include utils/meta.mk utils/help.mk

SHELL := /bin/bash
#COLORS
WHITE  := $(shell tput -Txterm setaf 7)
BLUE   := $(shell tput -Txterm setaf 6)
YELLOW := $(shell tput -Txterm setaf 3)
GREEN  := $(shell tput -Txterm setaf 2)
RESET  := $(shell tput -Txterm sgr0)

K8S_BUILD_DIR ?= ./build_k8s
K8S_FILES := $(shell find ./kubernetes -name '*.yaml' | sed 's:./kubernetes/::g')
K8S_FILES_EVM := $(shell find ./kubernetes-evm -name '*.yaml' | sed 's:./kubernetes-evm/::g')

run:
	@echo "$(BLUE)running action $(filter-out $@,$(MAKECMDGOALS))$(RESET)"
%:
@:

NETWORKS := $(patsubst .env.%,%,$(wildcard .env.*))
RELEASE_TAG := $(shell git describe --tags `git rev-list --tags --max-count=1` 2>/dev/null)

clean: ##@local Stop this instance and delete its containers and volumes (database included)
	@docker compose down --volumes --remove-orphans

$(NETWORKS): ##@local Switch .env to the named network (e.g. make jungle) and start
	@sed -e 's/REACT_APP_VERSION=dev/REACT_APP_VERSION=$(RELEASE_TAG)/g' ".env.$@" > ".env"
	@$(MAKE) --no-print-directory stop
	@$(MAKE) --no-print-directory start

stop: ##@local Stop all services
	@docker compose stop

start: ##@local Start backend services, then the webapp dev server in the foreground
	@$(MAKE) --no-print-directory start-backend
	@$(MAKE) --no-print-directory start-webapp

start-backend: ##@local Start postgres, hapi and hasura and wait until they are healthy
	@docker compose up -d --build --renew-anon-volumes --wait postgres hapi hasura

start-postgres:
	@docker compose up -d --build --wait postgres

start-wallet:
	@docker compose up -d --build --wait wallet

start-hapi:
	@docker compose up -d --build --renew-anon-volumes --wait hapi

start-hapi-evm:
	@docker compose up -d --build --renew-anon-volumes --wait hapi-evm

start-hasura:
	@docker compose up -d --build --wait hasura

start-webapp: ##@local Run the webapp dev server against the running backend
	@cd webapp && yarn && CI=true BROWSER=none yarn start:local | cat

console: ##@local Open the Hasura console (requires the hasura CLI)
	@cd hasura && hasura console --endpoint http://localhost:$${HASURA_PORT:-8080} --skip-update-check --no-browser --admin-secret $(HASURA_GRAPHQL_ADMIN_SECRET)

PLAYWRIGHT_VERSION := 1.55.0

smoke: ##@local Headless browser check of every webapp page (needs `make start` running)
	@mkdir -p smoke-results
	@docker run --rm --network host --user $$(id -u):$$(id -g) -e HOME=/tmp \
		-e SMOKE_EVM -e SMOKE_VERBOSE -e SMOKE_BASE_URL -e SMOKE_WAIT_MS \
		-v $(CURDIR)/scripts:/work/scripts:ro -v $(CURDIR)/smoke-results:/work/smoke-results \
		-w /work mcr.microsoft.com/playwright:v$(PLAYWRIGHT_VERSION)-noble \
		sh -c 'cd /tmp && npm install --silent --no-save playwright@$(PLAYWRIGHT_VERSION) >/dev/null && \
			cp /work/scripts/smoke-test.mjs /tmp/ && cd /work && node /tmp/smoke-test.mjs'

update-sitemaps:
	python3 ./scripts/updateSitemaps.py --path ./webapp/public/

add-language-webapp: ##copy en files in a new folder based on lang=
	@mkdir ./webapp/src/language/$(lang)
	@cp ./webapp/src/language/en/en.* ./webapp/src/language/$(lang)/
#	rename every file
	@file_names=$$(find ./webapp/src/language/$(lang)/ -name "en.*"); \
	for file in $$file_names; do \
		mv "$${file}" "$${file//en./$(lang).}"; \
	done
#	update import from /$(lang)/index.js
	@cp ./webapp/src/language/en/index.js ./webapp/src/language/$(lang)/index.js
	@file="./webapp/src/language/$(lang)/index.js"; \
	while IFS= read -r line; do \
	new_file="$${new_file}$${line//en/$(lang)}\n"; \
	done <"$${file}"; \
	echo -e "$${new_file}" > "$${file}"
	@echo "$${lang} added successfully"
	@echo "Now it can be important where it is needed"

logs: ##@local Follow backend logs
	@docker compose logs -f hapi hasura

build-kubernetes: ##@devops Generate proper k8s files based on the templates
build-kubernetes: ./kubernetes
	@echo "Build kubernetes files..."
	@rm -Rf $(K8S_BUILD_DIR) && mkdir -p $(K8S_BUILD_DIR)
	@for file in $(K8S_FILES); do \
		mkdir -p `dirname "$(K8S_BUILD_DIR)/$$file"`; \
		$(SHELL_EXPORT) envsubst <./kubernetes/$$file >$(K8S_BUILD_DIR)/$$file; \
	done

build-kubernetes-evm: ##@devops Generate proper k8s files based on the templates for evm
build-kubernetes-evm: ./kubernetes-evm
	@echo "Build kubernetes files for evm..."
	@mkdir -p $(K8S_BUILD_DIR)
	@for file in $(K8S_FILES_EVM); do \
		mkdir -p `dirname "$(K8S_BUILD_DIR)/$$file"`; \
		$(SHELL_EXPORT) envsubst <./kubernetes-evm/$$file >$(K8S_BUILD_DIR)/$$file; \
	done

deploy-kubernetes: ##@devops Publish the build k8s files
deploy-kubernetes: $(K8S_BUILD_DIR)
	@kubectl create ns $(NAMESPACE) || echo "Namespace '$(NAMESPACE)' already exists.";
	@echo "Creating SSL certificates..."
	@kubectl create secret tls \
		dashboard-tls-secret \
		--key ./ssl/antelope.tools.priv.key \
		--cert ./ssl/antelope.tools.crt \
		-n $(NAMESPACE)  || echo "SSL cert already configured.";
	@echo "Creating configmaps..."
	@kubectl create configmap -n $(NAMESPACE) \
	dashboard-wallet-config \
	--from-file wallet/config/ || echo "Wallet configuration already created.";
	@echo "Applying kubernetes files..."
	@for file in $(shell find $(K8S_BUILD_DIR) -name '*.yaml' | sed 's:$(K8S_BUILD_DIR)/::g'); do \
		kubectl apply -f $(K8S_BUILD_DIR)/$$file -n $(NAMESPACE) || echo "${file} Cannot be updated."; \
	done

build-docker-images: ##@devops Build docker images
build-docker-images:
	@echo "Building docker containers..."
	@for dir in $(SUBDIRS); do \
		$(MAKE) build-docker -C $$dir; \
	done

push-docker-images: ##@devops Publish docker images
push-docker-images:
	@echo $(DOCKER_PASSWORD) | docker login \
		--username $(DOCKER_USERNAME) \
		--password-stdin
	for dir in $(SUBDIRS); do \
		$(MAKE) push-image -C $$dir; \
	done

release: ##@devops Create Release for Version "make version=v1.3.xx release"
release:
	ifndef version
		$(error version is not set)
	endif
	@echo "Create release for version $(version)"
	@git tag -a $(version) -m "Create release tag $(version)"
	@git tag -a mainnet-$(version) -m "Create release tag mainnet-$(version)"
	@git tag -a xpr-$(version) -m "Create release tag xpr-$(version)"
	@git tag -a wax-$(version) -m "Create release tag wax-$(version)"
	@git tag -a telos-$(version) -m "Create release tag telos-$(version)"
	@git tag -a xpr-testnet-$(version) -m "Create release tag xpr-testnet-$(version)"
	@git tag -a wax-testnet-$(version) -m "Create release tag wax-testnet-$(version)"
	@git tag -a telos-testnet-$(version) -m "Create release tag telos-testnet-$(version)"
	@git push --tags

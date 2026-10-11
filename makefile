include utils/meta.mk utils/help.mk

SHELL := /bin/bash
#COLORS
WHITE  := $(shell tput -Txterm setaf 7)
BLUE   := $(shell tput -Txterm setaf 6)
YELLOW := $(shell tput -Txterm setaf 3)
GREEN  := $(shell tput -Txterm setaf 2)
RESET  := $(shell tput -Txterm sgr0)

NETWORKS := $(filter-out secrets example,$(patsubst .env.%,%,$(wildcard .env.*)))
RELEASE_TAG := $(shell git describe --tags `git rev-list --tags --max-count=1` 2>/dev/null)

secrets: ##@setup Create .env.secrets with random passwords (never overwrites an existing one)
	@if [ -f .env.secrets ]; then \
		echo ".env.secrets already exists; not changing it"; \
	else \
		umask 077; \
		{ echo "# Real credentials for this host. Not committed; keep a copy somewhere safe."; \
		  echo "# Layered over .env.<network> by make <network>."; \
		  echo "POSTGRES_PASSWORD=$$(python3 -c 'import secrets; print(secrets.token_hex(24))')"; \
		  echo "HASURA_GRAPHQL_ADMIN_SECRET=$$(python3 -c 'import secrets; print(secrets.token_hex(32))')"; \
		} > .env.secrets; \
		echo "created .env.secrets (readable only by you)"; \
	fi

clean: ##@development Stop this instance and delete its containers and volumes (database included)
	@docker compose down --volumes --remove-orphans

$(NETWORKS): ##@development Switch .env to the named network (e.g. make jungle) and start
	@sed -e 's/REACT_APP_VERSION=dev/REACT_APP_VERSION=$(RELEASE_TAG)/g' ".env.$@" > ".env"
	@if [ -f .env.secrets ]; then printf '\n# --- from .env.secrets ---\n' >> .env; cat .env.secrets >> .env; fi
	@$(MAKE) --no-print-directory stop
	@$(MAKE) --no-print-directory start

stop: ##@development Stop all services
	@docker compose stop

start: ##@development Start backend services, then the webapp dev server in the foreground
	@$(MAKE) --no-print-directory start-backend
	@$(MAKE) --no-print-directory start-webapp

start-backend: ##@development Start postgres, hapi and hasura and wait until they are healthy
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

start-webapp: ##@development Run the webapp dev server against the running backend
	@cd webapp && yarn && yarn dev

console: ##@development Open the Hasura console (requires the hasura CLI)
	@cd hasura && hasura console --endpoint http://localhost:$${HASURA_PORT:-8080} --skip-update-check --no-browser --admin-secret $(HASURA_GRAPHQL_ADMIN_SECRET)

PLAYWRIGHT_VERSION := 1.55.0

smoke: ##@development Headless browser check of every webapp page (SMOKE_BASE_URL=... for another URL)
	@mkdir -p smoke-results
	@docker run --rm --network host --user $$(id -u):$$(id -g) -e HOME=/tmp \
		-e SMOKE_EVM -e SMOKE_VERBOSE -e SMOKE_BASE_URL -e SMOKE_WAIT_MS \
		-v $(CURDIR)/scripts:/work/scripts:ro -v $(CURDIR)/smoke-results:/work/smoke-results \
		-w /work mcr.microsoft.com/playwright:v$(PLAYWRIGHT_VERSION)-noble \
		sh -c 'cd /tmp && npm install --silent --no-save playwright@$(PLAYWRIGHT_VERSION) >/dev/null && \
			cp /work/scripts/smoke-test.mjs /tmp/ && cd /work && node /tmp/smoke-test.mjs'

.PHONY: landing
landing: ##@development Serve the landing page (landing/) at http://localhost:8000
	@echo "landing page at http://localhost:8000"
	@python3 -m http.server 8000 --bind 0.0.0.0 --directory landing

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

logs: ##@development Follow backend logs
	@docker compose logs -f hapi hasura

# --- production -------------------------------------------------------------
# One stack per network (compose project antelope-<network>), see
# docs/deployment.md. Real credentials come from .env.secrets (make secrets).

PROD_COMPOSE = NETWORK=$(NETWORK) docker compose -p antelope-$(NETWORK) -f docker-compose.prod.yaml --env-file .deploy/$(NETWORK).env

prod-check:
	@if [ -z "$(NETWORK)" ]; then echo "usage: make $(MAKECMDGOALS) NETWORK=<network>  (one of: $(NETWORKS))"; exit 1; fi
	@if [ ! -f ".env.$(NETWORK)" ]; then echo "unknown network '$(NETWORK)' (one of: $(NETWORKS))"; exit 1; fi
	@if [ ! -f .env.secrets ]; then echo ".env.secrets is missing: run 'make secrets' first"; exit 1; fi

prod-env: prod-check
	@mkdir -p .deploy && chmod 700 .deploy
	@umask 077; { sed -e 's/REACT_APP_VERSION=dev/REACT_APP_VERSION=$(RELEASE_TAG)/' ".env.$(NETWORK)"; \
		printf '\n# --- from .env.secrets ---\n'; cat .env.secrets; } > .deploy/$(NETWORK).env
	@{ grep '^REACT_APP_' .deploy/$(NETWORK).env | grep -v '^REACT_APP_HASURA_URL='; \
		echo 'REACT_APP_HASURA_URL=/v1/graphql'; } > webapp/.env.build

prod-up: prod-env ##@production Build and start (or update) a network: make prod-up NETWORK=jungle
	@$(PROD_COMPOSE) up -d --build --wait
	@echo "antelope-$(NETWORK) is up on port $$(grep '^HTTP_PORT=' .deploy/$(NETWORK).env | cut -d= -f2)"

prod-down: prod-check ##@production Stop a network, keeping its database: make prod-down NETWORK=jungle
	@$(PROD_COMPOSE) down

prod-logs: prod-check ##@production Follow a network's logs: make prod-logs NETWORK=jungle
	@$(PROD_COMPOSE) logs -f --tail 100

prod-ps: ##@production List the running production stacks
	@docker ps --filter "label=com.docker.compose.project" --format '{{.Label "com.docker.compose.project"}}\t{{.Names}}\t{{.Status}}\t{{.Ports}}' | grep '^antelope-' | grep -v '^antelope-tools\b' | sort

landing-up: ##@production Start (or update) the landing page on LANDING_PORT (default 8100)
	@docker compose -p antelope-landing -f docker-compose.landing.yaml up -d --wait

landing-down: ##@production Stop the landing page
	@docker compose -p antelope-landing -f docker-compose.landing.yaml down

.PHONY: secrets clean stop start start-backend start-webapp smoke landing logs console prod-check prod-env prod-up prod-down prod-logs prod-ps landing-up landing-down

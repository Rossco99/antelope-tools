# .env values are available to make (e.g. $(HASURA_GRAPHQL_ADMIN_SECRET)) but
# deliberately NOT exported: docker compose gives exported variables priority
# over --env-file, which would leak the current dev .env into prod commands.
-include .env

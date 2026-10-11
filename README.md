<div align="center">
	<a href="https://antelope-tools.eosphere.io">
		<img src="webapp/public/antelope-tools.png" width="400">
	</a>
</div>

# Antelope Tools

**Open Infrastructure Data for the Antelope Ecosystem.** Antelope Tools is a network monitor for Antelope blockchains: Vaulta (EOS), Telos, WAX, XPR Network, Libre, FIO and their testnets. It shows each network's block producers, nodes, endpoints, rewards and CPU benchmarks in one place.

Live at **[antelope-tools.eosphere.io](https://antelope-tools.eosphere.io)**: pick a network to open its dashboard at `antelope-<network>.eosphere.io`.

Developed and operated by [EOSphere](https://eosphere.io).

## Contents

- [How it works](#how-it-works)
- [Development or production?](#development-or-production)
- [Requirements](#requirements)
- [Development](#development)
- [Production](#production)
- [Configuration](#configuration)
- [Testing](#testing)
- [Project layout](#project-layout)
- [Credits](#credits)
- [License](#license)

## How it works

Each network runs as its own copy of the stack: one network per instance, several instances per host.

| Service | What it does |
|---|---|
| **postgres** | Stores producers, nodes, endpoints, statistics and benchmark data |
| **hasura** | GraphQL API over the database, used by the webapp (queries and live subscriptions) |
| **hapi** | Backend workers: syncs producers and their `bp.json` files from the chain, checks endpoints, reads CPU benchmarks from Hyperion and, optionally, block history from a State History (SHiP) node |
| **webapp** | The dashboard (React, built with Vite) |
| **wallet** | `keosd` wallet, only needed for the testnet faucet |
| **hapi-evm** | EVM dashboard backend, currently parked (no working public EVM RPC endpoints) |

The landing page in [`landing/`](landing) lists every network and links to its dashboard.

Data comes from each chain's public API, every block producer's [bp.json](https://github.com/eosrio/bp-info-standard), Hyperion history nodes (CPU benchmark) and, if configured, a SHiP node (block history).

## Development or production?

The same repository runs in two different ways. **Use the right commands for the right machine.**

| | Development (sandbox, e.g. WSL) | Production (server) |
|---|---|---|
| Purpose | Working on and testing the code | Serving the public dashboards |
| Start a network | `make jungle` (or `make <network>`) | `make prod-up NETWORK=jungle` |
| Networks at once | One | All of them, each on its own port |
| Website | Vite dev server on port 3000, reloads on code changes, stops when the terminal closes | Built site served by nginx on the network's port (8101, 8102, ...) |
| Database and Hasura | Ports open on the host; Hasura console on | Not reachable from outside; console off; the public can only read |
| Passwords | Development values from `.env.<network>` (or `.env.secrets` if present) | `.env.secrets`, created by `make secrets` |
| After a reboot | Start it again | Restarts automatically |
| Compose file | `docker-compose.yaml` | `docker-compose.prod.yaml` and `docker-compose.landing.yaml` |

> **On the production server only use** `make secrets`, `make prod-*` and `make landing-up` / `landing-down`.
> The development commands (`make <network>`, `make start`, `make stop`, ...) start a separate development copy and do not touch the production stacks.

`make help` lists every command, grouped into *development*, *production* and *setup*.

## Requirements

Both:

- **Linux** (Ubuntu 24.04 recommended), or for development **Windows with WSL 2** (with systemd enabled in `/etc/wsl.conf`)
- **Docker Engine 24+ with the Compose plugin** (`docker compose`); your user in the `docker` group
- **git**, **make** and **Python 3**
- Outbound HTTPS access to each network's API and Hyperion endpoints

Development only:

- **Node.js 24 LTS** and **Yarn 1** (`sudo corepack enable`), for the webapp dev server

## Development

### Quick start

```bash
git clone -b dev-3.0 https://github.com/eosphere/antelope-tools.git
cd antelope-tools
make jungle
```

`make jungle` selects the Jungle4 testnet configuration, starts the backend in Docker and runs the webapp dev server in the foreground (Ctrl+C stops the dev server; the backend keeps running). When it is ready:

| | URL |
|---|---|
| Dashboard | http://localhost:3000 |
| Hasura GraphQL API | http://localhost:8080/v1/graphql |
| hapi health check | http://localhost:9090/healthz |

The first start takes a few minutes while images are built and producers are synced.

### Development commands

| Command | What it does |
|---|---|
| `make <network>` | Copy `.env.<network>` to `.env`, then start everything (e.g. `make mainnet`, `make wax`, `make fio`) |
| `make start` | Start everything with the current `.env` |
| `make start-backend` | Start postgres, hapi and hasura, and wait until they are healthy |
| `make start-webapp` | Run the webapp dev server against the running backend |
| `make console` | Open the Hasura console (needs the hasura CLI) |
| `make landing` | Serve the landing page at http://localhost:8000 |
| `make logs` | Follow the backend logs |
| `make smoke` | Headless browser check of every dashboard page (see [Testing](#testing)) |
| `make stop` | Stop the development containers |
| `make clean` | Remove the development containers **and their database** |

Available networks (`.env.<network>` files): `mainnet` (Vaulta/EOS), `jungle`, `wax`, `waxtestnet`, `telos`, `telostestnet`, `xpr`, `xprtestnet`, `libre`, `libretestnet`, `fio`, `fiotestnet`, `ultra`, `ultratestnet`, and `local` (for a local test chain).

Development runs one network at a time. To switch, run `make <other network>`; run `make clean` first for a fresh database.

### Building

Container images (hapi, hapi-evm, wallet; postgres and hasura use upstream images):

```bash
docker compose build
```

Webapp production build (static files in `webapp/build/`), using the settings in the root `.env`:

```bash
cd webapp
yarn install
yarn build      # yarn preview serves the build locally
```

In production `make prod-up` does this inside Docker (`webapp/Dockerfile`) and serves the result with nginx.

## Production

Each network runs as its own stack (compose project `antelope-<network>`) on its own port, behind EOSphere's HAProxy (which terminates SSL), plus a small container for the landing page. Everything restarts automatically after a crash or reboot.

First install on the server:

```bash
git clone -b dev-3.0 https://github.com/eosphere/antelope-tools.git ~/antelope-tools
cd ~/antelope-tools
make secrets                   # once per server: random passwords in .env.secrets (keep a copy safe)
make landing-up                # landing page on port 8100
make prod-up NETWORK=jungle    # one network on its HTTP_PORT (8102 for Jungle); repeat per network
make prod-ps                   # everything should be "healthy"
```

### Production commands

| Command | What it does |
|---|---|
| `make secrets` | Create `.env.secrets` with random passwords (once per server; never overwrites an existing one) |
| `make prod-up NETWORK=<network>` | Build and start a network, or update it after `git pull` |
| `make prod-ps` | List every running stack and its health |
| `make prod-logs NETWORK=<network>` | Follow a network's logs |
| `make prod-down NETWORK=<network>` | Stop a network (its database is kept) |
| `make landing-up` / `make landing-down` | Start or stop the landing page |

To update after changes are merged: `git pull`, then `make prod-up NETWORK=<network>` for each network.

Hasura runs with an admin secret, no console and read-only public access. See **[docs/deployment.md](docs/deployment.md)** for the server requirements, ports, the HAProxy configuration, checks, updates and backups.

## Configuration

All settings live in `.env.<network>` (one file per network, used by both development and production; `HTTP_PORT` is only used in production).

- **Development:** `make <network>` copies the chosen file to `.env` (not committed), which is what the development stack reads.
- **Production:** `make prod-up NETWORK=<network>` combines `.env.<network>` with `.env.secrets` into `.deploy/<network>.env` (not committed) for that network's stack.

Each file is grouped into sections:

- **Network:** chain ID, API endpoints (tried in order, with automatic failover) and display settings
- **Hyperion - CPU benchmark:** `HAPI_EOS_HYPERION_ENDPOINTS` lists Hyperion history nodes. The CPU Benchmark page reads the `eosmechanics::cpu` actions run on the network from them, and `REACT_APP_USE_CPU_BENCHMARK` shows or hides the page. Leave the list empty on networks without benchmark data.
- **State History (SHiP) - optional:** `HAPI_EOS_STATE_HISTORY_PLUGIN_ENDPOINT` streams blocks from a node's state history plugin. This enables the Dashboard's history charts and the Block Distribution and Missed Blocks pages; set `REACT_APP_STATE_HISTORY_ENABLED=true` with it.
- **EVM dashboard (hapi-evm) - parked:** kept for later, hidden until working EVM RPC endpoints exist.
- **Webapp:** title, logos, footer links, block explorer, the network switcher (`REACT_APP_NETWORK_URL`) and pages to hide (`REACT_APP_DISABLED_MENU_ITEMS`)

The landing page's network list is [`landing/networks.json`](landing/networks.json): one line per network (name, URL and logo).

### Passwords and secrets

The committed `.env.<network>` files contain **development values only** (`POSTGRES_PASSWORD=antelope-dev-password`, `HASURA_GRAPHQL_ADMIN_SECRET=antelope-dev-admin-secret`). Each secret is defined once; the compose files build the database URLs and hapi's Hasura secret from them.

On a production server, run `make secrets` once. It creates `.env.secrets` (not committed, readable only by your user) with strong random values; `make prod-up` requires it and layers it over the network's settings (in development `make <network>` uses it too, if present). Keep a copy of `.env.secrets` somewhere safe: the database password is set when a network's database is first created.

The database user and database name are both `antelope`.

## Testing

`make smoke` opens every dashboard page in a headless Chromium (the Playwright Docker image, so nothing extra to install), saves screenshots to `smoke-results/` and fails on page errors, GraphQL errors and unexpected redirects to `/404`.

- **Development:** run it against the dev server (`make start-webapp`) and against a production build (`cd webapp && yarn build && yarn preview --port 3000`) after any change.
- **Production:** point it at a network, e.g. `SMOKE_BASE_URL=http://localhost:8102 make smoke` on the server, or `SMOKE_BASE_URL=https://antelope-jungle.eosphere.io make smoke` from anywhere.

GitHub Actions runs the same check on every pull request (it builds the Jungle production stack from scratch).

## Project layout

```
antelope-tools/
├── .env.<network>       network configurations
├── docker-compose.yaml  development stack for one network
├── docker-compose.prod.yaml  production stack for one network
├── docker-compose.landing.yaml  production landing page
├── deploy/              production config (landing page nginx)
├── makefile             the commands above
├── hapi/                backend workers (Node.js)
├── hapi-evm/            EVM dashboard backend (TypeScript, parked)
├── hasura/              database migrations and GraphQL metadata
├── webapp/              the dashboard (React + Vite)
├── landing/             landing page and networks.json
├── wallet/              keosd wallet image (Spring)
├── scripts/             smoke test and helpers
└── docs/                API and wallet documentation
```

More documentation:

- [Production deployment](docs/deployment.md)
- [Producers REST API](docs/producers-API-documentation.md)
- [Wallet configuration](docs/wallet-config.md) (testnet faucet only)

## Credits

Antelope Tools was originally created by [Edenia](https://edenia.com) (formerly EOS Costa Rica) and is now developed and operated by [EOSphere](https://eosphere.io).

Questions and ideas: [Telegram](https://t.me/eosphere_io) · [X](https://x.com/eosphere_io)

## License

[MIT](LICENSE)

# Production deployment

Antelope Tools runs on one app server behind EOSphere's HAProxy front end:

```
Internet ──HTTPS──▶ HAProxy (separate machine, *.eosphere.io certificate)
                      │ plain HTTP, routed by hostname
                      ├─ antelope-tools.eosphere.io       ─▶ app-server:8100  landing page
                      ├─ antelope-eos.eosphere.io         ─▶ app-server:8101  Vaulta (EOS)
                      ├─ antelope-jungle.eosphere.io      ─▶ app-server:8102  Jungle4
                      └─ antelope-<network>.eosphere.io   ─▶ app-server:81xx  (HTTP_PORT in .env.<network>)
```

Each network is its own Docker Compose project (`antelope-<network>`) with postgres, hapi, hasura and the webapp. Only the webapp port is published. Its nginx serves the dashboard and proxies `/v1/graphql` (including the live websocket), `/api/rest/` and `/healthz` to that network's Hasura.

| Network | `make prod-up NETWORK=` | Port | Hostname |
|---|---|---|---|
| Landing page | `make landing-up` | 8100 | antelope-tools.eosphere.io |
| Vaulta (EOS) | `mainnet` | 8101 | antelope-eos.eosphere.io |
| Jungle4 | `jungle` | 8102 | antelope-jungle.eosphere.io |
| WAX | `wax` | 8103 | antelope-wax.eosphere.io |
| WAX Testnet | `waxtestnet` | 8104 | antelope-wax-testnet.eosphere.io |
| Telos | `telos` | 8105 | antelope-telos.eosphere.io |
| Telos Testnet | `telostestnet` | 8106 | antelope-telos-testnet.eosphere.io |
| XPR Network | `xpr` | 8107 | antelope-xpr.eosphere.io |
| XPR Testnet | `xprtestnet` | 8108 | antelope-xpr-testnet.eosphere.io |
| Libre | `libre` | 8109 | antelope-libre.eosphere.io |
| Libre Testnet | `libretestnet` | 8110 | antelope-libre-testnet.eosphere.io |
| FIO | `fio` | 8111 | antelope-fio.eosphere.io |
| FIO Testnet | `fiotestnet` | 8112 | antelope-fio-testnet.eosphere.io |
| Ultra Testnet | `ultratestnet` | 8113 | antelope-ultra-testnet.eosphere.io |

## 1. App server

- Ubuntu 24.04 (or similar), Docker Engine 24+ with the Compose plugin, git, make, Python 3
- A user for the app (e.g. `antelope`) in the `docker` group
- Firewall: allow ports **8100-8199 only from the HAProxy machine**; nothing else needs to be reachable from outside apart from SSH
- Sizing: about 1-1.5 GB RAM per network (16 GB for 6-7 networks), 4 cores, a few GB of disk per network (much more if SHiP block history is enabled)

## 2. First install

```bash
# eosphere/antelope-tools, or the fork the work is developed in (e.g. Rossco99/antelope-tools)
git clone -b dev-3.0 https://github.com/eosphere/antelope-tools.git
cd antelope-tools

make secrets          # creates .env.secrets with random passwords; keep a copy somewhere safe
make landing-up       # landing page on port 8100
make prod-up NETWORK=jungle
make prod-up NETWORK=mainnet
make prod-ps          # what is running
```

`make prod-up` builds the images, starts the stack and waits until every container is healthy. The first sync of producers takes a few minutes.

## 3. HAProxy

The network stacks speak plain HTTP; HAProxy terminates SSL with the `*.eosphere.io` certificate. Add to the existing HTTPS frontend (replace `APP_SERVER` with the app server's address):

```
frontend https-in
    # ... existing bind/certificate lines ...

    # antelope.eosphere.io -> landing page
    http-request redirect location https://antelope-tools.eosphere.io%[capture.req.uri] code 301 if { hdr(host) -i antelope.eosphere.io }

    use_backend antelope_landing if { hdr(host) -i antelope-tools.eosphere.io }
    use_backend antelope_eos     if { hdr(host) -i antelope-eos.eosphere.io }
    use_backend antelope_jungle  if { hdr(host) -i antelope-jungle.eosphere.io }
    # ... one line per network ...

backend antelope_landing
    option httpchk GET /healthz
    server app1 APP_SERVER:8100 check

backend antelope_eos
    option httpchk GET /healthz
    timeout tunnel 1h           # keeps the dashboard's live websocket open
    server app1 APP_SERVER:8101 check

backend antelope_jungle
    option httpchk GET /healthz
    timeout tunnel 1h
    server app1 APP_SERVER:8102 check
```

Each network backend's `/healthz` reports that network's Hasura, so HAProxy marks a network down when its stack is not working.

DNS: point `antelope-tools.eosphere.io`, `antelope.eosphere.io` and each `antelope-<network>.eosphere.io` at the HAProxy machine.

## 4. Updating

```bash
cd antelope-tools
git pull
make prod-up NETWORK=jungle     # rebuilds and restarts only what changed; repeat per network
make landing-up                 # landing page changes are live immediately (files are mounted)
```

Database migrations are applied automatically when Hasura restarts.

## 5. Day to day

| Command | What it does |
|---|---|
| `make prod-ps` | List every running stack and its health |
| `make prod-logs NETWORK=jungle` | Follow a network's logs |
| `make prod-down NETWORK=jungle` | Stop a network (its database volume is kept) |
| `make prod-up NETWORK=jungle` | Start or update a network |
| `make landing-up` / `make landing-down` | Start or stop the landing page |

Containers restart automatically after a crash or a server reboot.

## 6. Secrets

- `.env.secrets` (created by `make secrets`, readable only by its owner) holds `POSTGRES_PASSWORD` and `HASURA_GRAPHQL_ADMIN_SECRET`. It is never committed.
- `make prod-up` combines `.env.<network>` and `.env.secrets` into `.deploy/<network>.env` (also not committed, readable only by its owner).
- Postgres stores the password when a network's database is first created. Changing `POSTGRES_PASSWORD` later also requires changing it inside each database, or recreating it.
- Hasura runs with the admin secret, the console off, and anonymous visitors limited to the read-only `guest` role.

## 7. Backups

The database can be rebuilt from the chains (producers, nodes and endpoints resync on start), but history such as CPU benchmarks, endpoint checks and SHiP block history would be lost. To back up a network:

```bash
docker exec antelope-jungle-postgres-1 pg_dump -U antelope antelope | gzip > jungle-$(date +%F).sql.gz
```

## 8. Adding a network

1. Create `.env.<network>` (copy a similar network) and give it an unused `HTTP_PORT`.
2. Add it to `landing/networks.json` and to `REACT_APP_NETWORK_URL` in the other env files.
3. `make prod-up NETWORK=<network>`, then add the HAProxy `use_backend` line and backend, and the DNS record.

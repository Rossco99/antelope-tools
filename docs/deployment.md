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
| Vaulta (EOS) | `mainnet` | 8101 | antelope-eos.eosphere.io (alias: antelope-vaulta.eosphere.io) |
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
| Ultra | `ultra` | 8114 | antelope-ultra.eosphere.io |

## 1. App server

- Ubuntu 24.04 (or similar), Docker Engine 24+ with the Compose plugin, git, make, Python 3
- A user for the app (e.g. `antelope`) in the `docker` group
- Network: ports 8100-8199 must be reachable from the HAProxy machine. The stacks need outbound HTTPS to each network's API and Hyperion endpoints. If the server has a public address, keep 8100-8199 closed to the internet (EOSphere's server sits behind an upstream firewall)
- Sizing: about 1-1.5 GB RAM per network (16 GB for 6-7 networks), 4 cores, a few GB of disk per network (much more if SHiP block history is enabled)

## 2. First install

```bash
# eosphere/antelope-tools, or the fork the work is developed in (e.g. Rossco99/antelope-tools)
cd ~
git clone -b dev-3.0 https://github.com/eosphere/antelope-tools.git
cd antelope-tools

make secrets          # creates .env.secrets with random passwords; keep a copy somewhere safe
make landing-up       # landing page on port 8100
make prod-up NETWORK=jungle
make prod-up NETWORK=mainnet
make prod-ps          # what is running
```

`make prod-up` builds the images, starts the stack and waits until every container is healthy. The first build takes several minutes; later ones reuse the cached layers. Producers sync within a minute or two of start.

Check each network directly on the app server before pointing HAProxy at it:

```bash
curl http://localhost:8100/healthz     # landing page: ok
curl http://localhost:8102/healthz     # Jungle: ok when its Hasura is up
curl -s http://localhost:8102/v1/graphql -H 'content-type: application/json' \
  -d '{"query":"{ producer_aggregate { aggregate { count } } }"}'   # count above 0
```

Then open `http://APP_SERVER:8102` in a browser (from an address that can reach it).

**If `make prod-up` fails with Hasura unhealthy** and `make prod-logs NETWORK=<network>` shows `password authentication failed`, that network's database was created with different secrets (for example `.env.secrets` was recreated). On a new install, delete the empty database and start again: `NETWORK=<network> docker compose -p antelope-<network> -f docker-compose.prod.yaml --env-file .deploy/<network>.env down -v`, then `make prod-up NETWORK=<network>`.

## 3. HAProxy

The network stacks speak plain HTTP; HAProxy terminates SSL with the `*.eosphere.io` certificate. Add to the existing HTTPS frontend, before any catch-all rules (replace `APP_SERVER` with the app server's address, e.g. `10.0.0.112`):

```
    # --- Antelope Tools ---
    acl antelope_redirect_acl          hdr(host) -i antelope.eosphere.io
    acl antelope_landing_acl           hdr(host) -i antelope-tools.eosphere.io
    acl antelope_eos_acl               hdr(host) -i antelope-eos.eosphere.io
    acl antelope_vaulta_acl            hdr(host) -i antelope-vaulta.eosphere.io
    acl antelope_jungle_acl            hdr(host) -i antelope-jungle.eosphere.io
    acl antelope_wax_acl               hdr(host) -i antelope-wax.eosphere.io
    acl antelope_wax_testnet_acl       hdr(host) -i antelope-wax-testnet.eosphere.io
    acl antelope_telos_acl             hdr(host) -i antelope-telos.eosphere.io
    acl antelope_telos_testnet_acl     hdr(host) -i antelope-telos-testnet.eosphere.io
    acl antelope_xpr_acl               hdr(host) -i antelope-xpr.eosphere.io
    acl antelope_xpr_testnet_acl       hdr(host) -i antelope-xpr-testnet.eosphere.io
    acl antelope_libre_acl             hdr(host) -i antelope-libre.eosphere.io
    acl antelope_libre_testnet_acl     hdr(host) -i antelope-libre-testnet.eosphere.io
    acl antelope_fio_acl               hdr(host) -i antelope-fio.eosphere.io
    acl antelope_fio_testnet_acl       hdr(host) -i antelope-fio-testnet.eosphere.io
    acl antelope_ultra_testnet_acl     hdr(host) -i antelope-ultra-testnet.eosphere.io
    acl antelope_ultra_acl             hdr(host) -i antelope-ultra.eosphere.io

    # antelope.eosphere.io -> landing page
    http-request redirect location https://antelope-tools.eosphere.io%[capture.req.uri] code 301 if antelope_redirect_acl

    use_backend antelope_landing_servers       if antelope_landing_acl { path_beg / }
    use_backend antelope_eos_servers           if antelope_eos_acl { path_beg / }
    use_backend antelope_eos_servers           if antelope_vaulta_acl { path_beg / }
    use_backend antelope_jungle_servers        if antelope_jungle_acl { path_beg / }
    use_backend antelope_wax_servers           if antelope_wax_acl { path_beg / }
    use_backend antelope_wax_testnet_servers   if antelope_wax_testnet_acl { path_beg / }
    use_backend antelope_telos_servers         if antelope_telos_acl { path_beg / }
    use_backend antelope_telos_testnet_servers if antelope_telos_testnet_acl { path_beg / }
    use_backend antelope_xpr_servers           if antelope_xpr_acl { path_beg / }
    use_backend antelope_xpr_testnet_servers   if antelope_xpr_testnet_acl { path_beg / }
    use_backend antelope_libre_servers         if antelope_libre_acl { path_beg / }
    use_backend antelope_libre_testnet_servers if antelope_libre_testnet_acl { path_beg / }
    use_backend antelope_fio_servers           if antelope_fio_acl { path_beg / }
    use_backend antelope_fio_testnet_servers   if antelope_fio_testnet_acl { path_beg / }
    use_backend antelope_ultra_testnet_servers if antelope_ultra_testnet_acl { path_beg / }
    use_backend antelope_ultra_servers         if antelope_ultra_acl { path_beg / }
```

And the backends:

```
backend antelope_landing_servers
    option httpchk GET /healthz
    timeout queue 10s
    stick-table type ip size 50k expire 30s store http_req_rate(5s)
    http-request track-sc2 src
    http-request deny deny_status 429 if { sc_http_req_rate(2) gt 150 }
    server antelope APP_SERVER:8100 check maxconn 200

backend antelope_eos_servers
    option httpchk GET /healthz
    timeout tunnel 1h
    timeout queue 10s
    stick-table type ip size 50k expire 30s store http_req_rate(5s)
    http-request track-sc2 src
    http-request deny deny_status 429 if { sc_http_req_rate(2) gt 300 }
    server antelope APP_SERVER:8101 check maxconn 500

backend antelope_jungle_servers
    option httpchk GET /healthz
    timeout tunnel 1h
    timeout queue 10s
    stick-table type ip size 50k expire 30s store http_req_rate(5s)
    http-request track-sc2 src
    http-request deny deny_status 429 if { sc_http_req_rate(2) gt 300 }
    server antelope APP_SERVER:8102 check maxconn 500

backend antelope_wax_servers
    option httpchk GET /healthz
    timeout tunnel 1h
    timeout queue 10s
    stick-table type ip size 50k expire 30s store http_req_rate(5s)
    http-request track-sc2 src
    http-request deny deny_status 429 if { sc_http_req_rate(2) gt 300 }
    server antelope APP_SERVER:8103 check maxconn 500

backend antelope_wax_testnet_servers
    option httpchk GET /healthz
    timeout tunnel 1h
    timeout queue 10s
    stick-table type ip size 50k expire 30s store http_req_rate(5s)
    http-request track-sc2 src
    http-request deny deny_status 429 if { sc_http_req_rate(2) gt 300 }
    server antelope APP_SERVER:8104 check maxconn 500

backend antelope_telos_servers
    option httpchk GET /healthz
    timeout tunnel 1h
    timeout queue 10s
    stick-table type ip size 50k expire 30s store http_req_rate(5s)
    http-request track-sc2 src
    http-request deny deny_status 429 if { sc_http_req_rate(2) gt 300 }
    server antelope APP_SERVER:8105 check maxconn 500

backend antelope_telos_testnet_servers
    option httpchk GET /healthz
    timeout tunnel 1h
    timeout queue 10s
    stick-table type ip size 50k expire 30s store http_req_rate(5s)
    http-request track-sc2 src
    http-request deny deny_status 429 if { sc_http_req_rate(2) gt 300 }
    server antelope APP_SERVER:8106 check maxconn 500

backend antelope_xpr_servers
    option httpchk GET /healthz
    timeout tunnel 1h
    timeout queue 10s
    stick-table type ip size 50k expire 30s store http_req_rate(5s)
    http-request track-sc2 src
    http-request deny deny_status 429 if { sc_http_req_rate(2) gt 300 }
    server antelope APP_SERVER:8107 check maxconn 500

backend antelope_xpr_testnet_servers
    option httpchk GET /healthz
    timeout tunnel 1h
    timeout queue 10s
    stick-table type ip size 50k expire 30s store http_req_rate(5s)
    http-request track-sc2 src
    http-request deny deny_status 429 if { sc_http_req_rate(2) gt 300 }
    server antelope APP_SERVER:8108 check maxconn 500

backend antelope_libre_servers
    option httpchk GET /healthz
    timeout tunnel 1h
    timeout queue 10s
    stick-table type ip size 50k expire 30s store http_req_rate(5s)
    http-request track-sc2 src
    http-request deny deny_status 429 if { sc_http_req_rate(2) gt 300 }
    server antelope APP_SERVER:8109 check maxconn 500

backend antelope_libre_testnet_servers
    option httpchk GET /healthz
    timeout tunnel 1h
    timeout queue 10s
    stick-table type ip size 50k expire 30s store http_req_rate(5s)
    http-request track-sc2 src
    http-request deny deny_status 429 if { sc_http_req_rate(2) gt 300 }
    server antelope APP_SERVER:8110 check maxconn 500

backend antelope_fio_servers
    option httpchk GET /healthz
    timeout tunnel 1h
    timeout queue 10s
    stick-table type ip size 50k expire 30s store http_req_rate(5s)
    http-request track-sc2 src
    http-request deny deny_status 429 if { sc_http_req_rate(2) gt 300 }
    server antelope APP_SERVER:8111 check maxconn 500

backend antelope_fio_testnet_servers
    option httpchk GET /healthz
    timeout tunnel 1h
    timeout queue 10s
    stick-table type ip size 50k expire 30s store http_req_rate(5s)
    http-request track-sc2 src
    http-request deny deny_status 429 if { sc_http_req_rate(2) gt 300 }
    server antelope APP_SERVER:8112 check maxconn 500

backend antelope_ultra_testnet_servers
    option httpchk GET /healthz
    timeout tunnel 1h
    timeout queue 10s
    stick-table type ip size 50k expire 30s store http_req_rate(5s)
    http-request track-sc2 src
    http-request deny deny_status 429 if { sc_http_req_rate(2) gt 300 }
    server antelope APP_SERVER:8113 check maxconn 500

backend antelope_ultra_servers
    option httpchk GET /healthz
    timeout tunnel 1h
    timeout queue 10s
    stick-table type ip size 50k expire 30s store http_req_rate(5s)
    http-request track-sc2 src
    http-request deny deny_status 429 if { sc_http_req_rate(2) gt 300 }
    server antelope APP_SERVER:8114 check maxconn 500
```

Each network backend's `/healthz` reports that network's Hasura, so HAProxy marks a network down when its stack is not working.

- `timeout tunnel 1h` keeps the dashboard's live websocket open; the landing page has none.
- `maxconn 500` per network allows about 500 dashboards open at once (each holds one websocket); more wait up to `timeout queue 10s`, then get a 503.
- The stick table limits each client IP to 300 requests per 5 seconds per dashboard (150 for the landing page), well above a first page load, and answers 429 above that. It uses counter `sc2` because EOSphere's frontend already tracks `sc0` and `sc1`; use whichever counter is free in your config (`tune.stick-counters` in `global` adds more). `antelope-vaulta.eosphere.io` is an alias served by the EOS backend. Check the file with `haproxy -c -f /etc/haproxy/haproxy.cfg` before reloading.

DNS: point `antelope-tools.eosphere.io`, `antelope.eosphere.io`, `antelope-vaulta.eosphere.io` and each `antelope-<network>.eosphere.io` at the HAProxy machine.

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

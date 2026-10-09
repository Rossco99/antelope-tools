# Dashboard wallet creation and configuration

The wallet service (keosd) holds the key of the account hapi signs with. It is
only needed on testnets that offer the faucet (account creation and test token
transfers); the CPU benchmark reads data from Hyperion and needs no keys.

Inside the wallet container, create a wallet named after the faucet's base
account:

```bash
cleos --wallet-url http://localhost:8888 wallet create -n <base account> --to-console
```

The returned password (a string starting with PW...) goes in the environment
variables:

```bash
HAPI_EOS_BASE_ACCOUNT=<base account>
HAPI_EOS_BASE_ACCOUNT_PASSWORD=PW...
```

Import the base account's private key and check the wallet:

```bash
cleos --wallet-url http://localhost:8888 wallet import -n <base account>
cleos --wallet-url http://localhost:8888 wallet list
```

If the wallet is listed but locked, unlock it:

```bash
cleos --wallet-url http://localhost:8888 wallet unlock -n <base account>
```

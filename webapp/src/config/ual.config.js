import { Anchor } from 'ual-anchor'

const appName = import.meta.env.REACT_APP_EOS_APP_NAME || 'antelopetools'
const network = {
  chainId:
    import.meta.env.REACT_APP_EOS_CHAIN_ID ||
    '73e4385a2708e6d7048834fbc1079f2fabb17b3c125b146af438971e90716c4d',
  rpcEndpoints: [
    {
      blockchain: 'eos',
      protocol: import.meta.env.REACT_APP_EOS_API_PROTOCOL || 'https',
      host:
        JSON.parse(import.meta.env.REACT_APP_EOS_API_HOSTS)[0] ||
        'jungle.eosusa.io',
      port: parseInt(import.meta.env.REACT_APP_EOS_API_PORT || '443'),
    },
  ],
}
const authenticators = [new Anchor([network], { appName })]

export const ualConfig = {
  appName,
  network,
  authenticators,
}

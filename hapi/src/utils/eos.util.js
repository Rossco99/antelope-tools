const {
  ABI,
  Action,
  API,
  PackedTransaction,
  PrivateKey,
  PublicKey,
  Serializer,
  SignedTransaction,
  Transaction
} = require('@wharfkit/antelope')

const { eosConfig } = require('../config')

const walletUtil = require('./wallet.util')

const REQUEST_TIMEOUT = 30000
const waitRequestInterval = 300000
const endpoints = eosConfig.apiEndpoints.map(url => ({
  url,
  lastFailureTime: 0
}))

// The node answered with an error (unknown account, failed assertion, ...).
// Unlike network errors and timeouts, this doesn't mean the endpoint is down.
class ChainError extends Error {}

const post = async (url, path, body = {}) => {
  let response

  try {
    response = await fetch(`${url}${path}`, {
      method: 'POST',
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT)
    })
  } catch (error) {
    if (error.name === 'TimeoutError') {
      throw new Error(
        `timeout error: the endpoint took more than ${REQUEST_TIMEOUT} ms to respond`
      )
    }

    throw error
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    if (data?.error) {
      const details = data.error.details?.[0]?.message

      throw new ChainError(
        `${data.error.what || data.message}${details ? `: ${details}` : ''}`
      )
    }

    throw new Error(`${response.status} ${response.statusText}`)
  }

  return data
}

const callEosApi = async (funcName, path, body) => {
  for (const endpoint of endpoints) {
    const diffTime = new Date() - endpoint.lastFailureTime

    if (diffTime < waitRequestInterval) continue

    try {
      return await post(endpoint.url, path, body)
    } catch (error) {
      if (error instanceof ChainError) throw error

      endpoint.lastFailureTime = new Date()

      console.error(
        `WARNING ${funcName} => ${endpoint.url} has failed: \n`,
        error.message
      )
    }
  }

  throw new Error(
    `Each endpoint failed when trying to execute the function ${funcName}`
  )
}

const callWithTimeout = async (promise, ms) => {
  let timeoutID
  const timeoutMessage = `timeout error: the endpoint took more than ${ms} ms to respond`
  const timeoutPromise = new Promise((_resolve, reject) => {
    timeoutID = setTimeout(() => reject(new Error(timeoutMessage)), ms)
  })

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutID)
  })
}

const getAbi = account =>
  callEosApi('getAbi', '/v1/chain/get_abi', { account_name: account })

const getAccount = async account => {
  try {
    return await callEosApi('getAccount', '/v1/chain/get_account', {
      account_name: account
    })
  } catch (error) {
    return null
  }
}

const getBlock = blockNumber =>
  callEosApi('getBlock', '/v1/chain/get_block', {
    block_num_or_id: blockNumber
  })

const getCodeHash = account =>
  callEosApi('getCodeHash', '/v1/chain/get_code_hash', {
    account_name: account
  })

const getCurrencyBalance = (code, account, symbol) =>
  callEosApi('getCurrencyBalance', '/v1/chain/get_currency_balance', {
    code,
    account,
    symbol
  })

const getTableRows = options =>
  callEosApi('getTableRows', '/v1/chain/get_table_rows', {
    json: true,
    ...options
  })

const getProducerSchedule = () =>
  callEosApi('getProducerSchedule', '/v1/chain/get_producer_schedule')

const getCurrencyStats = options =>
  callEosApi('getCurrencyStats', '/v1/chain/get_currency_stats', options)

const getProducers = options =>
  callEosApi('getProducers', '/v1/chain/get_producers', options)

const getInfo = () => callEosApi('getInfo', '/v1/chain/get_info')

// Build, sign and push a transaction with the given private keys, signing only
// with the keys the chain says are required (extra signatures are rejected)
const signAndPush = async (actions, privateKeys) => {
  const info = API.v1.GetInfoResponse.from(await getInfo())
  const abis = {}

  for (const account of new Set(actions.map(action => action.account))) {
    abis[account] = ABI.from((await getAbi(account)).abi)
  }

  const transaction = Transaction.from({
    ...info.getTransactionHeader(30),
    actions: actions.map(action => Action.from(action, abis[action.account]))
  })
  const keys = privateKeys.map(key => PrivateKey.from(key))
  const { required_keys: requiredKeys } = await callEosApi(
    'getRequiredKeys',
    '/v1/chain/get_required_keys',
    {
      transaction: Serializer.objectify(transaction),
      available_keys: keys.map(key => String(key.toPublic()))
    }
  )
  const digest = transaction.signingDigest(info.chain_id)
  const signatures = requiredKeys.map(required => {
    const publicKey = PublicKey.from(required)

    return keys
      .find(key => key.toPublic().equals(publicKey))
      .signDigest(digest)
  })
  const packed = PackedTransaction.fromSigned(
    SignedTransaction.from({ ...transaction, signatures })
  )

  return callEosApi(
    'pushTransaction',
    '/v1/chain/push_transaction',
    Serializer.objectify(packed)
  )
}

const transact = async (actions, account, password) => {
  try {
    await walletUtil.unlock(account, password)
  } catch (error) {}

  try {
    const keys = await walletUtil.listKeys(account, password)

    return await signAndPush(actions, keys)
  } finally {
    await walletUtil.lock(account)
  }
}

const newAccount = async accountName => {
  const password = await walletUtil.create(accountName)
  const key = await walletUtil.createKey(accountName)
  const authorization = [
    {
      actor: eosConfig.baseAccount,
      permission: 'active'
    }
  ]
  const authority = {
    threshold: 1,
    keys: [{ key, weight: 1 }],
    accounts: [],
    waits: []
  }
  const transaction = await transact(
    [
      {
        authorization,
        account: 'eosio',
        name: 'newaccount',
        data: {
          creator: eosConfig.baseAccount,
          name: accountName,
          owner: authority,
          active: authority
        }
      },
      {
        authorization,
        account: 'eosio',
        name: 'buyrambytes',
        data: {
          payer: eosConfig.baseAccount,
          receiver: accountName,
          bytes: 4096
        }
      },
      {
        authorization,
        account: 'eosio',
        name: 'delegatebw',
        data: {
          from: eosConfig.baseAccount,
          receiver: accountName,
          stake_net_quantity: '1.0000 EOS',
          stake_cpu_quantity: '1.0000 EOS',
          transfer: false
        }
      }
    ],
    eosConfig.baseAccount,
    eosConfig.baseAccountPassword
  )

  return {
    password,
    transaction
  }
}

const generateRandomAccountName = async (prefix = '') => {
  const length = 12

  if (prefix.length === 12) return prefix

  const characters = 'abcdefghijklmnopqrstuvwxyz12345'
  let accountName = prefix

  while (accountName.length < length) {
    accountName = `${accountName}${characters.charAt(
      Math.floor(Math.random() * characters.length)
    )}`
  }

  const account = await getAccount(accountName)

  return account ? generateRandomAccountName(prefix) : accountName
}

module.exports = {
  callWithTimeout,
  newAccount,
  generateRandomAccountName,
  getAccount,
  getBlock,
  getAbi,
  getCodeHash,
  getCurrencyBalance,
  getTableRows,
  transact,
  getProducerSchedule,
  getCurrencyStats,
  getProducers,
  getInfo
}

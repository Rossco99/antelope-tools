import { eosConfig } from '../config'

export const ENDPOINTS_ERROR =
  'Each endpoint failed when trying to execute the function'

const waitRequestInterval = 120000
const timeout = 60000
const endpoints = eosConfig.endpoints.map(endpoint => ({
  endpoint,
  lastFailureTime: 0,
}))

// The node answered with an error (e.g. unknown account). The message is the
// node's JSON error body, which callers parse for details.
class ChainError extends Error {}

const post = async (endpoint, path, body = {}) => {
  let response

  try {
    response = await fetch(`${endpoint}${path}`, {
      method: 'POST',
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeout),
    })
  } catch (error) {
    if (error.name === 'TimeoutError') {
      throw new Error(
        `timeout error: the endpoint took more than ${timeout} ms to respond`,
      )
    }

    throw error
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    if (data?.error) throw new ChainError(JSON.stringify(data))

    throw new Error(`${response.status} ${response.statusText}`)
  }

  return data
}

const callEosApi = async (path, body) => {
  for (const api of endpoints) {
    const diffTime = new Date() - api.lastFailureTime

    if (diffTime < waitRequestInterval) continue

    try {
      const response = await post(api.endpoint, path, body)
      const headBlockTime = response.head_block_time

      if (headBlockTime) {
        const nowUTC = new Date()

        nowUTC.setMinutes(nowUTC.getMinutes() + nowUTC.getTimezoneOffset())

        const diffBlockTimems = nowUTC - new Date(headBlockTime)

        if (diffBlockTimems > eosConfig.syncToleranceInterval) {
          throw new Error(`The endpoint ${api.endpoint} is outdated`)
        }
      }

      return response
    } catch (error) {
      if (error instanceof ChainError) throw error

      api.lastFailureTime = new Date()
    }
  }

  throw new Error(ENDPOINTS_ERROR)
}

const getAbi = account =>
  callEosApi('/v1/chain/get_abi', { account_name: account })

const getAccount = account =>
  callEosApi('/v1/chain/get_account', { account_name: account })

const getBlock = block =>
  callEosApi('/v1/chain/get_block', { block_num_or_id: block })

const getCodeHash = account =>
  callEosApi('/v1/chain/get_code_hash', { account_name: account })

const getInfo = () => callEosApi('/v1/chain/get_info')

const getProducers = payload =>
  callEosApi('/v1/chain/get_producers', payload)

const getProducerSchedule = () =>
  callEosApi('/v1/chain/get_producer_schedule')

const getTableRows = payload =>
  callEosApi('/v1/chain/get_table_rows', { json: true, ...payload })

export default {
  getAbi,
  getAccount,
  getBlock,
  getCodeHash,
  getInfo,
  getProducers,
  getProducerSchedule,
  getTableRows,
}

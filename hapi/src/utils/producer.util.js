const axiosUtil = require('./axios.util')
const eosUtil = require('./eos.util')
const net = require('node:net')
const os = require('node:os')

const { eosConfig } = require('../config')

const getUrlStatus = async (url, api = '') => {
  const urlRegex = /\/$/
  url = url.replace(urlRegex, '')

  try {
    const response = await axiosUtil.instance.get(`${url}${api}`, {
      timeout: 30000
    })

    return response
  } catch (error) {
    return error.response
  }
}

const isP2PResponding = async (endpoint) => {
  const splitted = endpoint?.split(':') || {}
  const { 0: host, 1: port } = splitted

  if (splitted.length !== 2 || !host || !port)
    return { status: 'Failed', statusText: 'Invalid endpoint format' }

  const isResponding = new Promise((resolve, _) => {
    const client = net.createConnection({ host, port }, () => {
      client.destroy()
      resolve({ status: 'Success', statusText: 'Connection established' })
    })

    client.on('error', (err) => {
      let errorMessage = ''

      switch (Math.abs(err?.errno)) {
        case os.constants.errno.ECONNREFUSED:
          errorMessage = 'Connection refused'
          break
        case os.constants.errno.ETIMEDOUT:
          errorMessage = 'Connection timeout exceeded'
          break
        default:
          errorMessage = 'Connection error'
      }

      resolve({ status: 'Failed', statusText: errorMessage })
    })
  })

  return eosUtil.callWithTimeout(isResponding, 60000).catch((_) => {
    return { status: 'Failed', statusText: 'Connection timeout exceeded' }
  })
}

const getNodeInfo = async (url, api = '/v1/chain/get_info') => {
  const response = await getUrlStatus(url, api)

  return {
    ...(response?.data && { nodeInfo: response.data }),
    status: response?.status || null,
    statusText: response?.statusText || 'No response'
  }
}

const getSupportedAPIs = async (api) => {
  let supportedAPIs

  try {
    const response = await axiosUtil.instance.get(
      `${api}/v1/node/get_supported_apis`,
      { timeout: 30000 }
    )

    supportedAPIs = response.data?.apis
  } catch (error) {}

  return { supportedAPIs }
}

const getEndpoints = (nodes) => {
  if (!nodes?.length) {
    return {
      api: [],
      ssl: [],
      p2p: []
    }
  }

  const endpoints = { api: new Set(), ssl: new Set(), p2p: new Set() }

  Object.getOwnPropertyNames(endpoints).forEach((type) => {
    const endpointType = type + '_endpoint'

    nodes.forEach((node) => {
      const endpoint = node[endpointType]

      if (endpoint) endpoints[type].add(endpoint)
    })

    endpoints[type] = [...endpoints[type]]
  })

  return endpoints
}

const getCurrencyStats = async () => {
  const systemData = await eosUtil.getCurrencyStats({
    symbol: eosConfig.rewardsToken,
    code: 'eosio.token'
  })

  return systemData[eosConfig.rewardsToken]
}

const getExpectedRewards = async (producers, totalVotes) => {
  let rewards = []

  switch (eosConfig.networkName) {
    case eosConfig.knownNetworks.libre:
      rewards = await getLibreRewards(producers)
      break
    case eosConfig.knownNetworks.telos:
      rewards = await getTelosRewards(producers)
      break
    case eosConfig.knownNetworks.wax:
      rewards = await getWaxRewards()
      break
    case eosConfig.knownNetworks.fio:
        break
    default:
      rewards = await getEOSIORewards(producers, totalVotes)
      break
  }

  return rewards.reduce(
    (rewards, { producer, ...args }) => ({ ...rewards, [producer]: args }),
    {}
  )
}

const getLibrePerBlock = () => {
  const secondsPerYear = 86400 * 365
  const activatedTime = new Date('2022-07-04T18:58:09.000')
  const timePassed = (new Date() - activatedTime) / 1000

  // two halvings at six months
  return (
    4 >>
    (Boolean(timePassed > secondsPerYear) +
      Boolean(timePassed > secondsPerYear / 2))
  )
}

const getLibreRewards = async (producers) => {
  const secondsPerDay = 86400
  const round = 12
  const estimatedBlocks = (secondsPerDay / round / 21) * 24
  const rewardPerBlock = getLibrePerBlock()
  const blockProducers = producers.slice(0, 21)

  return blockProducers.map((producer) => {
    const totalRewards = estimatedBlocks * rewardPerBlock

    return {
      producer: producer.owner,
      vote_rewards: 0,
      block_rewards: totalRewards,
      total_rewards: totalRewards
    }
  })
}

const getTelosRewards = async (producers) => {
  const currencyStats = await getCurrencyStats()
  const { rows: payrateRows } = await eosUtil.getTableRows({
    code: 'eosio',
    scope: 'eosio',
    table: 'payrate',
    reverse: false,
    limit: 1,
    json: true,
    lower_bound: null
  })

  const tokenSupply = parseFloat(currencyStats.supply)
  const bPayRate = payrateRows?.at(0)?.bpay_rate / 100000
  const toProducers = (bPayRate * tokenSupply) / 365 // (bPayRate * tokenSupply * secondsPerDay) / secondsPerYear

  const MAX_PAID_PRODUCERS = 42
  const topProducers = producers.slice(0, MAX_PAID_PRODUCERS)
  const activeCount = topProducers.length
  const shareCount =
    activeCount <= 21
      ? activeCount * 2
      : MAX_PAID_PRODUCERS + (activeCount - 21)

  const producerRewards = toProducers / shareCount

  return topProducers.map((producer, i) => {
    const totalRewards = i < 21 ? producerRewards * 2 : producerRewards

    return {
      producer: producer.owner,
      vote_rewards: 0,
      block_rewards: totalRewards,
      total_rewards: totalRewards
    }
  })
}

// The system contract's pay settings (eosio global4 table), as on Vaulta:
// inflation a year (continuous_rate), the part of it paid to producers
// (10000 / inflation_pay_factor) and the part of that paid per block
// (10000 / votepay_factor, the rest is vote pay)
const getSystemPayRates = async () => {
  try {
    const { continuous_rate, inflation_pay_factor, votepay_factor } =
      await getSystemRow('global4')

    if (!continuous_rate || !inflation_pay_factor || !votepay_factor) return

    return {
      producersPerYear:
        (parseFloat(continuous_rate) * 10000) / inflation_pay_factor,
      blockShare: 10000 / votepay_factor
    }
  } catch (error) {
    console.warn('SYSTEM PAY RATES', error.message || error)
  }
}

const getSystemRow = async (table) => {
  const { rows } = await eosUtil.getTableRows({
    code: 'eosio',
    scope: 'eosio',
    table,
    limit: 1,
    json: true
  })

  return rows?.at(0) || {}
}

// WAX's yearly inflation is a constant in its system contract
// (wax-system-contracts eosio.system.hpp), not stored in a table
const WAX_CONTINUOUS_RATE = 0.04879

// WAX pays block producers from inflation only: a part goes to the RNG
// treasury, then 30% of the rest is block pay (40% voters, 30% savings).
// Block pay is split between the active schedule (by blocks produced, so
// equally) and the standby slots (by time on standby), weighted by
// active_producer_count and standby_slot_weight * num_standby_slots.
// Guilds that are neither scheduled nor active standbys get nothing.
const getWaxRewards = async () => {
  const currencyStats = await getCurrencyStats()
  const supply = currencyStats?.supply
    ? parseFloat(currencyStats.supply.split(' ')[0])
    : 0
  const global4 = await getSystemRow('global4')
  const global5 = await getSystemRow('global5')
  const schedule = await eosUtil.getProducerSchedule()
  const active = (schedule?.active?.producers || []).map(
    (producer) => producer.producer_name
  )
  const { rows: standbyRows = [] } = await eosUtil.getTableRows({
    code: 'eosio',
    scope: 'eosio',
    table: 'standbys',
    limit: 100,
    json: true
  })
  const standbys = standbyRows
    .filter((row) => !!row.is_active && !active.includes(row.owner))
    .map((row) => row.owner)

  const perDay = (WAX_CONTINUOUS_RATE * supply) / 365
  const rng = (perDay * (global5.rng_rate || 0)) / 10000
  const blockPay = ((perDay - rng) * 3) / 10

  const activeWeight = (global4.active_producer_count || active.length) * 10000
  const standbyWeight =
    (global4.standby_slot_weight || 0) * (global4.num_standby_slots || 0)
  const toActive = (blockPay * activeWeight) / (activeWeight + standbyWeight)
  const toStandby = blockPay - toActive

  const reward = (producer, amount) => ({
    producer,
    vote_rewards: 0,
    block_rewards: amount,
    total_rewards: amount
  })

  return [
    ...active.map((producer) => reward(producer, toActive / active.length)),
    ...standbys.map((producer) =>
      reward(producer, toStandby / (global4.num_standby_slots || standbys.length))
    )
  ]
}

const getEOSIORewards = async (producers, totalVotes) => {
  // no votes at all (e.g. Ultra): nothing to estimate
  if (!totalVotes) return []

  const currencyStats = await getCurrencyStats()
  const supply = currencyStats?.supply
    ? parseFloat(currencyStats.supply.split(' ')[0])
    : 0
  const payRates = await getSystemPayRates()

  // "inflation" is the amount paid to all producers per day
  let inflation = supply / 100 / 365 // fallback: 1% of supply a year
  let blockReward = 0.25 // share of it paid per block produced

  if (payRates && eosConfig.networkName !== eosConfig.knownNetworks.xpr) {
    // XPR also sends part of its inflation to yield farms and a committee,
    // so these settings don't describe its producer pay; it keeps the fallback
    inflation = (supply * payRates.producersPerYear) / 365
    blockReward = payRates.blockShare
  }

  const voteReward = 1 - blockReward // reward according to producer total_votes
  const minimumPercenToGetVoteReward =
    100 / (inflation * (voteReward || blockReward)) // calculate the minimum percent to get vote reward

  let distributedVoteRewardPercent = 0
  let undistributedVoteRewardPercent = 0

  producers.forEach((producer) => {
    const producerVotePercent = parseFloat(producer.total_votes) / totalVotes

    if (producerVotePercent > minimumPercenToGetVoteReward) {
      distributedVoteRewardPercent += producerVotePercent
    } else {
      undistributedVoteRewardPercent += producerVotePercent
    }
  })

  const producersRewards = []

  for (const i in producers) {
    const producer = producers[i]
    const isBlockProducer = i < 21
    const producerVotePercent = parseFloat(producer.total_votes) / totalVotes

    let expectedVoteReward = 0
    let expectedBlockReward = 0

    if (producerVotePercent > minimumPercenToGetVoteReward) {
      const producerDistributionPercent =
        producerVotePercent / distributedVoteRewardPercent // calculates the percentage that the producer represents of the distributed vote reward percent

      const producerUndistributedRewardPercent =
        producerDistributionPercent * undistributedVoteRewardPercent //  calculate the percentage that corresponds to the producer of the undistributed vote reward percent

      expectedVoteReward =
        inflation *
        voteReward *
        (producerUndistributedRewardPercent + producerVotePercent)

      if (isBlockProducer) {
        expectedBlockReward = inflation * blockReward * (1 / 21)
      }

      producersRewards.push({
        producer: producer.owner,
        vote_rewards: expectedVoteReward,
        block_rewards: expectedBlockReward,
        total_rewards: expectedVoteReward + expectedBlockReward
      })
    } else {
      break
    }
  }

  return producersRewards
}

const getVotes = (votes) => {
  switch (eosConfig.networkName) {
    case eosConfig.knownNetworks.telos:
    case eosConfig.knownNetworks.libre:
      return parseFloat(votes) / 10000
    case eosConfig.knownNetworks.wax:
      return getEOSIOVotes(votes, 13) / 10 ** 8
    default:
      return getEOSIOVotes(votes, 52) / 10000
  }
}

const getEOSIOVotes = (votes, weekHalfLife) => {
  const TIMESTAMP_EPOCH = 946684800
  const date = Date.now() / 1000 - TIMESTAMP_EPOCH
  const weight = date / (86400 * 7) / weekHalfLife // 86400 = seconds per day 24*3600

  return parseFloat(votes) / 2 ** weight
}

const jsonParse = (string) => {
  try {
    const json = JSON.parse(string)

    return json
  } catch (error) {}

  return {}
}

module.exports = {
  isP2PResponding,
  getNodeInfo,
  getEndpoints,
  getExpectedRewards,
  getSupportedAPIs,
  getUrlStatus,
  getVotes,
  jsonParse
}

const WebSocket = require('ws')
const { ABI, Serializer } = require('@wharfkit/antelope')

const statsService = require('./stats.service')
const { eosConfig } = require('../config')
const { hasuraUtil, sleepFor, eosUtil } = require('../utils')

let abi
let ws

const getLastBlockNumInDatabase = async () => {
  const query = `
    query {
      blocks: block_history(limit: 1, order_by: {block_num: desc}, where: {producer: {_neq: "NULL"}}) {
        block_num
      }
    }
  `
  const data = await hasuraUtil.request(query)

  return data?.blocks?.length > 0 ? data.blocks[0].block_num : 0
}

const saveBlocks = async (blocks) => {
  const upsertMutation = `
    mutation ($blocks: [block_history_insert_input!]!) {
      insert_block_history(objects: $blocks, on_conflict: {constraint: block_history_pkey, update_columns: [block_num,producer,schedule_version,timestamp,transactions_length,cpu_usage,net_usage]}) {
        affected_rows,
      }
    }
  `

  await hasuraUtil.request(upsertMutation, { blocks })
}

const deserialize = (type, data) =>
  Serializer.decode({ abi, type, data: new Uint8Array(data) })

const serialize = (type, value) =>
  Serializer.encode({ abi, type, object: value }).array

const send = async (message) => {
  if (ws.readyState === 1) {
    return ws.send(message)
  }

  console.log('waiting for ready state before send message')
  ws.close()
}

const requestBlocks = (requestArgs = {}) => {
  send(
    serialize('request', [
      'get_blocks_request_v0',
      {
        start_block_num: 0,
        end_block_num: 4294967295,
        max_messages_in_flight: 1,
        have_positions: [],
        fetch_block: true,
        irreversible_only: false,
        fetch_traces: false,
        fetch_deltas: false,
        ...requestArgs
      }
    ])
  )
}

let blocksData = []

const handleBlocksResult = async (data) => {
  try {
    if (!data.block?.array.length) {
      send(
        serialize('request', ['get_blocks_ack_request_v0', { num_messages: 1 }])
      )

      return
    }

    const block = Serializer.objectify({
      ...deserialize('signed_block', data.block.array),
      head: data.head,
      last_irreversible: data.last_irreversible,
      this_block: data.this_block,
      prev_block: data.prev_block
    })

    const usage = block?.transactions?.reduce(
      (total, current) => {
        total.cpu_usage +=
          (current.cpu_usage_us / eosConfig.maxBlockCpuUsage) * 100 || 0
        total.net_usage +=
          (current.net_usage_words / eosConfig.maxBlockNetUsage) * 100 || 0
        return total
      },
      { net_usage: 0, cpu_usage: 0 }
    )

    blocksData.push({
      producer: block.producer,
      schedule_version: block.schedule_version,
      block_num: block.this_block.block_num,
      transactions_length: block.transactions.length,
      timestamp: block.timestamp,
      ...usage
    })

    if (blocksData.length === 50) {
      await saveBlocks(blocksData)
      await statsService.udpateStats({ last_block_at: block.timestamp })
      blocksData = []
    }

    send(
      serialize('request', ['get_blocks_ack_request_v0', { num_messages: 1 }])
    )
  } catch (error) {
    console.log(error)
  }
}

const cleanOldBlocks = async () => {
  const date = new Date()
  const days = eosConfig.keepBlockHistoryForDays

  date.setSeconds(date.getSeconds() - 60 * 60 * 24 * days)

  const mutation = `
    mutation ($date: timestamptz) {
      delete_block_history (where: {timestamp: {_lt: $date}}) {
        affected_rows
      }
      delete_round_history (where: {completed_at: {_lt: $date}}) {
        affected_rows
      }
    }
  `

  await hasuraUtil.request(mutation, { date })
}

const getStartBlockNum = async () => {
  const startBlockNum = await getLastBlockNumInDatabase()

  if (startBlockNum === 0) {
    const info = await eosUtil.getInfo()
    const LIB = info?.last_irreversible_block_num
    const days = eosConfig.keepBlockHistoryForDays
    const date = new Date()

    date.setSeconds(date.getSeconds() - 60 * 60 * 24 * days)

    const estimatedBlockNum = Math.ceil(LIB - ((new Date() - date) / 1000) * 2)

    return estimatedBlockNum > 0 ? estimatedBlockNum : 0
  }

  return startBlockNum
}

const init = async () => {
  if (!eosConfig.stateHistoryPluginEndpoint) {
    return
  }

  const startBlockNum = await getStartBlockNum()

  // the first message of every connection is the protocol ABI
  abi = null
  ws = new WebSocket(eosConfig.stateHistoryPluginEndpoint, {
    perMessageDeflate: false,
    maxPayload: 2048 * 1024 * 1024
  })

  ws.on('open', () => {
    console.log('🚀 Connected to state_history_plugin socket')
  })

  ws.on('message', (data) => {
    if (!abi) {
      abi = ABI.from(JSON.parse(data))
      requestBlocks({ start_block_num: startBlockNum })

      return
    }

    const [type, response] = deserialize('result', data)

    switch (type) {
      case 'get_blocks_result_v0':
        handleBlocksResult(response)
        break
      default:
        console.log(`unsupported result ${type}`)
        break
    }
  })

  ws.on('error', (error) => console.error('STATE HISTORY PLUGIN', error))

  ws.on('close', async () => {
    await sleepFor(60)
    init()
  })
}

module.exports = {
  cleanOldBlocks,
  init
}

const {
  axiosUtil,
  hasuraUtil,
  sequelizeUtil,
  getGranularityFromRange
} = require('../utils')
const { eosConfig } = require('../config')

const cleanOldBenchmarks = async () => {
  const date = new Date()

  date.setFullYear(date.getFullYear() - 1)

  const mutation = `
    mutation ($date: timestamptz) {
      delete_cpu (where: {created_at: {_lt: $date}}) {
        affected_rows
      }
    }
  `

  await hasuraUtil.request(mutation, { date })
}

const HYPERION_PAGE_SIZE = 1000
const HYPERION_MAX_PAGES_PER_RUN = 20

const getLastHyperionBenchmarkTime = async () => {
  const query = `
    query {
      cpu (where: {transaction_id: {_is_null: false}}, order_by: {created_at: desc}, limit: 1) {
        created_at
      }
    }
  `
  const data = await hasuraUtil.request(query)

  return data.cpu[0]?.created_at
}

// Hyperion nodes are tried in order; the first one that answers is used
const getHyperionBenchmarks = async after => {
  for (const endpoint of eosConfig.hyperionEndpoints) {
    try {
      const { data } = await axiosUtil.instance.get(
        `${endpoint}/v2/history/get_actions`,
        {
          params: {
            account: 'eosmechanics',
            filter: 'eosmechanics:cpu',
            sort: 'asc',
            after,
            limit: HYPERION_PAGE_SIZE
          },
          timeout: 30000
        }
      )

      return data.actions || []
    } catch (error) {
      console.error(
        `WARNING cpuService.syncFromHyperion => ${endpoint} has failed:`,
        error.message
      )
    }
  }

  throw new Error('Each Hyperion endpoint failed to return CPU benchmarks')
}

// Hyperion v3 returns UTC timestamps without a zone designator
const toUtc = timestamp =>
  /(Z|[+-]\d{2}:?\d{2})$/.test(timestamp) ? timestamp : `${timestamp}Z`

// Read eosmechanics::cpu actions pushed by anyone on the network from Hyperion
// instead of running the benchmark ourselves
const syncFromHyperion = async () => {
  let after = await getLastHyperionBenchmarkTime()

  if (!after) {
    const since = new Date()

    since.setDate(since.getDate() - eosConfig.hyperionCpuBackfillDays)
    after = since.toISOString()
  }

  for (let page = 0; page < HYPERION_MAX_PAGES_PER_RUN; page++) {
    const actions = await getHyperionBenchmarks(after)
    const benchmarks = actions
      .filter(action => action.producer && action.cpu_usage_us)
      .map(action => ({
        account: action.producer,
        usage: action.cpu_usage_us,
        transaction_id: action.trx_id,
        created_at: toUtc(action['@timestamp'])
      }))

    if (benchmarks.length) {
      const mutation = `
        mutation ($benchmarks: [cpu_insert_input!]!) {
          insert_cpu (objects: $benchmarks, on_conflict: {constraint: cpu_transaction_id_key, update_columns: []}) {
            affected_rows
          }
        }
      `

      await hasuraUtil.request(mutation, { benchmarks })
      after = benchmarks[benchmarks.length - 1].created_at
    }

    if (actions.length < HYPERION_PAGE_SIZE) break
  }
}

const getBenchmark = async (range = '3 Hours') => {
  const granularity = getGranularityFromRange(range)
  const [rows] = await sequelizeUtil.query(`
    WITH interval AS (
      SELECT generate_series(
        date_trunc('${granularity}', now()) - '${range}'::interval,
        date_trunc('${granularity}', now()),
        '1 ${granularity}'::interval
      ) AS value
    )
    
    SELECT
      interval.value as datetime,
      cpu.account,
      count(cpu.usage) as transactions,
      avg(cpu.usage) as usage
    FROM 
      interval
    INNER JOIN 
      cpu ON date_trunc('${granularity}', cpu.created_at) = interval.value
    GROUP BY 
      1, 
      cpu.account
    ORDER BY 
      1 ASC`)

  return rows
}

module.exports = {
  syncFromHyperion,
  getBenchmark,
  cleanOldBenchmarks
}

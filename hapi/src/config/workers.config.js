module.exports = {
  syncProducersInterval: parseInt(
    process.env.HAPI_SYNC_PRODUCERS_INTERVAL || 14400
  ),
  syncProducerInfoInterval: parseInt(
    process.env.HAPI_SYNC_PRODUCER_INFO_INTERVAL || 1
  ),
  cpuHyperionSyncInterval: parseInt(
    process.env.HAPI_SYNC_CPU_HYPERION_INTERVAL || 60
  ),
  syncStatsInterval: parseInt(process.env.HAPI_SYNC_STATS_INTERVAL || 3600),
  syncExchangeRate: parseInt(process.env.HAPI_SYNC_EXCHANGE_RATE || 86400)
}

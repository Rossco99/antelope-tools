import resources from '../language'

export const useRewards = import.meta.env.REACT_APP_USE_REWARDS === 'true'
export const useVotes = import.meta.env.REACT_APP_USE_VOTES === 'true'
export const title = import.meta.env.REACT_APP_TITLE
export const landingUrl =
  import.meta.env.REACT_APP_LANDING_URL || 'https://antelope-tools.eosphere.io'
export const useCpuBenchmark = import.meta.env.REACT_APP_USE_CPU_BENCHMARK === 'true'
export const eosRateLink = import.meta.env.REACT_APP_EOS_RATE_LINK
export const defaultProducerLogo =
  import.meta.env.REACT_APP_DEFAULT_PRODUCER_LOGO ||
  'https://bloks.io/img/eosio.png'
export const footerLinks = import.meta.env.REACT_APP_FOOTER_LINKS
  ? JSON.parse(import.meta.env.REACT_APP_FOOTER_LINKS)
  : []
export const disabledMenuItems = JSON.parse(
  import.meta.env.REACT_APP_DISABLED_MENU_ITEMS || '[]',
)
export const appVersion =
  import.meta.env.REACT_APP_VERSION.split('/').pop() || 'v1.0'
export const appName = import.meta.env.REACT_APP_NAME || 'antelopetools'
export const networkLinks = import.meta.env.REACT_APP_NETWORK_URL
  ? JSON.parse(import.meta.env.REACT_APP_NETWORK_URL)
  : []
export const historyEnabled =
  import.meta.env.REACT_APP_STATE_HISTORY_ENABLED === 'true'
export const highchartsMapURL = 'https://code.highcharts.com/mapdata/countries/'
export const healthLights = Object.freeze({
  greenLight: 'greenLight',
  timerOff: 'timerOff',
  yellowLight: 'yellowLight',
  redLight: 'redLight',
})
export const defaultLanguage = 'en'
export const languageResources = resources
export const languages = Object.keys(resources)
export const languagesInProgress = ['ko', 'zh']
export const languagesLabels = {
  'es': 'Español',
  'en': 'English',
  'ko': '한국인',
  'zh': '中文',
}

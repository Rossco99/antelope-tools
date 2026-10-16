import { eosConfig } from '../config'
import { deepMerge } from '../utils/deep-merge'
import { applyProducerTerm } from '../utils/producer-term'

import en from './en'
import es from './es'
import ko from './ko'
import zh from './zh'

const languajes = {
  ...es,
  ...en,
  ...ko,
  ...zh,
}

const getLanguaje = (languaje) => {
  if (languajes[`${languaje}.${eosConfig.networkName}`]) {
    return deepMerge(
      languajes[languaje],
      languajes[`${languaje}.${eosConfig.networkName}`],
    )
  }

  return languajes[languaje] || {}
}

export default {
  // the producer term (e.g. Guild on WAX) only has English wording so far
  en: applyProducerTerm(getLanguaje('en'), eosConfig.producerTerm),
  es: getLanguaje('es'),
  ko: getLanguaje('ko'),
  zh: getLanguaje('zh'),
}

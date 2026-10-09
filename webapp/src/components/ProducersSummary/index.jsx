/* eslint camelcase: 0 */
import React, { memo } from 'react'
import PropTypes from 'prop-types'

import SimpleDataCard from '../SimpleDataCard'

const ProducersSummary = ({ t, loading, total }) => {
  return (
    <>
      <SimpleDataCard
        title={`${t('total')} ${t('producers')}`}
        helperText={t('tooltip.totalProducers')}
        value={total}
        loading={loading}
      />
    </>
  )
}

ProducersSummary.propTypes = {
  t: PropTypes.func,
  loading: PropTypes.bool,
  total: PropTypes.number,
}

ProducersSummary.defaultProps = {
  t: (text) => text,
  loading: false,
  total: 0,
}

export default memo(ProducersSummary)

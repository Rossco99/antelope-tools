/* eslint camelcase: 0 */
import React, { useState, useCallback } from 'react'
import { makeStyles } from '@mui/styles'
import { useTranslation } from 'react-i18next'
import Typography from '@mui/material/Typography'
import Link from '@mui/material/Link'
import LinearProgress from '@mui/material/LinearProgress'
import Paper from '@mui/material/Paper'
import Popover from '@mui/material/Popover'

import UnknowFlagIcon from '../../components/UnknowFlagIcon'
import CountryFlag from '../../components/CountryFlag'
import { formatWithThousandSeparator } from '../../utils'

import styles from './styles'
import RewardsDistributionStats from './RewardsDistributionStats'
import TokenToUSD from './TokenToUSD'
import RewardsMap from './RewardsMap'
import useRewardsDistributionState from 'hooks/customHooks/useRewardsDistributionState'

const useStyles = makeStyles(styles)

const RewardsDistribution = () => {
  const [anchorEl, setAnchorEl] = useState(null)
  const [currentNode, setCurrentNode] = useState(null)
  const classes = useStyles()
  const { t } = useTranslation('rewardsDistributionRoute')
  const open = Boolean(anchorEl)
  const [{ loading, nodes, setting, summary }] = useRewardsDistributionState()

  const handlePopoverOpen = useCallback(
    (node) => (event) => {
      if (!nodes.length > 0) {
        return
      }
      setCurrentNode(node)
      setAnchorEl(event.currentTarget)
    },
    [nodes],
  )

  const handlePopoverClose = () => {
    setAnchorEl(null)
  }

  return (
    <div
      aria-owns={open ? 'mouse-over-popover' : undefined}
      aria-haspopup="true"
    >
      <Popover
        onMouseEnter={handlePopoverOpen}
        onMouseLeave={handlePopoverClose}
        PaperProps={{ onMouseLeave: handlePopoverClose }}
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'center',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'center',
          horizontal: 'center',
        }}
        open={open}
        onClose={handlePopoverClose}
        id="mouse-over-popover"
      >
        <div className={classes.boxPadding}>
          <Typography>
            <span className={classes.popoverItem}>{t('country')}: </span>
            {!currentNode?.flag && (
              <span className={classes.countryFlagUnknown}>
                <UnknowFlagIcon />
              </span>
            )}
            <span>{currentNode?.name}</span>
            {currentNode?.flag && <CountryFlag code={currentNode?.code} />}
          </Typography>
          {summary && (
            <Typography>
              <span className={classes.popoverItem}>
                {t('rewardsPercentage')}:{' '}
              </span>
              <span>
                {formatWithThousandSeparator(
                  (currentNode?.rewards / summary.dailyRewards) * 100,
                  2,
                )}
                %
              </span>
            </Typography>
          )}
          <Typography>
            <span className={classes.popoverItem}>{t('rewards')}: </span>
            <TokenToUSD
              amount={currentNode?.rewards}
              tokenPrice={setting?.token_price}
            />
          </Typography>
          <span className={classes.popoverItem}>{t('producers')}:</span>
          <ul className={classes.producersList}>
            {currentNode?.items?.map((producer, i) => (
              <li key={`node-${i}`}>
                <Link
                  href={producer?.bp_json_url ?? ''}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {producer?.bp_json?.org?.candidate_name || producer.owner}
                </Link>
                <br />
                <TokenToUSD
                  amount={producer?.total_rewards}
                  tokenPrice={setting?.token_price}
                />
              </li>
            ))}
          </ul>
        </div>
      </Popover>
      {loading && <LinearProgress className={classes.linearLoader} />}
      <RewardsDistributionStats
        summary={summary}
        nodes={nodes}
        setting={setting}
        handlePopoverOpen={handlePopoverOpen}
      />
      {!loading && (
        <Paper className={classes.mapWrapper}>
          <RewardsMap
            nodes={nodes}
            maxRewards={summary?.topCountryByRewards?.rewards}
            onCountryHover={handlePopoverOpen}
          />
        </Paper>
      )}
    </div>
  )
}

RewardsDistribution.propTypes = {}

export default RewardsDistribution

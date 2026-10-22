import React, { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { useTheme } from '@mui/material/styles'

import HighMapsWrapper from '../../components/GeoMap/HighMapsWrapper'
import worldGeoData from '../../components/GeoMap/worldGeoData'

// The same Highcharts world map (Miller projection) as Geographic
// Distribution, shaded from the lowest to the highest daily rewards.
const RewardsMap = ({ nodes, maxRewards, onCountryHover }) => {
  const ref = useRef()
  const theme = useTheme()

  useEffect(() => {
    if (!ref.current) return

    const chart = new HighMapsWrapper.Map(ref.current, {
      chart: {
        backgroundColor: theme.palette.background.default,
        // keeps the map's own proportions at any width
        height: '52%',
      },
      title: { text: '' },
      legend: { enabled: false },
      exporting: { enabled: false },
      credits: { enabled: false },
      mapNavigation: { enabled: false },
      tooltip: { enabled: false },
      colorAxis: {
        min: 0,
        max: maxRewards || 1,
        minColor: theme.palette.primary.light,
        maxColor: theme.palette.primary.dark,
      },
      series: [
        {
          mapData: worldGeoData,
          joinBy: ['iso-a2', 'code'],
          data: nodes
            .filter((node) => node.rewards > 0)
            .map((node) => ({ code: node.code, value: node.rewards })),
          borderColor: theme.palette.neutral.main,
          nullColor: theme.palette.neutral.light,
          cursor: 'pointer',
          states: {
            hover: { color: theme.palette.primary.main },
          },
          point: {
            events: {
              mouseOver: function () {
                const node = nodes.find(({ code }) => code === this.code)

                if (node && this.graphic?.element) {
                  onCountryHover(node)({ currentTarget: this.graphic.element })
                }
              },
            },
          },
        },
      ],
    })

    return () => chart.destroy()
  }, [nodes, maxRewards, onCountryHover, theme.palette])

  return <div ref={ref} />
}

RewardsMap.propTypes = {
  nodes: PropTypes.array,
  maxRewards: PropTypes.number,
  onCountryHover: PropTypes.func,
}

RewardsMap.defaultProps = {
  nodes: [],
  maxRewards: 0,
  onCountryHover: () => () => {},
}

export default RewardsMap

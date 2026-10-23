import React, { useEffect, useRef } from 'react'
import PropTypes from 'prop-types'
import { useTheme } from '@mui/material/styles'

import HighMapsWrapper from '../../components/GeoMap/HighMapsWrapper'
import worldGeoData from '../../components/GeoMap/worldGeoData'
import spreadLabels from '../../components/GeoMap/spreadLabels'

const MAP_COUNTRIES = new Set(
  worldGeoData.features.map((feature) => feature.properties['iso-a2']),
)

// Places the world map leaves out (Hong Kong, Macau, Cayman Islands, ...) or
// draws too small to see or hover get a marker at their location instead
const SMALL_PLACES = {
  AD: [42.55, 1.6],
  AW: [12.52, -69.97],
  BB: [13.19, -59.54],
  BH: [26.07, 50.55],
  BM: [32.32, -64.76],
  CW: [12.17, -68.98],
  GG: [49.45, -2.58],
  GI: [36.14, -5.35],
  HK: [22.32, 114.17],
  IM: [54.24, -4.55],
  JE: [49.21, -2.13],
  KY: [19.31, -81.25],
  LI: [47.17, 9.55],
  LU: [49.81, 6.13],
  MC: [43.74, 7.42],
  MO: [22.2, 113.55],
  MT: [35.9, 14.45],
  MU: [-20.35, 57.55],
  MV: [3.2, 73.22],
  SC: [-4.68, 55.49],
  SG: [1.35, 103.82],
  SM: [43.94, 12.46],
  VG: [18.42, -64.62],
}

// the country's marker position: the table above, else the producers' own
// bp.json coordinates for places the map doesn't have
const markerPosition = (node) => {
  if (SMALL_PLACES[node.code]) return SMALL_PLACES[node.code]
  if (MAP_COUNTRIES.has(node.code)) return null

  const [lon, lat] = node.coordinates || []

  return lat && lon ? [parseFloat(lat), parseFloat(lon)] : null
}

const label = (node) => `${node.flag || node.code} ${node.quantity}`

// The same Highcharts world map (Miller projection) as Geographic
// Distribution, shaded from the lowest to the highest daily rewards, with the
// number of paid producers per country.
const RewardsMap = ({ nodes, maxRewards, onCountryHover }) => {
  const ref = useRef()
  const theme = useTheme()

  useEffect(() => {
    if (!ref.current) return

    const located = nodes.filter((node) => node.rewards > 0 && node.code !== 'N/A')
    const hover = function () {
      const node = located.find(({ code }) => code === this.code)

      if (node && this.graphic?.element) {
        onCountryHover(node)({ currentTarget: this.graphic.element })
      }
    }

    const chart = new HighMapsWrapper.Map(ref.current, {
      chart: {
        backgroundColor: theme.palette.background.default,
        // keeps the map's own proportions at any width
        height: '52%',
        events: {
          render() {
            spreadLabels(this, theme.palette.text.secondary)
          },
        },
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
          data: located.map((node) => ({
            code: node.code,
            value: node.rewards,
            // countries shown as a marker are labelled there instead
            text: markerPosition(node) ? '' : label(node),
          })),
          borderColor: theme.palette.neutral.main,
          nullColor: theme.palette.neutral.light,
          cursor: 'pointer',
          states: {
            hover: { color: theme.palette.primary.main },
          },
          dataLabels: {
            enabled: true,
            allowOverlap: true,
            format: '{point.text}',
          },
          point: { events: { mouseOver: hover } },
        },
        {
          type: 'mappoint',
          colorAxis: false,
          data: located
            .filter((node) => markerPosition(node))
            .map((node) => {
              const [lat, lon] = markerPosition(node)

              return { code: node.code, lat, lon, text: label(node) }
            }),
          color: theme.palette.primary.main,
          cursor: 'pointer',
          marker: {
            radius: 6,
            lineWidth: 2,
            lineColor: theme.palette.text.primary,
          },
          dataLabels: {
            enabled: true,
            allowOverlap: true,
            format: '{point.text}',
            y: -12,
          },
          point: { events: { mouseOver: hover } },
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

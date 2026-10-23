import React, { useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { makeStyles } from '@mui/styles'
import { useTheme } from '@mui/material/styles'
import PropTypes from 'prop-types'

import { countries } from '../../utils/countries'
import { eosConfig } from '../../config'

import HighMapsWrapper from './HighMapsWrapper'
import spreadLabels from './spreadLabels'
import styles from './styles'

const useStyles = makeStyles(styles)

const ClusterMap = ({ data, map, mapCode }) => {
  const classes = useStyles()
  const theme = useTheme()
  const navigate = useNavigate()
  const myRef = useRef()

  const find2DPointDistance = (p0, p1) =>
    Math.sqrt((p0.x - p1.x) ** 2 + (p0.y - p1.y) ** 2)

  const getNew2DPoint = (p0, p1, distance) => ({
    x: (distance + 1) * p1.x + -distance * p0.x,
    y: (distance + 1) * p1.y + -distance * p0.y,
  })

  const setupMapData = useCallback(
    (data, map, mapCode = '') => {
      for (const index in data) {
        const currentPoint = { x: data[index].lon, y: data[index].lat }

        for (const auxIndex in data) {
          if (parseInt(index) >= parseInt(auxIndex)) continue

          const auxPoint = { x: data[auxIndex].lon, y: data[auxIndex].lat }
          const distance = find2DPointDistance(currentPoint, auxPoint)

          if (distance < 0.5) {
            const newPoint = getNew2DPoint(currentPoint, auxPoint, distance)

            data[auxIndex].lon = newPoint.x
            data[auxIndex].lat = newPoint.y
          }
        }
      }

      // the built-in world map, zoomed to the selected country
      // with some margin around the country
      const zoomToCountry = (chart) => {
        chart.series[0].points
          .find((point) => point['iso-a2'] === mapCode)
          ?.zoomTo()
        chart.mapZoom(1.6)
      }

      const options = {
        chart: {
          map,
          backgroundColor: theme.palette.background.default,
          animation: false,
          height: '60%',
          events: {
            load() {
              const chart = this

              zoomToCountry(chart)
              chart.renderer
                .button('Reset zoom', chart.plotLeft, chart.plotTop + 70)
                .on('click', () => {
                  zoomToCountry(chart)
                })
                .add()
                .toFront()
            },
            // nodes in the same area get their names moved apart
            render() {
              spreadLabels(this, theme.palette.text.secondary)

              // a name opens its producer's profile, like clicking the point
              this.series[1]?.points.forEach((point) => {
                const owner = point.producer?.owner

                if (point.dataLabel?.element && owner) {
                  point.dataLabel.element.onclick = () =>
                    navigate(`/${eosConfig.producersRoute}/${owner}`)
                }
              })
            },
          },
        },
        legend: {
          enabled: false,
        },
        title: {
          text: countries[mapCode].name,
          style: {
            color: theme.palette.text.primary,
          },
        },
        mapNavigation: {
          enableButtons: true,
          enabled: true,
          enableDoubleClickZoom: false,
          enableDoubleClickZoomTo: false,
          enableMouseWheelZoom: false,
          enableTouchZoom: true,
        },
        tooltip: {
          enabled: false,
        },
        colorAxis: {
          min: 0,
          max: 20,
        },
        credits: {
          enabled: false,
        },
        plotOptions: {
          series: {
            dataLabels: {
              enabled: true,
              allowOverlap: true,
              y: -12,
              style: {
                fontWeight: 'bold',
                fontSize: '1.1em',
                color: theme.palette.primary.main,
                textOutline: `2px ${theme.palette.background.default}`,
                cursor: 'pointer',
              },
              formatter: function () {
                const producer = this?.point?.producer

                return producer?.owner
                  ? producer?.fio_address || producer?.owner
                  : ''
              },
            },
            events: {
              click: function (e) {
                navigate(
                  `/${eosConfig.producersRoute}/${e.point.producer?.owner}`,
                )
              },
            },
          },
        },
        series: [
          {
            name: 'NodeDistribution',
            data: [{ 'iso-a2': mapCode, color: theme.palette.neutral.lighter }],
            joinBy: 'iso-a2',
            enableMouseTracking: false,
            dataLabels: { enabled: false },
            borderColor: theme.palette.neutral.main,
            nullColor: theme.palette.neutral.light,
            showInLegend: false,
          },
          {
            cursor: 'pointer',
            type: 'mappoint',
            enableMouseTracking: true,
            colorKey: 'clusterPointsAmount',
            name: 'Countries',
            color: theme.palette.neutral.darker,
            data: data || [],
          },
        ],
      }

      return new HighMapsWrapper['Map'](myRef.current, options)
    },
    [navigate, theme.palette],
  )

  useEffect(() => {
    if (!myRef.current) return

    // a new chart replaces the old one, which must not keep animating
    const chart = setupMapData(data, map, mapCode)

    return () => chart.destroy()
  }, [data, map, mapCode, setupMapData])

  return <div ref={myRef} className={classes.divRef} />
}

ClusterMap.propTypes = {
  data: PropTypes.array,
  map: PropTypes.object,
  mapCode: PropTypes.string,
}

export default ClusterMap

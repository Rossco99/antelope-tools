// Highcharts maps can only hide overlapping data labels. This pushes the
// labels of nearby points apart instead (and off other points' markers) and
// draws a thin line from each moved label back to its point. Call it from the
// chart's render event.
const PADDING = 3
const MARKER_SIZE = 12
const MAX_PASSES = 80

const overlap = (a, b) => ({
  x:
    Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) + PADDING,
  y:
    Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) + PADDING,
})

// where the line from (x, y) to the box's centre crosses the box's edge
const edgePoint = (box, x, y) => {
  const cx = box.x + box.width / 2
  const cy = box.y + box.height / 2
  const dx = x - cx
  const dy = y - cy

  if (!dx && !dy) return { x: cx, y: cy }

  const scale = Math.min(
    dx ? box.width / 2 / Math.abs(dx) : Infinity,
    dy ? box.height / 2 / Math.abs(dy) : Infinity,
  )

  return { x: cx + dx * scale, y: cy + dy * scale }
}

export const spreadLabels = (chart, lineColor) => {
  ;(chart.labelConnectors || []).forEach((line) => line.destroy())
  chart.labelConnectors = []

  const boxes = chart.series.flatMap((series) =>
    (series.points || [])
      .filter(
        (point) =>
          point.dataLabel &&
          point.dataLabel.visibility !== 'hidden' &&
          point.dataLabel.attr('visibility') !== 'hidden',
      )
      .map((point) => {
        const label = point.dataLabel
        // Highcharts' own position for the label (alignAttr), not where an
        // earlier pass of this function moved it
        const box = {
          label,
          group: series.dataLabelsGroup,
          x: label.alignAttr?.x ?? label.x,
          y: label.alignAttr?.y ?? label.y,
          width: label.width,
          height: label.height,
        }

        box.startX = box.x
        box.startY = box.y
        // map points (nodes) point to their marker, map areas to the label's
        // own starting place
        box.anchorX = point.graphic && point.plotX !== undefined
          ? point.plotX
          : box.x + box.width / 2
        box.anchorY = point.graphic && point.plotY !== undefined
          ? point.plotY
          : box.y + box.height / 2

        return box
      }),
  )

  // markers of map points, which labels must not cover
  const markers = chart.series
    .filter((series) => series.type === 'mappoint')
    .flatMap((series) => series.points || [])
    .filter((point) => point.graphic && point.plotX !== undefined)
    .map((point) => ({
      x: point.plotX - MARKER_SIZE / 2,
      y: point.plotY - MARKER_SIZE / 2,
      width: MARKER_SIZE,
      height: MARKER_SIZE,
    }))

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let moved = false

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i]
        const b = boxes[j]
        const o = overlap(a, b)

        if (o.x <= 0 || o.y <= 0) continue

        moved = true

        // separate along the axis that needs the smaller move; labels are
        // wider than tall, so stacking them vertically is usually cheaper
        if (o.y <= o.x) {
          const up = a.y + a.height / 2 <= b.y + b.height / 2 ? a : b
          const down = up === a ? b : a

          up.y -= o.y / 2
          down.y += o.y / 2
        } else {
          const left = a.x + a.width / 2 <= b.x + b.width / 2 ? a : b
          const right = left === a ? b : a

          left.x -= o.x / 2
          right.x += o.x / 2
        }
      }
    }

    boxes.forEach((box) => {
      markers.forEach((marker) => {
        const o = overlap(box, marker)

        if (o.x <= 0 || o.y <= 0) return

        moved = true

        // only the label moves, up or down, whichever is shorter
        if (box.y + box.height / 2 <= marker.y + marker.height / 2) {
          box.y -= o.y
        } else {
          box.y += o.y
        }
      })
    })

    if (!moved) break
  }

  boxes.forEach((box) => {
    box.label.attr({ x: Math.round(box.x), y: Math.round(box.y) })

    // HTML labels (useHTML, e.g. with flag images) are a separate element
    // that the attr above doesn't move: shift it by the same amount
    const html = box.label.text?.element

    if (html instanceof HTMLElement) {
      html.style.transform = `translate(${Math.round(box.x - box.startX)}px, ${Math.round(box.y - box.startY)}px)`
    }

    if (Math.hypot(box.x - box.startX, box.y - box.startY) < 2) return

    const end = edgePoint(box, box.anchorX, box.anchorY)
    const line = chart.renderer
      .path(['M', box.anchorX, box.anchorY, 'L', end.x, end.y])
      .attr({ stroke: lineColor, 'stroke-width': 1, zIndex: 5 })
      // the line must not catch the mouse over a marker it crosses
      .css({ pointerEvents: 'none' })
      .add(box.group)

    chart.labelConnectors.push(line)
  })
}

export default spreadLabels

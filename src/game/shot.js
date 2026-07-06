import { ZONE_TARGETS, TOP_ROW_THRESHOLD_PX } from './constants.js'

// Map swipe vector → one of 6 goal zones.
// Per spec §3.2: the swipe determines DIRECTION only — the ball always travels
// from the penalty spot to the zone target at fixed power (~600ms). Speed/distance
// of swipe is irrelevant to where the ball goes.
export function swipeToZone(dx, dy, dist) {
  const normX = dx / dist

  let col
  if (normX < -0.22) col = 'L'
  else if (normX > 0.22) col = 'R'
  else col = 'C'

  const upwardPx = -dy  // positive = swiping up
  const row = upwardPx >= TOP_ROW_THRESHOLD_PX ? 'T' : 'B'

  return ZONE_TARGETS[row + col]
}

// Compute bezier control point for the ball arc.
// Always stays between svgStart and svgEnd — never overshoots.
// normDx: horizontal component of swipe direction (-1 left … +1 right)
export function computeControlPoint(svgStart, svgEnd, normDx) {
  const midX = (svgStart.x + svgEnd.x) / 2
  const midY = (svgStart.y + svgEnd.y) / 2
  return {
    x: midX + normDx * 22,  // subtle lateral bend following aim direction
    y: midY - 18,           // slight upward arc (ball rises before dipping in)
  }
}

// Quadratic bezier position at t ∈ [0,1]
export function bezierPoint(t, p0, p1, p2) {
  const u = 1 - t
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  }
}

// Smooth ease-in-out
export function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

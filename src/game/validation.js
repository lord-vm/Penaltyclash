import { pathLength } from './pathUtils.js'
import {
  SINUOSITY_LIMIT, LOOP_RADIUS_PX, LOOP_MIN_TRAVEL,
  MAX_CURVE_RATIO, SEVERE_CURVE_RATIO,
} from './constants.js'

/**
 * Validate a screen-coord path before firing a shot.  §4.2 (v2 — more lenient than v1)
 * Returns { valid: true } or { valid: false, reason: string }
 *
 * ACCEPT: straight lines, curved lines, lines with small wobble
 * REJECT only:
 *   1. True loops (coordinate revisited within 50px after travelling > 100px away)
 *   2. Sinuosity > 3× straight-line distance
 *   3. Severe over-curve > 33% of straight dist  (handled separately in clampOrRejectCurve)
 */
export function validatePath(pts) {
  if (pts.length < 2) return { valid: false, reason: 'too short' }

  const start = pts[0]
  const end   = pts[pts.length - 1]
  const straight = Math.hypot(end.x - start.x, end.y - start.y)
  if (straight < 10) return { valid: false, reason: 'too short' }

  const total = pathLength(pts)

  // 1. Sinuosity (scribbling) — v2 limit is 3× (was 2×)
  if (total > SINUOSITY_LIMIT * straight) {
    return { valid: false, reason: 'scribble' }
  }

  // 2. True loops — point revisited within 50px AFTER having moved > 100px away
  // Compare each point only against EARLIER points that the path has travelled
  // more than LOOP_MIN_TRAVEL away from (by arc length since that earlier point).
  // Without the arc-length gate, any straight line trips this once its total
  // length passes 100px — consecutive points a few px apart are always within
  // 50px of each other, which isn't a "loop" in any meaningful sense.
  const sparse = downsampleForCheck(pts, 50)
  const arc = [0]
  for (let i = 1; i < sparse.length; i++) {
    arc.push(arc[i-1] + Math.hypot(sparse[i].x - sparse[i-1].x, sparse[i].y - sparse[i-1].y))
  }
  for (let i = 0; i < sparse.length; i++) {
    for (let j = 0; j < i; j++) {
      if (arc[i] - arc[j] <= LOOP_MIN_TRAVEL) continue
      if (Math.hypot(sparse[i].x - sparse[j].x, sparse[i].y - sparse[j].y) < LOOP_RADIUS_PX) {
        return { valid: false, reason: 'loop' }
      }
    }
  }

  return { valid: true }
}

function downsampleForCheck(pts, n) {
  if (pts.length <= n) return pts
  const out  = [pts[0]]
  const step = (pts.length - 1) / (n - 1)
  for (let i = 1; i < n - 1; i++) out.push(pts[Math.round(i * step)])
  out.push(pts[pts.length - 1])
  return out
}

/**
 * v2 §4.4 — Curve-limit rule based on STRAIGHT-LINE distance (not path length).
 *
 * straight = |end - start|
 * MAX_CURVE_RATIO    = 0.22  → clamp   if peak perp > 22% of straight
 * SEVERE_CURVE_RATIO = 0.33  → reject  if peak perp > 33% of straight
 *
 * Returns { action: 'ok'|'clamp'|'reject', pts: [...] }
 */
export function clampOrRejectCurve(pts) {
  if (pts.length < 3) return { action: 'ok', pts }

  const s = pts[0]
  const e = pts[pts.length - 1]
  const straight = Math.hypot(e.x - s.x, e.y - s.y)
  if (straight < 1) return { action: 'ok', pts }

  const dirX =  (e.x - s.x) / straight
  const dirY =  (e.y - s.y) / straight
  const perpX = -dirY
  const perpY =  dirX

  let maxPerp = 0
  for (const p of pts) {
    const dx   = p.x - s.x
    const dy   = p.y - s.y
    const perp = Math.abs(dx * perpX + dy * perpY)
    if (perp > maxPerp) maxPerp = perp
  }

  const maxAllowed    = straight * MAX_CURVE_RATIO     // 22%
  const severeLimit   = straight * SEVERE_CURVE_RATIO  // 33%

  if (maxPerp <= maxAllowed) return { action: 'ok', pts }
  if (maxPerp > severeLimit)  return { action: 'reject', pts }

  // Clamp: scale all perpendicular offsets down to maxAllowed
  const scale = maxAllowed / maxPerp
  const clamped = pts.map(p => {
    const dx   = p.x - s.x
    const dy   = p.y - s.y
    const proj = dx * dirX  + dy * dirY
    const perp = (dx * perpX + dy * perpY) * scale
    return { x: s.x + proj * dirX + perp * perpX,
             y: s.y + proj * dirY + perp * perpY }
  })
  return { action: 'clamp', pts: clamped }
}

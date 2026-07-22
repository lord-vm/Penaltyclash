import { BALL_START } from './constants.js'
import { screenToSvg } from '../lib/svgCoords.js'

/**
 * v2 §4.3 — Light smoothing via 5-point moving average.
 * Kills micro-tremors from finger shake while preserving the intended curve shape.
 * Applied to screen-coord path BEFORE normalization.
 */
export function smoothPath(pts) {
  if (pts.length < 5) return pts
  const WINDOW = 2  // ±2 neighbours → window of 5
  return pts.map((p, i) => {
    let sx = 0, sy = 0, count = 0
    for (let d = -WINDOW; d <= WINDOW; d++) {
      const idx = Math.max(0, Math.min(pts.length - 1, i + d))
      sx += pts[idx].x; sy += pts[idx].y; count++
    }
    return { x: sx / count, y: sy / count }
  })
}

// Total drawn-path length in screen pixels
export function pathLength(pts) {
  let len = 0
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y)
  }
  return len
}

// Thin a large point array to ≤ targetCount evenly-spaced samples
export function downsample(pts, targetCount) {
  if (pts.length <= targetCount) return [...pts]
  const out  = [pts[0]]
  const step = (pts.length - 1) / (targetCount - 1)
  for (let i = 1; i < targetCount - 1; i++) out.push(pts[Math.round(i * step)])
  out.push(pts[pts.length - 1])
  return out
}

// Map a screen-coord path so that:
//   path[0]  → BALL_START   (penalty spot in SVG)
//   path[-1] → svgTarget    (validated goal point in SVG)
// Intermediate points are anisotropically scaled to preserve the drawn curve.
export function normalizePath(screenPts, svgTarget, containerEl) {
  if (screenPts.length < 2) return [BALL_START, svgTarget]

  const svgPts = screenPts.map(p => screenToSvg(p.x, p.y, containerEl))
  const s = svgPts[0]
  const e = svgPts[svgPts.length - 1]

  const fromDX = e.x - s.x
  const fromDY = e.y - s.y
  const toDX   = svgTarget.x - BALL_START.x
  const toDY   = svgTarget.y - BALL_START.y

  const sx = Math.abs(fromDX) > 0.5 ? toDX / fromDX : 0
  const sy = Math.abs(fromDY) > 0.5 ? toDY / fromDY : 0

  return svgPts.map(p => ({
    x: BALL_START.x + (p.x - s.x) * sx,
    y: BALL_START.y + (p.y - s.y) * sy,
  }))
}

/**
 * Resample a polyline into `count` points evenly spaced by ARC LENGTH.
 * Pointer samples are spaced by drawing speed, not distance, so index-based
 * interpolation replays the player's hand speed as ball speed. Emitted points
 * lie exactly on the original polyline (same curve, redistributed samples);
 * first/last points are preserved exactly — the endpoint decides the outcome.
 */
export function resampleByArcLength(pts, count) {
  if (pts.length < 3 || count < 2) return [...pts]

  // Cumulative arc-length table
  const cum = [0]
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  }
  const total = cum[cum.length - 1]
  if (total < 1e-6) return [...pts]   // degenerate: all points coincide

  const out = [pts[0]]
  let seg = 1
  for (let i = 1; i < count - 1; i++) {
    const target = (total * i) / (count - 1)
    while (seg < pts.length - 1 && cum[seg] < target) seg++
    const a = pts[seg - 1], b = pts[seg]
    const segLen = cum[seg] - cum[seg - 1] || 1e-6
    const f = (target - cum[seg - 1]) / segLen
    out.push({ x: a.x + f * (b.x - a.x), y: a.y + f * (b.y - a.y) })
  }
  out.push(pts[pts.length - 1])
  return out
}

// Linearly interpolate position along path at t ∈ [0,1]
export function interpolatePath(pts, t) {
  if (!pts || pts.length === 0) return BALL_START
  if (pts.length === 1 || t <= 0) return pts[0]
  if (t >= 1) return pts[pts.length - 1]
  const fi  = t * (pts.length - 1)
  const idx = Math.floor(fi)
  const f   = fi - idx
  const a   = pts[idx]
  const b   = pts[Math.min(idx + 1, pts.length - 1)]
  return { x: a.x + f * (b.x - a.x), y: a.y + f * (b.y - a.y) }
}

// Ease-in-out (used for keeper)
export function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

export function easeOut(t) {
  return 1 - (1 - t) * (1 - t)
}

/**
 * v2 §5.1 — Ball velocity profile: constant speed, start to finish.
 * Linear time→distance mapping — no acceleration phases at all. Collision
 * checks are position-based, so this only changes pacing, not outcomes.
 */
export function ballVelocityProfile(t) {
  return t
}

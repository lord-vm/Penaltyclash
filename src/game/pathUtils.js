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
 * v2 §5.1 — Ball velocity profile.
 * Accelerates over first 15% (foot impact burst), constant through middle,
 * decelerates slightly over final 15% (air drag feel).
 */
export function ballVelocityProfile(t) {
  if (t < 0.15) {
    const n = t / 0.15
    return n * n * 0.15            // quadratic ramp-up → reaches 0.15 at t=0.15
  }
  if (t <= 0.85) {
    return t                       // linear / constant velocity through middle
  }
  const n = (t - 0.85) / 0.15
  return 0.85 + (1 - (1 - n) * (1 - n)) * 0.15  // slight ease-in at end
}

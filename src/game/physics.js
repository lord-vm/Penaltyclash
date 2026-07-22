import { GOAL } from './constants.js'

// Ball radius in SVG user units
export const BALL_R = 12

// Keeper scale factor (applied by parent <g transform="...scale(0.52)">)
const K_SCALE = 0.52

// Keeper hitboxes in keeper LOCAL coordinates (before scale is applied).
// Combined hitbox = union of body rect + outstretched-arm rect.
//   Body: ±26 wide, -77 to +77 tall — matches the torso sprite width exactly;
//         covers torso + legs (drives center/low saves). Unchanged.
//   Arms: ±76 wide, -50 to -4 tall — tightened to the visible glove reach
//         (sprite glove edge is at local ±66) plus ~15% forgiveness, so saves
//         no longer register with the ball visually inside the goal. The arm
//         band's vertical extent lets a HIGH-positioned dive reach the top
//         corner (see the *_HIGH keeper targets).
const BODY_HW = 26, BODY_YMIN = -77, BODY_YMAX = 77
const ARM_HW  = 76, ARM_YMIN = -50, ARM_YMAX = -4

// Goal posts / crossbar in SVG world coords (matching Pitch.jsx geometry)
export const POSTS = {
  left:  { x1: 38, y1: 202, x2: 48,  y2: 308 },
  right: { x1: 342, y1: 202, x2: 352, y2: 308 },
  top:   { x1: 38, y1: 202, x2: 352, y2: 212 },
}

// Extended clamp region for endpoint (Bug 4):
// goal frame ± 20% on each side → wide misses allowed, stands disallowed
const MARGIN_X = (GOAL.x2 - GOAL.x1) * 0.20  // 60
const MARGIN_Y = (GOAL.y2 - GOAL.y1) * 0.20  // 22
export const CLAMP = {
  x1: GOAL.x1 - MARGIN_X,   // −15
  x2: GOAL.x2 + MARGIN_X,   // 405
  y1: GOAL.y1 - MARGIN_Y,   // 173
  y2: GOAL.y2 + MARGIN_Y,   // 327
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Circle-vs-AABB: is circle (cx,cy,r) intersecting rect [rx1,ry1,rx2,ry2]?
function circleRect(cx, cy, r, rx1, ry1, rx2, ry2) {
  const nearX = Math.max(rx1, Math.min(rx2, cx))
  const nearY = Math.max(ry1, Math.min(ry2, cy))
  return (cx - nearX) ** 2 + (cy - nearY) ** 2 <= r * r
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Check ball (world SVG coords) against keeper (world position + rotation).
 * The keeper's SVG transform is: translate(kx,ky) rotate(kRot) scale(K_SCALE)
 * We transform the ball into the keeper's local coordinate system and test
 * against the local hitbox rects.
 */
export function ballHitsKeeper(bx, by, kx, ky, kRot) {
  const r     = kRot * (Math.PI / 180)
  const dx    = bx - kx
  const dy    = by - ky
  // Inverse rotation then inverse scale → keeper local coords
  const lx = ( dx * Math.cos(r) + dy * Math.sin(r)) / K_SCALE
  const ly = (-dx * Math.sin(r) + dy * Math.cos(r)) / K_SCALE
  const lr = BALL_R / K_SCALE  // ball radius in local units

  return (
    circleRect(lx, ly, lr, -BODY_HW, BODY_YMIN, BODY_HW, BODY_YMAX) ||
    circleRect(lx, ly, lr, -ARM_HW,  ARM_YMIN,  ARM_HW,  ARM_YMAX)
  )
}

/**
 * Check ball against goal posts and crossbar.
 * Returns 'left' | 'right' | 'top' | null
 *
 * Side-post corner exclusion: a ball passing OUTSIDE a post's x-range at or
 * below the goal line should never register as a post hit (false corner graze).
 */
export function ballHitsPost(bx, by) {
  const { left, right, top } = POSTS

  // Left post: skip if ball is clearly to the left AND at/below goal line
  const leftBlocked  = bx < left.x1  && by >= GOAL.y2
  const rightBlocked = bx > right.x2 && by >= GOAL.y2

  if (!leftBlocked  && circleRect(bx, by, BALL_R, left.x1,  left.y1,  left.x2,  left.y2))  return 'left'
  if (!rightBlocked && circleRect(bx, by, BALL_R, right.x1, right.y1, right.x2, right.y2)) return 'right'
  if (circleRect(bx, by, BALL_R, top.x1, top.y1, top.x2, top.y2)) return 'top'
  return null
}

/**
 * Is ball center inside the goal mouth?
 * Uses ball-center position only — no radius inset.
 * The visual IS the truth: if the center crosses the crossbar line it's in.
 */
export function inGoalFrame(x, y) {
  return (
    x > GOAL.x1 &&
    x < GOAL.x2 &&
    y > GOAL.y1 &&   // center past the crossbar
    y <= GOAL.y2     // center at or before goal line
  )
}

/**
 * Clamp an SVG endpoint to the extended reachable region (Bug 4).
 * Wide misses are allowed; shooting into the stands is not.
 */
export function clampEndpoint(svgX, svgY) {
  return {
    x: Math.max(CLAMP.x1, Math.min(CLAMP.x2, svgX)),
    y: Math.max(CLAMP.y1, Math.min(CLAMP.y2, svgY)),
  }
}

/**
 * Reflect a velocity vector on a post hit.
 * postHit: 'left' | 'right' → reverse x;  'top' → reverse y
 */
export function reflectVelocity(vx, vy, postHit) {
  return postHit === 'top' ? { vx, vy: -vy } : { vx: -vx, vy }
}

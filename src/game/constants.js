// SVG viewBox: 0 0 390 844
//
// Scene layout:
//   Sky / stadium:  y =   0 … 305  (36%)
//   Pitch surface:  y = 305 … 844  (64%)
//   Horizon:        y = 305
//
// Goal frame (exactly 3:1 wide:tall — spec §8.4):
//   Left post  x = 45,  right post x = 345  → width  300 px
//   Crossbar   y = 205, goal-line  y = 305  → height 100 px

export const BALL_START = { x: 195, y: 490 }
export const SHOT_COUNT = 5

// Goal frame in SVG user units
export const GOAL = { x1: 45, x2: 345, y1: 205, y2: 305 }

// Keeper resting position & dive targets (SVG user units; inner <g> uses scale 0.52)
export const KEEPER_REST   = { x: 195, y: 268 }
// Low dives (default) — dive down toward the ground.
export const KEEPER_LEFT   = { x:  88, y: 292, r: -68 }
export const KEEPER_RIGHT  = { x: 302, y: 292, r:  68 }
export const KEEPER_CENTER = { x: 195, y: 260, r:   0 }
// High dives — used when the keeper commits UP (vertical read/streak). Raised
// ~60 toward the crossbar so the gloves reach the top corner; x pulled slightly
// inward (a high save is more upward reach than full lateral stretch); rotation
// eased so the arms point up-and-out into the corner.
export const KEEPER_LEFT_HIGH   = { x: 100, y: 232, r: -50 }
export const KEEPER_RIGHT_HIGH  = { x: 290, y: 232, r:  50 }
export const KEEPER_CENTER_HIGH = { x: 195, y: 222, r:   0 }

// Path-drawing power thresholds (screen px per second)  — §4.5
export const SPEED_SLOW = 400
export const SPEED_FAST = 1200
export const DUR_SLOW   = 600   // ms
export const DUR_MED    = 420   // ms
export const DUR_FAST   = 250   // ms

// ── v2 §4.2 — path validation (more lenient than v1) ────────────────────────
export const MIN_PATH_PX     = 40    // minimum total length to register a shot
export const MAX_SHOT_MS     = 2500  // max draw duration before cancelling (v1 was 1500)
export const LOOP_RADIUS_PX  = 50   // proximity radius for loop detection (v1 was 40)
export const LOOP_MIN_TRAVEL = 100  // must travel this far before looping is checked
export const SINUOSITY_LIMIT = 3.0  // max (path length / straight dist) ratio (v1 was 2.0)

// ── v2 §4.4 — curve limits, based on STRAIGHT-LINE start→end distance ────────
export const MAX_CURVE_RATIO    = 0.22  // clamp  if peak perp deviation > 22% of straight dist
export const SEVERE_CURVE_RATIO = 0.33  // reject if peak perp deviation > 33% of straight dist

// ── Curve-direction-reversal check (rejects S-curves / multi-bend squiggles) ─
// Peak-deviation (above) only catches a single bend; an S-curve keeps each lobe
// under SEVERE and slips through. This layered check counts how many times the
// path meaningfully reverses bend direction.
export const REVERSAL_STEP_PX   = 24    // arc-length stride for coarse segment vectors (jitter filter)
export const REVERSAL_MIN_TURN  = 18    // min turn angle (deg) at a junction to count as a real bend
export const MAX_REVERSALS      = 1     // allow ≤1 (single S / end-settle); reject at 2+ ('wavy')

// ── v2 §6.4 — post deflection ────────────────────────────────────────────────
export const DEFLECT_RETAIN = 0.60  // fraction of velocity kept after post contact (40% lost)
export const DEFLECT_MS     = 400   // post-deflection travel time in ms (v1 was 220)

// ── v2 §7.2 — keeper AI ──────────────────────────────────────────────────────
// Keeper is blind to the current shot — it commits its dive at pointerup using
// only (a) general penalty-kick tendencies and (b) the player's session history.
// Directions left/center/right are the same screen-space labels used for
// shotDir/KEEPER_LEFT/RIGHT/CENTER throughout this file.
export const GENERAL_PATTERNS = {
  horizontal:  { left: 0.30, center: 0.15, right: 0.55 },
  vertical:    { bottom: 0.68, top: 0.32 },
  bottomZones: { bottomLeft: 0.18, bottomCenter: 0.10, bottomRight: 0.40 },
  topZones:    { topLeft: 0.12, topCenter: 0.05, topRight: 0.15 },
}

// Belief = blend.general * GENERAL_PATTERNS.horizontal + blend.history * playerHistory
// Keyed by shot number (1-indexed). Shot 5+ reuses the shot-5 weights.
export const BELIEF_BLEND_BY_SHOT = {
  1: { general: 1.0, history: 0.0 },
  2: { general: 0.7, history: 0.3 },
  3: { general: 0.4, history: 0.6 },
  4: { general: 0.3, history: 0.7 },
  5: { general: 0.3, history: 0.7 },
}

export const KEEPER_MISREAD_CHANCE  = 0.15  // dive opposite of belief (keepers make mistakes)
export const KEEPER_STREAK_LENGTH   = 2     // consecutive same-direction shots that trigger streak bias
export const KEEPER_STREAK_BOOST    = 0.20  // extra belief weight toward a streak direction (horizontal)
export const KEEPER_VERT_STREAK_BOOST = 0.20 // extra belief toward a vertical streak (all-high / all-low)
export const KEEPER_POST_SAVE_BOOST = 0.25  // extra belief toward the side opposite a save, next shot only

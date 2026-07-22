import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { COUNTRIES } from '../data/countries.js'
import { CLUBS } from '../data/clubs.js'
import TeamBadge from '../components/TeamBadge.jsx'
import Pitch from '../components/Pitch.jsx'
import KeeperFigure from '../components/KeeperFigure.jsx'
import {
  BALL_START, SHOT_COUNT, GOAL, START_ZONE_R, START_RING_R,
  KEEPER_REST, KEEPER_LEFT, KEEPER_RIGHT, KEEPER_CENTER,
  KEEPER_LEFT_HIGH, KEEPER_RIGHT_HIGH, KEEPER_CENTER_HIGH,
  SPEED_SLOW, SPEED_FAST, DUR_SLOW, DUR_MED, DUR_FAST,
  MIN_PATH_PX, MAX_SHOT_MS, MAX_REVERSALS,
  GENERAL_PATTERNS, BELIEF_BLEND_BY_SHOT,
  KEEPER_MISREAD_CHANCE, KEEPER_STREAK_LENGTH, KEEPER_STREAK_BOOST, KEEPER_VERT_STREAK_BOOST, KEEPER_POST_SAVE_BOOST,
  DEFLECT_RETAIN, DEFLECT_MS,
} from '../game/constants.js'
import { screenToSvg } from '../lib/svgCoords.js'
import {
  pathLength, smoothPath, downsample, normalizePath, interpolatePath,
  resampleByArcLength, easeOut, ballVelocityProfile,
} from '../game/pathUtils.js'
import { validatePath, clampOrRejectCurve, curveReversals } from '../game/validation.js'
import {
  ballHitsKeeper, ballHitsPost, inGoalFrame,
  clampEndpoint, reflectVelocity, BALL_R, POSTS,
} from '../game/physics.js'
import {
  startCrowdAmbience, crowdReactGoal, crowdReactMiss,
  playPostHit, playNetRipple, playSaveThud, playKick,
} from '../lib/sfx.js'
import { fetchScoreboard } from '../lib/supabase.js'

export default function Game({ country, mode = 'country', onResult, onHome }) {
  const [shotsDone, setShotsDone] = useState(0)
  const [goals,     setGoals]     = useState(0)
  const [saves,     setSaves]     = useState(0)  // keeper's side of the ledger (misses count for neither)
  const [suddenDeath, setSuddenDeath] = useState(false)
  const [flash,     setFlash]     = useState(null)  // { type:'goal'|'miss'|'save', wide?, side? } | null
  const [hint,      setHint]      = useState(null)  // redraw hint text
  const [postFx,    setPostFx]    = useState(null)  // { x, y, key } — post-impact punch overlay
  const [goalFx,    setGoalFx]    = useState(null)  // { x, y, key, parts } — goal splash particles
  const [neighbors, setNeighbors] = useState(null)  // §2.3 you+neighbors rows from scoreboard fn
  const [keeperPose, setKeeperPose] = useState('ready') // 'ready' | 'leaping' — visual pose for high dives
  const netAnimRef = useRef(0)                      // cancels an in-flight net ripple on re-trigger

  const accent = country?.primary || '#FEDF00'

  // Current shooter: cycle the selected team's 5-player lineup across the shots
  // (shot N → lineup[N]); in sudden death keep cycling with % 5.
  const lineup  = country?.lineup
  const shooter = lineup?.length ? lineup[shotsDone % lineup.length] : null

  // API rows → NeighborPanel shape
  const neighborRows = (neighbors ?? []).map(r => ({
    rank:   r.rank,
    code:   r.code,
    name:   r.name,
    score:  r.win_count,
    isUser: r.code === country?.code,
  }))

  // DOM refs — all animation bypasses React state for smoothness
  const containerRef  = useRef(null)
  const sceneRef      = useRef(null)   // wraps all visual layers — camera lean/shake target
  const ballRef       = useRef(null)
  const shadowRef     = useRef(null)
  const keeperRef     = useRef(null)
  const liveTrailRef  = useRef(null)
  const fadeTrailRef  = useRef(null)
  const ballTrailRef  = useRef(null)   // v2 §5.2 travel trail (SVG polyline)
  const ballTrailPts  = useRef([])     // accumulated SVG positions during flight
  // Fire — all children of ballRef (on the ball, never the path). fireAnchorRef
  // is rotated every frame to point opposite the ball's real travel direction
  // (canceling the ball's own spin so the trail doesn't spin with it) —
  // that's what makes it read as wind-blown flame streaming off the back,
  // not a static halo. fireTintRef stays outside the anchor (a uniform
  // surface tint has no "direction").
  const fireAnchorRef = useRef(null)   // fire — outer group, JS-driven rotation (points backward)
  const fireAuraRef   = useRef(null)   // fire — blurred glow, elongated backward
  const fireRef       = useRef(null)   // fire — flickering flame licks, fanned backward
  const fireTintRef   = useRef(null)   // fire — hot overlay tinting the ball's own surface
  const fireScaleRef  = useRef(1)      // fire — current power-derived scale (plain value, not DOM)

  // Mutable shot state (no re-render)
  const phaseRef      = useRef('idle')
  const shotsRef      = useRef(0)
  const goalsRef      = useRef(0)
  const savesRef      = useRef(0)
  const suddenDeathRef = useRef(false)
  const ptrRef        = useRef(null)
  // v2 §7.2 — keeper memory: full session history of the PLAYER's actual shot
  // directions. The keeper is blind to the current shot — it only ever sees
  // this history when deciding where to dive.
  const shotMemoryRef    = useRef([])   // array of 'left'|'center'|'right'
  // Parallel vertical placement memory, pushed in LOCKSTEP with shotMemoryRef
  // (same shot → same index). Kept separate rather than merging into {h,v}
  // entries so the existing horizontal streak/blend code is untouched.
  const shotVertMemoryRef = useRef([]) // array of 'top'|'bottom'
  const lastShotDirRef   = useRef(null) // this shot's actual direction (set at release)
  const pendingSaveBoostRef = useRef(null) // direction of the shot just SAVED, consumed by next decision only

  useEffect(() => {
    placeBall(BALL_START, 1)
    placeKeeper(KEEPER_REST)
    startCrowdAmbience()   // idempotent — persistent crowd bed, reacts to shot outcomes
  }, [])

  // v2 §2.3 — neighbor panel refreshes between shots OR every 5 seconds,
  // whichever is later: the effect re-runs after each shot and an interval
  // covers idle time; fetchScoreboard's 5s client cache enforces the "later".
  // Works in both modes now — countries and clubs each have their own board.
  useEffect(() => {
    let live = true
    const load = () => {
      fetchScoreboard(country?.code, { kind: mode }).then(data => {
        if (live && data?.neighbors) setNeighbors(data.neighbors)
      })
    }
    load()
    const iv = setInterval(load, 5000)
    return () => { live = false; clearInterval(iv) }
  }, [shotsDone, country?.code, mode])

  // ── DOM helpers ───────────────────────────────────────────────────────────

  function placeBall({ x, y }, scale, rotation = 0) {
    ballRef.current?.setAttribute(
      'transform',
      `translate(${x},${y}) scale(${scale}) rotate(${rotation})`
    )
    shadowRef.current?.setAttribute(
      'transform',
      `translate(${x},${y + 15}) scale(${scale * 0.82})`
    )
  }

  function placeKeeper({ x, y, r = 0 }) {
    keeperRef.current?.setAttribute(
      'transform',
      `translate(${x},${y}) rotate(${r}) scale(0.52)`
    )
  }

  // ── Trail helpers ─────────────────────────────────────────────────────────

  function toContainerPts(screenPts) {
    if (!containerRef.current) return ''
    const rect = containerRef.current.getBoundingClientRect()
    return screenPts.map(p => `${p.x - rect.left},${p.y - rect.top}`).join(' ')
  }

  function showLiveTrail(pts) {
    liveTrailRef.current?.setAttribute('points', toContainerPts(pts))
  }
  function clearLiveTrail() {
    liveTrailRef.current?.setAttribute('points', '')
  }
  function showFadeTrail(screenPts) {
    if (!fadeTrailRef.current) return
    fadeTrailRef.current.setAttribute('points', toContainerPts(screenPts))
    fadeTrailRef.current.style.transition = 'none'
    fadeTrailRef.current.style.opacity = '0.5'
    requestAnimationFrame(() => {
      if (fadeTrailRef.current) {
        fadeTrailRef.current.style.transition = 'opacity 500ms linear'
        fadeTrailRef.current.style.opacity    = '0'
      }
    })
  }
  function clearFadeTrail() {
    if (!fadeTrailRef.current) return
    fadeTrailRef.current.style.transition = 'none'
    fadeTrailRef.current.style.opacity    = '0'
    fadeTrailRef.current.setAttribute('points', '')
  }

  // v2 §5.2 — Ball travel trail (fades 400ms after shot resolves). Plain
  // white trail only — the fire effect lives ON the ball itself (see
  // showFire/hideFire below), not on this path-following polyline.
  function appendBallTrail(svgX, svgY) {
    ballTrailPts.current.push(`${svgX.toFixed(1)},${svgY.toFixed(1)}`)
    if (ballTrailRef.current && ballTrailPts.current.length > 1) {
      ballTrailRef.current.setAttribute('points', ballTrailPts.current.join(' '))
    }
  }
  function fadeBallTrail(ms = 400) {
    if (!ballTrailRef.current) return
    ballTrailRef.current.style.transition = `opacity ${ms}ms linear`
    ballTrailRef.current.style.opacity    = '0'
    setTimeout(() => {
      if (ballTrailRef.current) {
        ballTrailRef.current.style.transition = 'none'
        ballTrailRef.current.style.opacity    = '0.4'
        ballTrailRef.current.setAttribute('points', '')
      }
      ballTrailPts.current = []
    }, ms + 20)
  }
  function clearBallTrail() {
    if (ballTrailRef.current) {
      ballTrailRef.current.style.transition = 'none'
      ballTrailRef.current.style.opacity    = '0.4'
      ballTrailRef.current.setAttribute('points', '')
    }
    ballTrailPts.current = []
  }

  // Fire effect — the ball itself looks engulfed in flame (aura glow + flame
  // licks + a hot tint on its own surface), all children of ballRef so they
  // move/scale/rotate WITH the ball only. Nothing traces the drawn path.
  // Shown only while in flight; intensity scales with shot power (~0.5-1.5)
  // so a hard-struck shot looks more dramatic than a gentle one.
  function showFire(power = 1) {
    const k = 0.7 + power * 0.5   // ~1.05 at power 0.5, ~1.45 at power 1.5
    fireScaleRef.current = k
    if (fireAuraRef.current) fireAuraRef.current.style.opacity = '0.6'
    if (fireRef.current)     fireRef.current.style.opacity     = '1'
    if (fireTintRef.current) fireTintRef.current.style.opacity = '0.5'
    // Sane default before the first frame tick supplies a real travel angle
    if (fireAnchorRef.current) fireAnchorRef.current.setAttribute('transform', `rotate(0) scale(${k})`)
  }
  function hideFire() {
    if (fireAuraRef.current) fireAuraRef.current.style.opacity = '0'
    if (fireRef.current) fireRef.current.style.opacity = '0'
    if (fireTintRef.current) fireTintRef.current.style.opacity = '0'
  }

  // Points the fire anchor opposite the ball's REAL travel direction, so the
  // flame streams backward like wind resistance — independent of the ball's
  // own spin (bRot), which would otherwise drag a fixed-angle flame around in
  // circles as the ball rotates. `worldDeg` is where "backward" is in the
  // same atan2 convention as the travel-direction calc in the frame loop;
  // subtracting bRot cancels the parent <g>'s own rotation contribution
  // (SVG nested rotations add, so the child's local angle must un-add it).
  function placeFireDirection(worldDeg, bRot) {
    if (!fireAnchorRef.current) return
    const local = worldDeg - bRot
    fireAnchorRef.current.setAttribute('transform', `rotate(${local}) scale(${fireScaleRef.current})`)
  }

  // ── Polish FX (visual-only — no physics/collision changes) ───────────────

  // Camera "lean" after a wide miss: scene scales up 1.03 toward the miss side,
  // holds a beat, then settles back. One GPU transform on the scene wrapper.
  function leanCamera(side) {
    const el = sceneRef.current
    if (!el || !el.animate) return
    el.style.transformOrigin =
      side === 'left' ? '18% 32%' : side === 'right' ? '82% 32%' : '50% 28%'
    el.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.03)', offset: 0.36 },
        { transform: 'scale(1.03)', offset: 0.45 },
        { transform: 'scale(1)' },
      ],
      { duration: 550, easing: 'ease-in-out' }
    )
  }

  // Light camera shake on post contact (2px, 100ms)
  function shakeCamera() {
    const el = sceneRef.current
    if (!el || !el.animate) return
    el.animate(
      [0, 2, -2, 1, 0].map(px => ({ transform: `translate(${px}px,${px / 2}px)` })),
      { duration: 100, easing: 'linear' }
    )
  }

  // Struck post visibly vibrates: damped oscillation, ±2.5px, ~200ms
  function wobblePost(which) {
    const el = containerRef.current?.querySelector(`[data-post="${which}"]`)
    if (!el || !el.animate) return
    const axis = which === 'top' ? 'translateY' : 'translateX'
    el.animate(
      [0, 2.5, -2, 1.2, -0.6, 0].map(px => ({ transform: `${axis}(${px}px)` })),
      { duration: 200, easing: 'ease-out' }
    )
  }

  // Ball fades out softly as it sails wide (restored on reset)
  function fadeBallOut() {
    for (const r of [ballRef, shadowRef]) {
      if (r.current) {
        r.current.style.transition = 'opacity 300ms linear'
        r.current.style.opacity = '0'
      }
    }
  }
  function restoreBall() {
    for (const r of [ballRef, shadowRef]) {
      if (r.current) {
        r.current.style.transition = 'none'
        r.current.style.opacity = '1'
      }
    }
  }

  // Wide miss treatment: camera lean + ball fade + long trail linger.
  // (Crowd reaction is handled centrally in resolveShot via crowdReactMiss.)
  // Returns the side used for the "WIDE!" text anchor.
  function _wideMissFx(lastPt) {
    const side = lastPt.x < GOAL.x1 ? 'left'
               : lastPt.x > GOAL.x2 ? 'right'
               : 'center' // over the bar
    leanCamera(side)
    fadeBallOut()
    return side
  }

  // Post hit punch: ping + flash/shock-lines overlay + post wobble + light shake.
  // Pure overlay on the existing 400ms deflection — adds 0ms to the loop.
  function _postHitFx(pos, which) {
    playPostHit()
    wobblePost(which)
    shakeCamera()
    setPostFx({ x: pos.x, y: pos.y, key: performance.now() })
    setTimeout(() => setPostFx(null), 450)
  }

  // Goal net ripple — water-style radial waves from the impact point.
  // 3 staggered rings (0/100/200ms) expand over 600ms, bulging the net
  // strings radially outward (peak ~5% of goal width, decaying with radius),
  // then the whole net rocks gently for ~600ms before settling. Runs as one
  // rAF loop rewriting the net polylines; restores base geometry on finish.
  function netRippleFx(impact) {
    const group = containerRef.current?.querySelector('[data-net]')
    if (!group) return
    const lines = [...group.querySelectorAll('polyline')].map(el => ({
      el,
      base: el.getAttribute('data-base').split(' ').map(s => {
        const [x, y] = s.split(',').map(Number)
        return { x, y }
      }),
    }))
    if (!lines.length) return

    const token = ++netAnimRef.current
    const start = performance.now()
    const maxR  = Math.hypot(GOAL.x2 - GOAL.x1, GOAL.y2 - GOAL.y1)  // far corner reach
    const RING_STARTS = [0, 70, 140]
    const EXPAND_MS = 380, SETTLE_MS = 600, TOTAL = EXPAND_MS + SETTLE_MS
    const SIGMA = 20          // ring thickness
    const PEAK  = 35          // bulge amplitude — larger than the 20-unit net grid, clearly visible
    const JOLT_AMP = 22, JOLT_SIGMA = 12, JOLT_MS = 120  // hard initial jab at the impact point

    function restore() {
      group.removeAttribute('transform')
      for (const { el } of lines) el.setAttribute('points', el.getAttribute('data-base'))
    }

    function frame(now) {
      if (token !== netAnimRef.current) return   // superseded by a newer ripple
      const t = now - start
      if (t >= TOTAL) { restore(); return }

      // Settling rock: damped side-to-side sway after the rings finish
      if (t > EXPAND_MS) {
        const st   = (t - EXPAND_MS) / SETTLE_MS
        const sway = Math.sin(st * Math.PI * 3) * 2.5 * (1 - st)
        group.setAttribute('transform', `translate(${sway.toFixed(2)},0)`)
      }

      for (const { el, base } of lines) {
        let out = ''
        for (const p of base) {
          const dx = p.x - impact.x
          const dy = p.y - impact.y
          const d  = Math.hypot(dx, dy) || 0.001
          let disp = 0
          // The jab: concentrated punch at the impact point, decaying over the
          // first JOLT_MS — the "hit", before the rings carry it outward.
          if (t < JOLT_MS) {
            disp += JOLT_AMP * Math.exp(-(d * d) / (2 * JOLT_SIGMA * JOLT_SIGMA)) * (1 - t / JOLT_MS)
          }
          for (let k = 0; k < 3; k++) {
            const rt = t - RING_STARTS[k]
            if (rt < 0 || rt > EXPAND_MS) continue
            const R   = (rt / EXPAND_MS) * maxR
            const amp = PEAK * (1 - R / maxR) * (1 - k * 0.25)  // decays as ring expands; later rings weaker
            disp += amp * Math.exp(-((d - R) ** 2) / (2 * SIGMA * SIGMA))
          }
          if (disp) {
            // Contain the bulge inside the goal frame (+ small pad) so big
            // displacements never punch through the posts or crossbar.
            const px = Math.max(GOAL.x1 - 6, Math.min(GOAL.x2 + 6,  p.x + (dx / d) * disp))
            const py = Math.max(GOAL.y1 - 6, Math.min(GOAL.y2 + 10, p.y + (dy / d) * disp))
            out += `${px.toFixed(1)},${py.toFixed(1)} `
          } else {
            out += `${p.x},${p.y} `
          }
        }
        el.setAttribute('points', out)
      }
      requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }

  // Center splash particles at the net impact point (10 circles, 400ms,
  // slight gravity fall as they fade)
  function _goalSplash(impact) {
    const parts = Array.from({ length: 10 }, () => {
      const a  = Math.random() * Math.PI * 2
      const sp = 16 + Math.random() * 26
      return {
        dx: Math.cos(a) * sp,
        dy: Math.sin(a) * sp * 0.7 - 8,
        r:  2 + Math.random() * 2,
      }
    })
    setGoalFx({ x: impact.x, y: impact.y, key: performance.now(), parts })
    setTimeout(() => setGoalFx(null), 450)
  }

  // Full goal celebration FX bundle (visual + layered audio).
  // (Crowd reaction is handled centrally in resolveShot via crowdReactGoal.)
  function _goalFx(impact) {
    netRippleFx(impact)
    _goalSplash(impact)
    playNetRipple()
  }

  // ── Pointer events ────────────────────────────────────────────────────────

  function onPointerDown(e) {
    if (phaseRef.current !== 'idle') return
    // Fix 1 — shots must START at the ball. Ignore pointer-downs outside the
    // start zone (silently: no shot, no hint). Same screen→SVG conversion as
    // the endpoint uses, so gating is consistent with path capture.
    if (containerRef.current) {
      const svg = screenToSvg(e.clientX, e.clientY, containerRef.current)
      if (Math.hypot(svg.x - BALL_START.x, svg.y - BALL_START.y) > START_ZONE_R) return
    }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch (_) {}
    phaseRef.current = 'drawing'
    ptrRef.current = {
      startTime: performance.now(),
      path: [{ x: e.clientX, y: e.clientY }],
    }
    showLiveTrail([{ x: e.clientX, y: e.clientY }])
  }

  function onPointerMove(e) {
    if (phaseRef.current !== 'drawing' || !ptrRef.current) return
    const pt = { x: e.clientX, y: e.clientY }
    ptrRef.current.path.push(pt)
    showLiveTrail(ptrRef.current.path)

    // v2 BUGFIX — the keeper is blind to the shot until release. It must NOT
    // read the drawn path or lean toward the current endpoint; it stays put
    // until pointerup, at which point it dives based only on shot memory.
  }

  function onPointerUp(e) {
    if (phaseRef.current !== 'drawing' || !ptrRef.current) return

    const { startTime, path } = ptrRef.current
    ptrRef.current = null
    clearLiveTrail()

    if (!containerRef.current || path.length < 2) {
      phaseRef.current = 'idle'
      return
    }

    const drawMs  = performance.now() - startTime
    const pxLen   = pathLength(path)

    // ── v2 §4.2 — Path validation (lenient thresholds) ────────────────────
    if (pxLen < MIN_PATH_PX)   { _reject('Redraw');              return }
    if (drawMs > MAX_SHOT_MS)  { _reject('Too slow — redraw');   return }

    // ── v2 §4.3 — Smooth shaky input (5-point moving average) ────────────
    // All downstream checks (curve deviation, sinuosity/loop) run on the
    // SMOOTHED path so finger tremor doesn't push a clean curve over a limit.
    const smoothed = smoothPath(path)

    const check = validatePath(smoothed)
    if (!check.valid) {
      _reject(check.reason === 'scribble' ? 'Keep it simple — redraw'
            : check.reason === 'loop'    ? 'No loops — redraw'
            :                              'Redraw')
      return
    }

    // ── Endpoint clamping ─────────────────────────────────────────────────
    const lastPt    = smoothed[smoothed.length - 1]
    const rawSvgEnd = screenToSvg(lastPt.x, lastPt.y, containerRef.current)
    const svgEnd    = clampEndpoint(rawSvgEnd.x, rawSvgEnd.y)

    // ── v2 §4.4 — Curve limit, computed in SCREEN space on the smoothed path.
    // (Computing this after mapping into SVG space distorts the ratio, because
    // normalizePath scales x/y anisotropically to hit the goal target — a
    // gentle drawn curve toward a corner could appear hugely exaggerated in
    // SVG space and get wrongly rejected.)
    const curveCheck = clampOrRejectCurve(smoothed)
    if (curveCheck.action === 'reject') {
      _reject('Too much curve — redraw')
      return
    }

    // Reject S-curves / multi-bend squiggles (layered on top of the single-bend
    // peak-deviation limit above, which can't see direction reversals).
    if (curveReversals(smoothed) > MAX_REVERSALS) {
      _reject('Too wavy — one curve only')
      return
    }

    // Downsample + map the (possibly clamped) screen-space path into SVG travel
    // coords, then resample evenly by ARC LENGTH (in SVG space, after the
    // anisotropic normalize) so index-based interpolation moves the ball a
    // constant distance per time step instead of replaying hand speed.
    const sampled = downsample(curveCheck.pts, 40)
    const svgPath = resampleByArcLength(normalizePath(sampled, svgEnd, containerRef.current), 40)

    phaseRef.current = 'flying'

    // ── v2 §4.5 — Power from drawing speed ───────────────────────────────
    const speed = pxLen / Math.max(drawMs / 1000, 0.05)
    let power
    if      (speed < SPEED_SLOW) power = 0.5
    else if (speed > SPEED_FAST) power = 1.5
    else power = 0.5 + (speed - SPEED_SLOW) / (SPEED_FAST - SPEED_SLOW)

    const ballMs = Math.max(DUR_FAST, Math.min(DUR_SLOW, DUR_MED / power))

    // ── v2 §7.2 — Keeper dive direction, decided ONLY from general patterns +
    // shot memory. The keeper is blind to this shot's path/endpoint. It commits
    // its dive at the moment of release based purely on football-tendency priors
    // and the player's past shots.
    const dive = _keeperDecide(shotMemoryRef.current, shotVertMemoryRef.current, shotsRef.current + 1)

    // Record THIS shot's actual placement for future memory (after the keeper
    // has already committed — it never sees these values). Horizontal and
    // vertical are pushed in lockstep so the two memory arrays stay aligned.
    const relX    = (svgEnd.x - GOAL.x1) / (GOAL.x2 - GOAL.x1)
    const shotDir = relX < 0.35 ? 'left' : relX > 0.65 ? 'right' : 'center'
    // Top = upper 40% of the goal mouth (the top-corner zone).
    const shotVert = svgEnd.y < GOAL.y1 + 0.40 * (GOAL.y2 - GOAL.y1) ? 'top' : 'bottom'
    shotMemoryRef.current.push(shotDir)
    shotVertMemoryRef.current.push(shotVert)
    lastShotDirRef.current = shotDir

    const lowTarg  = dive.dir === 'left'  ? KEEPER_LEFT
                   : dive.dir === 'right' ? KEEPER_RIGHT
                   :                        KEEPER_CENTER
    const highTarg = dive.dir === 'left'  ? KEEPER_LEFT_HIGH
                   : dive.dir === 'right' ? KEEPER_RIGHT_HIGH
                   :                        KEEPER_CENTER_HIGH
    const keeperTarg = dive.high ? highTarg : lowTarg

    // Visual pose swap at the moment of dive commit — a HIGH dive shows the
    // leaping (arms-up) figure; low/center keep the ready pose. Transform and
    // hitbox are unchanged; only which shapes render swaps.
    setKeeperPose(dive.high ? 'leaping' : 'ready')

    // Show fading draw-path trail & fire
    showFadeTrail(sampled)
    playKick()   // §9 — short low thud at the moment of release
    startShot(svgPath, keeperTarg, ballMs, power)
  }

  function _reject(msg) {
    phaseRef.current = 'idle'
    setHint(msg)
    setTimeout(() => setHint(null), 1000)   // §4.2 — hint shows for 1s
    // NOT counted as a shot
  }

  /**
   * v2 §7.2 (extended) — keeper dive decision, BLIND to the current shot.
   *
   * 1. Belief = blend of GENERAL_PATTERNS.horizontal (football-tendency prior)
   *    and the player's session shot-direction history, weighted by shot number
   *    (more prior early, more history-driven by shot 3+).
   * 2. Streak bias: if the player's last KEEPER_STREAK_LENGTH shots all went
   *    the same way, nudge belief toward that direction.
   * 3. Post-save psychology: if the previous shot was SAVED, nudge belief
   *    toward the opposite side for this shot only (then the flag is cleared).
   * 4. Sample a direction from the blended belief (weighted random, not argmax
   *    — so the keeper isn't perfectly predictable even with a strong prior).
   * 5. 15% misread chance: dive opposite of the sampled belief.
   * 6. Vertical read: same blend + streak mechanic on the top/bottom axis to
   *    decide whether to commit to a HIGH dive. Returns { dir, high }.
   */
  function _keeperDecide(memory, vertMemory, shotNumber) {
    const dirs = ['left', 'center', 'right']

    // 1. Blend general prior with session history
    const blend = BELIEF_BLEND_BY_SHOT[Math.min(shotNumber, 5)]
    const hist  = memory.length === 0
      ? { left: 1/3, center: 1/3, right: 1/3 }
      : (() => {
          const counts = { left: 0, center: 0, right: 0 }
          memory.forEach(d => counts[d]++)
          return { left: counts.left / memory.length, center: counts.center / memory.length, right: counts.right / memory.length }
        })()

    const belief = {}
    dirs.forEach(d => {
      belief[d] = blend.general * GENERAL_PATTERNS.horizontal[d] + blend.history * hist[d]
    })

    // 2. Streak bias — last N shots all the same direction
    if (memory.length >= KEEPER_STREAK_LENGTH) {
      const tail = memory.slice(-KEEPER_STREAK_LENGTH)
      if (tail.every(d => d === tail[0])) {
        belief[tail[0]] += KEEPER_STREAK_BOOST
      }
    }

    // 3. Post-save psychology — nudge toward the opposite of the last-saved
    // direction, for THIS shot only. Flag is consumed here regardless.
    const savedDir = pendingSaveBoostRef.current
    pendingSaveBoostRef.current = null
    const oppositeOf = { left: 'right', right: 'left', center: null }
    const boostDir = savedDir ? oppositeOf[savedDir] : null
    if (boostDir) belief[boostDir] += KEEPER_POST_SAVE_BOOST

    // Normalize
    const total = dirs.reduce((s, d) => s + belief[d], 0)
    dirs.forEach(d => belief[d] /= total)

    // 4. Weighted random sample (not argmax — keeper isn't fully predictable)
    let beliefDir = dirs[dirs.length - 1]
    let r = Math.random()
    for (const d of dirs) {
      if (r < belief[d]) { beliefDir = d; break }
      r -= belief[d]
    }

    // 5. 15% misread — dive opposite of belief
    if (Math.random() < KEEPER_MISREAD_CHANCE) {
      beliefDir = beliefDir === 'left'  ? 'right'
                : beliefDir === 'right' ? 'left'
                : (Math.random() < 0.5 ? 'left' : 'right')
    }

    // 6. Vertical read — mirror of the horizontal logic on the top/bottom axis,
    // deciding whether to commit to a HIGH dive. Independent of direction.
    const vHist = vertMemory.length === 0
      ? { top: 0.5, bottom: 0.5 }
      : (() => {
          const top = vertMemory.filter(v => v === 'top').length / vertMemory.length
          return { top, bottom: 1 - top }
        })()
    const vBelief = {
      top:    blend.general * GENERAL_PATTERNS.vertical.top    + blend.history * vHist.top,
      bottom: blend.general * GENERAL_PATTERNS.vertical.bottom + blend.history * vHist.bottom,
    }
    // Vertical streak — last N shots all the same height nudges that way.
    if (vertMemory.length >= KEEPER_STREAK_LENGTH) {
      const vtail = vertMemory.slice(-KEEPER_STREAK_LENGTH)
      if (vtail.every(v => v === vtail[0])) vBelief[vtail[0]] += KEEPER_VERT_STREAK_BOOST
    }
    let high = Math.random() < vBelief.top / (vBelief.top + vBelief.bottom)
    // Vertical misread — independent flip, so height isn't perfectly predictable.
    if (Math.random() < KEEPER_MISREAD_CHANCE) high = !high

    return { dir: beliefDir, high }
  }

  // ── Unified shot animation (ball + keeper in one rAF loop) ───────────────

  function startShot(svgPath, keeperTarget, ballDuration, power = 1.0) {
    const startMs     = performance.now()
    const keeperMs    = 380
    const REACT_LAG   = 60   // v2 §7.3 — keeper reaction lag (ms)
    let done = false
    clearBallTrail()
    showFire(power)   // flame licks + fire trail, only while this shot is in flight

    // Over-the-bar: endpoint clearly above the crossbar hitbox (top edge minus
    // ball radius). A ball sailing over the bar can't be saved and shouldn't
    // register a crossbar graze on the way up — it must reach its above-bar
    // endpoint and resolve as an "over" miss (vertical twin of the wide fix).
    const endPt     = svgPath[svgPath.length - 1]
    const isOverBar = endPt.y <= POSTS.top.y1 - BALL_R
    // Wide-of-post (horizontal twin of isOverBar): a draw whose endpoint is
    // clearly beyond a post must sail wide — its trajectory grazes the post's
    // lower corner from the spot, and the deflection used to bounce it back IN
    // for an unearned goal. Endpoints in the post zone (within ±BALL_R of the
    // post rect) keep full collision — genuine grazes still deflect.
    const isWideRight = endPt.x >= POSTS.right.x2 + BALL_R   // ≥ 364
    const isWideLeft  = endPt.x <= POSTS.left.x1  - BALL_R   // ≤ 26

    function frame(now) {
      if (done) return
      const elapsed = now - startMs

      // v2 §7.3 — Keeper waits 60ms (reaction lag) then dives
      const keeperElapsed = Math.max(0, elapsed - REACT_LAG)
      const kt = Math.min(keeperElapsed / keeperMs, 1)
      const ke = easeOut(kt)
      const kx = KEEPER_REST.x + (keeperTarget.x - KEEPER_REST.x) * ke
      const ky = KEEPER_REST.y + (keeperTarget.y - KEEPER_REST.y) * ke
      const kr = (keeperTarget.r ?? 0) * ke
      placeKeeper({ x: kx, y: ky, r: kr })

      // v2 §5.1 — Ball: velocity profile + scale + rotation
      const bt     = Math.min(elapsed / ballDuration, 1)
      const be     = ballVelocityProfile(bt)      // struck-ball ease-out (no mid-flight stall)
      const bPos   = interpolatePath(svgPath, be)
      // Scale runs on raw linear time (bt), decoupled from the velocity easing,
      // so the shrink is perfectly steady; 0.58 floor reads as "into the net"
      // rather than "into a void".
      const bScale = 1 - (1 - 0.58) * bt
      const bRot   = bt * 360 * power * 0.7       // rotation proportional to power
      placeBall(bPos, bScale, bRot)

      // Fire direction — sample the path a hair earlier to get the ball's
      // REAL instantaneous travel direction (same technique as the post-
      // deflection velocity calc below), then point the flame trail at
      // travelAngle+180 (backward) so it streams like wind resistance.
      const firePrevBe  = ballVelocityProfile(Math.max(0, bt - 0.02))
      const firePrevPos = interpolatePath(svgPath, firePrevBe)
      const fireVx = bPos.x - firePrevPos.x || 0.01
      const fireVy = bPos.y - firePrevPos.y || 0.01
      const travelAngleDeg = Math.atan2(fireVy, fireVx) * 180 / Math.PI
      placeFireDirection(travelAngleDeg + 270, bRot)

      // v2 §5.2 — Append to travel trail
      appendBallTrail(bPos.x, bPos.y)

      // ── Keeper collision (only inside the goal mouth, not on pitch) ────────
      // Position-based guard: the ball must be inside the goal's y band before
      // the keeper can save it, so the rotating body never catches balls that
      // are still on the pitch side of the goal line. Independent of the
      // velocity easing — it opens exactly when the ball crosses the band.
      // Over-bar shots are unsaveable: the ball is going over the crossbar.
      if (!isOverBar && bPos.y <= GOAL.y2 + 8 && ballHitsKeeper(bPos.x, bPos.y, kx, ky, kr)) {
        done = true
        resolveShot('save')
        return
      }

      // ── Post collision ───────────────────────────────────────────────────
      // Skip the crossbar graze for an over-bar shot — let it sail over to its
      // above-bar endpoint and resolve as an "over" miss. Side-post hits, and
      // 'top' hits on non-over-bar shots, still deflect as before.
      const postHit = ballHitsPost(bPos.x, bPos.y, bScale)
      if (postHit && !(postHit === 'top'   && isOverBar)
                  && !(postHit === 'right' && isWideRight)
                  && !(postHit === 'left'  && isWideLeft)) {
        done = true
        // Velocity from path derivative — use same easing as ball position
        const prevBe  = ballVelocityProfile(Math.max(0, bt - 0.025))
        const prevPos = interpolatePath(svgPath, prevBe)
        const rawVx = bPos.x - prevPos.x || 0.01
        const rawVy = bPos.y - prevPos.y || -0.01
        const { vx, vy } = reflectVelocity(rawVx, rawVy, postHit)
        _postHitFx(bPos, postHit)
        startDeflection(bPos, bScale, vx, vy, { x: kx, y: ky, r: kr })
        return
      }

      // ── Continue or finish ───────────────────────────────────────────────
      if (bt < 1) {
        requestAnimationFrame(frame)
      } else {
        done = true
        const lastPt = svgPath[svgPath.length - 1]
        // Priority: GOAL beats post at final frame (visually ball crossed the line)
        if (inGoalFrame(lastPt.x, lastPt.y)) {
          resolveShot('goal', { impact: lastPt })
        } else {
          const endPost = ballHitsPost(lastPt.x, lastPt.y, bScale)
          if (endPost && !(endPost === 'right' && isWideRight)
                      && !(endPost === 'left'  && isWideLeft)) {
            // Post hit at endpoint — deflect (same easing as the flight)
            const prevBe  = ballVelocityProfile(Math.max(0, bt - 0.025))
            const prevPos = interpolatePath(svgPath, prevBe)
            const rawVx = lastPt.x - prevPos.x || 0.01
            const rawVy = lastPt.y - prevPos.y || -0.01
            const { vx, vy } = reflectVelocity(rawVx, rawVy, endPost)
            _postHitFx(lastPt, endPost)
            startDeflection(lastPt, bScale, vx, vy, { x:kx, y:ky, r:kr })
          } else {
            // Wide miss — ball sailed past the frame with no contact
            // (over the bar if the endpoint cleared the crossbar).
            const side = _wideMissFx(lastPt)
            resolveShot('miss', { wide: true, side, over: isOverBar })
          }
        }
      }
    }

    requestAnimationFrame(frame)
  }

  // Deflection animation after a post hit (Bug 2)
  // v2 §6.4 — post deflection: 40% velocity lost, 400ms continuation
  function startDeflection(hitPos, hitScale, vx, vy, keeperPos) {
    const rawSpeed = Math.hypot(vx, vy) || 0.1
    const speed = rawSpeed * DEFLECT_RETAIN   // 40% energy loss
    const nx = vx / rawSpeed
    const ny = vy / rawSpeed
    const deflectDist = speed * (DEFLECT_MS / 16) * 0.8  // proportional to retained speed
    const deflectMs   = DEFLECT_MS  // 400ms

    const startMs = performance.now()

    function frame(now) {
      const t    = Math.min((now - startMs) / deflectMs, 1)
      const pos  = { x: hitPos.x + nx * deflectDist * t,
                     y: hitPos.y + ny * deflectDist * t }
      placeBall(pos, hitScale * (1 - t * 0.25))
      // Keeper stays at final dive position during deflection
      placeKeeper(keeperPos)

      if (t < 1) {
        requestAnimationFrame(frame)
      } else {
        const inGoal = inGoalFrame(pos.x, pos.y)
        resolveShot(inGoal ? 'goal' : 'miss', inGoal ? { impact: pos } : {})
      }
    }

    requestAnimationFrame(frame)
  }

  // ── Shot resolution ────────────────────────────────────────────────────────

  function resolveShot(result, fx = {}) {
    hideFire()   // shot is decided — flame effect only belongs to the flight
    const scored   = result === 'goal'
    const saved    = result === 'save'
    const newGoals = goalsRef.current + (scored ? 1 : 0)
    const newSaves = savesRef.current + (saved ? 1 : 0)
    const newShots = shotsRef.current + 1
    goalsRef.current = newGoals
    savesRef.current = newSaves
    shotsRef.current  = newShots

    // v2 §7.2 — post-save psychology: if this shot was saved, bias the NEXT
    // shot's belief toward the opposite side (consumed once, then cleared).
    pendingSaveBoostRef.current = result === 'save' ? lastShotDirRef.current : null

    // Crowd reacts to every outcome: cheer on a goal, boo on anything else
    // (save or miss). One persistent bed, modulated — see sfx.js.
    if (scored) crowdReactGoal()
    else        crowdReactMiss()

    // Goal celebration: net ripple from the actual impact point + splash
    // particles + layered water-ripple/crowd-cheer audio. Purely visual/audio —
    // doesn't block the loop (next shot is playable as soon as phase resets).
    if (result === 'goal' && fx.impact) _goalFx(fx.impact)

    // §9 — keeper save thud (deep bass), the moment the ball is stopped
    if (result === 'save') playSaveThud()

    // v2 §5.2 — Fade ball travel trail on resolve.
    // Wide miss: trail lingers ~2x longer (FIFA-style tail as the ball sails past).
    fadeBallTrail(fx.wide ? 800 : 400)

    setGoals(newGoals)
    setSaves(newSaves)
    setShotsDone(newShots)
    setFlash({ type: result, wide: fx.wide, side: fx.side, over: fx.over })
    setTimeout(() => setFlash(null), 700)

    const endRound = (outcome) =>
      setTimeout(() => onResult(outcome, newGoals, suddenDeathRef.current), 1000)
    const nextShot = () =>
      setTimeout(() => {
        clearFadeTrail()
        restoreBall()
        placeBall(BALL_START, 1, 0)
        placeKeeper(KEEPER_REST)
        setKeeperPose('ready')   // back to the ready pose for the next shot
        phaseRef.current = 'idle'
      }, 900)

    // ── End-game rules ────────────────────────────────────────────────────
    // Ledger: player goals vs keeper saves; wide misses count for neither.
    // Regulation: 3+ goals wins (ends the moment the 3rd goal locks it).
    // After 5 shots: goals === saves is a genuine draw → sudden death;
    // any other sub-3 score is a loss, same as before.
    // Sudden death: goal → win on the spot; save → loss; wide miss → both
    // sides failed, still level → another sudden-death shot. No score cap.
    if (suddenDeathRef.current) {
      if (scored)      endRound('win')
      else if (saved)  endRound('loss')
      else             nextShot()
    } else if (newGoals >= 3) {
      endRound('win')   // win mathematically locked — don't play out the rest
    } else if (newShots >= SHOT_COUNT) {
      if (newGoals === newSaves) {
        suddenDeathRef.current = true
        setSuddenDeath(true)
        setTimeout(() => setFlash({ type: 'sudden' }), 1000)
        setTimeout(() => setFlash(null), 2200)
        nextShot()
      } else {
        endRound('loss')
      }
    } else {
      nextShot()
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden select-none"
      style={{ touchAction: 'none' }}
    >
      {/* Scene wrapper — camera lean/shake applies one transform to all visual layers */}
      <div ref={sceneRef} className="absolute inset-0 pointer-events-none will-change-transform">

      {/* Background scene — shooter name/number is printed on the jersey */}
      <Pitch country={country} shooter={shooter} />

      {/* Keeper overlay (rAF-animated via keeperRef) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 390 844"
        preserveAspectRatio="xMidYMid slice"
      >
        <g ref={keeperRef} transform="translate(195,268) rotate(0) scale(0.52)">
          <KeeperFigure pose={keeperPose} />
        </g>
      </svg>

      {/* Trail overlay (screen coords — no viewBox) */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        <polyline ref={fadeTrailRef} points="" fill="none"
          stroke="rgba(255,255,255,0.48)" strokeWidth="3.5"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ opacity: 0 }} />
        <polyline ref={liveTrailRef} points="" fill="none"
          stroke="rgba(255,255,255,0.62)" strokeWidth="4"
          strokeLinecap="round" strokeLinejoin="round" />
      </svg>

      {/* Ball overlay (includes travel trail, shadow, ball) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 390 844"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <radialGradient id="gBall" cx="38%" cy="35%" r="60%">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.6)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.22)" />
          </radialGradient>
          <radialGradient id="gFlameOuter" cx="50%" cy="70%" r="60%">
            <stop offset="0%"   stopColor="#ffb347" />
            <stop offset="100%" stopColor="#ff4500" />
          </radialGradient>
          <filter id="fFireBlur" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="2.6" />
          </filter>
        </defs>

        {/* Fire trail — reuses the exact same points as the white travel trail
            below, so it always matches the ball's real path. Glow (blurred,
            wide) first, hot core (crisp, thin) on top; only visible while
            showFire()/hideFire() toggle it during a shot's flight. */}
        {/* v2 §5.2 — Ball travel trail (SVG coords, fades behind ball) */}
        <polyline
          ref={ballTrailRef}
          points=""
          fill="none"
          stroke="rgba(255,255,255,0.4)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ opacity: 0.4 }}
        />

        {/* Fix 1 — start-zone affordance: shots must begin inside this ring.
            Subtle dashed marker at the spot; accept radius is slightly larger
            (START_ZONE_R) for thumb-friendly grace. */}
        <circle cx={BALL_START.x} cy={BALL_START.y} r={START_RING_R}
          fill="none" stroke="rgba(255,255,255,0.28)" strokeWidth="1.5"
          strokeDasharray="5 7" strokeLinecap="round" />

        <ellipse ref={shadowRef} cx="0" cy="0" rx="13" ry="4.5" fill="rgba(0,0,0,0.30)" />
        <g ref={ballRef}>
          {/* Fire effect — the ball itself looks engulfed in flame, streaming
              backward like wind resistance. Everything here is a child of
              ballRef (moves/scales with the ball), but fireAnchorRef gets its
              OWN per-frame rotation (see placeFireDirection in the flight
              loop) pointing opposite the ball's real travel direction —
              independent of the ball's own spin — so the trail doesn't spin
              in place, it trails behind. Hidden except during flight via
              showFire()/hideFire(); scale set by power. */}
          <g ref={fireAnchorRef}>
            {/* Wind buffet — a slower, gentler sway than the per-lick flicker
                below, layered on top of it (two motions compose). */}
            <g style={{ animation: 'fireWave 0.45s ease-in-out infinite', transformOrigin: '0px 0px' }}>

              {/* Back layer: blurred aura, elongated backward (base near the
                  ball, tail trailing away) — a comet-like flame body. */}
              <ellipse ref={fireAuraRef} cx="0" cy="-4" rx="8" ry="15"
                fill="url(#gFlameOuter)" filter="url(#fFireBlur)"
                style={{ opacity: 0 }} />

              {/* Mid layer: a narrow backward-facing fan of flame licks (not
                  a full ring) — each with a long trailing tail and its own
                  independent flicker, like tongues of fire whipping behind
                  a fireball in flight. */}
              <g ref={fireRef} style={{ opacity: 0 }}>
                {[-40, -20, 0, 20, 40].map((deg, i) => (
                  <g key={deg} transform={`rotate(${deg})`}>
                    <g
                      style={{
                        transformOrigin: '0px 0px',
                        animation: `${i % 2 === 0 ? 'fireFlicker1' : 'fireFlicker2'} ${0.15 + i * 0.025}s ease-in-out infinite`,
                        animationDelay: `${-i * 0.04}s`,
                      }}
                    >
                      <path d="M0,4 C-4.5,-4 -4.5,-15 0,-24 C4.5,-15 4.5,-4 0,4 Z" fill="url(#gFlameOuter)" />
                      <path d="M0,1 C-2,-4 -2,-11 0,-18 C2,-11 2,-4 0,1 Z" fill="#ffe680" />
                    </g>
                  </g>
                ))}
              </g>
            </g>
          </g>

          <circle cx="0" cy="0" r={BALL_R} fill="white" />
          <circle cx="0" cy="0" r={BALL_R} fill="url(#gBall)" />
          <path d="M0,-12 L7.5,-6.5 L4.5,4 L-4.5,4 L-7.5,-6.5 Z"
            fill="none" stroke="#333" strokeWidth="0.9" opacity="0.45" />
          <path d="M-7.5,-6.5 L-12,-2 L-10,5.5 L-6,7 Z"
            fill="none" stroke="#333" strokeWidth="0.9" opacity="0.45" />
          <path d="M7.5,-6.5 L12,-2 L10,5.5 L6,7 Z"
            fill="none" stroke="#333" strokeWidth="0.9" opacity="0.45" />
          <circle cx="-3.5" cy="-4.5" r="3" fill="rgba(255,255,255,0.55)" />

          {/* Front layer: warm tint directly over the ball's own surface, so
              the ball itself reads as glowing hot, not just haloed by flame. */}
          <circle ref={fireTintRef} cx="0" cy="0" r={BALL_R} fill="url(#gFlameOuter)"
            style={{ opacity: 0 }} />
        </g>

        {/* Goal splash: tight burst of white particles from the net impact point */}
        {goalFx && (
          <g key={goalFx.key}>
            {goalFx.parts.map((p, i) => (
              <motion.circle key={i}
                r={p.r} fill="white"
                initial={{ cx: goalFx.x, cy: goalFx.y, opacity: 0.9 }}
                animate={{
                  cx: goalFx.x + p.dx,
                  cy: [goalFx.y, goalFx.y + p.dy, goalFx.y + p.dy + 14],  // out, then gravity fall
                  opacity: 0,
                }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            ))}
          </g>
        )}

        {/* Post-impact punch: radial flash + shock lines + POST! text */}
        {postFx && (
          <g key={postFx.key}>
            <motion.circle
              cx={postFx.x} cy={postFx.y} fill="white"
              initial={{ r: 6,  opacity: 0.85 }}
              animate={{ r: 22, opacity: 0 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
            />
            {[0, 60, 120, 180, 240, 300].map(deg => {
              const a = (deg * Math.PI) / 180
              return (
                <motion.line key={deg}
                  stroke="white" strokeWidth="2.5" strokeLinecap="round"
                  initial={{
                    x1: postFx.x + Math.cos(a) * 8,  y1: postFx.y + Math.sin(a) * 8,
                    x2: postFx.x + Math.cos(a) * 14, y2: postFx.y + Math.sin(a) * 14,
                    opacity: 0.9,
                  }}
                  animate={{
                    x1: postFx.x + Math.cos(a) * 22, y1: postFx.y + Math.sin(a) * 22,
                    x2: postFx.x + Math.cos(a) * 30, y2: postFx.y + Math.sin(a) * 30,
                    opacity: 0,
                  }}
                  transition={{ duration: 0.13, ease: 'easeOut' }}
                />
              )
            })}
            <motion.text
              x={Math.max(60, Math.min(330, postFx.x))}
              y={Math.max(170, postFx.y - 28)}
              textAnchor="middle"
              className="font-display"
              fill="#ffffff" fontSize="30"
              style={{ textShadow: '0 0 14px rgba(255,255,255,0.9)' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0], y: postFx.y - 40 }}
              transition={{ duration: 0.4, times: [0, 0.2, 0.7, 1] }}
            >
              POST!
            </motion.text>
          </g>
        )}
      </svg>

      </div>{/* /scene wrapper */}

      {/* Pointer capture */}
      <div
        className="absolute inset-0 z-10"
        style={{ touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      />

      {/* HUD */}
      <div className="relative z-20 flex items-center justify-between px-4 pt-3 pb-2 pointer-events-none">
        <div className="flex items-center gap-3">
          <button className="pointer-events-auto opacity-80" onClick={onHome}>
            {country
              ? <TeamBadge entity={country} mode={mode} size={28} />
              : <span className="text-lg">🏳️</span>}
          </button>
          {suddenDeath
            ? <span className="font-display text-base tracking-widest animate-pulse"
                style={{ color: '#ff5555', textShadow: '0 0 12px rgba(255,60,60,0.7)' }}>
                SUDDEN DEATH
              </span>
            : <ShotPips total={SHOT_COUNT} done={shotsDone} accent={accent} />}
        </div>
        <div className="font-display text-2xl leading-none px-3 py-1 rounded-lg"
          style={{ color: accent, background: 'rgba(0,0,0,0.38)' }}>
          {suddenDeath ? `${goals}–${saves}` : `${goals}/${SHOT_COUNT}`}
        </div>
      </div>


      {/* Neighbor scoreboard (live data; hidden until the first fetch lands) */}
      {neighborRows.length > 0 && (
        <>
          <div className="absolute right-2 top-1/3 z-20 hidden sm:flex flex-col gap-1 pointer-events-none">
            <NeighborPanel rows={neighborRows} accent={accent} country={country} mode={mode} />
          </div>
          <div className="absolute bottom-0 left-0 right-0 z-20 sm:hidden px-2 pb-2 pointer-events-none">
            <NeighborPanel rows={neighborRows} accent={accent} country={country} mode={mode} horizontal />
          </div>
        </>
      )}

      {/* Result flash */}
      <AnimatePresence>
        {flash && (
          <motion.div key="flash"
            className={`absolute inset-0 z-30 flex items-center pointer-events-none ${
              flash.wide && flash.side === 'left'  ? 'justify-start pl-5'
            : flash.wide && flash.side === 'right' ? 'justify-end pr-5'
            :                                        'justify-center'}`}
            initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.3 }} transition={{ duration: 0.22 }}>
            <span className="font-display leading-none text-center" style={{
              fontSize: flash.type === 'sudden' ? 'clamp(2.4rem,12vw,4rem)'
                      : flash.wide             ? 'clamp(3rem,15vw,5rem)'
                      :                          'clamp(3.5rem,18vw,6rem)',
              color:
                flash.type === 'goal'   ? accent :
                flash.type === 'save'   ? '#facc15' :
                flash.type === 'sudden' ? '#ff5555' : '#ef4444',
              textShadow: `0 0 40px currentColor`,
            }}>
              {flash.type === 'goal' ? 'GOAL!'
               : flash.type === 'save' ? 'SAVED!'
               : flash.type === 'sudden' ? 'SUDDEN DEATH'
               : flash.over ? 'OVER!'
               : flash.wide ? 'WIDE!' : 'MISS!'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Redraw hint (Bug 3 rejection) */}
      <AnimatePresence>
        {hint && (
          <motion.div key="hint"
            className="absolute bottom-20 left-0 right-0 z-30 flex justify-center pointer-events-none"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <span className="font-body text-white/70 text-sm bg-black/50 px-4 py-2 rounded-full">
              {hint}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* First-shot prompt */}
      <AnimatePresence>
        {shotsDone === 0 && !flash && !hint && (
          <motion.p key="prompt"
            className="absolute bottom-10 left-0 right-0 z-20 text-center font-body text-white/40 text-xs tracking-widest pointer-events-none"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            DRAW YOUR SHOT PATH
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ShotPips({ total, done, accent }) {
  return (
    <div className="flex gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className="block w-3 h-3 rounded-full border border-white/30"
          style={{
            background: i < done ? accent
              : i === done ? 'rgba(255,255,255,0.55)'
              : 'transparent',
          }} />
      ))}
    </div>
  )
}

// Backend rows only carry {code,name,win_count,rank} — look up the matching
// static entity (for a club's colors, or just to confirm a country code) by
// code from the list for the current mode.
function neighborEntityFor(code, mode) {
  return (mode === 'club' ? CLUBS : COUNTRIES).find(e => e.code === code)
}

function NeighborPanel({ rows, accent, country, mode, horizontal }) {
  if (horizontal) return (
    <div className="flex justify-center gap-3 bg-black/40 backdrop-blur-sm rounded-xl px-3 py-2">
      {rows.map(r => (
        <div key={r.rank} className="flex items-center gap-1"
          style={{ color: r.isUser ? accent : 'rgba(255,255,255,0.7)' }}>
          <span className="font-body text-xs opacity-60">#{r.rank}</span>
          <TeamBadge entity={neighborEntityFor(r.code, mode)} mode={mode} size={20} />
          <span className="font-body text-xs font-semibold">{r.name}</span>
          <span className="font-display text-sm">{r.score.toLocaleString()}</span>
          {r.isUser && <span className="font-body text-[9px] opacity-60">← you</span>}
        </div>
      ))}
    </div>
  )
  return (
    <div className="flex flex-col gap-0.5 bg-black/40 backdrop-blur-sm rounded-xl px-3 py-2 min-w-[155px]">
      {rows.map(r => (
        <div key={r.rank} className="flex items-center gap-1.5"
          style={{ color: r.isUser ? accent : 'rgba(255,255,255,0.75)' }}>
          <span className="font-body text-[10px] opacity-60 w-6 text-right">#{r.rank}</span>
          <TeamBadge entity={neighborEntityFor(r.code, mode)} mode={mode} size={20} />
          <span className="font-body text-xs flex-1 font-medium">{r.name}</span>
          <span className="font-display text-xs">{r.score.toLocaleString()}</span>
          {r.isUser && <span className="font-body text-[9px] opacity-50">←</span>}
        </div>
      ))}
    </div>
  )
}

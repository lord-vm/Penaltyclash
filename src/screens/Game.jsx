import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { flagSrc } from '../data/countries.js'
import Pitch from '../components/Pitch.jsx'
import KeeperFigure from '../components/KeeperFigure.jsx'
import {
  BALL_START, SHOT_COUNT, GOAL,
  KEEPER_REST, KEEPER_LEFT, KEEPER_RIGHT, KEEPER_CENTER,
  SPEED_SLOW, SPEED_FAST, DUR_SLOW, DUR_MED, DUR_FAST,
  MIN_PATH_PX, MAX_SHOT_MS,
  GENERAL_PATTERNS, BELIEF_BLEND_BY_SHOT,
  KEEPER_MISREAD_CHANCE, KEEPER_STREAK_LENGTH, KEEPER_STREAK_BOOST, KEEPER_POST_SAVE_BOOST,
  DEFLECT_RETAIN, DEFLECT_MS,
} from '../game/constants.js'
import { screenToSvg } from '../lib/svgCoords.js'
import {
  pathLength, smoothPath, downsample, normalizePath, interpolatePath,
  easeInOut, easeOut, ballVelocityProfile,
} from '../game/pathUtils.js'
import { validatePath, clampOrRejectCurve } from '../game/validation.js'
import {
  ballHitsKeeper, ballHitsPost, inGoalFrame,
  clampEndpoint, reflectVelocity, BALL_R,
} from '../game/physics.js'
import { playCrowdGroan, playCrowdCheer, playPostHit, playNetRipple } from '../lib/sfx.js'
import { fetchScoreboard } from '../lib/supabase.js'

export default function Game({ country, onResult, onHome }) {
  const [shotsDone, setShotsDone] = useState(0)
  const [goals,     setGoals]     = useState(0)
  const [flash,     setFlash]     = useState(null)  // { type:'goal'|'miss'|'save', wide?, side? } | null
  const [hint,      setHint]      = useState(null)  // redraw hint text
  const [postFx,    setPostFx]    = useState(null)  // { x, y, key } — post-impact punch overlay
  const [goalFx,    setGoalFx]    = useState(null)  // { x, y, key, parts } — goal splash particles
  const [neighbors, setNeighbors] = useState(null)  // §2.3 you+neighbors rows from scoreboard fn
  const netAnimRef = useRef(0)                      // cancels an in-flight net ripple on re-trigger

  const accent = country?.primary || '#FEDF00'

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

  // Mutable shot state (no re-render)
  const phaseRef      = useRef('idle')
  const shotsRef      = useRef(0)
  const goalsRef      = useRef(0)
  const ptrRef        = useRef(null)
  // v2 §7.2 — keeper memory: full session history of the PLAYER's actual shot
  // directions. The keeper is blind to the current shot — it only ever sees
  // this history when deciding where to dive.
  const shotMemoryRef    = useRef([])   // array of 'left'|'center'|'right'
  const lastShotDirRef   = useRef(null) // this shot's actual direction (set at release)
  const pendingSaveBoostRef = useRef(null) // direction of the shot just SAVED, consumed by next decision only

  useEffect(() => {
    placeBall(BALL_START, 1)
    placeKeeper(KEEPER_REST)
  }, [])

  // v2 §2.3 — neighbor panel refreshes between shots OR every 5 seconds,
  // whichever is later: the effect re-runs after each shot and an interval
  // covers idle time; fetchScoreboard's 5s client cache enforces the "later".
  useEffect(() => {
    let live = true
    const load = () => {
      fetchScoreboard(country?.code).then(data => {
        if (live && data?.neighbors) setNeighbors(data.neighbors)
      })
    }
    load()
    const iv = setInterval(load, 5000)
    return () => { live = false; clearInterval(iv) }
  }, [shotsDone, country?.code])

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

  // v2 §5.2 — Ball travel trail (fades 400ms after shot resolves)
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

  // Wide miss treatment: crowd groan + camera lean + ball fade + long trail linger.
  // Returns the side used for the "WIDE!" text anchor.
  function _wideMissFx(lastPt) {
    const side = lastPt.x < GOAL.x1 ? 'left'
               : lastPt.x > GOAL.x2 ? 'right'
               : 'center' // over the bar
    playCrowdGroan()
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
    const RING_STARTS = [0, 100, 200]
    const EXPAND_MS = 600, SETTLE_MS = 600, TOTAL = EXPAND_MS + SETTLE_MS
    const SIGMA = 20          // ring thickness (wave passes a point over ~250ms)
    const PEAK  = 15          // ~5% of 300px goal width

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
          for (let k = 0; k < 3; k++) {
            const rt = t - RING_STARTS[k]
            if (rt < 0 || rt > EXPAND_MS) continue
            const R   = (rt / EXPAND_MS) * maxR
            const amp = PEAK * (1 - R / maxR) * (1 - k * 0.25)  // decays as ring expands; later rings weaker
            disp += amp * Math.exp(-((d - R) ** 2) / (2 * SIGMA * SIGMA))
          }
          out += disp
            ? `${(p.x + (dx / d) * disp).toFixed(1)},${(p.y + (dy / d) * disp).toFixed(1)} `
            : `${p.x},${p.y} `
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

  // Full goal celebration FX bundle (visual + layered audio)
  function _goalFx(impact) {
    netRippleFx(impact)
    _goalSplash(impact)
    playNetRipple()
    playCrowdCheer()
  }

  // ── Pointer events ────────────────────────────────────────────────────────

  function onPointerDown(e) {
    if (phaseRef.current !== 'idle') return
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

    // Downsample + map the (possibly clamped) screen-space path into SVG travel coords
    const sampled = downsample(curveCheck.pts, 40)
    const svgPath = normalizePath(sampled, svgEnd, containerRef.current)

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
    const diveDir = _keeperDecide(shotMemoryRef.current, shotsRef.current + 1)

    // Record THIS shot's actual direction for future memory (after the
    // keeper has already committed — it never sees this value).
    const relX    = (svgEnd.x - GOAL.x1) / (GOAL.x2 - GOAL.x1)
    const shotDir = relX < 0.35 ? 'left' : relX > 0.65 ? 'right' : 'center'
    shotMemoryRef.current.push(shotDir)
    lastShotDirRef.current = shotDir

    const keeperTarg = diveDir === 'left'  ? KEEPER_LEFT
                     : diveDir === 'right' ? KEEPER_RIGHT
                     :                       KEEPER_CENTER

    // Show fading draw-path trail & fire
    showFadeTrail(sampled)
    startShot(svgPath, keeperTarg, ballMs, power)
  }

  function _reject(msg) {
    phaseRef.current = 'idle'
    setHint(msg)
    setTimeout(() => setHint(null), 1200)
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
   */
  function _keeperDecide(memory, shotNumber) {
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
      if (beliefDir === 'left')  return 'right'
      if (beliefDir === 'right') return 'left'
      return Math.random() < 0.5 ? 'left' : 'right'
    }
    return beliefDir
  }

  // ── Unified shot animation (ball + keeper in one rAF loop) ───────────────

  function startShot(svgPath, keeperTarget, ballDuration, power = 1.0) {
    const startMs     = performance.now()
    const keeperMs    = 380
    const REACT_LAG   = 60   // v2 §7.3 — keeper reaction lag (ms)
    let done = false
    clearBallTrail()

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
      const be     = ballVelocityProfile(bt)      // accelerate→constant→decelerate
      const bPos   = interpolatePath(svgPath, be)
      const bScale = 1 - (1 - 0.38) * be
      const bRot   = bt * 360 * power * 0.7       // rotation proportional to power
      placeBall(bPos, bScale, bRot)

      // v2 §5.2 — Append to travel trail
      appendBallTrail(bPos.x, bPos.y)

      // ── Keeper collision (only inside the goal mouth, not on pitch) ────────
      // Ball must be within the goal's y range before keeper can save it.
      // Without this guard, the keeper's rotating body catches balls that are
      // still on the pitch side of the goal line — a regression from the new
      // ballVelocityProfile timing (slower in middle phase than easeInOut).
      if (bPos.y <= GOAL.y2 + 8 && ballHitsKeeper(bPos.x, bPos.y, kx, ky, kr)) {
        done = true
        resolveShot('save')
        return
      }

      // ── Post collision ───────────────────────────────────────────────────
      const postHit = ballHitsPost(bPos.x, bPos.y)
      if (postHit) {
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
          const endPost = ballHitsPost(lastPt.x, lastPt.y)
          if (endPost) {
            // Post hit at endpoint — deflect
            const prevBe  = easeInOut(Math.max(0, bt - 0.025))
            const prevPos = interpolatePath(svgPath, prevBe)
            const rawVx = lastPt.x - prevPos.x || 0.01
            const rawVy = lastPt.y - prevPos.y || -0.01
            const { vx, vy } = reflectVelocity(rawVx, rawVy, endPost)
            _postHitFx(lastPt, endPost)
            startDeflection(lastPt, bScale, vx, vy, { x:kx, y:ky, r:kr })
          } else {
            // Wide miss — ball sailed past the frame with no contact
            const side = _wideMissFx(lastPt)
            resolveShot('miss', { wide: true, side })
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
    const scored   = result === 'goal'
    const newGoals = goalsRef.current + (scored ? 1 : 0)
    const newShots = shotsRef.current + 1
    goalsRef.current = newGoals
    shotsRef.current  = newShots

    // v2 §7.2 — post-save psychology: if this shot was saved, bias the NEXT
    // shot's belief toward the opposite side (consumed once, then cleared).
    pendingSaveBoostRef.current = result === 'save' ? lastShotDirRef.current : null

    // Goal celebration: net ripple from the actual impact point + splash
    // particles + layered water-ripple/crowd-cheer audio. Purely visual/audio —
    // doesn't block the loop (next shot is playable as soon as phase resets).
    if (result === 'goal' && fx.impact) _goalFx(fx.impact)

    // v2 §5.2 — Fade ball travel trail on resolve.
    // Wide miss: trail lingers ~2x longer (FIFA-style tail as the ball sails past).
    fadeBallTrail(fx.wide ? 800 : 400)

    setGoals(newGoals)
    setShotsDone(newShots)
    setFlash({ type: result, wide: fx.wide, side: fx.side })
    setTimeout(() => setFlash(null), 700)

    if (newShots >= SHOT_COUNT) {
      setTimeout(() => onResult(newGoals >= 3 ? 'win' : 'loss', newGoals), 1000)
    } else {
      setTimeout(() => {
        clearFadeTrail()
        restoreBall()
        placeBall(BALL_START, 1, 0)
        placeKeeper(KEEPER_REST)
        phaseRef.current = 'idle'
      }, 900)
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

      {/* Background scene */}
      <Pitch country={country} />

      {/* Keeper overlay (rAF-animated via keeperRef) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 390 844"
        preserveAspectRatio="xMidYMid slice"
      >
        <g ref={keeperRef} transform="translate(195,268) rotate(0) scale(0.52)">
          <KeeperFigure />
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
        </defs>

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

        <ellipse ref={shadowRef} cx="0" cy="0" rx="13" ry="4.5" fill="rgba(0,0,0,0.30)" />
        <g ref={ballRef}>
          <circle cx="0" cy="0" r={BALL_R} fill="white" />
          <circle cx="0" cy="0" r={BALL_R} fill="url(#gBall)" />
          <path d="M0,-12 L7.5,-6.5 L4.5,4 L-4.5,4 L-7.5,-6.5 Z"
            fill="none" stroke="#333" strokeWidth="0.9" opacity="0.45" />
          <path d="M-7.5,-6.5 L-12,-2 L-10,5.5 L-6,7 Z"
            fill="none" stroke="#333" strokeWidth="0.9" opacity="0.45" />
          <path d="M7.5,-6.5 L12,-2 L10,5.5 L6,7 Z"
            fill="none" stroke="#333" strokeWidth="0.9" opacity="0.45" />
          <circle cx="-3.5" cy="-4.5" r="3" fill="rgba(255,255,255,0.55)" />
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
              ? <img src={flagSrc(country.code)} alt={country.name} className="w-7 h-auto rounded-sm" />
              : <span className="text-lg">🏳️</span>}
          </button>
          <ShotPips total={SHOT_COUNT} done={shotsDone} accent={accent} />
        </div>
        <div className="font-display text-2xl leading-none px-3 py-1 rounded-lg"
          style={{ color: accent, background: 'rgba(0,0,0,0.38)' }}>
          {goals}/{SHOT_COUNT}
        </div>
      </div>

      {/* Neighbor scoreboard (live data; hidden until the first fetch lands) */}
      {neighborRows.length > 0 && (
        <>
          <div className="absolute right-2 top-1/3 z-20 hidden sm:flex flex-col gap-1 pointer-events-none">
            <NeighborPanel rows={neighborRows} accent={accent} country={country} />
          </div>
          <div className="absolute bottom-0 left-0 right-0 z-20 sm:hidden px-2 pb-2 pointer-events-none">
            <NeighborPanel rows={neighborRows} accent={accent} country={country} horizontal />
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
            <span className="font-display leading-none" style={{
              fontSize: flash.wide ? 'clamp(3rem,15vw,5rem)' : 'clamp(3.5rem,18vw,6rem)',
              color:
                flash.type === 'goal' ? accent :
                flash.type === 'save' ? '#facc15' : '#ef4444',
              textShadow: `0 0 40px currentColor`,
            }}>
              {flash.type === 'goal' ? 'GOAL!'
               : flash.type === 'save' ? 'SAVED!'
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

function NeighborPanel({ rows, accent, country, horizontal }) {
  if (horizontal) return (
    <div className="flex justify-center gap-3 bg-black/40 backdrop-blur-sm rounded-xl px-3 py-2">
      {rows.map(r => (
        <div key={r.rank} className="flex items-center gap-1"
          style={{ color: r.isUser ? accent : 'rgba(255,255,255,0.7)' }}>
          <span className="font-body text-xs opacity-60">#{r.rank}</span>
          <img src={flagSrc(r.code)} alt={r.name} className="w-5 h-auto rounded-sm" />
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
          <img src={flagSrc(r.code)} alt={r.name} className="w-5 h-auto rounded-sm" />
          <span className="font-body text-xs flex-1 font-medium">{r.name}</span>
          <span className="font-display text-xs">{r.score.toLocaleString()}</span>
          {r.isUser && <span className="font-body text-[9px] opacity-50">←</span>}
        </div>
      ))}
    </div>
  )
}

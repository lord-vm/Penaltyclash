// Synthesized sound effects — Web Audio API only, no audio assets.
// Context is created lazily on first play (always inside a user-gesture
// call chain, so autoplay policy is satisfied).

let ctx = null
let master = null

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    // Master bus: a gentle safety compressor so layered moments (goal boom +
    // net ripple + crowd roar) can never clip, plus a small trim.
    // Measured note: the earlier -10dB/4:1 setting squashed hard (post hit
    // rendered at 0.25 instead of ~0.65) and let the sub-boom duck the crowd.
    // -6dB/3:1 keeps the no-clip guarantee (worst stack ≈ +4dB in → ≈0.7 out)
    // while letting individual sounds through near their designed levels.
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -6
    comp.knee.value = 10
    comp.ratio.value = 3
    comp.attack.value = 0.004
    comp.release.value = 0.18
    const trim = ctx.createGain()
    trim.gain.value = 0.95
    comp.connect(trim)
    trim.connect(ctx.destination)
    master = comp
  }
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

// All sounds route through the master bus (compressor → trim → destination)
function bus() { return master }

// Crowd-only sub-bus — every crowd-ambience sound (the bed + its random
// cheer/horn/drum/whistle events) routes through this gain node instead of
// bus() directly, so muteCrowd() can silence just the crowd without touching
// kick/post-hit/save-thud/net-ripple. Lazily created (creates the whole
// AudioContext + master bus too, via ac(), if this is the very first sound).
let crowdBusGain = null
function crowdBus() {
  const c = ac()
  if (!crowdBusGain) {
    crowdBusGain = c.createGain()
    crowdBusGain.gain.value = 1
    crowdBusGain.connect(bus())
  }
  return crowdBusGain
}

/**
 * Toggle the crowd ambience on/off (short ramp, no click). Safe to call
 * before any crowd sound has started — crowdBus()/ac() create everything
 * lazily on first use, so this can run as early as app mount or a menu
 * toggle click, independent of whether a match/ambience is active yet.
 */
export function muteCrowd(muted) {
  try {
    const cb = crowdBus()
    const c = ac()
    const t = c.currentTime
    cb.gain.cancelScheduledValues(t)
    cb.gain.setValueAtTime(cb.gain.value, t)
    cb.gain.linearRampToValueAtTime(muted ? 0.0001 : 1, t + 0.08)
  } catch (_) { /* audio unavailable — fail silent */ }
}

// Shared helper: white-noise buffer of `dur` seconds
function noiseBuffer(c, dur, brown = false) {
  const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate)
  const data = buf.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1
    if (brown) {
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    } else {
      data[i] = white
    }
  }
  return buf
}

// ── Persistent stadium ambience ──────────────────────────────────────────────
// A real stadium is never silent, and its noise doesn't sync to the pitch —
// a small, constant crowd bed plays for the whole session, and chanting
// swells, a vuvuzela-style horn, a drum line and fan whistles drift in on
// their own random schedule, independent of goals/misses. Game outcomes add
// nothing extra (crowdReactGoal/crowdReactMiss are intentionally no-ops) —
// the atmosphere is already constant and alive.
//
// White noise, not brown, for the base bed: brown noise is a slow random
// WALK, and pushed through a resonant filter it smooths into one swelling
// tone (reads as ocean waves, not a crowd). Plain broadband white noise
// through a wide, non-resonant highpass+lowpass stays busy/textured —
// closer to a real murmur, and is quiet enough to just "beat the silence."
let ambientGain = null
let ambientFilt = null
let ambientStarted = false
let stadiumTimer = null

const AMBIENT_BASE_GAIN = 0.02   // resting murmur — small, just enough to beat silence
const AMBIENT_BASE_FREQ = 1400   // Hz — resting lowpass cutoff (murmur brightness)

/**
 * Start the persistent stadium bed + random event scheduler. Idempotent —
 * safe to call on every mount. Must run inside a user-gesture call chain
 * (same rule as every other sound here) since it creates the AudioContext.
 * A ~6s looping white-noise buffer with tiny (15ms) fades at both ends so
 * the loop seam doesn't click.
 */
export function startCrowdAmbience() {
  try {
    if (ambientStarted) return
    ambientStarted = true
    const c = ac()
    const t = c.currentTime

    const dur = 6
    const buf = noiseBuffer(c, dur, false)   // white — see design note above
    const data = buf.getChannelData(0)
    const fadeSamples = Math.floor(c.sampleRate * 0.015)
    for (let i = 0; i < fadeSamples; i++) {
      const k = i / fadeSamples
      data[i] *= k
      data[data.length - 1 - i] *= k
    }

    const src = c.createBufferSource()
    src.buffer = buf
    src.loop = true

    // Wide, non-resonant band: highpass trims rumble, lowpass sets the
    // brightness ceiling (and is what the random cheer swells sweep).
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.Q.value = 0.5
    hp.frequency.value = 200
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.Q.value = 0.5
    lp.frequency.value = AMBIENT_BASE_FREQ
    ambientFilt = lp

    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(AMBIENT_BASE_GAIN, t + 1.5)  // ease the bed in
    ambientGain = g

    src.connect(hp)
    hp.connect(lp)
    lp.connect(g)
    g.connect(crowdBus())
    src.start(t)

    scheduleNextStadiumEvent()
  } catch (_) { /* audio unavailable — fail silent */ }
}

// Fires ONE random stadium event, then reschedules itself after a fresh
// random delay (5-13s). Randomizing both WHICH event and WHEN is what keeps
// the stadium feeling alive rather than looped or metronomic.
function scheduleNextStadiumEvent() {
  const delay = 5000 + Math.random() * 8000
  stadiumTimer = setTimeout(() => {
    try {
      const c = ac()
      const t = c.currentTime
      const events = [
        cheerSwell, cheerSwell,               // weighted toward plain chanting
        () => stadiumHorn(c, t),
        () => drumHits(c, t),
        () => whistleBlip(c, t),
      ]
      events[Math.floor(Math.random() * events.length)]()
    } catch (_) { /* skip this event, keep the loop alive */ }
    scheduleNextStadiumEvent()
  }, delay)
}

// A ripple of chanting/reaction from the crowd — several SHORT, independently
// timed and independently pitched noise bursts, NOT one smooth swell.
//
// The previous version modulated the shared ambient bed with a single
// coherent gain-swell + filter-sweep — but "one continuous noise band with
// one smooth amplitude envelope and one smooth filter sweep" is literally
// the standard synthesis recipe for wind/ocean-wave sounds, which is exactly
// why it read as a wave instead of a crowd. A real crowd reaction is ragged:
// many voices starting and stopping at slightly different times, in
// different registers. Layering 4-7 short, staggered, independently-pitched
// bursts (each its own noise source — nothing shared/coherent between them)
// breaks up that smooth "wave" shape into something scattered and voice-like.
function cheerSwell() {
  const c = ac()
  const t = c.currentTime
  const voices = 4 + Math.floor(Math.random() * 4)   // 4-7 overlapping bursts
  for (let i = 0; i < voices; i++) {
    const t0    = t + Math.random() * 0.55            // staggered onset — not synced
    const dur   = 0.3 + Math.random() * 0.4           // short burst, not a sustained swell
    const peak  = 0.045 + Math.random() * 0.05
    const attack = 0.02 + Math.random() * 0.05        // fast, irregular attack per voice

    const src = c.createBufferSource()
    src.buffer = noiseBuffer(c, dur, false)           // white — busy/textured, not tonal
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 0.6 + Math.random() * 0.7
    bp.frequency.value = 700 + Math.random() * 2200   // each voice its own register

    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t0)
    g.gain.exponentialRampToValueAtTime(peak, t0 + attack)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)

    src.connect(bp)
    bp.connect(g)
    g.connect(crowdBus())
    src.start(t0)
    src.stop(t0 + dur + 0.02)
  }
}

// ── Random stadium events — stadium horn, drum line, whistles ─────────────
// Fired from the scheduler above at unpredictable moments (NOT tied to game
// outcomes) — a full "real stadium" texture: instruments (drum), a stadium
// horn (vuvuzela), excited whistle blips.

/**
 * Stadium horn — a vuvuzela-style drone. 4 slightly-detuned sawtooth voices
 * around Bb3 (~233Hz, the real instrument's pitch) summed through a buzzy
 * bandpass (~750Hz — its characteristic upper-harmonic honk), each with a
 * small independent vibrato so four "horns" beat against each other instead
 * of phase-locking into one clean tone. ~1.6s: quick blow-in, sustained
 * honk, fade.
 */
function stadiumHorn(c, t0) {
  const voices = [231, 234, 238, 236]
  const master = c.createGain()
  master.gain.setValueAtTime(0.0001, t0)
  master.gain.exponentialRampToValueAtTime(0.16, t0 + 0.06)
  master.gain.setValueAtTime(0.16, t0 + 1.1)
  master.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.6)
  master.connect(crowdBus())

  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.frequency.value = 750
  bp.Q.value = 1.1
  bp.connect(master)

  for (const f of voices) {
    const osc = c.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(f, t0)

    // Slow independent waver per voice — breath instability, not a synced LFO
    const lfo = c.createOscillator()
    lfo.frequency.value = 4 + Math.random() * 3
    const lfoGain = c.createGain()
    lfoGain.gain.value = 3
    lfo.connect(lfoGain)
    lfoGain.connect(osc.frequency)
    lfo.start(t0)
    lfo.stop(t0 + 1.6)

    const vg = c.createGain()
    vg.gain.value = 1 / voices.length
    osc.connect(vg)
    vg.connect(bp)
    osc.start(t0)
    osc.stop(t0 + 1.65)
  }
}

/** Drum line — 3 quick stadium-drum hits (low thump + noise click), ~0.7s. */
function drumHits(c, t0) {
  for (const dt of [0, 0.28, 0.56]) {
    const tt = t0 + dt
    const osc = c.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(110, tt)
    osc.frequency.exponentialRampToValueAtTime(60, tt + 0.12)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, tt)
    g.gain.exponentialRampToValueAtTime(0.3, tt + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, tt + 0.14)
    osc.connect(g); g.connect(crowdBus())
    osc.start(tt); osc.stop(tt + 0.15)

    const noise = c.createBufferSource()
    noise.buffer = noiseBuffer(c, 0.03)
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 800
    const ng = c.createGain()
    ng.gain.setValueAtTime(0.15, tt)
    ng.gain.exponentialRampToValueAtTime(0.0001, tt + 0.03)
    noise.connect(lp); lp.connect(ng); ng.connect(crowdBus())
    noise.start(tt); noise.stop(tt + 0.03)
  }
}

/** A single excited fan whistle — quick pitch-up-then-down sine, ~0.45s. */
function whistleBlip(c, t0) {
  const osc = c.createOscillator()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(2600, t0)
  osc.frequency.exponentialRampToValueAtTime(3200, t0 + 0.15)
  osc.frequency.exponentialRampToValueAtTime(2200, t0 + 0.4)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.05)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.45)
  osc.connect(g); g.connect(crowdBus())
  osc.start(t0); osc.stop(t0 + 0.46)
}

/** Goal scored — intentionally a no-op. The persistent stadium ambience
 *  (constant bed + random horn/drum/whistle/cheer events above) already
 *  covers the atmosphere at all times; goals don't need an extra cue. */
export function crowdReactGoal() {}

/** Goal NOT scored (save or miss) — intentionally a no-op, see crowdReactGoal. */
export function crowdReactMiss() {}

/**
 * Post hit — heavy steel post struck by a fast ball. ~400ms total.
 *   Base:    95Hz sine, 5ms attack, exponential decay to ~350ms (the thud body)
 *   Mid:     240Hz sine, lower amplitude, ~180ms decay (metallic resonance)
 *   Click:   30ms white-noise burst, high-passed at 1.5kHz, low volume (contact punch)
 *   Shimmer: quiet 1200Hz sine for 80ms (subtle ring, not a doorbell)
 */
export function playPostHit() {
  try {
    const c = ac()
    const t = c.currentTime

    // Base thud — slight downward pitch droop adds weight
    const base = c.createOscillator()
    base.type = 'sine'
    base.frequency.setValueAtTime(95, t)
    base.frequency.exponentialRampToValueAtTime(70, t + 0.35)
    const bg = c.createGain()
    bg.gain.setValueAtTime(0.0001, t)
    bg.gain.exponentialRampToValueAtTime(0.7, t + 0.005)   // 5ms attack
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
    base.connect(bg)
    bg.connect(bus())
    base.start(t)
    base.stop(t + 0.4)

    // Mid resonance
    const mid = c.createOscillator()
    mid.type = 'sine'
    mid.frequency.setValueAtTime(240, t)
    const mg = c.createGain()
    mg.gain.setValueAtTime(0.0001, t)
    mg.gain.exponentialRampToValueAtTime(0.28, t + 0.005)
    mg.gain.exponentialRampToValueAtTime(0.0001, t + 0.18)
    mid.connect(mg)
    mg.connect(bus())
    mid.start(t)
    mid.stop(t + 0.2)

    // Contact click — 30ms high-passed noise burst
    const click = c.createBufferSource()
    click.buffer = noiseBuffer(c, 0.03)
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 1500
    const cg = c.createGain()
    cg.gain.setValueAtTime(0.18, t)
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.03)
    click.connect(hp)
    hp.connect(cg)
    cg.connect(bus())
    click.start(t)
    click.stop(t + 0.03)

    // Shimmer — quiet, short metallic ring
    const sh = c.createOscillator()
    sh.type = 'sine'
    sh.frequency.setValueAtTime(1200, t)
    const sg = c.createGain()
    sg.gain.setValueAtTime(0.06, t)
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.08)
    sh.connect(sg)
    sg.connect(bus())
    sh.start(t)
    sh.stop(t + 0.08)
  } catch (_) { /* audio unavailable — fail silent */ }
}

/**
 * Keeper save thud — §9: deep bass, ~150ms, low-frequency sine + short noise
 * burst. Peaks at 0.55: clearly above the crowd (0.35-0.38), below the post
 * hit (0.7) which stays the loudest single impact.
 */
export function playSaveThud() {
  try {
    const c = ac()
    const t = c.currentTime

    // Deep body — 65Hz sine dropping to 45Hz
    const body = c.createOscillator()
    body.type = 'sine'
    body.frequency.setValueAtTime(65, t)
    body.frequency.exponentialRampToValueAtTime(45, t + 0.15)
    const bg = c.createGain()
    bg.gain.setValueAtTime(0.0001, t)
    bg.gain.exponentialRampToValueAtTime(0.55, t + 0.008)
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.15)
    body.connect(bg)
    bg.connect(bus())
    body.start(t)
    body.stop(t + 0.16)

    // Short low-passed noise burst — glove/body contact
    const burst = c.createBufferSource()
    burst.buffer = noiseBuffer(c, 0.06)
    const lp = c.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 500
    const ng = c.createGain()
    ng.gain.setValueAtTime(0.3, t)
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
    burst.connect(lp)
    lp.connect(ng)
    ng.connect(bus())
    burst.start(t)
    burst.stop(t + 0.06)
  } catch (_) { /* audio unavailable — fail silent */ }
}

/**
 * Ball kick — §9: short low thud, ~80ms, at the moment of release.
 * Quiet (0.3) — it fires on every shot and must not compete with outcomes.
 */
export function playKick() {
  try {
    const c = ac()
    const t = c.currentTime

    const osc = c.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(120, t)
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.08)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08)
    osc.connect(g)
    g.connect(bus())
    osc.start(t)
    osc.stop(t + 0.09)

    // Tiny leather-contact tick
    const tick = c.createBufferSource()
    tick.buffer = noiseBuffer(c, 0.02)
    const hp = c.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 900
    const tg = c.createGain()
    tg.gain.setValueAtTime(0.08, t)
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.02)
    tick.connect(hp)
    hp.connect(tg)
    tg.connect(bus())
    tick.start(t)
    tick.stop(t + 0.02)
  } catch (_) { /* audio unavailable — fail silent */ }
}

/**
 * Net ripple on goal — the goal-moment impact. Water-like ripple layers on TOP
 * of a deep cinematic boom (stadium-goal thump), ~1.4s with a ringing tail.
 *   NEW Sub boom: sine 120Hz → 40Hz over 350ms, 8ms attack; holds only
 *                 briefly then spends ~80% of its length in a pronounced
 *                 two-stage fade-out to silence at 1.4s
 *   NEW Warmth:   triangle 90Hz → 60Hz, ~0.65s — audible weight on phone
 *                 speakers that can't reproduce the 40-60Hz sub
 *   NEW Punch:    60ms low-passed (350Hz) noise burst — the chest-hit attack
 *   Base:  soft filtered-noise swish (quiet — the cloth of the net)
 *   Drop:  sine sliding 800Hz → 250Hz over 200ms, 3ms attack (the "bloop")
 *   Tail:  150Hz sine pulsing twice over 400ms, very low amplitude (rings)
 * Mix: sub peaks 0.5 — below post hit (0.7) and save thud (0.55) so the §9
 * impact hierarchy holds; the master-bus compressor absorbs stacked peaks.
 */
export function playNetRipple() {
  try {
    const c = ac()
    const t = c.currentTime

    // — Cinematic goal boom: deep sub sweep with a long ring-out —
    const sub = c.createOscillator()
    sub.type = 'sine'
    sub.frequency.setValueAtTime(120, t)
    sub.frequency.exponentialRampToValueAtTime(40, t + 0.35)
    const subG = c.createGain()
    subG.gain.setValueAtTime(0.0001, t)
    subG.gain.exponentialRampToValueAtTime(0.5, t + 0.008)
    // Pronounced fade-out (full 1.4s duration kept): drop to ~30% within the
    // first 0.35s, then a long gentle glide to silence — the boom audibly
    // fades away rather than ringing near-full then cutting.
    subG.gain.exponentialRampToValueAtTime(0.15, t + 0.35)
    subG.gain.exponentialRampToValueAtTime(0.0001, t + 1.4)
    sub.connect(subG)
    subG.connect(bus())
    sub.start(t)
    sub.stop(t + 1.45)

    // Warmth harmonic — carries the boom on small speakers
    const warm = c.createOscillator()
    warm.type = 'triangle'
    warm.frequency.setValueAtTime(90, t)
    warm.frequency.exponentialRampToValueAtTime(60, t + 0.4)
    const warmG = c.createGain()
    warmG.gain.setValueAtTime(0.0001, t)
    warmG.gain.exponentialRampToValueAtTime(0.18, t + 0.012)
    warmG.gain.exponentialRampToValueAtTime(0.0001, t + 0.65)
    warm.connect(warmG)
    warmG.connect(bus())
    warm.start(t)
    warm.stop(t + 0.7)

    // Chest-punch transient — 60ms low-passed noise
    const punch = c.createBufferSource()
    punch.buffer = noiseBuffer(c, 0.06)
    const punchLp = c.createBiquadFilter()
    punchLp.type = 'lowpass'
    punchLp.frequency.value = 350
    const punchG = c.createGain()
    punchG.gain.setValueAtTime(0.22, t)
    punchG.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
    punch.connect(punchLp)
    punchLp.connect(punchG)
    punchG.connect(bus())
    punch.start(t)
    punch.stop(t + 0.06)

    // Noise swish base
    const swish = c.createBufferSource()
    swish.buffer = noiseBuffer(c, 0.45, true)
    const bp = c.createBiquadFilter()
    bp.type = 'bandpass'
    bp.Q.value = 0.8
    bp.frequency.setValueAtTime(900, t)
    bp.frequency.exponentialRampToValueAtTime(400, t + 0.45)
    const sg = c.createGain()
    sg.gain.setValueAtTime(0.0001, t)
    sg.gain.exponentialRampToValueAtTime(0.14, t + 0.04)
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.45)
    swish.connect(bp)
    bp.connect(sg)
    sg.connect(bus())
    swish.start(t)
    swish.stop(t + 0.45)

    // Water-drop bloop
    const drop = c.createOscillator()
    drop.type = 'sine'
    drop.frequency.setValueAtTime(800, t)
    drop.frequency.exponentialRampToValueAtTime(250, t + 0.2)
    const dg = c.createGain()
    dg.gain.setValueAtTime(0.0001, t)
    dg.gain.exponentialRampToValueAtTime(0.3, t + 0.003)   // 3ms attack
    dg.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
    drop.connect(dg)
    dg.connect(bus())
    drop.start(t)
    drop.stop(t + 0.25)

    // Ripple tail — two soft 150Hz pulses
    const tail = c.createOscillator()
    tail.type = 'sine'
    tail.frequency.value = 150
    const tg = c.createGain()
    tg.gain.setValueAtTime(0.0001, t + 0.18)
    tg.gain.exponentialRampToValueAtTime(0.07, t + 0.24)
    tg.gain.exponentialRampToValueAtTime(0.005, t + 0.38)
    tg.gain.exponentialRampToValueAtTime(0.06, t + 0.44)
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
    tail.connect(tg)
    tg.connect(bus())
    tail.start(t + 0.18)
    tail.stop(t + 0.62)
  } catch (_) { /* audio unavailable — fail silent */ }
}

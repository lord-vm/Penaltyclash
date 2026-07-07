// Synthesized sound effects — Web Audio API only, no audio assets.
// Context is created lazily on first play (always inside a user-gesture
// call chain, so autoplay policy is satisfied).

let ctx = null

function ac() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
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

/**
 * Crowd "ohh" groan for a wide miss — a brown-noise swell through a
 * bandpass filter whose centre frequency falls (the disappointed pitch-down).
 * ~600ms total.
 */
export function playCrowdGroan() {
  try {
    const c = ac()
    const t = c.currentTime
    const dur = 0.6

    const src  = c.createBufferSource()
    src.buffer = noiseBuffer(c, dur, true)
    const filt = c.createBiquadFilter()
    filt.type = 'bandpass'
    filt.Q.value = 1.2
    filt.frequency.setValueAtTime(500, t)
    filt.frequency.exponentialRampToValueAtTime(220, t + dur)

    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.38, t + 0.12)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)

    src.connect(filt)
    filt.connect(g)
    g.connect(c.destination)
    src.start(t)
    src.stop(t + dur)
  } catch (_) { /* audio unavailable — fail silent */ }
}

/**
 * Crowd cheer on goal — brown-noise swell with the bandpass sweeping UP
 * (the rising roar). Layered alongside the net-ripple sound. ~900ms.
 */
export function playCrowdCheer() {
  try {
    const c = ac()
    const t = c.currentTime
    const dur = 0.9

    const src  = c.createBufferSource()
    src.buffer = noiseBuffer(c, dur, true)
    const filt = c.createBiquadFilter()
    filt.type = 'bandpass'
    filt.Q.value = 0.9
    filt.frequency.setValueAtTime(450, t)
    filt.frequency.exponentialRampToValueAtTime(1400, t + 0.25)
    filt.frequency.exponentialRampToValueAtTime(700, t + dur)

    // Mix (§9 polish): crowd sits UNDER the impact sounds — save thud peaks
    // at 0.55 and post hit at 0.7, so the roar never overpowers either.
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.15)
    g.gain.setValueAtTime(0.35, t + 0.45)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)

    src.connect(filt)
    filt.connect(g)
    g.connect(c.destination)
    src.start(t)
    src.stop(t + dur)
  } catch (_) { /* audio unavailable — fail silent */ }
}

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
    bg.connect(c.destination)
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
    mg.connect(c.destination)
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
    cg.connect(c.destination)
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
    sg.connect(c.destination)
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
    bg.connect(c.destination)
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
    ng.connect(c.destination)
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
    g.connect(c.destination)
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
    tg.connect(c.destination)
    tick.start(t)
    tick.stop(t + 0.02)
  } catch (_) { /* audio unavailable — fail silent */ }
}

/**
 * Net ripple on goal — water-like to match the radial net wave visual. ~600ms.
 *   Base:  soft filtered-noise swish (quiet — the cloth of the net)
 *   Drop:  sine sliding 800Hz → 250Hz over 200ms, 3ms attack (the "bloop")
 *   Tail:  150Hz sine pulsing twice over 400ms, very low amplitude (spreading rings)
 */
export function playNetRipple() {
  try {
    const c = ac()
    const t = c.currentTime

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
    sg.connect(c.destination)
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
    dg.connect(c.destination)
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
    tg.connect(c.destination)
    tail.start(t + 0.18)
    tail.stop(t + 0.62)
  } catch (_) { /* audio unavailable — fail silent */ }
}

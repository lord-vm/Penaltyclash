const COUNTRY_KEY = 'pc_country'
const MODE_KEY = 'pc_mode'
const MUTE_KEY = 'pc_mute'
const CROWD_MUTE_KEY = 'pc_crowd_muted'
const DEVICE_KEY = 'pc_device_id'

export function getStoredCountry() {
  try {
    const raw = localStorage.getItem(COUNTRY_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setStoredCountry(country) {
  localStorage.setItem(COUNTRY_KEY, JSON.stringify(country))
}

// Selection mode: 'country' (national team) or 'club'. Each has its own
// leaderboard on the backend. Stored alongside the selected entity.
export function getStoredMode() {
  return localStorage.getItem(MODE_KEY) === 'club' ? 'club' : 'country'
}

export function setStoredMode(mode) {
  localStorage.setItem(MODE_KEY, mode === 'club' ? 'club' : 'country')
}

// v2 §13 — anonymous device UUID, sent with win submissions (logged server-side)
export function getDeviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY)
    if (!id) {
      id = crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem(DEVICE_KEY, id)
    }
    return id
  } catch {
    return 'unknown'
  }
}

export function getMute() {
  return localStorage.getItem(MUTE_KEY) === 'true'
}

export function setMute(val) {
  localStorage.setItem(MUTE_KEY, String(val))
}

// Crowd ambience on/off — a separate, narrower toggle than the (currently
// unwired) global getMute/setMute above; only gates the stadium crowd bed.
export function getCrowdMuted() {
  return localStorage.getItem(CROWD_MUTE_KEY) === 'true'
}

export function setCrowdMuted(val) {
  localStorage.setItem(CROWD_MUTE_KEY, String(val))
}

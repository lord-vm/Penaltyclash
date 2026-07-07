const COUNTRY_KEY = 'pc_country'
const MUTE_KEY = 'pc_mute'
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

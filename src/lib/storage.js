const COUNTRY_KEY = 'pc_country'
const MUTE_KEY = 'pc_mute'

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

export function getMute() {
  return localStorage.getItem(MUTE_KEY) === 'true'
}

export function setMute(val) {
  localStorage.setItem(MUTE_KEY, String(val))
}

// Thin fetch wrappers around the two Supabase edge functions.
// Keys come from Vite env vars (.env.local) — never hardcoded.
// Plain fetch instead of @supabase/supabase-js keeps the bundle small (§0).

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const backendConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

const HEADERS = {
  'Content-Type': 'application/json',
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
}

// v2 §12.2 — cache scoreboard reads client-side for 5s
const SCOREBOARD_CACHE_MS = 5000
let sbCache = { at: 0, key: '', data: null }

/**
 * GET /scoreboard → { top: Row[20], neighbors: Row[3]|null }
 * where Row = { code, name, flag, win_count, rank }.
 * `kind` selects which leaderboard ('country', the default, or 'club') —
 * countries and clubs rank separately. Pass the user's team code to also
 * get the you+neighbors slice. Serves the 5s cache unless `force` (manual
 * refresh) is set; on network or server errors it falls back to the last
 * good payload (or null).
 */
export async function fetchScoreboard(userCode = null, { force = false, kind = 'country' } = {}) {
  if (!backendConfigured) return null
  const key = `${kind}:${userCode ?? ''}`
  const now = Date.now()
  if (!force && sbCache.data && sbCache.key === key && now - sbCache.at < SCOREBOARD_CACHE_MS) {
    return sbCache.data
  }
  try {
    const qs  = `?kind=${kind}${userCode ? `&code=${encodeURIComponent(userCode)}` : ''}`
    const res = await fetch(`${SUPABASE_URL}/functions/v1/scoreboard${qs}`, { headers: HEADERS })
    if (!res.ok) return sbCache.data
    const data = await res.json()
    sbCache = { at: now, key, data }
    return data
  } catch {
    return sbCache.data
  }
}

/**
 * POST /submit-win with { team_code, device_id }. Covers both countries and
 * clubs — both leaderboards count wins now.
 * Returns { code, win_count, rank } or null. Fire-and-forget from the caller's
 * perspective — the server is the source of truth either way.
 * v2 §13 — on 429 the client retries once after 30s, then fails silently.
 */
export async function submitWin(teamCode, deviceId, isRetry = false) {
  if (!backendConfigured || !teamCode) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/submit-win`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ team_code: teamCode, device_id: deviceId }),
    })
    if (res.status === 429 && !isRetry) {
      setTimeout(() => { submitWin(teamCode, deviceId, true) }, 30_000)
      return null
    }
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

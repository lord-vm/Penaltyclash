// v2 §12.2 / §13 — submit-win edge function.
// Accepts { country_code, device_id }. Rate-limits 1 win per IP per 30s
// (in-memory), validates the country against the table, increments win_count
// atomically and returns the updated rank. Server is source of truth —
// nothing from the client is trusted beyond the validated 2-letter code.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const RATE_LIMIT_MS = 30_000
const lastSubmitByIp = new Map<string, number>()

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extra },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim()

  // §13 — max 1 submission per IP per 30s
  const now = Date.now()
  const last = lastSubmitByIp.get(ip)
  if (last !== undefined && now - last < RATE_LIMIT_MS) {
    const retryAfter = Math.ceil((RATE_LIMIT_MS - (now - last)) / 1000)
    return json({ error: 'rate_limited' }, 429, { 'Retry-After': String(retryAfter) })
  }
  // keep the map bounded — drop entries that have aged past the window
  if (lastSubmitByIp.size > 10_000) {
    for (const [k, v] of lastSubmitByIp) {
      if (now - v >= RATE_LIMIT_MS) lastSubmitByIp.delete(k)
    }
  }

  let body: { country_code?: unknown; device_id?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_json' }, 400)
  }

  const code = typeof body.country_code === 'string'
    ? body.country_code.trim().toUpperCase()
    : ''
  if (!/^[A-Z]{2}$/.test(code)) return json({ error: 'invalid_country_code' }, 400)

  // §13 — device id is logged but not enforced in v1
  console.log(`submit-win ip=${ip} device=${String(body.device_id ?? 'none')} code=${code}`)

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  const { data, error } = await supabase.rpc('submit_win', { p_code: code }).maybeSingle()
  if (error) {
    console.error('submit_win rpc failed:', error.message)
    return json({ error: 'db_error' }, 500)
  }
  if (!data) return json({ error: 'unknown_country' }, 400)

  lastSubmitByIp.set(ip, now) // only successful submissions consume the window
  return json({ code, win_count: data.win_count, rank: data.rank })
})

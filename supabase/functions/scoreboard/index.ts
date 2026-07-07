// v2 §12.2 — scoreboard edge function. No auth, 5s in-memory cache.
// Returns the top 20 countries by win_count DESC. With ?code=XX it also
// returns `neighbors`: the row above, the user's country, and the row below
// (for the in-game §2.3 panel), computed from the same cached ranking so the
// user's rank is correct even outside the top 20.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

type Row = { code: string; name: string; flag: string; win_count: number; rank: number }

const CACHE_MS = 5_000
let cache: { at: number; rows: Row[] } | null = null

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'GET') return json({ error: 'method_not_allowed' }, 405)

  const now = Date.now()
  if (!cache || now - cache.at >= CACHE_MS) {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const { data, error } = await supabase
      .from('countries')
      .select('code,name,flag,win_count')
      .order('win_count', { ascending: false })
      .order('code', { ascending: true }) // deterministic order within ties
    if (error) {
      console.error('scoreboard query failed:', error.message)
      if (!cache) return json({ error: 'db_error' }, 500)
      // stale-if-error: fall through and serve the last good cache
    } else {
      // competition ranking — equal win_counts share a rank
      let rank = 0
      let prev: number | null = null
      const rows = (data ?? []).map((r, i) => {
        if (r.win_count !== prev) {
          rank = i + 1
          prev = r.win_count
        }
        return { ...r, rank }
      })
      cache = { at: now, rows }
    }
  }

  const rows = cache!.rows
  const top = rows.slice(0, 20)

  const code = new URL(req.url).searchParams.get('code')?.trim().toUpperCase()
  let neighbors: Row[] | null = null
  if (code) {
    const i = rows.findIndex((r) => r.code === code)
    if (i !== -1) neighbors = rows.slice(Math.max(0, i - 1), Math.min(rows.length, i + 2))
  }

  return json({ top, neighbors, cached_at: cache!.at })
})

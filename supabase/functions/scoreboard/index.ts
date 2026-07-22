// v2 §12.2 — scoreboard edge function. No auth, 5s in-memory cache.
// Returns the top 20 teams by win_count DESC, ranked WITHIN the requested
// ?kind= ('country', the default, or 'club') — countries and clubs are
// separate leaderboards, so a club's rank never counts against countries.
// With ?code=XX it also returns `neighbors`: the row above, the requested
// team, and the row below (for the in-game §2.3 panel), computed from the
// same cached ranking so the user's rank is correct even outside the top 20.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

type Row = { code: string; kind: string; name: string; flag: string | null; win_count: number }
type RankedRow = Row & { rank: number }

const CACHE_MS = 5_000
// Cache holds ALL teams (both kinds), sorted by win_count desc — cheap to
// keep unfiltered since the whole table is at most a few dozen rows; kind
// filtering + competition ranking happen per-request against this cache.
let cache: { at: number; rows: Row[] } | null = null

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })
}

// Competition ranking (equal win_counts share a rank) within one kind.
// Rows are assumed already sorted by win_count desc (true of any subset of
// the globally-sorted cache).
function rankWithinKind(rows: Row[], kind: string): RankedRow[] {
  const subset = rows.filter((r) => r.kind === kind)
  let rank = 0
  let prev: number | null = null
  return subset.map((r, i) => {
    if (r.win_count !== prev) {
      rank = i + 1
      prev = r.win_count
    }
    return { ...r, rank }
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
      .from('teams')
      .select('code,kind,name,flag,win_count')
      .order('win_count', { ascending: false })
      .order('code', { ascending: true }) // deterministic order within ties
    if (error) {
      console.error('scoreboard query failed:', error.message)
      if (!cache) return json({ error: 'db_error' }, 500)
      // stale-if-error: fall through and serve the last good cache
    } else {
      cache = { at: now, rows: data ?? [] }
    }
  }

  const url  = new URL(req.url)
  const kind = url.searchParams.get('kind') === 'club' ? 'club' : 'country'
  const ranked = rankWithinKind(cache!.rows, kind)
  const top = ranked.slice(0, 20)

  const code = url.searchParams.get('code')?.trim().toUpperCase()
  let neighbors: RankedRow[] | null = null
  if (code) {
    const i = ranked.findIndex((r) => r.code === code)
    if (i !== -1) neighbors = ranked.slice(Math.max(0, i - 1), Math.min(ranked.length, i + 2))
  }

  return json({ top, neighbors, cached_at: cache!.at })
})

import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { flagSrc } from '../data/countries.js'
import { fetchScoreboard, backendConfigured } from '../lib/supabase.js'

export default function Scoreboard({ country, onBack }) {
  const userCode = country?.code

  const [rows,    setRows]    = useState(null)  // null = first load in flight
  const [userRow, setUserRow] = useState(null)  // user's own ranked row (may be outside top 20)
  const [loading, setLoading] = useState(true)

  // v2 §2.5 / §12.2 — top 20 from the scoreboard edge function; manual
  // refresh bypasses the 5s client cache (`force`).
  const load = useCallback(async (force = false) => {
    setLoading(true)
    const data = await fetchScoreboard(userCode, { force })
    if (data) {
      setRows(data.top ?? [])
      setUserRow(data.neighbors?.find(r => r.code === userCode) ?? null)
    } else {
      setRows(prev => prev ?? [])
    }
    setLoading(false)
  }, [userCode])

  useEffect(() => { load() }, [load])

  return (
    <div className="flex flex-col h-full w-full bg-[#0c1014] select-none">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe pt-4 pb-3 border-b border-white/10">
        <button onClick={onBack} className="text-white/50 text-2xl leading-none p-1">←</button>
        <h2 className="font-display text-white text-2xl tracking-wide flex-1">SCOREBOARD</h2>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="font-body text-white/40 text-xs border border-white/20 px-3 py-1 rounded-full disabled:opacity-40"
        >
          {loading ? '…' : 'Refresh'}
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        {rows === null && (
          <p className="font-body text-white/30 text-sm text-center pt-10">Loading…</p>
        )}

        {rows !== null && rows.length === 0 && (
          <p className="font-body text-white/30 text-sm text-center pt-10 px-8">
            {backendConfigured
              ? 'Scoreboard unavailable — try refresh'
              : 'Scoreboard backend not configured'}
          </p>
        )}

        {(rows ?? []).map((row, idx) => {
          const isUser = row.code === userCode
          const accent = country?.primary
          return (
            <motion.div
              key={row.code}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="flex items-center gap-3 px-4 py-3 border-b border-white/5"
              style={{
                background: isUser
                  ? `linear-gradient(90deg, ${accent}22 0%, transparent 100%)`
                  : 'transparent',
              }}
            >
              {/* Rank */}
              <span
                className="font-display text-lg w-8 text-right shrink-0"
                style={{ color: isUser ? accent : 'rgba(255,255,255,0.3)' }}
              >
                {row.rank <= 3 ? ['🥇','🥈','🥉'][row.rank-1] : `#${row.rank}`}
              </span>

              {/* Flag */}
              <img src={flagSrc(row.code)} alt={row.name} className="w-8 h-auto rounded-sm shrink-0" />

              {/* Name */}
              <span
                className="font-body text-sm font-semibold flex-1"
                style={{ color: isUser ? accent : 'rgba(255,255,255,0.85)' }}
              >
                {row.name}
                {isUser && (
                  <span className="ml-2 font-normal text-[10px] opacity-60">← you</span>
                )}
              </span>

              {/* Score */}
              <span
                className="font-display text-xl shrink-0"
                style={{ color: isUser ? accent : 'rgba(255,255,255,0.7)' }}
              >
                {row.win_count.toLocaleString()}
              </span>
            </motion.div>
          )
        })}

        {/* User country if outside top 20 */}
        {userRow && rows && rows.length > 0 && !rows.find((r) => r.code === userCode) && (
          <div className="px-4 py-3 border-t-2 border-white/10 mt-1">
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: `${country?.primary}22`, border: `1px solid ${country?.primary}55` }}
            >
              <span className="font-display text-lg text-white/40 w-8 text-right">#{userRow.rank}</span>
              <img src={flagSrc(userRow.code)} alt={userRow.name} className="w-8 h-auto rounded-sm" />
              <span className="font-body text-sm font-semibold flex-1" style={{ color: country?.primary }}>
                {userRow.name}
                <span className="ml-2 font-normal text-[10px] opacity-60">← you</span>
              </span>
              <span className="font-display text-xl" style={{ color: country?.primary }}>
                {userRow.win_count.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

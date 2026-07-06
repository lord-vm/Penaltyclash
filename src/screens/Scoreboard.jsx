import { motion } from 'framer-motion'
import { flagSrc } from '../data/countries.js'

// Mock data for Step 1
const MOCK_SCORES = [
  { rank: 1,  code: 'BR', name: 'Brazil',       wins: 48291 },
  { rank: 2,  code: 'AR', name: 'Argentina',    wins: 41087 },
  { rank: 3,  code: 'FR', name: 'France',       wins: 37422 },
  { rank: 4,  code: 'ES', name: 'Spain',        wins: 33918 },
  { rank: 5,  code: 'DE', name: 'Germany',      wins: 31204 },
  { rank: 6,  code: 'PT', name: 'Portugal',     wins: 28766 },
  { rank: 7,  code: 'GB', name: 'England',      wins: 25341 },
  { rank: 8,  code: 'IT', name: 'Italy',        wins: 22890 },
  { rank: 9,  code: 'NL', name: 'Netherlands',  wins: 19743 },
  { rank: 10, code: 'US', name: 'USA',          wins: 18512 },
  { rank: 11, code: 'JP', name: 'Japan',        wins: 16288 },
  { rank: 12, code: 'MX', name: 'Mexico',       wins: 14091 },
  { rank: 13, code: 'KR', name: 'South Korea',  wins: 12847 },
  { rank: 14, code: 'IN', name: 'India',        wins: 9221  },
  { rank: 15, code: 'MA', name: 'Morocco',      wins: 8940  },
  { rank: 16, code: 'NG', name: 'Nigeria',      wins: 7812  },
  { rank: 17, code: 'BE', name: 'Belgium',      wins: 6934  },
  { rank: 18, code: 'HR', name: 'Croatia',      wins: 5671  },
  { rank: 19, code: 'AU', name: 'Australia',    wins: 4890  },
  { rank: 20, code: 'SN', name: 'Senegal',      wins: 3712  },
]

export default function Scoreboard({ country, onBack }) {
  const userCode = country?.code

  return (
    <div className="flex flex-col h-full w-full bg-[#0c1014] select-none">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe pt-4 pb-3 border-b border-white/10">
        <button onClick={onBack} className="text-white/50 text-2xl leading-none p-1">←</button>
        <h2 className="font-display text-white text-2xl tracking-wide flex-1">SCOREBOARD</h2>
        <button
          onClick={() => {}}
          className="font-body text-white/40 text-xs border border-white/20 px-3 py-1 rounded-full"
        >
          Refresh
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto" style={{ WebkitOverflowScrolling: 'touch' }}>
        {MOCK_SCORES.map((row, idx) => {
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
                {row.wins.toLocaleString()}
              </span>
            </motion.div>
          )
        })}

        {/* User country if outside top 20 */}
        {userCode && !MOCK_SCORES.find((r) => r.code === userCode) && (
          <div className="px-4 py-3 border-t-2 border-white/10 mt-1">
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: `${country?.primary}22`, border: `1px solid ${country?.primary}55` }}
            >
              <span className="font-display text-lg text-white/40 w-8 text-right">#—</span>
              <img src={flagSrc(country.code)} alt={country.name} className="w-8 h-auto rounded-sm" />
              <span className="font-body text-sm font-semibold flex-1" style={{ color: country?.primary }}>
                {country?.name}
                <span className="ml-2 font-normal text-[10px] opacity-60">← you</span>
              </span>
              <span className="font-display text-xl" style={{ color: country?.primary }}>0</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

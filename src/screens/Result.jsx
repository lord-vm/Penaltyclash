import { useMemo } from 'react'
import { motion } from 'framer-motion'
import TeamBadge from '../components/TeamBadge.jsx'

export default function Result({ outcome, score, suddenDeath, country, mode = 'country', onPlayAgain, onScoreboard, onHome }) {
  const isWin = outcome === 'win'
  const accent = country?.primary || '#FEDF00'

  return (
    <div className="relative flex flex-col items-center justify-center h-full w-full bg-[#0c1014] overflow-hidden select-none px-6">
      {/* Subtle pitch lines in background */}
      <div className="absolute inset-0 opacity-10">
        <svg width="100%" height="100%" viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
          {[0,1,2,3,4,5].map((i) => (
            <rect key={i} x={i*65} y="0" width="65" height="844" fill={i%2===0?'#1a7a3a':'#2d9c52'} />
          ))}
        </svg>
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 w-full max-w-sm">
        {isWin
          ? <WinContent score={score} country={country} mode={mode} accent={accent} />
          : <LossContent score={score} mode={mode} />}

        {suddenDeath && (
          <span className="font-display text-sm tracking-widest px-3 py-1 rounded-full border"
            style={{ color: '#ff5555', borderColor: 'rgba(255,85,85,0.4)' }}>
            DECIDED IN SUDDEN DEATH
          </span>
        )}

        {/* Buttons */}
        <div className="flex flex-col gap-3 w-full mt-4">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onPlayAgain}
            className="font-display text-black text-2xl tracking-wider py-4 rounded-xl w-full"
            style={{ background: accent }}
          >
            PLAY AGAIN
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onScoreboard}
            className="font-display text-white text-2xl tracking-wider py-4 rounded-xl w-full border border-white/30 bg-white/10"
          >
            SCOREBOARD
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onHome}
            className="font-display text-white/50 text-xl tracking-wider py-3 rounded-xl w-full"
          >
            HOME
          </motion.button>
        </div>
      </div>
    </div>
  )
}

function WinContent({ score, country, mode, accent }) {
  return (
    <div className="flex flex-col items-center gap-4">
      {/* Sparkle ring */}
      <div className="relative">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="font-display text-center leading-none"
          style={{ fontSize: 'clamp(5rem, 22vw, 8rem)', color: accent, textShadow: `0 0 60px ${accent}88` }}
        >
          WIN
        </motion.div>

        {/* Sparkle — §10: ~30 particles emit from the WIN text in accent
            colors, fading over 1.5s */}
        <Sparkles accent={accent} />
      </div>

      <div className="text-center">
        <p className="font-display text-white/80 text-3xl">
          {score ?? 4}/5
        </p>
        {country && (
          <p className="font-body text-white/60 text-sm mt-1 flex items-center justify-center gap-1.5">
            +1 for
            <TeamBadge entity={country} mode={mode} size={20} />
            {country.name}
          </p>
        )}
      </div>
    </div>
  )
}

function Sparkles({ accent }) {
  // Random burst computed once per mount
  const parts = useMemo(() =>
    Array.from({ length: 30 }, () => {
      const angle = Math.random() * Math.PI * 2
      const dist  = 55 + Math.random() * 85
      return {
        x:     Math.cos(angle) * dist,
        y:     Math.sin(angle) * dist * 0.85,   // slightly flattened burst
        size:  3 + Math.random() * 4,
        delay: Math.random() * 0.25,
      }
    }), [])

  return parts.map((p, i) => (
    <motion.span
      key={i}
      initial={{ opacity: 0, x: 0, y: 0, scale: 1 }}
      animate={{ opacity: [0, 1, 0], x: p.x, y: p.y, scale: 0.4 }}
      transition={{ delay: 0.15 + p.delay, duration: 1.5, ease: 'easeOut' }}
      className="absolute top-1/2 left-1/2 rounded-full pointer-events-none"
      style={{
        width: p.size, height: p.size, background: accent,
        marginTop: -p.size / 2, marginLeft: -p.size / 2,
        boxShadow: `0 0 6px ${accent}`,
      }}
    />
  ))
}

function LossContent({ score, mode }) {
  return (
    <div className="flex flex-col items-center gap-4">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 160, damping: 14 }}
        className="font-display text-white/60 text-center leading-none"
        style={{ fontSize: 'clamp(3rem, 16vw, 6rem)' }}
      >
        TRY
        <br />
        AGAIN
      </motion.div>

      <p className="font-display text-white/40 text-3xl">{score ?? 2}/5</p>
      <p className="font-body text-white/30 text-sm">
        Score 3 or more to win {mode === 'club' ? 'the shootout' : 'for your country'}
      </p>
    </div>
  )
}

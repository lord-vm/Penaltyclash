import { motion } from 'framer-motion'
import { flagSrc } from '../data/countries.js'

export default function Result({ outcome, score, country, onPlayAgain, onScoreboard, onHome }) {
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
        {isWin ? <WinContent score={score} country={country} accent={accent} /> : <LossContent score={score} />}

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

function WinContent({ score, country, accent }) {
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

        {/* Particle dots — static stand-ins for Step 1 */}
        {Array.from({ length: 12 }, (_, i) => {
          const angle = (i / 12) * 360
          const r = 90
          const x = Math.cos((angle * Math.PI) / 180) * r
          const y = Math.sin((angle * Math.PI) / 180) * r
          return (
            <motion.span
              key={i}
              initial={{ opacity: 0, x: 0, y: 0 }}
              animate={{ opacity: [0, 1, 0], x, y }}
              transition={{ delay: 0.2 + i * 0.04, duration: 0.9 }}
              className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full"
              style={{ background: accent, marginTop: -4, marginLeft: -4 }}
            />
          )
        })}
      </div>

      <div className="text-center">
        <p className="font-display text-white/80 text-3xl">
          {score ?? 4}/5
        </p>
        {country && (
          <p className="font-body text-white/60 text-sm mt-1 flex items-center justify-center gap-1.5">
            +1 for
            <img src={flagSrc(country.code)} alt={country.name} className="w-5 h-auto rounded-sm" />
            {country.name}
          </p>
        )}
      </div>
    </div>
  )
}

function LossContent({ score }) {
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
      <p className="font-body text-white/30 text-sm">Score 3 or more to win for your country</p>
    </div>
  )
}

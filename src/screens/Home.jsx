import { motion } from 'framer-motion'
import { flagSrc } from '../data/countries.js'

export default function Home({ onPlay, onScoreboard, savedCountry }) {
  return (
    <div className="relative flex flex-col items-center justify-center h-full w-full overflow-hidden select-none">
      {/* Stadium background */}
      <StadiumBg />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/50" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-6 w-full max-w-sm">
        {/* Logo */}
        <div className="text-center">
          <h1
            className="font-display text-white leading-none tracking-wide"
            style={{ fontSize: 'clamp(3rem, 14vw, 5.5rem)' }}
          >
            PENALTY
          </h1>
          <h1
            className="font-display text-white leading-none tracking-wide"
            style={{ fontSize: 'clamp(3rem, 14vw, 5.5rem)' }}
          >
            CLASH
          </h1>
          <p className="font-body text-white/70 text-sm mt-2 tracking-widest uppercase">
            Score for your nation
          </p>
        </div>

        {/* Returning player chip */}
        {savedCountry && (
          <div className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5">
            <img src={flagSrc(savedCountry.code)} alt={savedCountry.name} className="w-6 h-auto rounded-sm" />
            <span className="font-body text-white text-sm font-medium">{savedCountry.name}</span>
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-col gap-3 w-full">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onPlay}
            className="font-display text-black text-2xl tracking-wider py-4 rounded-xl w-full"
            style={{ background: '#FEDF00' }}
          >
            PLAY
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onScoreboard}
            className="font-display text-white text-2xl tracking-wider py-4 rounded-xl w-full border border-white/30 bg-white/10 backdrop-blur-sm"
          >
            SCOREBOARD
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => window.close()}
            className="font-display text-white/50 text-xl tracking-wider py-3 rounded-xl w-full"
          >
            EXIT
          </motion.button>
        </div>
      </div>
    </div>
  )
}

function StadiumBg() {
  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 390 844"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Sky gradient */}
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6ea8d4" />
          <stop offset="100%" stopColor="#f5c97a" />
        </linearGradient>
        <linearGradient id="pitch" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a7a3a" />
          <stop offset="100%" stopColor="#2d9c52" />
        </linearGradient>
      </defs>

      {/* Sky */}
      <rect width="390" height="844" fill="url(#sky)" />

      {/* Pitch */}
      <rect y="480" width="390" height="364" fill="url(#pitch)" />

      {/* Pitch stripes */}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <rect
          key={i}
          x={i * 65}
          y="480"
          width="65"
          height="364"
          fill={i % 2 === 0 ? '#1a7a3a' : '#2d9c52'}
          opacity="0.6"
        />
      ))}

      {/* Goal posts (distant) */}
      <rect x="110" y="340" width="8" height="120" fill="#f5f5f0" />
      <rect x="272" y="340" width="8" height="120" fill="#f5f5f0" />
      <rect x="110" y="340" width="170" height="8" fill="#f5f5f0" />

      {/* Net lines */}
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <line
          key={`v${i}`}
          x1={118 + i * 24}
          y1="348"
          x2={118 + i * 24}
          y2="460"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1"
        />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <line
          key={`h${i}`}
          x1="118"
          y1={360 + i * 24}
          x2="272"
          y2={360 + i * 24}
          stroke="rgba(255,255,255,0.18)"
          strokeWidth="1"
        />
      ))}

      {/* Penalty spot */}
      <circle cx="195" cy="560" r="4" fill="white" opacity="0.6" />

      {/* 18-yard box */}
      <rect x="70" y="460" width="250" height="120" fill="none" stroke="white" strokeWidth="2" opacity="0.3" />
    </svg>
  )
}

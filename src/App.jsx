import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Home from './screens/Home.jsx'
import CountrySelect from './screens/CountrySelect.jsx'
import Game from './screens/Game.jsx'
import Result from './screens/Result.jsx'
import Scoreboard from './screens/Scoreboard.jsx'
import { getStoredCountry, setStoredCountry, getDeviceId } from './lib/storage.js'
import { submitWin } from './lib/supabase.js'

const FADE = {
  initial:    { opacity: 0 },
  animate:    { opacity: 1 },
  exit:       { opacity: 0 },
  transition: { duration: 0.2 },
}

export default function App() {
  const [screen,  setScreen]  = useState('home')
  const [country, setCountry] = useState(getStoredCountry)
  const [outcome, setOutcome] = useState(null)
  const [score,   setScore]   = useState(null)

  function handlePlay() {
    setScreen(country ? 'game' : 'countrySelect')
  }

  function handleCountryConfirm(c) {
    setStoredCountry(c)
    setCountry(c)
    setScreen('game')
  }

  function handleResult(result, actualScore) {
    setOutcome(result)
    setScore(actualScore ?? (result === 'win' ? 4 : 2))
    setScreen('result')
    // v2 §12.2 — a WIN posts +1 for the country. Fire-and-forget: the server
    // validates, rate-limits and is the source of truth; the UI never blocks.
    if (result === 'win' && country) {
      submitWin(country.code, getDeviceId())
    }
  }

  return (
    // ── Outer shell: full viewport, dark stadium "wings" on wide screens ──
    <div
      className="flex items-center justify-center overflow-hidden bg-[#060b10]"
      style={{ width: '100vw', height: '100dvh' }}
    >
      {/* ── Portrait 9:16 game container ─────────────────────────────────
          On portrait mobile  → fills entire viewport (no letterbox)
          On desktop / tablet → max height = 100dvh, width auto (9:16)
      ──────────────────────────────────────────────────────────────────── */}
      <div
        className="relative overflow-hidden bg-[#0c1014]"
        style={{
          width:  'min(100vw, calc(100dvh * 9 / 16))',
          height: '100dvh',
        }}
      >
        <AnimatePresence mode="wait">
          {screen === 'home' && (
            <Screen key="home">
              <Home
                savedCountry={country}
                onPlay={handlePlay}
                onScoreboard={() => setScreen('scoreboard')}
              />
            </Screen>
          )}

          {screen === 'countrySelect' && (
            <Screen key="countrySelect">
              <CountrySelect
                onConfirm={handleCountryConfirm}
                onBack={() => setScreen('home')}
              />
            </Screen>
          )}

          {screen === 'game' && (
            <Screen key="game">
              <Game
                country={country}
                onResult={handleResult}
                onHome={() => setScreen('home')}
              />
            </Screen>
          )}

          {screen === 'result' && (
            <Screen key="result">
              <Result
                outcome={outcome}
                score={score}
                country={country}
                onPlayAgain={() => setScreen('game')}
                onScoreboard={() => setScreen('scoreboard')}
                onHome={() => setScreen('home')}
              />
            </Screen>
          )}

          {screen === 'scoreboard' && (
            <Screen key="scoreboard">
              <Scoreboard
                country={country}
                onBack={() => setScreen('home')}
              />
            </Screen>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function Screen({ children }) {
  return (
    <motion.div
      className="absolute inset-0"
      initial={FADE.initial}
      animate={FADE.animate}
      exit={FADE.exit}
      transition={FADE.transition}
    >
      {children}
    </motion.div>
  )
}

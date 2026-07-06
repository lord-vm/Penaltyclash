import { useState } from 'react'
import { motion } from 'framer-motion'
import { COUNTRIES, flagSrc } from '../data/countries.js'

export default function CountrySelect({ onConfirm, onBack }) {
  const [selected, setSelected] = useState(null)

  function handleConfirm() {
    if (selected) onConfirm(selected)
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#0c1014] select-none">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe pt-4 pb-3 border-b border-white/10">
        <button
          onClick={onBack}
          className="text-white/50 text-2xl leading-none p-1"
          aria-label="Back"
        >
          ←
        </button>
        <h2 className="font-display text-white text-2xl tracking-wide">PICK YOUR COUNTRY</h2>
      </div>

      {/* Grid */}
      <div
        className="flex-1 overflow-y-auto px-3 py-3"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div className="grid grid-cols-4 gap-2">
          {COUNTRIES.map((c) => {
            const isSelected = selected?.code === c.code
            return (
              <motion.button
                key={c.code}
                whileTap={{ scale: 0.93 }}
                onClick={() => setSelected(c)}
                className="flex flex-col items-center gap-1 rounded-xl p-2 transition-colors"
                style={{
                  background: isSelected ? `${c.primary}22` : 'rgba(255,255,255,0.05)',
                  border: isSelected ? `2px solid ${c.primary}` : '2px solid transparent',
                  transform: isSelected ? 'scale(1.06)' : 'scale(1)',
                  transition: 'transform 0.15s, border-color 0.15s, background 0.15s',
                }}
              >
                <img src={flagSrc(c.code)} alt={c.name} className="w-10 h-auto rounded-sm" />
                <span className="font-body text-white/70 text-[10px] text-center leading-tight">
                  {c.name}
                </span>
              </motion.button>
            )
          })}
        </div>
      </div>

      {/* Confirm footer */}
      <div className="px-4 pb-safe pb-6 pt-3 border-t border-white/10">
        {selected && (
          <p className="font-body text-white/50 text-xs text-center mb-2 flex items-center justify-center gap-1.5">
            Playing for{' '}
            <img src={flagSrc(selected.code)} alt={selected.name} className="w-5 h-auto rounded-sm" />
            <span className="text-white font-semibold">{selected.name}</span>
          </p>
        )}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleConfirm}
          disabled={!selected}
          className="font-display text-black text-2xl tracking-wider py-4 rounded-xl w-full transition-opacity"
          style={{
            background: selected ? (selected.primary || '#FEDF00') : '#444',
            opacity: selected ? 1 : 0.4,
            color: selected ? '#0c1014' : '#888',
          }}
        >
          CONFIRM
        </motion.button>
      </div>
    </div>
  )
}

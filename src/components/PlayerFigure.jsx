// Back-facing shooter. Render as <g> inside an <svg>.
// Origin at hip-center. Height spans roughly y=-130 to y=110.
// accent  = primary jersey color (country)
// accent2 = secondary color (shorts / collar trim)
// name    = current shooter's surname (printed in the jersey name band)
// number  = current shooter's shirt number (defaults to 9 when no lineup data)
export default function PlayerFigure({ accent = '#0055A4', accent2 = '#FFFFFF', name = '', number = 9 }) {
  const skin   = '#C8834A'
  const hair   = '#1a1109'
  const boot   = '#111111'
  const shortColor = accent2 === '#FFFFFF' ? '#e0e0e0' : accent2

  // Name band fit: uppercase; font-size scales inversely with length so the
  // printed width stays ~constant inside the 44-wide band (capped at 9 to fit
  // the band height). Long names shrink but stay legible — no truncation.
  const label    = String(name || '').toUpperCase()
  const nameFont = label ? Math.min(9, 90 / label.length) : 0

  return (
    <g style={{ animation: 'playerSway 2.2s ease-in-out infinite, weightShift 1.8s ease-in-out infinite', transformOrigin: '0px 0px' }}>
      {/* Drop shadow */}
      <ellipse cx="0" cy="108" rx="38" ry="8" fill="rgba(0,0,0,0.3)" />

      {/* === BOOTS === */}
      {/* Left boot */}
      <ellipse cx="-16" cy="102" rx="20" ry="10" fill={boot} />
      <ellipse cx="-20" cy="98"  rx="16" ry="7"  fill="#2a2a2a" />
      {/* Right boot */}
      <ellipse cx="16"  cy="104" rx="20" ry="10" fill={boot} />
      <ellipse cx="20"  cy="100" rx="16" ry="7"  fill="#2a2a2a" />

      {/* === SOCKS === */}
      <rect x="-28" y="78" width="20" height="28" rx="5" fill={accent2 === '#FFFFFF' ? '#ddd' : accent2} />
      <rect x="8"   y="80" width="20" height="28" rx="5" fill={accent2 === '#FFFFFF' ? '#ddd' : accent2} />

      {/* === SHINS (skin) === */}
      <rect x="-28" y="52" width="20" height="30" rx="6" fill={skin} />
      <rect x="8"   y="54" width="20" height="30" rx="6" fill={skin} />

      {/* === SHORTS === */}
      <path d="M-36,0 L-40,56 L-8,58 L0,38 L8,58 L40,56 L36,0 Z" fill={shortColor} />
      {/* Shorts inner shadow */}
      <path d="M0,0 L-4,58 L8,58 L0,38 Z" fill="rgba(0,0,0,0.08)" />

      {/* === JERSEY body (back) === */}
      {/* Main torso */}
      <path d="M-44,-62 C-46,-30 -44,0 -42,2 L42,2 C44,0 46,-30 44,-62 C28,-76 -28,-76 -44,-62 Z" fill={accent} />
      {/* Side shading for depth */}
      <path d="M-44,-62 C-46,-30 -44,0 -42,2 L-32,2 C-34,-2 -36,-28 -34,-58 Z" fill="rgba(0,0,0,0.15)" />
      <path d="M44,-62 C46,-30 44,0 42,2 L32,2 C34,-2 36,-28 34,-58 Z" fill="rgba(0,0,0,0.15)" />

      {/* Jersey number on back */}
      <text x="0" y="-24" textAnchor="middle" fill={accent2} fontSize="28" fontWeight="bold"
        fontFamily="Anton, sans-serif" opacity="0.8">{number}</text>

      {/* Name band at top of number — real shooter surname (fitted to band) */}
      <rect x="-22" y="-60" width="44" height="10" rx="2" fill="rgba(0,0,0,0.2)" />
      {label && (
        <text x="0" y="-52" textAnchor="middle" fill={accent2}
          fontSize={nameFont} fontWeight="bold" fontFamily="Anton, sans-serif"
          opacity="0.9">{label}</text>
      )}

      {/* === SLEEVES + ARMS === */}
      {/* Left arm (hanging slightly back) */}
      <path d="M-44,-58 C-52,-44 -58,-20 -56,-4 L-42,-2 C-42,-16 -40,-38 -36,-54 Z" fill={accent} />
      {/* Right arm */}
      <path d="M44,-58 C52,-44 58,-20 56,-4 L42,-2 C42,-16 40,-38 36,-54 Z" fill={accent} />

      {/* Left hand */}
      <ellipse cx="-52" cy="-1" rx="9" ry="11" fill={skin} />
      {/* Right hand */}
      <ellipse cx="52"  cy="-1" rx="9" ry="11" fill={skin} />

      {/* === NECK === */}
      <rect x="-10" y="-88" width="20" height="28" rx="6" fill={skin} />

      {/* Collar (back of jersey) */}
      <path d="M-14,-82 Q0,-78 14,-82 L12,-66 Q0,-62 -12,-66 Z" fill={accent} />

      {/* === HEAD (back view) === */}
      <circle cx="0" cy="-112" r="26" fill={skin} />

      {/* Hair (back of head — short sides, more on top) */}
      <ellipse cx="0"  cy="-128" rx="26" ry="18" fill={hair} />
      <rect x="-26" y="-128" width="52" height="18" rx="0" fill={hair} />
      {/* Hairline at neck */}
      <path d="M-14,-90 Q0,-86 14,-90 L12,-84 Q0,-80 -12,-84 Z" fill={hair} />

      {/* Ear left */}
      <ellipse cx="-24" cy="-110" rx="5" ry="7" fill={skin} />
      {/* Ear right */}
      <ellipse cx="24"  cy="-110" rx="5" ry="7" fill={skin} />

      {/* === HEADBAND (optional accent detail) === */}
      <rect x="-26" y="-120" width="52" height="6" rx="3" fill={accent2} opacity="0.6" />
    </g>
  )
}

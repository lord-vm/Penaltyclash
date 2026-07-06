// Front-facing goalkeeper. Render as <g> inside an <svg>.
// Origin is at the figure's hip-center. Height spans roughly y=-90 to y=90.
export default function KeeperFigure() {
  const skin   = '#D4956A'
  const hair   = '#1a1109'
  const jersey = '#F4D03F'   // bright yellow GK jersey
  const glove  = '#C0392B'   // red gloves
  const shorts = '#1a1a1a'
  const sock   = '#F4D03F'
  const boot   = '#111111'

  return (
    <g style={{ animation: 'keeperBounce 1.4s ease-in-out infinite, keeperSway 2.8s ease-in-out infinite', transformOrigin: '0px 0px' }}>
      {/* Drop shadow */}
      <ellipse cx="0" cy="90" rx="28" ry="6" fill="rgba(0,0,0,0.25)" />

      {/* === BOOTS === */}
      <ellipse cx="-12" cy="86" rx="14" ry="7" fill={boot} />
      <ellipse cx="12"  cy="86" rx="14" ry="7" fill={boot} />

      {/* === SOCKS === */}
      <rect x="-19" y="66" width="14" height="24" rx="4" fill={sock} />
      <rect x="5"   y="66" width="14" height="24" rx="4" fill={sock} />

      {/* === SHINS (skin between shorts and sock) === */}
      <rect x="-19" y="44" width="14" height="28" rx="5" fill={skin} />
      <rect x="5"   y="44" width="14" height="28" rx="5" fill={skin} />

      {/* === SHORTS === */}
      <path d="M-22,10 L-24,46 L-6,48 L0,30 L6,48 L24,46 L22,10 Z" fill={shorts} />

      {/* === JERSEY body === */}
      <path d="M-26,-48 C-28,-20 -26,10 -24,12 L24,12 C26,10 28,-20 26,-48 C14,-58 -14,-58 -26,-48 Z" fill={jersey} />

      {/* Jersey side panels */}
      <path d="M-26,-48 C-28,-20 -26,10 -24,12 L-18,12 C-20,8 -22,-18 -20,-44 Z" fill="rgba(0,0,0,0.12)" />
      <path d="M26,-48 C28,-20 26,10 24,12 L18,12 C20,8 22,-18 20,-44 Z" fill="rgba(0,0,0,0.12)" />

      {/* === SLEEVES + ARMS (slightly raised, ready stance) === */}
      {/* Left */}
      <path d="M-26,-44 C-34,-36 -52,-22 -56,-12 L-46,-6 C-42,-14 -26,-28 -20,-36 Z" fill={jersey} />
      {/* Right */}
      <path d="M26,-44 C34,-36 52,-22 56,-12 L46,-6 C42,-14 26,-28 20,-36 Z" fill={jersey} />

      {/* === GLOVES === */}
      {/* Left glove body */}
      <rect x="-66" y="-20" width="20" height="14" rx="5" fill={glove} />
      <ellipse cx="-56" cy="-13" rx="12" ry="8" fill={glove} />
      {/* Left glove finger ridges */}
      {[-62,-57,-52,-47].map((x,i) => (
        <rect key={i} x={x} y="-22" width="4" height="10" rx="2" fill="rgba(0,0,0,0.2)" />
      ))}
      {/* Right glove body */}
      <rect x="46" y="-20" width="20" height="14" rx="5" fill={glove} />
      <ellipse cx="56" cy="-13" rx="12" ry="8" fill={glove} />
      {[47,52,57,62].map((x,i) => (
        <rect key={i} x={x} y="-22" width="4" height="10" rx="2" fill="rgba(0,0,0,0.2)" />
      ))}

      {/* === NECK === */}
      <rect x="-8" y="-66" width="16" height="22" rx="5" fill={skin} />

      {/* === HEAD === */}
      <circle cx="0" cy="-82" r="20" fill={skin} />

      {/* Ear left */}
      <ellipse cx="-19" cy="-82" rx="4" ry="6" fill={skin} />
      {/* Ear right */}
      <ellipse cx="19" cy="-82" rx="4" ry="6" fill={skin} />

      {/* === HAIR === */}
      <path d="M-20,-92 Q0,-105 20,-92 L18,-76 Q0,-82 -18,-76 Z" fill={hair} />

      {/* Eyebrows */}
      <path d="M-12,-78 Q-7,-80 -2,-78" stroke={hair} strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M2,-78 Q7,-80 12,-78" stroke={hair} strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* Eyes */}
      <ellipse cx="-7" cy="-74" rx="4" ry="3.5" fill="white" />
      <ellipse cx="7"  cy="-74" rx="4" ry="3.5" fill="white" />
      <circle cx="-7" cy="-74" r="2.5" fill="#3a2a10" />
      <circle cx="7"  cy="-74" r="2.5" fill="#3a2a10" />
      <circle cx="-6" cy="-75" r="1" fill="white" />
      <circle cx="8"  cy="-75" r="1" fill="white" />

      {/* Nose */}
      <path d="M0,-71 Q-3,-66 -4,-63 Q0,-61 4,-63 Q3,-66 0,-71" fill="rgba(0,0,0,0.12)" />

      {/* Mouth (slight concentration expression) */}
      <path d="M-6,-58 Q0,-56 6,-58" stroke="rgba(0,0,0,0.3)" strokeWidth="1.5" fill="none" strokeLinecap="round" />

      {/* Jersey collar */}
      <path d="M-10,-60 Q0,-55 10,-60 L8,-48 Q0,-44 -8,-48 Z" fill={jersey} />
      <path d="M-10,-60 Q0,-64 10,-60" stroke="rgba(0,0,0,0.15)" strokeWidth="1" fill="none" />
    </g>
  )
}

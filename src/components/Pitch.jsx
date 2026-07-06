import PlayerFigure from './PlayerFigure.jsx'
// KeeperFigure is rendered in Game.jsx's overlay SVG (needs rAF animation)

// ─────────────────────────────────────────────────────────────────────────────
// Scene layout  (viewBox 0 0 390 844)
//   y 0–305  →  sky (36 %) + stadium stands behind goal
//   y 305–844 → pitch surface (64 %) — "65-70% of screen" per spec
//   Horizon: y = 305
//
// Goal  (3:1 wide:tall)
//   Left post x=45, right post x=345  →  width 300 px
//   Crossbar y=195, goal-line y=305   →  height 110 px   ratio 2.73:1
//
// Keeper: scale 0.52, centred at (195, 270)
//   Renders ≈ 65 % of goal height, ≈ 25 % of goal width with arms out
// ─────────────────────────────────────────────────────────────────────────────

export default function Pitch({ country }) {
  const accent  = country?.primary   || '#0055A4'
  const accent2 = country?.secondary || '#FFFFFF'

  return (
    <svg
      className="absolute inset-0 w-full h-full"
      viewBox="0 0 390 844"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* 2 PM afternoon sky: soft warm blue → hazy cream at horizon */}
        <linearGradient id="gSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#7bbcd5" />
          <stop offset="55%"  stopColor="#b8d8ea" />
          <stop offset="100%" stopColor="#f2dba8" />
        </linearGradient>

        {/* Pitch: deep → lighter green stripe base */}
        <linearGradient id="gPitch" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#1c8a3e" />
          <stop offset="100%" stopColor="#145c29" />
        </linearGradient>

        {/* Net shading */}
        <linearGradient id="gNet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="rgba(0,0,0,0.28)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.06)" />
        </linearGradient>

        {/* Vignette */}
        <radialGradient id="gVig" cx="50%" cy="50%" r="70%">
          <stop offset="0%"   stopColor="transparent" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.40)" />
        </radialGradient>

        {/* Warm haze at horizon */}
        <radialGradient id="gHaze" cx="50%" cy="100%" r="50%">
          <stop offset="0%"   stopColor="#f5e0a0" stopOpacity="0.55" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>

        <radialGradient id="gBallShade" cx="38%" cy="35%" r="60%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.55)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0.22)" />
        </radialGradient>
      </defs>

      {/* ── SKY ─────────────────────────────────────────────────────────── */}
      <rect width="390" height="305" fill="url(#gSky)" />

      {/* ── STADIUM STANDS (angular, not hills) ─────────────────────────── */}
      {/* Back wall / upper structure */}
      <rect x="0" y="0" width="390" height="110" fill="#1a2530" />

      {/* Roof overhang */}
      <rect x="0" y="98" width="390" height="14" fill="#232f3c" />
      <rect x="0" y="108" width="390" height="4"  fill="rgba(255,255,255,0.06)" />

      {/* Upper tier — dark stepped seats */}
      <path d="M0,110 L0,170 L390,170 L390,110 Z" fill="#1e2d3a" />
      {/* Seat row lines */}
      {[118,126,134,142,150,158,166].map((y,i) => (
        <line key={i} x1="0" y1={y} x2="390" y2={y}
          stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      ))}
      {/* Crowd suggestion: tiny alternating-tone rectangles */}
      {Array.from({length:32},(_,i)=>(
        <rect key={i} x={i*12+1} y={112} width={10} height={52}
          fill={i%3===0?'rgba(255,255,255,0.04)':i%3===1?'rgba(255,255,255,0.02)':'rgba(0,0,0,0.05)'} />
      ))}

      {/* Lower tier — slightly lighter, closer */}
      <path d="M0,170 L0,220 L390,220 L390,170 Z" fill="#253545" />
      {[178,186,194,202,210,218].map((y,i) => (
        <line key={i} x1="0" y1={y} x2="390" y2={y}
          stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      ))}
      {/* Crowd dots lower tier */}
      {Array.from({length:38},(_,i)=>(
        <rect key={i} x={i*10+2} y={172} width={8} height={46}
          fill={i%4===0?'rgba(255,200,50,0.08)':i%4===1?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.06)'} />
      ))}

      {/* Floodlight columns (subtle) */}
      {[30, 360].map((x,i) => (
        <g key={i}>
          <rect x={x-3} y="20" width="6" height="195" fill="#2a3a4a" />
          <rect x={x-8} y="18" width="16" height="6" rx="1" fill="#3a4a5a" />
        </g>
      ))}

      {/* Horizon fade */}
      <rect x="0" y="220" width="390" height="85" fill="url(#gHaze)" opacity="0.7" />

      {/* ── PITCH SURFACE ───────────────────────────────────────────────── */}
      <rect x="0" y="305" width="390" height="539" fill="url(#gPitch)" />

      {/* Pitch stripes */}
      {[0,1,2,3,4,5,6,7].map(i => i%2===0 ? null : (
        <rect key={i} x={i*49} y="305" width="49" height="539"
          fill="rgba(0,0,0,0.06)" />
      ))}

      {/* Horizon ground line */}
      <line x1="0" y1="305" x2="390" y2="305"
        stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

      {/* ── GOAL ────────────────────────────────────────────────────────── */}
      {/* Net fill */}
      <path d="M45,195 L345,195 L345,305 L45,305 Z" fill="url(#gNet)" />

      {/* Net grid — polylines with intermediate sample points so Game.jsx can
          bend the strings during the goal ripple effect. data-base holds the
          resting geometry; Game.jsx restores it when the ripple settles. */}
      <g data-net="grid">
        {/* Vertical strings */}
        {Array.from({length:16},(_,i)=>{
          const x = 45 + i * 20
          const pts = Array.from({length:12},(_,j)=>`${x},${195 + j * 10}`).join(' ')
          return <polyline key={`nv${i}`} data-base={pts} points={pts} fill="none"
            stroke="rgba(255,255,255,0.13)" strokeWidth="0.8" />
        })}
        {/* Horizontal strings */}
        {Array.from({length:6},(_,i)=>{
          const y = 207 + i * 17
          const pts = Array.from({length:16},(_,j)=>`${45 + j * 20},${y}`).join(' ')
          return <polyline key={`nh${i}`} data-base={pts} points={pts} fill="none"
            stroke="rgba(255,255,255,0.13)" strokeWidth="0.8" />
        })}
      </g>

      {/* Left post — data-post group lets Game.jsx wobble it on impact */}
      <g data-post="left">
        <rect x="38" y="192" width="10" height="115" rx="2" fill="#f0f0eb" />
        <rect x="39" y="192" width="4"  height="115" fill="rgba(255,255,255,0.45)" />
      </g>

      {/* Right post */}
      <g data-post="right">
        <rect x="342" y="192" width="10" height="115" rx="2" fill="#f0f0eb" />
        <rect x="343" y="192" width="4"  height="115" fill="rgba(255,255,255,0.45)" />
      </g>

      {/* Crossbar */}
      <g data-post="top">
        <rect x="38" y="192" width="314" height="10" rx="2" fill="#f0f0eb" />
        <rect x="38" y="193" width="314" height="4"  fill="rgba(255,255,255,0.45)" />
      </g>

      {/* Post base shadows on pitch */}
      <ellipse cx="43"  cy="307" rx="8" ry="3" fill="rgba(0,0,0,0.3)" />
      <ellipse cx="347" cy="307" rx="8" ry="3" fill="rgba(0,0,0,0.3)" />

      {/* ── PITCH MARKINGS ─────────────────────────────────────────────── */}
      {/* Goal line */}
      <line x1="38" y1="305" x2="352" y2="305"
        stroke="rgba(255,255,255,0.65)" strokeWidth="2" />

      {/* 6-yard box (perspective trapezoid) */}
      <path d="M130,305 L120,340 L270,340 L260,305"
        fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />

      {/* 18-yard box (wider trapezoid) */}
      <path d="M45,305 L10,470 L380,470 L345,305"
        fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" />

      {/* Penalty arc */}
      <path d="M20,465 Q195,505 370,465"
        fill="none" stroke="rgba(255,255,255,0.30)" strokeWidth="1.5"
        strokeDasharray="7 5" />

      {/* Penalty spot */}
      <circle cx="195" cy="490" r="5" fill="rgba(255,255,255,0.70)" />

      {/* Keeper rendered in Game.jsx overlay for rAF animation */}

      {/* ── PLAYER (back-view shooter) ─────────────────────────────────── */}
      {/* Positioned so upper body + head visible in lower frame */}
      <g transform="translate(195,790) scale(1.38)">
        <PlayerFigure accent={accent} accent2={accent2} />
      </g>

      {/* ── VIGNETTE ───────────────────────────────────────────────────── */}
      <rect width="390" height="844" fill="url(#gVig)" />

      {/* Warm sun stripe at horizon */}
      <rect x="0" y="303" width="390" height="4"
        fill="rgba(245,210,120,0.15)" />
    </svg>
  )
}

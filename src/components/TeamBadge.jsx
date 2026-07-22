import { flagSrc } from '../data/countries.js'

// Perceived luminance → pick a readable text color for a club badge.
function isLight(hex) {
  const c = (hex || '#000').replace('#', '')
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  return 0.299 * r + 0.587 * g + 0.114 * b > 150
}

/**
 * Unified team crest: a flag <img> for countries, a colored initials badge for
 * clubs (no external images — clubs have no flag CDN). `size` is width in px.
 */
export default function TeamBadge({ entity, mode, size = 28, className = '' }) {
  if (!entity) return null

  if (mode === 'club') {
    const fg = isLight(entity.primary) ? '#111' : '#fff'
    return (
      <span
        className={`inline-flex items-center justify-center font-display leading-none rounded-sm shrink-0 ${className}`}
        style={{
          width: size, height: size,
          background: entity.primary, color: fg,
          border: `1.5px solid ${entity.secondary}`,
          fontSize: Math.round(size * 0.34),
        }}
      >
        {entity.code}
      </span>
    )
  }

  return (
    <img
      src={flagSrc(entity.code)}
      alt={entity.name}
      style={{ width: size }}
      className={`h-auto rounded-sm shrink-0 ${className}`}
    />
  )
}

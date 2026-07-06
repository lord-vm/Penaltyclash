// flagcdn.com provides flag images by lowercase ISO code
// e.g. https://flagcdn.com/w40/br.png
export function flagUrl(code) {
  return `https://flagcdn.com/w40/${code.toLowerCase()}.png`
}

// England uses gb-eng subdivision code
function eng(code) {
  return code === 'GB' ? 'gb-eng' : code.toLowerCase()
}

export function flagSrc(code) {
  return `https://flagcdn.com/w40/${eng(code)}.png`
}

export const COUNTRIES = [
  { code: 'BR', name: 'Brazil',       primary: '#FEDF00', secondary: '#009C3B' },
  { code: 'AR', name: 'Argentina',    primary: '#75AADB', secondary: '#FFFFFF' },
  { code: 'FR', name: 'France',       primary: '#0055A4', secondary: '#EF4135' },
  { code: 'ES', name: 'Spain',        primary: '#AA151B', secondary: '#F1BF00' },
  { code: 'DE', name: 'Germany',      primary: '#DD0000', secondary: '#FFCE00' },
  { code: 'PT', name: 'Portugal',     primary: '#006600', secondary: '#FF0000' },
  { code: 'GB', name: 'England',      primary: '#CE1124', secondary: '#FFFFFF' },
  { code: 'IN', name: 'India',        primary: '#FF9933', secondary: '#138808' },
  { code: 'JP', name: 'Japan',        primary: '#BC002D', secondary: '#FFFFFF' },
  { code: 'KR', name: 'South Korea',  primary: '#003478', secondary: '#C60C30' },
  { code: 'MX', name: 'Mexico',       primary: '#006847', secondary: '#CE1126' },
  { code: 'NG', name: 'Nigeria',      primary: '#008751', secondary: '#FFFFFF' },
  { code: 'IT', name: 'Italy',        primary: '#008C45', secondary: '#CD212A' },
  { code: 'NL', name: 'Netherlands',  primary: '#FF7F00', secondary: '#FFFFFF' },
  { code: 'MA', name: 'Morocco',      primary: '#C1272D', secondary: '#006233' },
  { code: 'US', name: 'USA',          primary: '#B22234', secondary: '#3C3B6E' },
  { code: 'BE', name: 'Belgium',      primary: '#FDDA24', secondary: '#EF3340' },
  { code: 'HR', name: 'Croatia',      primary: '#FF0000', secondary: '#FFFFFF' },
  { code: 'SA', name: 'Saudi Arabia', primary: '#006C35', secondary: '#FFFFFF' },
  { code: 'AU', name: 'Australia',    primary: '#FFCD00', secondary: '#00843D' },
  { code: 'SN', name: 'Senegal',      primary: '#00853F', secondary: '#FDEF42' },
  { code: 'UY', name: 'Uruguay',      primary: '#7B9ED9', secondary: '#FCD116' },
  { code: 'CO', name: 'Colombia',     primary: '#FCD116', secondary: '#003893' },
  { code: 'CH', name: 'Switzerland',  primary: '#DA291C', secondary: '#FFFFFF' },
]

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

// Each country carries a 5-player `lineup` of its most significant players
// (shown one per shot). National-team numbers are the player's most-associated
// number; several nations legitimately have multiple #10s (shown sequentially).
export const COUNTRIES = [
  { code: 'BR', name: 'Brazil',       primary: '#FEDF00', secondary: '#009C3B',
    lineup: [ { name: 'Pelé', number: 10 }, { name: 'Ronaldo', number: 9 }, { name: 'Romário', number: 11 }, { name: 'Ronaldinho', number: 10 }, { name: 'Neymar', number: 10 } ] },
  { code: 'AR', name: 'Argentina',    primary: '#75AADB', secondary: '#FFFFFF',
    lineup: [ { name: 'Maradona', number: 10 }, { name: 'Messi', number: 10 }, { name: 'Batistuta', number: 9 }, { name: 'Di María', number: 11 }, { name: 'Mascherano', number: 14 } ] },
  { code: 'FR', name: 'France',       primary: '#0055A4', secondary: '#EF4135',
    lineup: [ { name: 'Zidane', number: 10 }, { name: 'Platini', number: 10 }, { name: 'Mbappé', number: 10 }, { name: 'Henry', number: 12 }, { name: 'Griezmann', number: 7 } ] },
  { code: 'ES', name: 'Spain',        primary: '#AA151B', secondary: '#F1BF00',
    lineup: [ { name: 'Iniesta', number: 6 }, { name: 'Xavi', number: 8 }, { name: 'Casillas', number: 1 }, { name: 'Torres', number: 9 }, { name: 'Ramos', number: 15 } ] },
  { code: 'DE', name: 'Germany',      primary: '#DD0000', secondary: '#FFCE00',
    lineup: [ { name: 'Beckenbauer', number: 5 }, { name: 'Matthäus', number: 10 }, { name: 'Klose', number: 11 }, { name: 'Kahn', number: 1 }, { name: 'G. Müller', number: 13 } ] },
  { code: 'PT', name: 'Portugal',     primary: '#006600', secondary: '#FF0000',
    lineup: [ { name: 'Ronaldo', number: 7 }, { name: 'Figo', number: 7 }, { name: 'Eusébio', number: 13 }, { name: 'Rui Costa', number: 10 }, { name: 'Pauleta', number: 9 } ] },
  { code: 'GB', name: 'England',      primary: '#CE1124', secondary: '#FFFFFF',
    lineup: [ { name: 'Rooney', number: 10 }, { name: 'Shearer', number: 9 }, { name: 'Gerrard', number: 8 }, { name: 'Beckham', number: 7 }, { name: 'Moore', number: 6 } ] },
  { code: 'IN', name: 'India',        primary: '#FF9933', secondary: '#138808',
    lineup: [ { name: 'Chhetri', number: 11 }, { name: 'Bhutia', number: 15 }, { name: 'Vijayan', number: 10 }, { name: 'PK Banerjee', number: 20 }, { name: 'Goswami', number: 8 } ] },
  { code: 'JP', name: 'Japan',        primary: '#BC002D', secondary: '#FFFFFF',
    lineup: [ { name: 'Nakata', number: 10 }, { name: 'Nakamura', number: 10 }, { name: 'Honda', number: 4 }, { name: 'Kazu Miura', number: 11 }, { name: 'Okazaki', number: 9 } ] },
  { code: 'KR', name: 'South Korea',  primary: '#003478', secondary: '#C60C30',
    lineup: [ { name: 'Son', number: 7 }, { name: 'Park Ji-sung', number: 13 }, { name: 'Cha Bum-kun', number: 11 }, { name: 'Hong Myung-bo', number: 20 }, { name: 'Ahn Jung-hwan', number: 19 } ] },
  { code: 'MX', name: 'Mexico',       primary: '#006847', secondary: '#CE1126',
    lineup: [ { name: 'Hugo Sánchez', number: 11 }, { name: 'Márquez', number: 4 }, { name: 'Blanco', number: 10 }, { name: 'Chicharito', number: 14 }, { name: 'Campos', number: 1 } ] },
  { code: 'NG', name: 'Nigeria',      primary: '#008751', secondary: '#FFFFFF',
    lineup: [ { name: 'Okocha', number: 10 }, { name: 'Kanu', number: 4 }, { name: 'Yekini', number: 9 }, { name: 'Finidi', number: 7 }, { name: 'Amokachi', number: 11 } ] },
  { code: 'IT', name: 'Italy',        primary: '#008C45', secondary: '#CD212A',
    lineup: [ { name: 'Baggio', number: 10 }, { name: 'Maldini', number: 3 }, { name: 'Buffon', number: 1 }, { name: 'Cannavaro', number: 5 }, { name: 'Pirlo', number: 21 } ] },
  { code: 'NL', name: 'Netherlands',  primary: '#FF7F00', secondary: '#FFFFFF',
    lineup: [ { name: 'Cruyff', number: 14 }, { name: 'Van Basten', number: 9 }, { name: 'Gullit', number: 10 }, { name: 'Rijkaard', number: 8 }, { name: 'Robben', number: 11 } ] },
  { code: 'MA', name: 'Morocco',      primary: '#C1272D', secondary: '#006233',
    lineup: [ { name: 'Hakimi', number: 2 }, { name: 'Ziyech', number: 7 }, { name: 'Bounou', number: 1 }, { name: 'En-Nesyri', number: 19 }, { name: 'Hadji', number: 10 } ] },
  { code: 'US', name: 'USA',          primary: '#B22234', secondary: '#3C3B6E',
    lineup: [ { name: 'Donovan', number: 10 }, { name: 'Dempsey', number: 8 }, { name: 'Pulisic', number: 10 }, { name: 'Howard', number: 1 }, { name: 'McBride', number: 20 } ] },
  { code: 'BE', name: 'Belgium',      primary: '#FDDA24', secondary: '#EF3340',
    lineup: [ { name: 'Hazard', number: 10 }, { name: 'De Bruyne', number: 7 }, { name: 'Lukaku', number: 9 }, { name: 'Courtois', number: 1 }, { name: 'Kompany', number: 4 } ] },
  { code: 'HR', name: 'Croatia',      primary: '#FF0000', secondary: '#FFFFFF',
    lineup: [ { name: 'Modrić', number: 10 }, { name: 'Šuker', number: 9 }, { name: 'Rakitić', number: 7 }, { name: 'Prosinečki', number: 8 }, { name: 'Mandžukić', number: 17 } ] },
  { code: 'SA', name: 'Saudi Arabia', primary: '#006C35', secondary: '#FFFFFF',
    lineup: [ { name: 'Majed Abdullah', number: 10 }, { name: 'Al-Jaber', number: 9 }, { name: 'Al-Owairan', number: 7 }, { name: 'Al-Deayea', number: 1 }, { name: 'Al-Qahtani', number: 20 } ] },
  { code: 'AU', name: 'Australia',    primary: '#FFCD00', secondary: '#00843D',
    lineup: [ { name: 'Kewell', number: 10 }, { name: 'Cahill', number: 4 }, { name: 'Viduka', number: 9 }, { name: 'Schwarzer', number: 1 }, { name: 'Bresciano', number: 23 } ] },
  { code: 'SN', name: 'Senegal',      primary: '#00853F', secondary: '#FDEF42',
    lineup: [ { name: 'Mané', number: 10 }, { name: 'Koulibaly', number: 3 }, { name: 'Diouf', number: 11 }, { name: 'Fadiga', number: 8 }, { name: 'Mendy', number: 16 } ] },
  { code: 'UY', name: 'Uruguay',      primary: '#7B9ED9', secondary: '#FCD116',
    lineup: [ { name: 'Forlán', number: 10 }, { name: 'Suárez', number: 9 }, { name: 'Cavani', number: 21 }, { name: 'Godín', number: 3 }, { name: 'Francescoli', number: 11 } ] },
  { code: 'CO', name: 'Colombia',     primary: '#FCD116', secondary: '#003893',
    lineup: [ { name: 'Valderrama', number: 10 }, { name: 'James', number: 10 }, { name: 'Falcao', number: 9 }, { name: 'Higuita', number: 1 }, { name: 'Asprilla', number: 11 } ] },
  { code: 'CH', name: 'Switzerland',  primary: '#DA291C', secondary: '#FFFFFF',
    lineup: [ { name: 'Shaqiri', number: 23 }, { name: 'Xhaka', number: 10 }, { name: 'Sommer', number: 1 }, { name: 'Frei', number: 9 }, { name: 'Chapuisat', number: 8 } ] },
]

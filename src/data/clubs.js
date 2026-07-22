// Iconic football clubs — parallel to COUNTRIES (same {code,name,primary,secondary}
// shape, plus a 5-player `lineup` from each club's prime era). Club wins count
// on their own leaderboard, separate from countries; codes are 3-letter
// (vs. countries' 2-letter) so the two never collide in the backend teams table.
export const CLUBS = [
  {
    code: 'BAR', name: 'Barcelona', primary: '#A50044', secondary: '#004D98',
    lineup: [
      { name: 'Messi', number: 10 }, { name: 'Xavi', number: 6 },
      { name: 'Iniesta', number: 8 }, { name: 'Suárez', number: 9 },
      { name: 'Neymar', number: 11 },
    ],
  },
  {
    code: 'RMA', name: 'Real Madrid', primary: '#FFFFFF', secondary: '#FEBE10',
    lineup: [
      { name: 'Ronaldo', number: 7 }, { name: 'Benzema', number: 9 },
      { name: 'Bale', number: 11 }, { name: 'Modrić', number: 10 },
      { name: 'Ramos', number: 4 },
    ],
  },
  {
    code: 'MUN', name: 'Man United', primary: '#DA020E', secondary: '#FBE122',
    lineup: [
      { name: 'Giggs', number: 11 }, { name: 'Scholes', number: 18 },
      { name: 'Keane', number: 16 }, { name: 'Beckham', number: 7 },
      { name: 'Rooney', number: 10 },
    ],
  },
  {
    code: 'LIV', name: 'Liverpool', primary: '#C8102E', secondary: '#00B2A9',
    lineup: [
      { name: 'Salah', number: 11 }, { name: 'Mané', number: 10 },
      { name: 'Firmino', number: 9 }, { name: 'Van Dijk', number: 4 },
      { name: 'Alexander-Arnold', number: 66 },
    ],
  },
  {
    code: 'BAY', name: 'Bayern Munich', primary: '#DC052D', secondary: '#0066B2',
    lineup: [
      { name: 'Lewandowski', number: 9 }, { name: 'Müller', number: 25 },
      { name: 'Robben', number: 10 }, { name: 'Ribéry', number: 7 },
      { name: 'Neuer', number: 1 },
    ],
  },
  {
    code: 'JUV', name: 'Juventus', primary: '#FFFFFF', secondary: '#000000',
    lineup: [
      { name: 'Del Piero', number: 10 }, { name: 'Buffon', number: 1 },
      { name: 'Nedvěd', number: 11 }, { name: 'Pirlo', number: 21 },
      { name: 'Trezeguet', number: 17 },
    ],
  },
  {
    code: 'MIL', name: 'AC Milan', primary: '#FB090B', secondary: '#000000',
    lineup: [
      { name: 'Maldini', number: 3 }, { name: 'Kaká', number: 22 },
      { name: 'Shevchenko', number: 7 }, { name: 'Pirlo', number: 21 },
      { name: 'Nesta', number: 13 },
    ],
  },
  {
    code: 'INT', name: 'Inter Milan', primary: '#005BAC', secondary: '#000000',
    lineup: [
      { name: 'Milito', number: 22 }, { name: 'Sneijder', number: 10 },
      { name: "Eto'o", number: 9 }, { name: 'Zanetti', number: 4 },
      { name: 'Cambiasso', number: 19 },
    ],
  },
  {
    code: 'CHE', name: 'Chelsea', primary: '#034694', secondary: '#FFFFFF',
    lineup: [
      { name: 'Lampard', number: 8 }, { name: 'Terry', number: 26 },
      { name: 'Drogba', number: 11 }, { name: 'Čech', number: 1 },
      { name: 'Hazard', number: 10 },
    ],
  },
  {
    code: 'ARS', name: 'Arsenal', primary: '#EF0107', secondary: '#FFFFFF',
    lineup: [
      { name: 'Henry', number: 14 }, { name: 'Bergkamp', number: 10 },
      { name: 'Vieira', number: 4 }, { name: 'Pirès', number: 7 },
      { name: 'Ljungberg', number: 8 },
    ],
  },
  {
    code: 'PSG', name: 'PSG', primary: '#004170', secondary: '#DA291C',
    lineup: [
      { name: 'Mbappé', number: 7 }, { name: 'Neymar', number: 10 },
      { name: 'Di María', number: 11 }, { name: 'Cavani', number: 9 },
      { name: 'Verratti', number: 6 },
    ],
  },
  {
    code: 'MCI', name: 'Man City', primary: '#6CABDD', secondary: '#1C2C5B',
    lineup: [
      { name: 'De Bruyne', number: 17 }, { name: 'D. Silva', number: 21 },
      { name: 'Agüero', number: 10 }, { name: 'Kompany', number: 4 },
      { name: 'Sterling', number: 7 },
    ],
  },
  {
    code: 'DOR', name: 'Dortmund', primary: '#FDE100', secondary: '#000000',
    lineup: [
      { name: 'Lewandowski', number: 9 }, { name: 'Reus', number: 11 },
      { name: 'Götze', number: 10 }, { name: 'Gündoğan', number: 8 },
      { name: 'Hummels', number: 15 },
    ],
  },
  {
    code: 'ATM', name: 'Atlético', primary: '#CB3524', secondary: '#272E61',
    lineup: [
      { name: 'Griezmann', number: 7 }, { name: 'Godín', number: 2 },
      { name: 'Koke', number: 6 }, { name: 'Diego Costa', number: 19 },
      { name: 'Oblak', number: 13 },
    ],
  },
  {
    code: 'TOT', name: 'Tottenham', primary: '#132257', secondary: '#FFFFFF',
    lineup: [
      { name: 'Kane', number: 10 }, { name: 'Son', number: 7 },
      { name: 'Eriksen', number: 23 }, { name: 'Lloris', number: 1 },
      { name: 'Alli', number: 20 },
    ],
  },
  {
    code: 'AJA', name: 'Ajax', primary: '#D2122E', secondary: '#FFFFFF',
    lineup: [
      { name: 'Onana', number: 24 }, { name: 'De Ligt', number: 4 },
      { name: 'De Jong', number: 21 }, { name: 'Ziyech', number: 22 },
      { name: 'Tadić', number: 10 },
    ],
  },
]

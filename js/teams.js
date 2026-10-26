// js/teams.js
// Real clubs, 2024-25 first-choice XIs. Stats: [pace, dribbling, passing,
// shooting, defending]; for goalkeepers "defending" is shot-stopping.
export { formationPositions } from './formations.js';

// `short` is the on-pitch label for names too long to fit above a player
const P = (num, name, role, [pac, dri, pas, sho, def], short) =>
  ({ num, name, role, stats: { pac, dri, pas, sho, def }, ...(short && { short }) });

export function pickTwoIndices(count, rng = Math.random) {
  const i = Math.floor(rng() * count);
  let j = Math.floor(rng() * count);
  if (j === i) j = (i + 1) % count;
  return [i, j];
}

export function pickTwoTeams(teams, rng = Math.random) {
  const [i, j] = pickTwoIndices(teams.length, rng);
  return [teams[i], teams[j]];
}

// next team index in direction `step`, never landing on the opponent's team
export function cycleTeam(index, step, other, count) {
  let next = index;
  do next = (next + step + count) % count; while (next === other);
  return next;
}

const rgb = (hex) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

// home kits too alike to tell apart on the pitch → away side changes kit
export function kitsClash(a, b) {
  const [r1, g1, b1] = rgb(a.colors.kit), [r2, g2, b2] = rgb(b.colors.kit);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2) < 120;
}

export const TEAMS = [
  { name: 'Real Madrid', short: 'RMA', formation: '4-3-3',
    crest: { shape: 'circle', pattern: 'band', colors: ['#ffffff', '#3d195b'], rim: '#d4af37', text: 'RM', textColor: '#00529f' },
    colors: { kit: '#ffffff', text: '#00529f', gk: '#f1c40f', away: { kit: '#1f2937', text: '#f5f5f5' } },
    players: [
      P(1, 'Courtois', 'GK', [50, 35, 70, 20, 90]),
      P(2, 'Carvajal', 'DF', [78, 78, 80, 62, 82]),
      P(22, 'Rüdiger', 'DF', [80, 64, 70, 52, 87]),
      P(3, 'Militão', 'DF', [82, 68, 68, 55, 85]),
      P(23, 'Mendy', 'DF', [86, 76, 72, 50, 82]),
      P(8, 'Valverde', 'MF', [88, 84, 84, 82, 80]),
      P(14, 'Tchouaméni', 'MF', [70, 78, 80, 70, 84]),
      P(5, 'Bellingham', 'MF', [80, 88, 86, 84, 78]),
      P(7, 'Vinícius', 'FW', [95, 92, 80, 84, 30]),
      P(9, 'Mbappé', 'FW', [97, 92, 82, 91, 36]),
      P(11, 'Rodrygo', 'FW', [88, 87, 80, 82, 40]),
    ] },
  { name: 'Barcelona', short: 'BAR', formation: '4-3-3',
    crest: { shape: 'shield', pattern: 'stripes', colors: ['#a50044', '#004d98'], rim: '#edbb00', text: 'FCB', textColor: '#ffffff' },
    colors: { kit: '#a50044', text: '#edbb00', gk: '#2ecc71', away: { kit: '#f1e05a', text: '#a50044' } },
    players: [
      P(1, 'ter Stegen', 'GK', [48, 35, 85, 20, 87]),
      P(23, 'Koundé', 'DF', [82, 78, 76, 55, 84]),
      P(4, 'Araujo', 'DF', [80, 66, 68, 52, 86]),
      P(2, 'Cubarsí', 'DF', [70, 72, 78, 40, 80]),
      P(3, 'Baldé', 'DF', [92, 80, 74, 56, 74]),
      P(8, 'Pedri', 'MF', [76, 90, 90, 72, 68]),
      P(21, 'de Jong', 'MF', [80, 88, 88, 70, 76]),
      P(6, 'Gavi', 'MF', [76, 86, 82, 70, 72]),
      P(19, 'Yamal', 'FW', [88, 92, 84, 80, 30]),
      P(9, 'Lewandowski', 'FW', [76, 86, 80, 90, 42]),
      P(11, 'Raphinha', 'FW', [90, 86, 80, 84, 48]),
    ] },
  { name: 'Manchester City', short: 'MCI', formation: '4-3-3',
    crest: { shape: 'circle', pattern: 'solid', colors: ['#6cabdd'], rim: '#1c2c5b', text: 'MC', textColor: '#1c2c5b' },
    colors: { kit: '#6cabdd', text: '#1c2c5b', gk: '#e67e22', away: { kit: '#1c2c5b', text: '#ffffff' } },
    players: [
      P(31, 'Ederson', 'GK', [64, 45, 90, 20, 86]),
      P(2, 'Walker', 'DF', [88, 74, 76, 60, 80]),
      P(3, 'Dias', 'DF', [66, 68, 76, 40, 89]),
      P(24, 'Gvardiol', 'DF', [82, 78, 76, 64, 85]),
      P(6, 'Aké', 'DF', [72, 72, 74, 52, 84]),
      P(16, 'Rodri', 'MF', [62, 84, 90, 80, 87]),
      P(17, 'De Bruyne', 'MF', [72, 86, 94, 88, 62]),
      P(20, 'Bernardo', 'MF', [76, 92, 88, 76, 66]),
      P(47, 'Foden', 'FW', [84, 91, 86, 84, 56]),
      P(9, 'Haaland', 'FW', [89, 80, 68, 93, 45]),
      P(11, 'Doku', 'FW', [94, 90, 74, 70, 36]),
    ] },
  { name: 'Liverpool', short: 'LIV', formation: '4-3-3',
    crest: { shape: 'shield', pattern: 'solid', colors: ['#c8102e'], rim: '#f6eb61', text: 'LFC', textColor: '#f6eb61' },
    colors: { kit: '#c8102e', text: '#ffffff', gk: '#2ecc71', away: { kit: '#f5f5f5', text: '#c8102e' } },
    players: [
      P(1, 'Alisson', 'GK', [62, 40, 80, 20, 89]),
      P(66, 'Alexander-Arnold', 'DF', [76, 82, 90, 72, 76], 'Trent'),
      P(4, 'van Dijk', 'DF', [76, 72, 76, 62, 90]),
      P(5, 'Konaté', 'DF', [80, 64, 64, 40, 85]),
      P(26, 'Robertson', 'DF', [84, 78, 84, 60, 80]),
      P(10, 'Mac Allister', 'MF', [70, 84, 86, 80, 76]),
      P(38, 'Gravenberch', 'MF', [76, 86, 82, 70, 78]),
      P(8, 'Szoboszlai', 'MF', [80, 84, 84, 82, 70]),
      P(11, 'Salah', 'FW', [89, 88, 84, 89, 45]),
      P(7, 'Díaz', 'FW', [91, 88, 78, 80, 45]),
      P(9, 'Núñez', 'FW', [90, 78, 70, 82, 44]),
    ] },
  { name: 'Bayern München', short: 'BAY', formation: '4-2-3-1',
    crest: { shape: 'circle', pattern: 'checks', colors: ['#0066b2', '#ffffff'], rim: '#dc052d', text: 'FCB', textColor: '#ffffff' },
    colors: { kit: '#dc052d', text: '#ffffff', gk: '#2c3e50', away: { kit: '#f5f5f5', text: '#dc052d' } },
    players: [
      P(1, 'Neuer', 'GK', [56, 45, 85, 20, 86]),
      P(27, 'Laimer', 'DF', [84, 80, 80, 70, 80]),
      P(2, 'Upamecano', 'DF', [84, 70, 70, 46, 84]),
      P(3, 'Kim', 'DF', [80, 66, 68, 40, 86]),
      P(19, 'Davies', 'DF', [95, 84, 76, 66, 76]),
      P(6, 'Kimmich', 'MF', [70, 84, 90, 74, 82]),
      P(8, 'Goretzka', 'MF', [78, 82, 84, 82, 82]),
      P(42, 'Musiala', 'MF', [84, 93, 86, 82, 62]),
      P(10, 'Sané', 'FW', [90, 88, 82, 82, 42]),
      P(17, 'Olise', 'FW', [84, 88, 86, 82, 40]),
      P(9, 'Kane', 'FW', [70, 84, 88, 94, 48]),
    ] },
  { name: 'Arsenal', short: 'ARS', formation: '4-3-3',
    crest: { shape: 'shield', pattern: 'halves', colors: ['#ef0107', '#063672'], rim: '#9c824a', text: 'AFC', textColor: '#ffffff' },
    colors: { kit: '#ef0107', text: '#ffffff', gk: '#f1c40f', away: { kit: '#f6c90e', text: '#063672' } },
    players: [
      P(22, 'Raya', 'GK', [52, 40, 84, 20, 86]),
      P(4, 'White', 'DF', [80, 76, 78, 60, 82]),
      P(2, 'Saliba', 'DF', [82, 72, 76, 45, 88]),
      P(6, 'Gabriel', 'DF', [74, 66, 70, 62, 87]),
      P(33, 'Calafiori', 'DF', [76, 78, 78, 62, 80]),
      P(41, 'Rice', 'MF', [74, 82, 86, 78, 85]),
      P(8, 'Ødegaard', 'MF', [72, 88, 92, 82, 60]),
      P(5, 'Partey', 'MF', [68, 80, 82, 74, 82]),
      P(7, 'Saka', 'FW', [86, 88, 84, 84, 58]),
      P(29, 'Havertz', 'FW', [76, 82, 82, 82, 60]),
      P(11, 'Martinelli', 'FW', [90, 86, 76, 80, 44]),
    ] },
  { name: 'PSG', short: 'PSG', formation: '4-3-3',
    crest: { shape: 'circle', pattern: 'band', colors: ['#14213d', '#da291c'], rim: '#ffffff', text: 'PSG', textColor: '#ffffff' },
    colors: { kit: '#14213d', text: '#ffffff', gk: '#c0392b', away: { kit: '#ffffff', text: '#14213d' } },
    players: [
      P(1, 'Donnarumma', 'GK', [50, 35, 72, 20, 88]),
      P(2, 'Hakimi', 'DF', [92, 82, 82, 74, 78]),
      P(5, 'Marquinhos', 'DF', [74, 72, 78, 52, 87]),
      P(51, 'Pacho', 'DF', [74, 64, 70, 40, 82]),
      P(25, 'Nuno Mendes', 'DF', [92, 84, 78, 62, 78]),
      P(17, 'Vitinha', 'MF', [74, 90, 90, 76, 72]),
      P(87, 'João Neves', 'MF', [78, 86, 84, 72, 78]),
      P(33, 'Zaïre-Emery', 'MF', [78, 82, 82, 72, 76]),
      P(10, 'Dembélé', 'FW', [92, 90, 82, 86, 40]),
      P(7, 'Kvaratskhelia', 'FW', [86, 92, 82, 82, 40], 'Kvara'),
      P(29, 'Barcola', 'FW', [92, 86, 76, 78, 38]),
    ] },
  { name: 'Inter', short: 'INT', formation: '3-5-2',
    crest: { shape: 'circle', pattern: 'stripes', colors: ['#0068a8', '#111111'], rim: '#d4af37', text: 'IM', textColor: '#ffffff' },
    colors: { kit: '#0068a8', text: '#ffffff', gk: '#f39c12', away: { kit: '#ffffff', text: '#0068a8' } },
    players: [
      P(1, 'Sommer', 'GK', [50, 40, 78, 20, 85]),
      P(28, 'Pavard', 'DF', [74, 74, 76, 62, 83]),
      P(15, 'Acerbi', 'DF', [60, 62, 72, 50, 85]),
      P(95, 'Bastoni', 'DF', [72, 78, 84, 58, 86]),
      P(2, 'Dumfries', 'MF', [86, 76, 76, 74, 78]),
      P(23, 'Barella', 'MF', [80, 86, 86, 78, 78]),
      P(20, 'Çalhanoğlu', 'MF', [66, 84, 90, 84, 74]),
      P(22, 'Mkhitaryan', 'MF', [72, 84, 86, 78, 66]),
      P(32, 'Dimarco', 'MF', [80, 80, 86, 78, 78]),
      P(10, 'Lautaro', 'FW', [82, 86, 78, 90, 48]),
      P(9, 'Thuram', 'FW', [86, 82, 76, 82, 42]),
    ] },
];

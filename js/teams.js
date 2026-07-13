import { PITCH } from './constants.js';

const P = (num, name, role) => ({ num, name, role });

// Base formation for a team defending x=0 (attacking toward x=105). 4-4-2.
const FORMATION_442 = [
  { x: 5,  y: 34 },                                   // 0 GK
  { x: 20, y: 12 }, { x: 20, y: 26 }, { x: 20, y: 42 }, { x: 20, y: 56 }, // DF
  { x: 40, y: 12 }, { x: 40, y: 26 }, { x: 40, y: 42 }, { x: 40, y: 56 }, // MF
  { x: 52, y: 24 }, { x: 52, y: 44 },                 // FW
];

export function formationPositions(index, side) {
  const base = FORMATION_442[index];
  if (side === 'A') return { x: base.x, y: base.y };
  return { x: PITCH.w - base.x, y: base.y }; // mirror for B
}

export function pickTwoTeams(teams, rng = Math.random) {
  const i = Math.floor(rng() * teams.length);
  let j = Math.floor(rng() * teams.length);
  if (j === i) j = (i + 1) % teams.length;
  return [teams[i], teams[j]];
}

export const TEAMS = [
  { name: 'Wolves', short: 'WOL', colors: { kit: '#fdb913', text: '#231f20', gk: '#c0392b' },
    players: [P(1,'Sa','GK'),P(5,'Coady','DF'),P(15,'Kilman','DF'),P(23,'Saiss','DF'),P(2,'Doherty','DF'),
      P(8,'Neves','MF'),P(28,'Moutinho','MF'),P(11,'Traore','MF'),P(19,'Jonny','MF'),P(9,'Jimenez','FW'),P(10,'Silva','FW')] },
  { name: 'FCB', short: 'FCB', colors: { kit: '#2e2b5f', text: '#c9a227', gk: '#27ae60' },
    players: [P(1,'Ter','GK'),P(3,'Pique','DF'),P(15,'Lenglet','DF'),P(23,'Umtiti','DF'),P(18,'Alba','DF'),
      P(5,'Busquets','MF'),P(8,'Arthur','MF'),P(21,'Sarabia','MF'),P(22,'Vidal','MF'),P(9,'Suarez','FW'),P(10,'Messi','FW')] },
  { name: 'Reds', short: 'RED', colors: { kit: '#c8102e', text: '#ffffff', gk: '#2ecc71' },
    players: [P(1,'Alisson','GK'),P(4,'VanDijk','DF'),P(12,'Gomez','DF'),P(26,'Robertson','DF'),P(66,'Arnold','DF'),
      P(3,'Fabinho','MF'),P(14,'Henderson','MF'),P(5,'Wijnaldum','MF'),P(11,'Salah','FW'),P(9,'Firmino','FW'),P(10,'Mane','FW')] },
  { name: 'Sky', short: 'SKY', colors: { kit: '#6cabdd', text: '#1c2c5b', gk: '#e67e22' },
    players: [P(31,'Ederson','GK'),P(2,'Walker','DF'),P(5,'Stones','DF'),P(3,'Dias','DF'),P(7,'Cancelo','DF'),
      P(16,'Rodri','MF'),P(17,'DeBruyne','MF'),P(47,'Foden','MF'),P(20,'Silva','MF'),P(9,'Haaland','FW'),P(10,'Grealish','FW')] },
  { name: 'Blancos', short: 'MAD', colors: { kit: '#ffffff', text: '#00529f', gk: '#f1c40f' },
    players: [P(1,'Courtois','GK'),P(2,'Carvajal','DF'),P(4,'Alaba','DF'),P(3,'Militao','DF'),P(23,'Mendy','DF'),
      P(8,'Kroos','MF'),P(10,'Modric','MF'),P(15,'Valverde','MF'),P(20,'Vini','FW'),P(9,'Benzema','FW'),P(11,'Rodrygo','FW')] },
  { name: 'Bavaria', short: 'BAY', colors: { kit: '#dc052d', text: '#ffffff', gk: '#2c3e50' },
    players: [P(1,'Neuer','GK'),P(5,'Pavard','DF'),P(4,'DeLigt','DF'),P(2,'Upamecano','DF'),P(19,'Davies','DF'),
      P(6,'Kimmich','MF'),P(8,'Goretzka','MF'),P(25,'Muller','MF'),P(10,'Sane','FW'),P(9,'Lewa','FW'),P(7,'Gnabry','FW')] },
];

// js/formations.js
// Tactical shapes for a team defending x=0 (attacking toward x=105).
// Slot order: GK, defenders, midfielders, forwards — each line top to bottom.
import { PITCH } from './constants.js';

const line = (x, ys, role) => ys.map(y => ({ x, y, role }));
const GK = [{ x: 5, y: 34, role: 'GK' }];

export const FORMATIONS = {
  '4-4-2': [...GK,
    ...line(20, [12, 26, 42, 56], 'DF'),
    ...line(38, [12, 26, 42, 56], 'MF'),
    ...line(50, [24, 44], 'FW')],
  '4-3-3': [...GK,
    ...line(20, [12, 26, 42, 56], 'DF'),
    ...line(37, [20, 34, 48], 'MF'),
    ...line(50, [14, 34, 54], 'FW')],
  '3-4-3': [...GK,
    ...line(20, [18, 34, 50], 'DF'),
    ...line(37, [10, 26, 42, 58], 'MF'),
    ...line(50, [14, 34, 54], 'FW')],
  '3-5-2': [...GK,
    ...line(20, [18, 34, 50], 'DF'),
    { x: 38, y: 8, role: 'MF' }, { x: 34, y: 22, role: 'MF' }, { x: 32, y: 34, role: 'MF' },
    { x: 34, y: 46, role: 'MF' }, { x: 38, y: 60, role: 'MF' },
    ...line(50, [26, 42], 'FW')],
  '4-2-3-1': [...GK,
    ...line(20, [12, 26, 42, 56], 'DF'),
    ...line(32, [27, 41], 'MF'),
    ...line(43, [14, 34, 54], 'MF'),
    ...line(51, [34], 'FW')],
};

export const FORMATION_NAMES = Object.keys(FORMATIONS);

export function formationPositions(index, side, name = '4-4-2') {
  const { x, y } = FORMATIONS[name][index];
  return side === 'A' ? { x, y } : { x: PITCH.w - x, y };   // B mirrors A
}

const ROLE_ORDER = { GK: 0, DF: 1, MF: 2, FW: 3 };

// Fit the squad into the formation's slots: players sorted by natural role
// fill slots in order, so a spare full-back becomes a wing midfielder in a back three.
export function lineup(team, name) {
  const squad = [...team.players].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
  return FORMATIONS[name].map((slot, i) => ({ slot, role: slot.role, player: squad[i] }));
}

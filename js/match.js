import { PITCH, HALF_MINUTES, GOAL_HALF_HEIGHT } from './constants.js';
import { formationPositions, lineup } from './formations.js';

// Each player takes a formation slot: `role` is the tactical role he plays,
// `base` his home position (side-A orientation, i.e. attacking +x).
function buildPlayers(teamA, teamB) {
  const out = [];
  for (const [side, team] of [['A', teamA], ['B', teamB]]) {
    const formation = team.formation ?? '4-4-2';
    lineup(team, formation).forEach(({ slot, role, player }, i) => {
      const pos = formationPositions(i, side, formation);
      out.push({ num: player.num, name: player.name, label: player.short ?? player.name, role, stats: player.stats, side,
        base: { x: slot.x, y: slot.y },
        x: pos.x, y: pos.y, vx: 0, vy: 0, facing: { x: side === 'A' ? 1 : -1, y: 0 }, isGK: role === 'GK' });
    });
  }
  return out;
}

// home position for the current half (sides swap at half time)
export function homePosition(match, p) {
  const x = p.side === 'A' ? p.base.x : PITCH.w - p.base.x;
  return { x: match.attackDir.A < 0 ? PITCH.w - x : x, y: p.base.y };
}

export function createMatch(teamA, teamB, lengthMinutes) {
  const m = {
    teamA, teamB, lengthMinutes,
    players: buildPlayers(teamA, teamB),
    ball: { x: PITCH.w / 2, y: PITCH.h / 2, z: 0, vx: 0, vy: 0, vz: 0, ownerId: null },
    scoreA: 0, scoreB: 0, clock: 0, half: 1, phase: 'kickoff',
    attackDir: { A: +1, B: -1 },
  };
  return m;
}

export function resetKickoff(match) {
  match.players.forEach((p) => {
    const pos = homePosition(match, p);
    p.x = pos.x; p.y = pos.y; p.vx = 0; p.vy = 0;
    p.facing = { x: match.attackDir[p.side], y: 0 };
    p.stunT = 0; p.feintT = 0;
  });
  match.ball = { x: PITCH.w / 2, y: PITCH.h / 2, z: 0, vx: 0, vy: 0, vz: 0, ownerId: null };
}

function swapSides(match) {
  match.attackDir.A *= -1;
  match.attackDir.B *= -1;
}

export function advanceClock(match, gameMinutes) {
  const events = [];
  const before = match.clock;
  match.clock = Math.min(before + gameMinutes, 2 * HALF_MINUTES);
  if (before < HALF_MINUTES && match.clock >= HALF_MINUTES && match.half === 1) {
    match.half = 2;
    match.phase = 'halftime';
    swapSides(match);
    events.push('Half Time');
  }
  if (match.clock >= 2 * HALF_MINUTES && match.phase !== 'fulltime') {
    match.phase = 'fulltime';
    events.push('Full Time');
  }
  return events;
}

export function scoreGoal(match, side) {
  if (side === 'A') match.scoreA += 1; else match.scoreB += 1;
}

export function checkGoal(match) {
  const { x, y } = match.ball;
  const onTarget = y > PITCH.h / 2 - GOAL_HALF_HEIGHT && y < PITCH.h / 2 + GOAL_HALF_HEIGHT;
  if (!onTarget) return null;
  // Right goal (x >= 105): scored by whoever attacks +x
  if (x >= PITCH.w) return match.attackDir.A > 0 ? 'A' : 'B';
  if (x <= 0)       return match.attackDir.A > 0 ? 'B' : 'A';
  return null;
}

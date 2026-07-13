import { PITCH, HALF_MINUTES, GOAL_HALF_HEIGHT } from './constants.js';
import { formationPositions } from './teams.js';

function buildPlayers(teamA, teamB) {
  const out = [];
  for (const [side, team] of [['A', teamA], ['B', teamB]]) {
    team.players.forEach((p, i) => {
      const pos = formationPositions(i, side);
      out.push({ num: p.num, name: p.name, role: p.role, side,
        x: pos.x, y: pos.y, vx: 0, vy: 0, isGK: i === 0 });
    });
  }
  return out;
}

export function createMatch(teamA, teamB, lengthMinutes) {
  const m = {
    teamA, teamB, lengthMinutes,
    players: buildPlayers(teamA, teamB),
    ball: { x: PITCH.w / 2, y: PITCH.h / 2, vx: 0, vy: 0, ownerId: null },
    scoreA: 0, scoreB: 0, clock: 0, half: 1, phase: 'kickoff',
    attackDir: { A: +1, B: -1 },
  };
  return m;
}

export function resetKickoff(match) {
  match.players.forEach((p, i) => {
    const pos = formationPositions(i % 11, p.side);
    // keep sides consistent with current attackDir (A defends the goal it attacks away from)
    const flip = match.attackDir.A < 0;
    p.x = flip ? PITCH.w - pos.x : pos.x;
    p.y = pos.y; p.vx = 0; p.vy = 0;
  });
  match.ball = { x: PITCH.w / 2, y: PITCH.h / 2, vx: 0, vy: 0, ownerId: null };
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

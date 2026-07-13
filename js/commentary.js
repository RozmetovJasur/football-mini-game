// js/commentary.js
const PASS_LINES = [
  (n) => `${n} with the backpass`,
  (n) => `${n} plays it short`,
  (n) => `${n} switches the play`,
  (n) => `${n} threads it through`,
];
const SHOT_LINES = [
  (n) => `${n} lets fly!`,
  (n) => `${n} shoots!`,
  (n) => `${n} tries his luck`,
];

const pick = (arr, rng = Math.random) => arr[Math.floor(rng() * arr.length)];

export function commentGoal(match, side) {
  const team = side === 'A' ? match.teamA : match.teamB;
  return `GOAL! ${team.name} score!`;
}
export function commentPass(name, rng) { return pick(PASS_LINES, rng)(name); }
export function commentShot(name, rng) { return pick(SHOT_LINES, rng)(name); }
export function commentKickoff() { return 'Kick-off!'; }

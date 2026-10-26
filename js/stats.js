// js/stats.js
// Player attributes (1..99): pace, dribbling, passing, shooting, defending.
// For goalkeepers `def` stands for shot-stopping.

export const STAT_KEYS = ['pac', 'dri', 'pas', 'sho', 'def'];

export const stat = (p, key) => p.stats?.[key] ?? 70;

// how much each attribute counts towards the overall rating, by natural role
const WEIGHTS = {
  GK: { def: 0.85, pas: 0.15 },
  DF: { def: 0.6, pac: 0.15, pas: 0.15, dri: 0.1 },
  MF: { pas: 0.35, dri: 0.3, def: 0.15, sho: 0.1, pac: 0.1 },
  FW: { sho: 0.4, dri: 0.25, pac: 0.25, pas: 0.1 },
};

export function overall(p) {
  const w = WEIGHTS[p.role] ?? WEIGHTS.MF;
  let sum = 0;
  for (const k in w) sum += stat(p, k) * w[k];
  return Math.max(1, Math.min(100, Math.round(sum)));
}

export function teamRating(team) {
  const total = team.players.reduce((s, p) => s + overall(p), 0);
  return Math.round(total / team.players.length);
}

// average of each attribute over the outfield players
export function teamRatings(team) {
  const outfield = team.players.filter(p => p.role !== 'GK');
  const out = {};
  for (const k of STAT_KEYS) out[k] = Math.round(outfield.reduce((s, p) => s + stat(p, k), 0) / outfield.length);
  return out;
}

// --- how attributes shape play (all ≈1.0 for a 70-rated player) ---
export const paceFactor = (p) => 0.7 + stat(p, 'pac') / 100 * 0.45;         // top speed
export const carryFactor = (p) => 0.8 + stat(p, 'dri') / 100 * 0.2;         // speed with the ball
export const tackleFactor = (tackler, carrier) =>
  (0.5 + stat(tackler, 'def') / 100) * (1.6 - stat(carrier, 'dri') / 100);
export const takeOnChance = (p) => stat(p, 'dri') / 100 * 0.7;
export const passErrorFactor = (p) => 1.6 - stat(p, 'pas') / 100;
export const shotPowerFactor = (p) => 0.8 + stat(p, 'sho') / 100 * 0.3;
export const shotSpreadFactor = (p) => 1.5 - stat(p, 'sho') / 100;
export const keeperReachFactor = (p) => 0.8 + stat(p, 'def') / 250;

// beating a man: how often a carrier tries a feint, and whether it comes off
export const feintAttemptChance = (p) => 0.05 + stat(p, 'dri') / 350;
export const feintSuccess = (carrier, defender) =>
  Math.max(0.1, Math.min(0.9, 0.38 + (stat(carrier, 'dri') - stat(defender, 'def')) * 0.015));

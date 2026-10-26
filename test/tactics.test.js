import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEAMS } from '../js/teams.js';
import { FORMATIONS, FORMATION_NAMES, formationPositions, lineup } from '../js/formations.js';
import { createMatch, resetKickoff } from '../js/match.js';
import { applyMovement, tryTackle, decideAction, passOrShoot } from '../js/ai.js';
import { STAT_KEYS, teamRatings, overall, teamRating } from '../js/stats.js';
import { kitsClash } from '../js/teams.js';
import { captureBall } from '../js/ai.js';
import { PITCH } from '../js/constants.js';

const withF = (team, formation) => ({ ...team, formation });

test('every formation has 11 slots: one GK, outfield lines summing to its name', () => {
  assert.ok(FORMATION_NAMES.includes('4-4-2') && FORMATION_NAMES.includes('3-4-3'));
  for (const name of FORMATION_NAMES) {
    const slots = FORMATIONS[name];
    assert.equal(slots.length, 11, name);
    assert.equal(slots.filter(s => s.role === 'GK').length, 1, name);
    const df = slots.filter(s => s.role === 'DF').length;
    assert.equal(df, Number(name.split('-')[0]), `${name} defenders`);
    // everyone starts in their own half
    for (const s of slots) assert.ok(s.x < PITCH.w / 2, `${name} slot in own half`);
  }
});

test('side B mirrors side A for any formation', () => {
  for (const name of FORMATION_NAMES) {
    for (let i = 0; i < 11; i++) {
      const a = formationPositions(i, 'A', name), b = formationPositions(i, 'B', name);
      assert.equal(a.x + b.x, PITCH.w);
      assert.equal(a.y, b.y);
    }
  }
});

test('lineup puts the goalkeeper in goal and takes roles from the formation', () => {
  const team = TEAMS[0];
  const xi = lineup(team, '3-4-3');
  assert.equal(xi.length, 11);
  assert.equal(xi[0].role, 'GK');
  assert.equal(xi[0].player.role, 'GK');
  assert.equal(xi.filter(s => s.role === 'DF').length, 3);
  assert.equal(xi.filter(s => s.role === 'FW').length, 3);
  assert.equal(new Set(xi.map(s => s.player.num)).size, 11);   // nobody twice
});

test('match uses each team\'s chosen formation', () => {
  const m = createMatch(withF(TEAMS[0], '3-4-3'), withF(TEAMS[1], '4-4-2'), 2);
  const df = (side) => m.players.filter(p => p.side === side && p.role === 'DF').length;
  assert.equal(df('A'), 3);
  assert.equal(df('B'), 4);
  resetKickoff(m);
  const a = m.players.filter(p => p.side === 'A');
  a.forEach((p, i) => assert.deepEqual({ x: p.x, y: p.y }, formationPositions(i, 'A', '3-4-3')));
});

test('every player carries all stats in 1..99', () => {
  for (const team of TEAMS) for (const p of team.players) {
    for (const k of STAT_KEYS) assert.ok(p.stats[k] >= 1 && p.stats[k] <= 99, `${p.name}.${k}`);
  }
  const r = teamRatings(TEAMS[0]);
  for (const k of STAT_KEYS) assert.ok(r[k] > 0);
});

// --- stats change behaviour ---
const mk = () => createMatch(TEAMS[0], TEAMS[1], 2);

test('faster player covers more ground', () => {
  const m = mk();
  const run = (pac) => {
    const p = m.players[5];
    p.stats = { ...p.stats, pac };
    p.x = 30; p.y = 34; p.vx = 0; p.vy = 0;
    const targets = m.players.map(q => ({ x: q.x, y: q.y }));
    targets[5] = { x: 90, y: 34 };
    for (let i = 0; i < 120; i++) applyMovement(m, targets, 1 / 60);
    return p.x - 30;
  };
  assert.ok(run(95) > run(50) * 1.15);
});

test('good dribbler is harder to tackle', () => {
  const chance = (dri) => {
    const m = mk();
    m.players[6].x = 40; m.players[6].y = 34; m.players[6].stats = { ...m.players[6].stats, dri };
    m.players.forEach((p, i) => { if (i !== 6 && i !== 13) { p.x = 2 + i; p.y = 67; } });
    m.players[13].x = 40.8; m.players[13].y = 34;
    m.ball.ownerId = 6;
    let lo = 0, hi = 1;                       // find the rng threshold for success
    for (let k = 0; k < 30; k++) {
      const mid = (lo + hi) / 2;
      m.ball.ownerId = 6;
      if (tryTackle(m, 0.1, () => mid) !== null) lo = mid; else hi = mid;
    }
    return lo;
  };
  assert.ok(chance(95) < chance(40));
});

test('better passer is more accurate', () => {
  const miss = (pas) => {
    const m = mk();
    m.players.forEach((p, i) => { p.x = 2 + i * 4.5; p.y = 67; });
    const c = m.players[6], r = m.players[10];
    c.x = 40; c.y = 34; r.x = 60; r.y = 34; r.vx = 0; r.vy = 0;
    c.stats = { ...c.stats, pas };
    m.ball.ownerId = 6;
    const a = decideAction(m, () => 0);       // rng 0 → maximum error
    return Math.hypot(a.targetX - 60, a.targetY - 34);
  };
  assert.ok(miss(95) < miss(50));
});

test('better finisher shoots harder', () => {
  const speed = (sho) => {
    const m = mk();
    m.players[9].stats = { ...m.players[9].stats, sho };
    m.ball = { x: 90, y: 34, ownerId: 9 };
    passOrShoot(m, { type: 'shoot', targetX: 105, targetY: 34 }, () => 0.5);
    return Math.hypot(m.ball.vx, m.ball.vy);
  };
  assert.ok(speed(95) > speed(50));
});

test('teams are real clubs with an overall rating in 1..100', () => {
  assert.ok(TEAMS.length >= 8);
  const names = TEAMS.map(t => t.name);
  for (const n of ['Real Madrid', 'Barcelona', 'Manchester City', 'Liverpool', 'Bayern München'])
    assert.ok(names.includes(n), n);
  for (const team of TEAMS) {
    const r = teamRating(team);
    assert.ok(Number.isInteger(r) && r >= 1 && r <= 100, `${team.name} ${r}`);
    assert.ok(FORMATION_NAMES.includes(team.formation), `${team.name} default formation`);
  }
});

test('player overall depends on role: a striker is judged on finishing', () => {
  const base = { pac: 80, dri: 80, pas: 70, def: 40 };
  const fw = (sho) => overall({ role: 'FW', stats: { ...base, sho } });
  assert.ok(fw(95) > fw(60));
  const df = (def) => overall({ role: 'DF', stats: { ...base, sho: 50, def } });
  assert.ok(df(90) > df(60));
});

test('team rating is the average of its players', () => {
  const team = TEAMS[0];
  const avg = team.players.reduce((s, p) => s + overall(p), 0) / team.players.length;
  assert.equal(teamRating(team), Math.round(avg));
});

test('similar kits clash, different ones do not', () => {
  const byName = (n) => TEAMS.find(t => t.name === n);
  assert.equal(kitsClash(byName('Liverpool'), byName('Arsenal')), true);
  assert.equal(kitsClash(byName('Real Madrid'), byName('Barcelona')), false);
});

test('better goalkeeper reaches further for the ball', () => {
  const reach = (def) => {
    const m = mk();
    m.players.forEach((p, i) => { p.x = 2 + i * 4.5; p.y = 67; });
    const gk = m.players[0];
    gk.x = 4; gk.y = 34; gk.stats = { ...gk.stats, def };
    m.ball = { x: 4, y: 36.2, z: 0, vx: 0, vy: 0, vz: 0, ownerId: null };
    return captureBall(m) === 0;
  };
  assert.equal(reach(95), true);
  assert.equal(reach(40), false);
});

test('every player has an on-pitch label of at most 12 characters', () => {
  for (const team of TEAMS) for (const p of team.players) {
    const label = p.short ?? p.name;
    assert.ok(label.length <= 12, `${p.name} → ${label}`);
  }
});

test('match players keep their short label', () => {
  const liv = TEAMS.find(t => t.name === 'Liverpool');
  const m = createMatch(liv, TEAMS[0], 2);
  assert.ok(m.players.some(p => p.label === 'Trent'));
  assert.ok(m.players.some(p => p.label === 'Salah'));
});

test('every club has a crest spec', () => {
  const shapes = ['shield', 'circle'], patterns = ['solid', 'stripes', 'band', 'checks', 'halves'];
  for (const team of TEAMS) {
    const c = team.crest;
    assert.ok(c, team.name);
    assert.ok(shapes.includes(c.shape), `${team.name} shape`);
    assert.ok(patterns.includes(c.pattern), `${team.name} pattern`);
    assert.ok(c.colors.length >= 1 && c.colors.every(h => /^#[0-9a-f]{6}$/i.test(h)), `${team.name} colours`);
    assert.ok(c.text && c.text.length <= 3, `${team.name} initials`);
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEAMS } from '../js/teams.js';
import { createMatch } from '../js/match.js';
import { nearestPlayer, captureBall, decideAction, computeTargets, applyMovement, stepBall } from '../js/ai.js';
import { PITCH, PLAYER_SPEED } from '../js/constants.js';

const mk = () => createMatch(TEAMS[0], TEAMS[1], 2);

test('nearestPlayer finds closest', () => {
  const m = mk();
  m.players[3].x = 50; m.players[3].y = 34;
  const { index } = nearestPlayer(m.players, 50, 34);
  assert.equal(index, 3);
});

test('captureBall assigns owner within CAPTURE_DIST', () => {
  const m = mk();
  m.ball = { x: m.players[7].x, y: m.players[7].y, vx: 0, vy: 0, ownerId: null };
  const idx = captureBall(m);
  assert.equal(idx, 7);
  assert.equal(m.ball.ownerId, 7);
});

test('decideAction shoots when near attacking goal', () => {
  const m = mk();               // player 9 = FW side A, attacks +x
  m.ball.ownerId = 9;
  m.players[9].x = 95; m.players[9].y = 34;  // within SHOOT_RANGE of x=105
  const a = decideAction(m, () => 0.99);
  assert.equal(a.type, 'shoot');
  assert.ok(a.targetX > 100);
});

test('decideAction dribbles toward goal when far and rng high', () => {
  const m = mk();
  m.ball.ownerId = 9;
  m.players[9].x = 20; m.players[9].y = 34;
  const a = decideAction(m, () => 0.99);   // no pass
  assert.equal(a.type, 'dribble');
  assert.ok(a.targetX > 20);
});

test('computeTargets: GK stays near own goal line', () => {
  const m = mk();
  const targets = computeTargets(m);
  assert.ok(Math.abs(targets[0].x - m.players[0].x) < 10);
});

test('applyMovement keeps players inside pitch', () => {
  const m = mk();
  const targets = m.players.map(() => ({ x: 999, y: 999 }));
  applyMovement(m, targets, 100);
  for (const p of m.players) {
    assert.ok(p.x >= 0 && p.x <= PITCH.w);
    assert.ok(p.y >= 0 && p.y <= PITCH.h);
  }
});

test('stepBall applies friction to loose ball', () => {
  const m = mk();
  m.ball = { x: 50, y: 34, vx: 10, vy: 0, ownerId: null };
  // move players away so it stays loose
  m.players.forEach(p => { p.x = 0; p.y = 0; });
  stepBall(m, 1);
  assert.ok(Math.abs(m.ball.vx) < 10);
  assert.ok(m.ball.x > 50);
});

test('computeTargets never assigns GK as a presser', () => {
  const m = mk();
  m.ball.ownerId = null;
  m.ball.x = 50; m.ball.y = 34;                // middle of pitch
  m.players[0].x = 50; m.players[0].y = 34;    // A GK sitting on the ball
  const targets = computeTargets(m);
  // GK routed to goal line, not the ball
  assert.notEqual(targets[0].x, m.ball.x);
  // exactly the two nearest OUTFIELD players press (target === ball pos)
  const pressers = targets
    .map((t, i) => ({ i, t }))
    .filter(o => o.t.x === m.ball.x && o.t.y === m.ball.y);
  assert.equal(pressers.length, 2);
  assert.ok(pressers.every(o => !m.players[o.i].isGK));
});

test('captureBall: loose ball beyond CAPTURE_DIST stays unowned', () => {
  const m = mk();
  m.ball = { x: 50, y: 34, vx: 0, vy: 0, ownerId: null };
  // move all players far away
  m.players.forEach(p => { p.x = 0; p.y = 0; });
  const idx = captureBall(m);
  assert.equal(idx, null);
  assert.equal(m.ball.ownerId, null);
});

test('captureBall: already-owned ball leaves owner unchanged', () => {
  const m = mk();
  m.ball.ownerId = 5;
  const result = captureBall(m);
  assert.equal(result, 5);
  assert.equal(m.ball.ownerId, 5);
});

test('players do not track the ball in lockstep (role-based, non-parallel)', () => {
  const m = mk();
  const t0 = computeTargets(m);
  m.ball.x += 10; m.ball.y += 5;            // ball moves; players unchanged
  const t1 = computeTargets(m);
  // shift of each target caused purely by the ball move (wander/separation
  // depend on clock & player positions, both unchanged, so they cancel out)
  const posIdx = m.players.map((_, i) => i).filter(i => {
    if (m.players[i].isGK || i === m.ball.ownerId) return false;
    if (t1[i].x === m.ball.x && t1[i].y === m.ball.y) return false; // exclude pressers
    return true;
  });
  const uniq = new Set(posIdx.map(i =>
    `${(t1[i].x - t0[i].x).toFixed(3)},${(t1[i].y - t0[i].y).toFixed(3)}`));
  assert.ok(uniq.size > 1,
    'positional players must shift by role-dependent amounts, not one identical vector');
});

test('applyMovement uses velocity inertia (does not snap straight to target)', () => {
  const m = mk();
  m.players[5].x = 40; m.players[5].y = 34; m.players[5].vx = 0; m.players[5].vy = 0;
  const targets = m.players.map((p) => ({ x: p.x, y: p.y }));
  targets[5] = { x: 60, y: 34 };            // far target on +x
  applyMovement(m, targets, 0.1);
  // with inertia, one short step covers less than the full PLAYER_SPEED*dt
  const moved = m.players[5].x - 40;
  assert.ok(moved > 0, 'player should start moving toward target');
  assert.ok(moved < PLAYER_SPEED * 0.1,
    'inertia should make the first step smaller than the max un-damped step');
  assert.ok(m.players[5].vx > 0, 'player should have gained forward velocity');
});

test('stepBall clamps loose ball to pitch on x-axis (wide of goal)', () => {
  const m = mk();
  // wide of the goal posts (goal spans ~30.34-37.66), heading off the byline
  m.ball = { x: 104, y: 5, vx: 50, vy: 0, ownerId: null };
  // move all players far away so nobody can capture the ball
  m.players.forEach(p => { p.x = 0; p.y = 0; });
  stepBall(m, 1);
  assert.ok(m.ball.x <= PITCH.w, `ball.x should be clamped to <= ${PITCH.w}, got ${m.ball.x}`);
  assert.equal(m.ball.ownerId, null);
});

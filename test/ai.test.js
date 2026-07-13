import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEAMS } from '../js/teams.js';
import { createMatch } from '../js/match.js';
import { nearestPlayer, captureBall, decideAction, computeTargets, applyMovement, stepBall } from '../js/ai.js';
import { PITCH } from '../js/constants.js';

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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEAMS } from '../js/teams.js';
import { createMatch } from '../js/match.js';
import { captureBall, passOrShoot, stepBall } from '../js/ai.js';
import { BALL_REACH_Z } from '../js/constants.js';

const mk = () => createMatch(TEAMS[0], TEAMS[1], 2);
const clearPlayers = (m) => m.players.forEach(p => { p.x = 0; p.y = 0; });

test('short pass stays on the ground', () => {
  const m = mk();
  m.ball = { x: 50, y: 34, vx: 0, vy: 0, ownerId: 5 };
  passOrShoot(m, { type: 'pass', targetX: 60, targetY: 34 }, () => 0.5);
  assert.equal(m.ball.vz, 0);
});

test('long pass and shot are lofted', () => {
  const m = mk();
  m.ball = { x: 20, y: 34, vx: 0, vy: 0, ownerId: 5 };
  passOrShoot(m, { type: 'pass', targetX: 50, targetY: 10 }, () => 0.5);
  assert.ok(m.ball.vz > 0);
  m.ball = { x: 85, y: 34, vx: 0, vy: 0, ownerId: 5 };
  passOrShoot(m, { type: 'shoot', targetX: 105, targetY: 34 }, () => 0.5);
  assert.ok(m.ball.vz > 0);
});

test('lofted ball falls back, bounces and reports the bounce', () => {
  const m = mk();
  clearPlayers(m);
  m.ball = { x: 50, y: 34, z: 0, vx: 5, vy: 0, vz: 8, ownerId: null };
  let bounced = 0, maxZ = 0;
  for (let i = 0; i < 120; i++) {
    bounced += stepBall(m, 1 / 60) ? 1 : 0;
    maxZ = Math.max(maxZ, m.ball.z);
  }
  assert.ok(maxZ > 0.5, `ball should rise, got ${maxZ}`);
  assert.ok(m.ball.z >= 0);
  assert.ok(bounced >= 1);
});

test('ball above reach height cannot be captured', () => {
  const m = mk();
  m.ball = { x: m.players[7].x, y: m.players[7].y, z: BALL_REACH_Z + 1, vx: 0, vy: 0, vz: 0, ownerId: null };
  assert.equal(captureBall(m), null);
  m.ball.z = 0;
  assert.equal(captureBall(m), 7);
});

test('owned ball sits on the ground', () => {
  const m = mk();
  m.ball = { x: 50, y: 34, z: 3, vx: 0, vy: 0, vz: 4, ownerId: 5 };
  stepBall(m, 1 / 60);
  assert.equal(m.ball.z, 0);
  assert.equal(m.ball.vz, 0);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEAMS } from '../js/teams.js';
import { createMatch } from '../js/match.js';
import { tryFeint, tryTackle, applyMovement } from '../js/ai.js';
import { feintSuccess } from '../js/stats.js';
import { feintPose, stumblePose } from '../js/view3d/gait.js';

const mk = () => createMatch(TEAMS[0], TEAMS[1], 2);
function stage(m) {
  m.players.forEach((p, i) => { p.x = 2 + i * 4.5; p.y = 67; p.vx = 0; p.vy = 0; });
  return m;
}
const put = (m, i, x, y) => { m.players[i].x = x; m.players[i].y = y; };
// carrier 6 (side A, facing +x) with defender 13 closing in front
function duel(dri = 90, def = 60) {
  const m = stage(mk());
  put(m, 6, 40, 34); put(m, 13, 43, 34.5);
  m.players[6].facing = { x: 1, y: 0 };
  m.players[6].stats = { ...m.players[6].stats, dri };
  m.players[13].stats = { ...m.players[13].stats, def };
  m.ball.x = 41.5; m.ball.y = 34; m.ball.ownerId = 6; m.ball.feintCooldown = 0;
  return m;
}

test('skill beats defending: success chance rises with dribbling, falls with defending', () => {
  const p = (dri, def) => feintSuccess({ stats: { dri } }, { stats: { def } });
  assert.ok(p(92, 70) > p(70, 70));
  assert.ok(p(80, 90) < p(80, 60));
  assert.ok(p(99, 1) <= 0.9 && p(1, 99) >= 0.1, 'never certain');
});

test('a successful feint leaves the defender beaten and sends the carrier past him', () => {
  const m = duel();
  const ev = tryFeint(m, 1 / 60, () => 0);          // attempts and succeeds
  assert.equal(ev.success, true);
  assert.equal(ev.carrier, 6); assert.equal(ev.defender, 13);
  assert.ok(m.players[13].stunT > 0);
  assert.equal(m.ball.ownerId, 6);
  const t = m.ball.dribbleTarget;
  assert.ok(t.x > 43, 'goes beyond the defender');
  assert.ok(t.y < 34, 'away from the side the defender came from');
});

test('a beaten defender can neither tackle nor keep up', () => {
  const m = duel();
  tryFeint(m, 1 / 60, () => 0);
  assert.equal(tryTackle(m, 1, () => 0), null);
  const d = m.players[13];
  d.vx = 0; d.vy = 0;
  const targets = m.players.map(p => ({ x: p.x, y: p.y }));
  targets[13] = { x: 0, y: 34 };
  const x0 = d.x;
  for (let i = 0; i < 20; i++) applyMovement(m, targets, 1 / 60);
  const slow = x0 - d.x;
  const m2 = duel(); const d2 = m2.players[13]; d2.vx = 0;
  for (let i = 0; i < 20; i++) applyMovement(m2, targets, 1 / 60);
  assert.ok(slow < (x0 - d2.x) * 0.6);
});

test('a failed feint can cost the ball', () => {
  const m = duel(50, 95);
  let rolls = [0, 0.99, 0];                          // attempt, fail, defender takes it
  const ev = tryFeint(m, 1 / 60, () => rolls.shift() ?? 0);
  assert.equal(ev.success, false);
  assert.equal(m.ball.ownerId, 13);
});

test('no feint without a defender in front, or straight after one', () => {
  const m = duel();
  put(m, 13, 37, 34);                                // behind the carrier
  assert.equal(tryFeint(m, 1 / 60, () => 0), null);
  const m2 = duel();
  tryFeint(m2, 1 / 60, () => 0);
  put(m2, 14, 44, 33);                               // a second defender arrives at once
  assert.equal(tryFeint(m2, 1 / 60, () => 0), null, 'cooldown');
});

test('feint and stumble poses sway to opposite sides and settle', () => {
  assert.ok(feintPose(0.25, 1).lean * feintPose(0.75, 1).lean < 0, 'fake one way, go the other');
  assert.ok(Math.abs(feintPose(1, 1).lean) < 0.05);
  assert.ok(Math.abs(stumblePose(0.3, 1).lean) > 0.2);
  assert.ok(Math.abs(stumblePose(1, 1).lean) < 0.05);
});

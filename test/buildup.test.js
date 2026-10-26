import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEAMS } from '../js/teams.js';
import { createMatch } from '../js/match.js';
import {
  decideAction, computeTargets, captureBall, readyToAct, commitDribble, tryTackle, passOrShoot, stepBall,
  applyMovement,
} from '../js/ai.js';

const mk = () => createMatch(TEAMS[0], TEAMS[1], 2);

// park everyone out of the way along the far touchline so a test can stage
// exactly the players it cares about
function stage(m) {
  m.players.forEach((p, i) => { p.x = 2 + i * 4.5; p.y = 67; p.vx = 0; p.vy = 0; });
  return m;
}
const put = (m, i, x, y) => { m.players[i].x = x; m.players[i].y = y; };

test('carrier waits before deciding (no instant first-touch pass)', () => {
  const m = stage(mk());
  put(m, 6, 40, 34);
  m.ball.x = 40; m.ball.y = 34; m.ball.ownerId = null;
  captureBall(m);
  assert.equal(m.ball.ownerId, 6);
  assert.equal(readyToAct(m), false);
  m.ball.holdTime = 2;
  assert.equal(readyToAct(m), true);
});

test('pass goes to the open teammate, not the one behind a defender', () => {
  const m = stage(mk());
  put(m, 6, 40, 34);                 // carrier (A MF)
  put(m, 9, 55, 20);                 // A FW, lane blocked
  put(m, 12, 47, 27.5);              // B defender sitting in that lane
  put(m, 10, 55, 48);                // A FW, wide open
  m.ball.ownerId = 6;
  const a = decideAction(m, () => 0.1);
  assert.equal(a.type, 'pass');
  assert.equal(a.targetId, 10);
});

test('pass is led ahead of a running receiver', () => {
  const m = stage(mk());
  put(m, 6, 40, 34);
  put(m, 10, 55, 40);
  m.players[10].vx = 10;             // sprinting toward goal
  m.ball.ownerId = 6;
  const a = decideAction(m, () => 0.1);
  assert.equal(a.targetId, 10);
  assert.ok(a.targetX > 55, `lead pass expected ahead of receiver, got ${a.targetX}`);
});

test('under pressure the carrier releases the ball instead of dribbling', () => {
  const m = stage(mk());
  put(m, 6, 40, 34);
  put(m, 13, 42, 34);                // B player right on him
  put(m, 5, 41, 20);                 // safe option square, inside his field of view
  m.ball.ownerId = 6;
  const a = decideAction(m, () => 0.99);
  assert.equal(a.type, 'pass');
});

test('goalkeeper distributes rather than dribbling', () => {
  const m = stage(mk());
  put(m, 0, 5, 34);
  put(m, 2, 20, 26);
  m.ball.ownerId = 0;
  const a = decideAction(m, () => 0.99);
  assert.equal(a.type, 'pass');
});

test('no shot from a tight angle far out wide', () => {
  const m = stage(mk());
  put(m, 9, 98, 14);                 // inside range but near the corner flag
  put(m, 10, 92, 30);
  m.ball.ownerId = 9;
  const a = decideAction(m, () => 0.5);
  assert.notEqual(a.type, 'shoot');
});

test('only the defending side presses the carrier', () => {
  const m = mk();
  m.ball.ownerId = 6;                // A has the ball
  m.ball.x = m.players[6].x; m.ball.y = m.players[6].y;
  const t = computeTargets(m);
  const chasers = t.map((p, i) => i).filter(i => i !== 6 &&
    t[i].x === m.players[6].x && t[i].y === m.players[6].y);
  assert.ok(chasers.length >= 1);
  assert.ok(chasers.every(i => m.players[i].side === 'B'));
});

test('intended receiver runs onto a pass in flight', () => {
  const m = stage(mk());
  put(m, 6, 40, 34);
  put(m, 10, 60, 40);
  m.ball.x = 40; m.ball.y = 34; m.ball.ownerId = 6;
  passOrShoot(m, { type: 'pass', targetX: 60, targetY: 40, targetId: 10 });
  const t = computeTargets(m);
  // heads back toward the incoming ball rather than standing still
  assert.ok(t[10].x < 60);
});

test('dribble commits a target the carrier runs to, then waits again', () => {
  const m = stage(mk());
  put(m, 6, 40, 34);
  m.ball.ownerId = 6; m.ball.holdTime = 5;
  commitDribble(m, { type: 'dribble', targetX: 52, targetY: 30 }, () => 0.5);
  assert.equal(readyToAct(m), false);
  const t = computeTargets(m);
  assert.deepEqual(t[6], { x: 52, y: 30 });
});

test('tackle: close defender can win the ball', () => {
  const m = stage(mk());
  put(m, 6, 40, 34);
  put(m, 13, 40.8, 34);
  m.ball.ownerId = 6;
  assert.equal(tryTackle(m, 0.016, () => 0.99), null);   // failed attempt
  assert.equal(tryTackle(m, 0.016, () => 0), 13);        // successful one
  assert.equal(m.ball.ownerId, 13);
});

test('passer cannot instantly recollect his own slow pass', () => {
  const m = stage(mk());
  put(m, 6, 40, 34);
  put(m, 7, 48, 34);
  m.ball.x = 41.5; m.ball.y = 34; m.ball.ownerId = 6;
  passOrShoot(m, { type: 'pass', targetX: 48, targetY: 34, targetId: 7 });
  stepBall(m, 1 / 60);
  assert.notEqual(m.ball.ownerId, 6);
});

test('defender standing on the ball does not steal a pass off the boot', () => {
  const m = stage(mk());
  put(m, 6, 40, 34);
  put(m, 7, 55, 34);
  put(m, 13, 41.5, 34.5);            // presser right on the ball
  m.ball.x = 41.5; m.ball.y = 34; m.ball.ownerId = 6;
  passOrShoot(m, { type: 'pass', targetX: 55, targetY: 34, targetId: 7 });
  stepBall(m, 1 / 60);
  assert.equal(m.ball.ownerId, null);
});

// --- field of view: a passer only sees the half-plane in front of him ---

test('players start facing the goal they attack', () => {
  const m = mk();
  assert.deepEqual(m.players[6].facing, { x: 1, y: 0 });
  assert.deepEqual(m.players[17].facing, { x: -1, y: 0 });
});

test('running turns a player to face where he is going', () => {
  const m = stage(mk());
  put(m, 6, 40, 34);
  const targets = m.players.map(p => ({ x: p.x, y: p.y }));
  targets[6] = { x: 40, y: 60 };                    // run toward the near touchline
  for (let i = 0; i < 60; i++) applyMovement(m, targets, 1 / 60);
  const f = m.players[6].facing;
  assert.ok(f.y > 0.9, `should face +y, got ${JSON.stringify(f)}`);
});

test('no pass to a teammate behind the passer, however open', () => {
  const m = stage(mk());
  put(m, 6, 40, 34);
  m.players[6].facing = { x: 1, y: 0 };
  put(m, 5, 25, 34);                                // wide open, but behind him
  m.ball.ownerId = 6;
  const a = decideAction(m, () => 0.1);
  assert.notEqual(a.targetId, 5);
});

test('a player with his back to goal can only lay it back the way he faces', () => {
  const m = stage(mk());
  put(m, 6, 60, 34);
  m.players[6].facing = { x: -1, y: 0 };            // received facing his own goal
  put(m, 9, 72, 34);                                // forward, but behind his back
  put(m, 5, 48, 30);                                // in front of his eyes
  m.ball.ownerId = 6;
  // he may turn and carry it instead, but any pass goes to the man he can see
  for (const r of [0.1, 0.5, 0.9]) {
    const a = decideAction(m, () => r);
    assert.notEqual(a.targetId, 9);
    if (a.type === 'pass') assert.equal(a.targetId, 5);
  }
});

test('standing players turn to watch the ball', () => {
  const m = stage(mk());
  put(m, 7, 40, 34);
  m.players[7].facing = { x: 1, y: 0 };
  m.ball.x = 40; m.ball.y = 10; m.ball.ownerId = null;
  const targets = m.players.map(p => ({ x: p.x, y: p.y }));
  for (let i = 0; i < 120; i++) applyMovement(m, targets, 1 / 60);
  assert.ok(m.players[7].facing.y < -0.9);
});

test('with no one in view, the carrier turns toward his best outlet instead of charging on', () => {
  const m = stage(mk());
  put(m, 6, 40, 34);
  m.players[6].facing = { x: 1, y: 0 };
  put(m, 5, 28, 30);                                // free, but behind him
  put(m, 13, 46, 34);                               // opponent blocking the way forward
  put(m, 14, 46, 28); put(m, 15, 46, 40);
  put(m, 9, 10, 67); put(m, 10, 14, 67);            // parked teammates out of his view
  m.ball.ownerId = 6;
  const a = decideAction(m, () => 0.99);
  assert.equal(a.type, 'dribble');
  assert.ok(a.targetX < 40, `should turn back toward the outlet, got ${a.targetX}`);
});

// --- defending: marking, intercepting, winning the ball ---

test('a defender marks the nearest attacker goal-side', () => {
  const m = stage(mk());
  put(m, 6, 30, 34); m.ball.ownerId = 6;          // A on the ball, deep
  m.ball.x = 30; m.ball.y = 34;
  put(m, 9, 70, 20);                               // A forward in B's half
  put(m, 12, 78, 30);                              // B defender nearby (B defends x=105)
  const t = computeTargets(m);
  // he moves toward the forward, staying between him and his own goal
  assert.ok(Math.hypot(t[12].x - 70, t[12].y - 20) < Math.hypot(78 - 70, 30 - 20));
  assert.ok(t[12].x > 70, 'goal-side of the attacker');
});

test('nearest defender runs to cut out a pass, not to where the ball is now', () => {
  const m = stage(mk());
  put(m, 6, 40, 34);
  put(m, 10, 60, 34);
  put(m, 13, 50, 40);                              // B player next to the lane
  m.ball.x = 41.5; m.ball.y = 34; m.ball.ownerId = 6;
  passOrShoot(m, { type: 'pass', targetX: 60, targetY: 34, targetId: 10 });
  const t = computeTargets(m);
  assert.ok(t[13].x > m.ball.x + 2, `should head ahead of the ball, got ${t[13].x}`);
});

test('a defender who gets to the carrier wins the ball fairly often', () => {
  let won = 0;
  for (let k = 0; k < 200; k++) {
    const m = stage(mk());
    put(m, 6, 40, 34);
    put(m, 13, 41.7, 34);
    m.ball.ownerId = 6;
    if (tryTackle(m, 0.5) !== null) won++;     // half a second of close contact
  }
  assert.ok(won > 60, `won ${won}/200`);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEAMS } from '../js/teams.js';
import { createMatch, resetKickoff, advanceClock, scoreGoal, checkGoal } from '../js/match.js';
import { PITCH } from '../js/constants.js';

const mk = () => createMatch(TEAMS[0], TEAMS[1], 2);

test('createMatch builds 22 players and centered ball', () => {
  const m = mk();
  assert.equal(m.players.length, 22);
  assert.equal(m.scoreA, 0);
  assert.equal(m.phase, 'kickoff');
  assert.equal(m.players[0].isGK, true);
  assert.equal(m.players[11].side, 'B');
});

test('resetKickoff centers ball and clears owner', () => {
  const m = mk();
  m.ball.x = 3; m.ball.ownerId = 5;
  resetKickoff(m);
  assert.equal(m.ball.x, PITCH.w / 2);
  assert.equal(m.ball.ownerId, null);
});

test('advanceClock triggers halftime at 45 and swaps sides', () => {
  const m = mk();
  const dirA = m.attackDir.A;
  const ev = advanceClock(m, 45);
  assert.equal(m.phase, 'halftime');
  assert.equal(m.attackDir.A, -dirA);
  assert.ok(ev.some(e => /Half Time/i.test(e)));
});

test('advanceClock triggers fulltime at 90', () => {
  const m = mk();
  advanceClock(m, 45); m.phase = 'playing';
  advanceClock(m, 45);
  assert.equal(m.phase, 'fulltime');
});

test('scoreGoal increments correct side', () => {
  const m = mk();
  scoreGoal(m, 'A'); scoreGoal(m, 'A'); scoreGoal(m, 'B');
  assert.equal(m.scoreA, 2);
  assert.equal(m.scoreB, 1);
});

test('checkGoal detects ball crossing goal line within posts', () => {
  const m = mk();
  m.ball.x = 106; m.ball.y = 34;         // past right goal, on target
  assert.equal(checkGoal(m), 'A');       // A attacks right → A scores
  m.ball.x = 106; m.ball.y = 5;          // wide
  assert.equal(checkGoal(m), null);
  m.ball.x = -1; m.ball.y = 34;
  assert.equal(checkGoal(m), 'B');
});

test('advanceClock fires Full Time only once across repeated calls', () => {
  const m = mk();
  advanceClock(m, 45); m.phase = 'playing';   // clear halftime
  const first = advanceClock(m, 45);           // reaches 90 -> fulltime
  const second = advanceClock(m, 45);          // already 90
  assert.equal(first.filter(e => /Full Time/i.test(e)).length, 1);
  assert.equal(second.filter(e => /Full Time/i.test(e)).length, 0);
  assert.equal(m.phase, 'fulltime');
});

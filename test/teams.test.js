import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEAMS, pickTwoTeams, pickTwoIndices, cycleTeam, formationPositions } from '../js/teams.js';

test('at least 6 teams, each with 11 players', () => {
  assert.ok(TEAMS.length >= 6);
  for (const t of TEAMS) assert.equal(t.players.length, 11);
});

test('pickTwoTeams returns two distinct teams', () => {
  const [a, b] = pickTwoTeams(TEAMS, () => 0.0);
  assert.notEqual(a.name, b.name);
});

test('formation: A GK near left goal, B GK near right goal', () => {
  const aGk = formationPositions(0, 'A');
  const bGk = formationPositions(0, 'B');
  assert.ok(aGk.x < 10, 'A GK left');
  assert.ok(bGk.x > 95, 'B GK right');
  assert.equal(aGk.x + bGk.x, 105, 'B mirrors A');
});

test('pickTwoIndices returns two distinct valid indices', () => {
  for (const r of [0, 0.5, 0.999]) {
    const [i, j] = pickTwoIndices(6, () => r);
    assert.notEqual(i, j);
    assert.ok(i >= 0 && i < 6 && j >= 0 && j < 6);
  }
});

test('cycleTeam steps through teams, skipping the opponent and wrapping', () => {
  assert.equal(cycleTeam(0, +1, 3, 6), 1);
  assert.equal(cycleTeam(2, +1, 3, 6), 4);     // skips the other side's team
  assert.equal(cycleTeam(5, +1, 0, 6), 1);     // wraps and skips
  assert.equal(cycleTeam(0, -1, 5, 6), 4);
});

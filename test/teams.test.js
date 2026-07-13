import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEAMS, pickTwoTeams, formationPositions } from '../js/teams.js';

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

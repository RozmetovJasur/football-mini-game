// test/commentary.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commentGoal, commentPass, commentShot } from '../js/commentary.js';
import { createMatch } from '../js/match.js';
import { TEAMS } from '../js/teams.js';

test('commentary strings mention context', () => {
  const m = createMatch(TEAMS[0], TEAMS[1], 2);
  assert.match(commentGoal(m, 'A'), /GOAL/i);
  assert.match(commentGoal(m, 'A'), new RegExp(m.teamA.name));
  assert.match(commentPass('Sarabia'), /Sarabia/);
  assert.match(commentShot('Messi'), /Messi/);
});

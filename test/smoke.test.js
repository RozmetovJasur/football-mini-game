import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PITCH, SHOOT_RANGE } from '../js/constants.js';

test('constants load', () => {
  assert.equal(PITCH.w, 105);
  assert.equal(PITCH.h, 68);
  assert.equal(SHOOT_RANGE, 25);
});

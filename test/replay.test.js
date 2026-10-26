import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEAMS } from '../js/teams.js';
import { createMatch } from '../js/match.js';
import { createRecorder, frameAt, clipDuration } from '../js/replay.js';

const mk = () => createMatch(TEAMS[0], TEAMS[1], 2);

test('recorder samples at its frame rate, not every tick', () => {
  const m = mk();
  const rec = createRecorder({ seconds: 5, fps: 10 });
  for (let i = 0; i < 60; i++) rec.record(m, 1 / 60);      // 1 second of ticks
  assert.equal(rec.clip().length, 10);
});

test('recorder keeps only the most recent window', () => {
  const m = mk();
  const rec = createRecorder({ seconds: 2, fps: 10 });
  for (let i = 0; i < 50; i++) { m.ball.x = i; rec.record(m, 0.1); }
  const clip = rec.clip();
  assert.equal(clip.length, 20);
  assert.equal(clip[clip.length - 1].ball.x, 49);
  assert.equal(clip[0].ball.x, 30);
});

test('clip is a snapshot unaffected by later play', () => {
  const m = mk();
  const rec = createRecorder({ seconds: 2, fps: 10 });
  m.ball.x = 10; rec.record(m, 0.1);
  const clip = rec.clip();
  m.ball.x = 99; m.players[0].x = 99; rec.record(m, 0.1);
  assert.equal(clip.length, 1);
  assert.equal(clip[0].ball.x, 10);
  assert.notEqual(clip[0].players[0].x, 99);
});

test('clip can be limited to the last N seconds', () => {
  const m = mk();
  const rec = createRecorder({ seconds: 5, fps: 10 });
  for (let i = 0; i < 50; i++) rec.record(m, 0.1);
  assert.equal(rec.clip(2).length, 20);
});

test('frameAt interpolates between samples', () => {
  const m = mk();
  const rec = createRecorder({ seconds: 2, fps: 10 });
  m.ball.x = 0; m.ball.z = 0; rec.record(m, 0.1);
  m.ball.x = 10; m.ball.z = 2; rec.record(m, 0.1);
  const clip = rec.clip();
  assert.equal(clipDuration(clip), 0.1);
  const mid = frameAt(clip, 0.05);
  assert.ok(Math.abs(mid.ball.x - 5) < 1e-9);
  assert.ok(Math.abs(mid.ball.z - 1) < 1e-9);
  assert.equal(frameAt(clip, 99).ball.x, 10);             // clamps past the end
});

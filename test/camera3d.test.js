import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toWorld, cameraShot, followCamera } from '../js/camera3d.js';
import { PITCH } from '../js/constants.js';

test('toWorld centres the pitch on the origin with y up', () => {
  assert.deepEqual(toWorld(PITCH.w / 2, PITCH.h / 2), { x: 0, y: 0, z: 0 });
  assert.deepEqual(toWorld(0, PITCH.h, 2), { x: -PITCH.w / 2, y: 2, z: PITCH.h / 2 });
});

test('broadcast camera sits high behind the near touchline', () => {
  const shot = cameraShot('broadcast', { x: 52.5, y: 34, z: 0 });
  assert.ok(shot.pos.z > PITCH.h / 2 + 5);
  assert.ok(shot.pos.y > 15);
});

test('broadcast camera pans with the ball but stays within the stadium', () => {
  const left = cameraShot('broadcast', { x: 0, y: 34, z: 0 });
  const right = cameraShot('broadcast', { x: 105, y: 34, z: 0 });
  assert.ok(left.look.x < right.look.x);
  assert.ok(Math.abs(right.pos.x) <= 35 && Math.abs(left.pos.x) <= 35);
});

test('replay camera is lower and closer to the ball', () => {
  const ball = { x: 90, y: 30, z: 0 };
  const b = cameraShot('broadcast', ball), r = cameraShot('replay', ball);
  const d = (s) => Math.hypot(s.pos.x - s.look.x, s.pos.y - s.look.y, s.pos.z - s.look.z);
  assert.ok(r.pos.y < b.pos.y);
  assert.ok(d(r) < d(b));
});

test('follow camera eases toward the shot instead of jumping', () => {
  const cam = { pos: { x: 0, y: 30, z: 60 }, look: { x: 0, y: 0, z: 0 } };
  const target = { pos: { x: 30, y: 30, z: 60 }, look: { x: 40, y: 0, z: 0 } };
  followCamera(cam, target, 1 / 60);
  assert.ok(cam.pos.x > 0 && cam.pos.x < 30);
  for (let i = 0; i < 600; i++) followCamera(cam, target, 1 / 60);
  assert.ok(Math.abs(cam.pos.x - 30) < 0.01);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gaitPose, kickPose, keeperPose, detectKick, KICK_CONTACT } from '../js/view3d/gait.js';

const samples = (speed) => Array.from({ length: 64 }, (_, i) => gaitPose(i / 64 * Math.PI * 2, speed));

test('legs swing in opposition while running', () => {
  for (const p of samples(1)) assert.ok(Math.abs(p.hipL + p.hipR) < 1e-9);
  const maxSwing = Math.max(...samples(1).map(p => Math.abs(p.hipL)));
  assert.ok(maxSwing > 0.5, 'a real stride');
});

test('knees only bend forward and bend most while the leg recovers', () => {
  for (const p of samples(1)) {
    assert.ok(p.kneeL >= 0 && p.kneeR >= 0, 'no hyper-extension');
  }
  const flex = samples(1).map(p => p.kneeL);
  assert.ok(Math.max(...flex) > 0.9);
});

test('arms counter the legs and elbows stay bent', () => {
  for (const p of samples(1)) {
    // left arm moves with the right leg
    assert.ok(Math.sign(p.shoulderL) === Math.sign(-p.hipL) || Math.abs(p.hipL) < 1e-6);
    assert.ok(p.elbow < -0.3);
  }
});

test('standing still is a relaxed pose, faster running is bigger', () => {
  const idle = samples(0), run = samples(1);
  const amp = (s) => Math.max(...s.map(p => Math.abs(p.hipL)));
  assert.ok(amp(idle) < 0.05);
  assert.ok(amp(run) > amp(samples(0.4)));
  assert.ok(Math.max(...run.map(p => p.lean)) > Math.max(...idle.map(p => p.lean)));
});

test('kick: wind up behind, then strike through in front', () => {
  const back = kickPose(0.3), strike = kickPose(0.75);
  assert.ok(back.hip > 0.5, 'leg drawn back');
  assert.ok(back.knee > 1, 'knee cocked');
  assert.ok(strike.hip < -0.8, 'follow-through in front');
  assert.ok(strike.knee < back.knee);
  assert.ok(kickPose(0.5).armOut > 0.3, 'arms out for balance');
});

test('keeper ready stance crouches with hands up', () => {
  const k = keeperPose();
  assert.ok(k.knee > 0.3 && k.shoulder < -0.3);
});

test('detectKick spots a sudden jump in ball speed next to a player', () => {
  const players = [{ x: 10, y: 10 }, { x: 50, y: 34 }];
  const before = { x: 50.5, y: 34, vx: 0, vy: 0 };
  const after = { x: 50.6, y: 34, vx: 40, vy: 0 };
  assert.equal(detectKick(players, before, after), 1);
  assert.equal(detectKick(players, after, { ...after, vx: 39 }), null);   // just friction
});

test('kick is detected at contact, so the animation starts there, not at the wind-up', () => {
  // at the contact moment the striking foot is under the body...
  assert.ok(Math.abs(kickPose(KICK_CONTACT).hip) < 0.1);
  // ...and from there on the leg only travels forward (follow-through)
  let prev = kickPose(KICK_CONTACT).hip;
  for (let t = KICK_CONTACT + 0.05; t <= 1; t += 0.05) {
    const h = kickPose(t).hip;
    assert.ok(h <= prev + 1e-9, `leg moved back at t=${t.toFixed(2)}`);
    prev = h;
  }
});

// js/view3d/gait.js
// Joint angles (radians) for the footballer rig. Pure maths so it can be tested.
// Sign conventions (rotation about the x axis): negative hip = leg forward,
// positive knee = shin folds back, negative shoulder = arm forward,
// negative elbow = forearm forward.

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, k) => a + (b - a) * k;

// running/walking cycle; `speed` is the fraction of top speed (0 = standing)
export function gaitPose(phase, speed) {
  const s = Math.min(speed, 1.15);
  const sw = Math.sin(phase);
  const amp = 0.75 * s;
  // a knee folds hardest while its leg swings forward to recover (cos > 0)
  const knee = (c) => s * (0.15 + 1.0 * Math.max(0, c)) + 0.06;
  return {
    hipL: -sw * amp,
    hipR: sw * amp,
    kneeL: knee(Math.cos(phase)),
    kneeR: knee(-Math.cos(phase)),
    shoulderL: sw * 0.65 * s,            // left arm swings forward with the right leg
    shoulderR: -sw * 0.65 * s,
    elbow: -(0.35 + 0.95 * s),
    twist: sw * 0.12 * s,
    lean: 0.03 + 0.17 * s,
    bob: Math.abs(Math.cos(phase)) * 0.05 * s,
  };
}

export const KICK_TIME = 0.42;   // seconds

// kicking leg through a strike; t in 0..1
export function kickPose(t) {
  if (t < 0.4) {                                     // wind-up: leg back, knee cocked
    const k = t / 0.4;
    return { hip: lerp(0, 0.85, k), knee: lerp(0.2, 1.5, k), armOut: lerp(0.1, 0.6, k) };
  }
  const k = clamp01((t - 0.4) / 0.6);                // strike and follow-through
  return { hip: lerp(0.85, -1.35, Math.min(1, k * 1.6)), knee: lerp(1.5, 0.1, Math.min(1, k * 2)), armOut: lerp(0.6, 0.2, k) };
}

// point in the kick where the foot meets the ball (hip passes vertical):
// the ball only moves from here on, so a detected kick starts the animation here
export const KICK_CONTACT = 0.4 + 0.6 * (0.85 / 2.2) / 1.6;

// goalkeeper set position when not running
export function keeperPose() {
  return { knee: 0.45, hip: -0.25, shoulder: -0.55, elbow: -0.6, armOut: 0.25 };
}

// A kick shows up as a sudden jump in ball speed; returns the index of the
// player at the ball, or null. Works on live play and on replay frames alike.
export function detectKick(players, before, after) {
  const v0 = Math.hypot(before.vx || 0, before.vy || 0);
  const v1 = Math.hypot(after.vx || 0, after.vy || 0);
  if (v1 - v0 < 8) return null;
  let best = null, bestD = 3.5;
  players.forEach((p, i) => {
    const d = Math.hypot(p.x - before.x, p.y - before.y);
    if (d < bestD) { bestD = d; best = i; }
  });
  return best;
}

// carrier's feint, t in 0..1: dip one way, explode the other, foot rolling
// over the ball on the fake side; `side` is where he goes (+1 = his left)
export function feintPose(t, side) {
  return {
    lean: -side * 0.35 * Math.sin(2 * Math.PI * t),
    stepOver: t < 0.5 ? Math.sin(2 * Math.PI * t) * 0.6 : 0,
  };
}

// a wrong-footed defender lurching the wrong way, t in 0..1
export function stumblePose(t, side) {
  const k = Math.sin(Math.PI * t);
  return { lean: side * 0.5 * k, knee: 0.5 * k };
}

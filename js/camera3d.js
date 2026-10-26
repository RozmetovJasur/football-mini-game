// js/camera3d.js
// Pitch ↔ 3D world mapping and camera shots. Pure maths, no Three.js.
// World: metres, origin at the centre spot, y up, +z toward the near touchline.
import { PITCH } from './constants.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const toWorld = (x, y, z = 0) => ({ x: x - PITCH.w / 2, y: z, z: y - PITCH.h / 2 });

// Where the camera stands and what it looks at, for a ball at pitch coords.
//  broadcast — main TV camera high in the stand, panning along the touchline
//  replay    — low pitch-side camera close to the action
//  goal      — tighter broadcast framing for celebrations
export function cameraShot(mode, ball) {
  const b = toWorld(ball.x, ball.y, ball.z || 0);
  if (mode === 'replay') {
    const side = b.x >= 0 ? 1 : -1;            // look toward the goal being attacked
    return {
      pos: { x: b.x - side * 16, y: 5, z: b.z + 16 },
      look: { x: b.x + side * 4, y: 1, z: b.z },
    };
  }
  const tight = mode === 'goal';
  return {
    pos: { x: clamp(b.x * 0.75, -35, 35), y: tight ? 15 : 22, z: tight ? 34 : 44 },
    look: { x: clamp(b.x, -44, 44), y: 0, z: b.z * 0.45 - 2 },
  };
}

// Ease `cam` toward `target` (frame-rate independent); mutates and returns cam.
export function followCamera(cam, target, dt, rate = 3) {
  const k = 1 - Math.exp(-rate * dt);
  for (const part of ['pos', 'look']) {
    for (const axis of ['x', 'y', 'z']) cam[part][axis] += (target[part][axis] - cam[part][axis]) * k;
  }
  return cam;
}

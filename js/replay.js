// js/replay.js
// Rolling recording of recent play, used for goal and big-chance replays.

const snapshot = (match) => ({
  players: match.players.map(p => ({
    x: p.x, y: p.y, vx: p.vx || 0, vy: p.vy || 0, fx: p.facing?.x ?? 1, fy: p.facing?.y ?? 0,
    feintT: p.feintT || 0, feintSide: p.feintSide || 0, stunT: p.stunT || 0, stunSide: p.stunSide || 0,
  })),
  ball: { x: match.ball.x, y: match.ball.y, z: match.ball.z || 0, vx: match.ball.vx || 0, vy: match.ball.vy || 0 },
});

export function createRecorder({ seconds = 5, fps = 30 } = {}) {
  const step = 1 / fps;
  const capacity = Math.round(seconds * fps);
  let frames = [];
  let acc = null;            // null: record the very next tick

  return {
    fps,
    record(match, dt) {
      if (acc === null) acc = 0;
      else {
        acc += dt;
        if (acc < step - 1e-9) return;
        acc -= step;
      }
      frames.push(snapshot(match));
      if (frames.length > capacity) frames = frames.slice(-capacity);
    },
    // copy of the last `secs` seconds (all of the window when omitted)
    clip(secs) {
      const n = secs === undefined ? frames.length : Math.round(secs * fps);
      return frames.slice(-n).map(f => ({ ...f, fps }));
    },
    reset() { frames = []; acc = null; },
  };
}

export const clipDuration = (clip) => clip.length ? (clip.length - 1) / clip[0].fps : 0;

const lerp = (a, b, k) => a + (b - a) * k;
const mix = (a, b, k) => {
  const out = {};
  for (const key in a) out[key] = lerp(a[key], b[key], k);
  return out;
};

// interpolated state `time` seconds into the clip
export function frameAt(clip, time) {
  const pos = Math.max(0, Math.min(time * clip[0].fps, clip.length - 1));
  const i = Math.floor(pos), k = pos - i;
  const a = clip[i], b = clip[Math.min(i + 1, clip.length - 1)];
  return {
    players: a.players.map((p, j) => mix(p, b.players[j], k)),
    ball: mix(a.ball, b.ball, k),
  };
}

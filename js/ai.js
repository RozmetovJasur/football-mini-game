import {
  PITCH, SHOOT_RANGE, PASS_RANGE, CAPTURE_DIST, P_PASS,
  PLAYER_SPEED, BALL_FRICTION, PASS_SPEED, SHOT_SPEED,
  TURN_RATE, WANDER_AMP, WANDER_FREQ, SEPARATION_DIST, SEPARATION_PUSH,
} from './constants.js';
import { formationPositions } from './teams.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const goalX = (match, side) => (match.attackDir[side] > 0 ? PITCH.w : 0);

export function nearestPlayer(players, x, y, filter = () => true) {
  let index = -1, best = Infinity;
  players.forEach((p, i) => {
    if (!filter(p, i)) return;
    const d = dist(p.x, p.y, x, y);
    if (d < best) { best = d; index = i; }
  });
  return { index, dist: best };
}

export function captureBall(match) {
  if (match.ball.ownerId !== null) return match.ball.ownerId;
  const { index, dist: d } = nearestPlayer(match.players, match.ball.x, match.ball.y);
  if (d <= CAPTURE_DIST) { match.ball.ownerId = index; return index; }
  return null;
}

export function decideAction(match, rng = Math.random) {
  const id = match.ball.ownerId;
  if (id === null) return null;
  const p = match.players[id];
  const side = p.side;
  const gx = goalX(match, side), gy = PITCH.h / 2;
  const dir = match.attackDir[side];

  if (dist(p.x, p.y, gx, gy) < SHOOT_RANGE) {
    return { type: 'shoot', targetX: gx, targetY: gy };
  }
  // teammate ahead in attack direction, within PASS_RANGE
  let mate = -1, mateBest = Infinity;
  match.players.forEach((q, i) => {
    if (i === id || q.side !== side) return;
    const ahead = dir > 0 ? q.x > p.x : q.x < p.x;
    const d = dist(p.x, p.y, q.x, q.y);
    if (ahead && d < PASS_RANGE && d < mateBest) { mate = i; mateBest = d; }
  });
  if (mate >= 0 && rng() < P_PASS) {
    const q = match.players[mate];
    return { type: 'pass', targetX: q.x, targetY: q.y, targetId: mate };
  }
  return { type: 'dribble', targetX: p.x + dir * 15, targetY: gy };
}

// Formation home position in the current-half orientation.
function formationBase(match, i, side) {
  const base = formationPositions(i % 11, side);
  const bx = match.attackDir.A < 0 ? PITCH.w - base.x : base.x;
  return { x: bx, y: base.y };
}

// How strongly each role tracks the ball along the x-axis, and its lateral
// (y) tracking — distinct per role so the team does NOT translate as a rigid
// grid. DF hold a deeper line, FW push high.
const X_TRACK = { GK: 0, DF: 0.20, MF: 0.45, FW: 0.65 };
const Y_TRACK = { GK: 0, DF: 0.15, MF: 0.30, FW: 0.30 };
const PUSH_WEIGHT = { GK: 0, DF: 0.25, MF: 0.6, FW: 1 };

export function computeTargets(match) {
  const { ball } = match;
  const owner = ball.ownerId !== null ? match.players[ball.ownerId] : null;

  // two nearest outfield non-owners press the ball (chase it directly)
  const ranked = match.players
    .map((p, i) => ({ i, d: dist(p.x, p.y, ball.x, ball.y) }))
    .filter(o => o.i !== ball.ownerId && !match.players[o.i].isGK)
    .sort((a, b) => a.d - b.d);
  const pressers = new Set([ranked[0]?.i, ranked[1]?.i]);

  const positional = new Set();
  const targets = match.players.map((p, i) => {
    if (i === ball.ownerId) {
      const gx = goalX(match, p.side);
      return { x: gx, y: PITCH.h / 2 };          // owner drives to goal
    }
    if (p.isGK) {
      const ownGoalX = match.attackDir[p.side] > 0 ? 4 : PITCH.w - 4;
      return { x: ownGoalX, y: clamp(ball.y, 28, 40) };
    }
    if (pressers.has(i)) return { x: ball.x, y: ball.y };

    // positional player: role-based movement, individual wander
    positional.add(i);
    const base = formationBase(match, i, p.side);
    const dir = match.attackDir[p.side];
    const teamHasBall = owner !== null && owner.side === p.side;
    const xt = X_TRACK[p.role] ?? 0.4;
    const yt = Y_TRACK[p.role] ?? 0.3;
    let tx = base.x + (ball.x - base.x) * xt;
    // attack push forward with possession, drop back without it — role-scaled
    tx += dir * (teamHasBall ? 7 : -5) * (PUSH_WEIGHT[p.role] ?? 0.5);
    let ty = base.y + (ball.y - base.y) * yt;
    // per-player wander: distinct phase per index → no lockstep translation
    tx += Math.sin(match.clock * WANDER_FREQ + i * 1.7) * WANDER_AMP;
    ty += Math.cos(match.clock * WANDER_FREQ + i * 2.3) * WANDER_AMP;
    return { x: clamp(tx, 0, PITCH.w), y: clamp(ty, 0, PITCH.h) };
  });

  // separation: positional players repel nearby teammates so they spread out
  // and hold distinct lanes instead of clumping into one moving blob.
  match.players.forEach((p, i) => {
    if (!positional.has(i)) return;
    let sx = 0, sy = 0;
    match.players.forEach((q, j) => {
      if (j === i || q.side !== p.side) return;
      const dx = p.x - q.x, dy = p.y - q.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < SEPARATION_DIST) {
        sx += (dx / d) * (SEPARATION_DIST - d);
        sy += (dy / d) * (SEPARATION_DIST - d);
      }
    });
    targets[i].x = clamp(targets[i].x + sx * SEPARATION_PUSH, 0, PITCH.w);
    targets[i].y = clamp(targets[i].y + sy * SEPARATION_PUSH, 0, PITCH.h);
  });

  return targets;
}

// Move players toward their targets with velocity inertia (smooth acceleration
// and turning) rather than snapping straight, so motion looks natural.
export function applyMovement(match, targets, dt) {
  const agility = 1 - Math.pow(1 - TURN_RATE, dt); // frame-rate independent steer
  match.players.forEach((p, i) => {
    const t = targets[i];
    const dx = t.x - p.x, dy = t.y - p.y;
    const d = Math.hypot(dx, dy);
    let dvx = 0, dvy = 0;
    if (d > 0.001) {
      const speed = Math.min(PLAYER_SPEED, d / dt); // never overshoot the target
      dvx = (dx / d) * speed;
      dvy = (dy / d) * speed;
    }
    p.vx = (p.vx || 0) + (dvx - (p.vx || 0)) * agility;
    p.vy = (p.vy || 0) + (dvy - (p.vy || 0)) * agility;
    p.x = clamp(p.x + p.vx * dt, 0, PITCH.w);
    p.y = clamp(p.y + p.vy * dt, 0, PITCH.h);
  });
}

export function passOrShoot(match, action) {
  const speed = action.type === 'shoot' ? SHOT_SPEED : PASS_SPEED;
  const b = match.ball;
  const dx = action.targetX - b.x, dy = action.targetY - b.y;
  const d = Math.hypot(dx, dy) || 1;
  b.vx = (dx / d) * speed;
  b.vy = (dy / d) * speed;
  b.ownerId = null;
}

export function stepBall(match, dt) {
  const b = match.ball;
  if (b.ownerId !== null) {
    const p = match.players[b.ownerId];
    const dir = match.attackDir[p.side];
    b.x = clamp(p.x + dir * 1.5, 0, PITCH.w);   // ball just ahead of owner
    b.y = p.y; b.vx = 0; b.vy = 0;
    return;
  }
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  const decay = Math.pow(BALL_FRICTION, dt);
  b.vx *= decay; b.vy *= decay;
  if (Math.abs(b.vx) < 0.3 && Math.abs(b.vy) < 0.3) { b.vx = 0; b.vy = 0; }
  b.y = clamp(b.y, 0, PITCH.h);
  b.x = clamp(b.x, 0, PITCH.w);
  if (b.x === 0 || b.x === PITCH.w) b.vx = 0;
  captureBall(match);
}

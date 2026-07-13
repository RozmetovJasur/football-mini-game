import {
  PITCH, SHOOT_RANGE, PASS_RANGE, CAPTURE_DIST, P_PASS,
  PLAYER_SPEED, BALL_FRICTION, PASS_SPEED, SHOT_SPEED,
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

export function computeTargets(match) {
  const { ball } = match;
  // two nearest non-owners press the ball
  const ranked = match.players
    .map((p, i) => ({ i, d: dist(p.x, p.y, ball.x, ball.y) }))
    .filter(o => o.i !== ball.ownerId && !match.players[o.i].isGK)
    .sort((a, b) => a.d - b.d);
  const pressers = new Set([ranked[0]?.i, ranked[1]?.i]);

  return match.players.map((p, i) => {
    if (i === ball.ownerId) {
      const gx = goalX(match, p.side);
      return { x: gx, y: PITCH.h / 2 };          // owner drives to goal
    }
    if (p.isGK) {
      const ownGoalX = match.attackDir[p.side] > 0 ? 4 : PITCH.w - 4;
      return { x: ownGoalX, y: clamp(ball.y, 28, 40) };
    }
    if (pressers.has(i)) return { x: ball.x, y: ball.y };
    const base = formationPositions(i % 11, p.side);
    const bx = match.attackDir.A < 0 ? PITCH.w - base.x : base.x;
    return { x: (bx + ball.x) / 2, y: (base.y + ball.y) / 2 }; // hold shape, drift to ball
  });
}

export function applyMovement(match, targets, dt) {
  match.players.forEach((p, i) => {
    const t = targets[i];
    const dx = t.x - p.x, dy = t.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const step = Math.min(PLAYER_SPEED * dt, d);
    p.x = clamp(p.x + (dx / d) * step, 0, PITCH.w);
    p.y = clamp(p.y + (dy / d) * step, 0, PITCH.h);
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

import {
  PITCH, SHOOT_RANGE, PASS_RANGE, CAPTURE_DIST,
  PLAYER_SPEED, BALL_FRICTION, PASS_SPEED, SHOT_SPEED,
  TURN_RATE, WANDER_AMP, WANDER_FREQ, SEPARATION_DIST, SEPARATION_PUSH,
  GRAVITY, BALL_BOUNCE, BALL_REACH_Z, LOFT_PASS_DIST, MAX_LOFT_VZ,
  HOLD_MIN, HOLD_RAND, PRESSURE_DIST, LANE_BLOCK_DIST, MIN_PASS_DIST, P_PASS_OPEN,
  TACKLE_DIST, TACKLE_RATE, GOOD_SHOT_ANGLE, CLOSE_SHOT_DIST, GOAL_HALF_HEIGHT,
  FEINT_RANGE, FEINT_COOLDOWN, FEINT_TIME, STUN_TIME, FEINT_LOSS,
} from './constants.js';
import { homePosition } from './match.js';
import {
  paceFactor, carryFactor, tackleFactor, takeOnChance, passErrorFactor,
  shotPowerFactor, shotSpreadFactor, keeperReachFactor, feintAttemptChance, feintSuccess,
} from './stats.js';

const KICK_LOCKOUT = 0.3;   // sec
const FACING_MIN_SPEED = 1;      // units/s: below this a player is standing, not running
const TURN_TO_BALL = 4;          // how quickly a standing player turns toward the ball
const TURN_STEP = 4;             // units a carrier moves while turning to find a pass
const STUNNED_SPEED = 0.25;      // speed of a wrong-footed defender, as a share of normal
const FEINT_BURST = 1.15;        // carrier's acceleration out of a feint
const MARK_RADIUS = 14;          // a defender picks up attackers this close to his zone
const MARK_GAP = 2;              // marking distance, goal-side
const MARK_WEIGHT = 0.7;         // how far marking pulls a defender out of his shape
const KICK_CLEAR = 0.1;     // sec nobody can touch a freshly struck ball
const PASS_ERROR = 0.12;    // max miss per unit of pass length
const INTERCEPT_REACTION = 0.3;   // share of the flight time an opponent can use to close a lane
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
  if ((match.ball.z || 0) > BALL_REACH_Z) return null;   // ball flying overhead
  const b = match.ball;
  if ((b.sinceKick ?? Infinity) < KICK_CLEAR) return null;   // just left the boot
  // the kicker needs a moment before he can touch his own pass again
  const canTouch = (p, i) => !(i === b.kickerId && (b.sinceKick ?? Infinity) < KICK_LOCKOUT);
  const { index, dist: d } = nearestPlayer(match.players, b.x, b.y, canTouch);
  if (index < 0) return null;
  const p = match.players[index];
  const reach = p.isGK ? CAPTURE_DIST * keeperReachFactor(p) : CAPTURE_DIST;   // keepers dive
  if (d <= reach) { takePossession(match, index); return index; }
  return null;
}

function takePossession(match, index, rng = Math.random) {
  const b = match.ball;
  b.ownerId = index;
  b.lastSide = match.players[index].side;
  b.targetId = null;
  b.dribbleTarget = null;
  b.holdTime = 0;
  b.nextDecision = HOLD_MIN + rng() * HOLD_RAND;
  b.feintCooldown = 0.3;          // a touch to settle before taking anyone on
}

const opponentsOf = (match, side) => match.players.filter(q => q.side !== side);

// distance from the nearest opponent to the carrier
function pressureOn(match, p) {
  let best = Infinity;
  for (const q of opponentsOf(match, p.side)) best = Math.min(best, dist(p.x, p.y, q.x, q.y));
  return best;
}

// Closest approach of point (px,py) to the segment a→b, ignoring the first
// 20% (an opponent right beside the passer can't cut out the pass). Returns the
// distance and the fraction t of the path where it happens.
function laneDist(ax, ay, bx, by, px, py) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0.2, 1);
  return { d: dist(ax + dx * t, ay + dy * t, px, py), t };
}

// Carrier keeps the ball for a short, random hold before acting, unless an
// opponent closes in.
export function readyToAct(match) {
  const b = match.ball;
  if (b.ownerId === null) return false;
  const held = b.holdTime || 0;
  if (held >= (b.nextDecision ?? 0)) return true;
  return held > 0.3 && pressureOn(match, match.players[b.ownerId]) < PRESSURE_DIST;
}

export function commitDribble(match, action, rng = Math.random) {
  const b = match.ball;
  b.dribbleTarget = { x: action.targetX, y: action.targetY };
  b.holdTime = 0;
  b.nextDecision = HOLD_MIN + rng() * HOLD_RAND;
}

// Opponents within reach of the carrier may win the ball; returns the tackler.
export function tryTackle(match, dt, rng = Math.random) {
  const id = match.ball.ownerId;
  if (id === null) return null;
  const p = match.players[id];
  let tackler = -1, best = Infinity;
  match.players.forEach((q, i) => {
    if (q.side === p.side || q.stunT > 0) return;   // a wrong-footed defender can't challenge
    const d = dist(p.x, p.y, q.x, q.y);
    if (d < TACKLE_DIST && d < best) { best = d; tackler = i; }
  });
  if (tackler < 0 || rng() >= TACKLE_RATE * dt * tackleFactor(match.players[tackler], p)) return null;
  takePossession(match, tackler, rng);
  return tackler;
}

// When a defender closes in front of him, the carrier may try to beat him
// with a feint. Success wrong-foots the defender and sends the carrier past on
// the other side; failure can cost the ball. Returns the event, or null.
export function tryFeint(match, dt, rng = Math.random) {
  const b = match.ball;
  if (b.ownerId === null) return null;
  b.feintCooldown = Math.max(0, (b.feintCooldown ?? 0) - dt);
  if (b.feintCooldown > 0) return null;
  const p = match.players[b.ownerId];
  if (p.isGK) return null;
  let def = -1, best = FEINT_RANGE;
  match.players.forEach((q, i) => {
    if (q.side === p.side || q.stunT > 0) return;
    const d = dist(p.x, p.y, q.x, q.y);
    if (d < best && canSee(p, q.x, q.y)) { best = d; def = i; }
  });
  if (def < 0) return null;
  b.feintCooldown = FEINT_COOLDOWN;              // one decision per duel
  if (rng() >= feintAttemptChance(p)) return null;

  const q = match.players[def];
  const carrier = b.ownerId;
  const f = p.facing ?? { x: match.attackDir[p.side], y: 0 };
  const nx = -f.y, ny = f.x;                     // his left
  const side = ((q.x - p.x) * nx + (q.y - p.y) * ny) >= 0 ? -1 : 1;   // go round the far side
  if (rng() < feintSuccess(p, q)) {
    q.stunT = STUN_TIME; q.stunSide = -side;     // he bites on the fake
    p.feintT = FEINT_TIME; p.feintSide = side;
    b.dribbleTarget = {
      x: clamp(p.x + f.x * 9 + nx * side * 4, 0, PITCH.w),
      y: clamp(p.y + f.y * 9 + ny * side * 4, 2, PITCH.h - 2),
    };
    b.holdTime = 0;
    b.nextDecision = FEINT_TIME + 0.2;           // finish the move before passing
    return { type: 'feint', success: true, carrier, defender: def, side };
  }
  p.feintT = FEINT_TIME; p.feintSide = side;     // he tried it all the same
  if (rng() < FEINT_LOSS) takePossession(match, def, rng);
  return { type: 'feint', success: false, carrier, defender: def, side };
}

// A player sees the half-plane in front of him (180° field of view).
export function canSee(p, x, y) {
  const f = p.facing ?? { x: 1, y: 0 };
  return (x - p.x) * f.x + (y - p.y) * f.y >= 0;
}

// Rank every teammate as a pass option: forward progress, space around the
// receiver and a clear lane. Passes are led to where the receiver is running.
function bestPass(match, id, { anyDirection = false } = {}) {
  const p = match.players[id];
  const dir = match.attackDir[p.side];
  const opps = opponentsOf(match, p.side);
  let best = null;
  match.players.forEach((q, i) => {
    if (i === id || q.side !== p.side || q.isGK) return;
    if (!anyDirection && !canSee(p, q.x, q.y)) return;   // can't pass to a man behind him
    const d0 = dist(p.x, p.y, q.x, q.y);
    if (d0 < MIN_PASS_DIST || d0 > PASS_RANGE) return;
    const flight = d0 / passSpeed(d0);
    const lx = clamp(q.x + (q.vx || 0) * flight, 2, PITCH.w - 2);
    const ly = clamp(q.y + (q.vy || 0) * flight, 2, PITCH.h - 2);
    const d = dist(p.x, p.y, lx, ly);
    const travel = d / passSpeed(d);
    let lane = Infinity, space = Infinity, blocked = false;
    for (const o of opps) {
      // an opponent can step into the lane while the ball is on its way
      const l = laneDist(p.x, p.y, lx, ly, o.x, o.y);
      const reach = Math.max(LANE_BLOCK_DIST, CAPTURE_DIST + PLAYER_SPEED * travel * l.t * INTERCEPT_REACTION);
      if (l.d < reach) blocked = true;
      lane = Math.min(lane, l.d);
      space = Math.min(space, dist(lx, ly, o.x, o.y));
    }
    // receiver must get to the ball before the closest marker does
    if (blocked || space < dist(q.x, q.y, lx, ly) + CAPTURE_DIST) return;
    const progress = (lx - p.x) * dir;
    const score = progress * 1.5 + Math.min(progress, 0) + Math.min(space, 10) * 0.8
      + Math.min(lane, 6) - Math.max(0, d0 - 25) * 0.5;
    if (!best || score > best.score) best = { i, x: lx, y: ly, score, progress };
  });
  return best;
}

// no opponent in a short cone in front of the carrier
function clearAhead(match, p) {
  const dir = match.attackDir[p.side];
  return opponentsOf(match, p.side).every(o => {
    const ahead = (o.x - p.x) * dir;
    return ahead < 0 || ahead > 6 || Math.abs(o.y - p.y) > ahead * 0.8 + 1.5;
  });
}

const passSpeed = (d) => Math.min(PASS_SPEED, 16 + d * 1.2);

export function decideAction(match, rng = Math.random) {
  const id = match.ball.ownerId;
  if (id === null) return null;
  const p = match.players[id];
  const side = p.side;
  const gx = goalX(match, side), gy = PITCH.h / 2;
  const dir = match.attackDir[side];
  const toGoal = dist(p.x, p.y, gx, gy);
  const pressed = pressureOn(match, p) < PRESSURE_DIST;
  const pass = bestPass(match, id);
  // passes are not laser-guided: error grows with distance
  const passTo = (o) => {
    const err = dist(p.x, p.y, o.x, o.y) * PASS_ERROR * passErrorFactor(p);
    return {
      type: 'pass', targetId: o.i,
      targetX: clamp(o.x + (rng() * 2 - 1) * err, 0, PITCH.w),
      targetY: clamp(o.y + (rng() * 2 - 1) * err, 0, PITCH.h),
    };
  };

  // shoot from close in, or from range with a decent angle when no better ball
  const goodAngle = Math.abs(p.y - gy) < GOOD_SHOT_ANGLE;
  if (!p.isGK && (toGoal < CLOSE_SHOT_DIST ||
      (toGoal < SHOOT_RANGE && goodAngle && (pressed || !pass || pass.progress < 5 || rng() < 0.5)))) {
    // aim for the corners; poor finishers spray it wide
    const aim = gy + (rng() * 2 - 1) * GOAL_HALF_HEIGHT * 1.2 * shotSpreadFactor(p);
    return { type: 'shoot', targetX: gx, targetY: aim };
  }
  // with nobody ahead to find, an attacker with room in front takes his man on
  const takeOn = !p.isGK && pass && pass.progress < 0 && clearAhead(match, p) && rng() < takeOnChance(p);
  // pass when pressed, when the way ahead is shut, or usually when it's on anyway
  const blocked = !clearAhead(match, p);
  if (pass && !takeOn && (p.isGK || pressed || blocked || (pass.progress > -5 && rng() < P_PASS_OPEN))) {
    return passTo(pass);
  }
  // nobody in view and the way ahead is shut: shield it and turn toward the
  // best teammate behind him, to play it next time he looks up
  if (!pass && blocked) {
    const outlet = bestPass(match, id, { anyDirection: true });
    if (outlet) {
      const dx = outlet.x - p.x, dy = outlet.y - p.y, d = Math.hypot(dx, dy) || 1;
      return { type: 'dribble', targetX: clamp(p.x + dx / d * TURN_STEP, 0, PITCH.w), targetY: clamp(p.y + dy / d * TURN_STEP, 0, PITCH.h) };
    }
  }
  // carry it forward, drifting toward the centre and away from the nearest opponent
  let ty = p.y + (gy - p.y) * 0.25;
  let near = null, nd = Infinity;
  for (const o of opponentsOf(match, side)) {
    const d = dist(p.x, p.y, o.x, o.y);
    if (d < nd) { nd = d; near = o; }
  }
  if (near && nd < 10) ty += (p.y >= near.y ? 1 : -1) * 5;
  return { type: 'dribble', targetX: clamp(p.x + dir * 12, 0, PITCH.w), targetY: clamp(ty, 2, PITCH.h - 2) };
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

  // pressers: two nearest defenders of the side without the ball; for a loose
  // ball nobody is passing to, the nearest player from each side
  const receiver = owner === null && ball.targetId != null ? ball.targetId : null;
  const attackSide = owner ? owner.side : (receiver !== null ? match.players[receiver].side : null);
  const ranked = match.players
    .map((p, i) => ({ i, side: p.side, d: dist(p.x, p.y, ball.x, ball.y) }))
    .filter(o => o.i !== ball.ownerId && o.i !== receiver && !match.players[o.i].isGK)
    .sort((a, b) => a.d - b.d);
  const pressers = new Set();
  let cover = null;
  if (attackSide) {
    // one defender closes the ball down, the next one covers behind him
    const defenders = ranked.filter(o => o.side !== attackSide);
    if (defenders[0]) pressers.add(defenders[0].i);
    cover = defenders[1]?.i ?? null;
  } else {
    for (const s of ['A', 'B']) { const o = ranked.find(r => r.side === s); if (o) pressers.add(o.i); }
  }

  const positional = new Set();
  const targets = match.players.map((p, i) => {
    if (i === ball.ownerId) {
      if (ball.dribbleTarget) return { ...ball.dribbleTarget };
      return { x: goalX(match, p.side), y: PITCH.h / 2 };   // owner drives to goal
    }
    // the receiver runs onto the pass; defenders try to cut it out
    if (i === receiver || (receiver !== null && pressers.has(i))) return interceptPoint(ball, p);
    if (p.isGK) {
      const ownGoalX = match.attackDir[p.side] > 0 ? 4 : PITCH.w - 4;
      return { x: ownGoalX, y: clamp(ball.y, 28, 40) };
    }
    if (pressers.has(i)) return { x: ball.x, y: ball.y };
    if (i === cover) {
      const back = -match.attackDir[p.side] * 8;   // between ball and own goal
      return { x: clamp(ball.x + back, 0, PITCH.w), y: ball.y + (PITCH.h / 2 - ball.y) * 0.3 };
    }

    // positional player: role-based movement, individual wander
    positional.add(i);
    const base = homePosition(match, p);
    const dir = match.attackDir[p.side];
    const teamHasBall = owner !== null && owner.side === p.side;
    const xt = X_TRACK[p.role] ?? 0.4;
    const yt = Y_TRACK[p.role] ?? 0.3;
    let tx = base.x + (ball.x - base.x) * xt;
    // attack push forward with possession, drop back without it — role-scaled
    tx += dir * (teamHasBall ? 7 : -5) * (PUSH_WEIGHT[p.role] ?? 0.5);
    let ty = base.y + (ball.y - base.y) * yt;
    // forwards make runs beyond the ball to offer a pass in behind
    if (teamHasBall && p.role === 'FW') tx = dir > 0 ? Math.max(tx, ball.x + 8) : Math.min(tx, ball.x - 8);
    // per-player wander: distinct phase per index → no lockstep translation
    tx += Math.sin(match.clock * WANDER_FREQ + i * 1.7) * WANDER_AMP;
    ty += Math.cos(match.clock * WANDER_FREQ + i * 2.3) * WANDER_AMP;
    return { x: clamp(tx, 0, PITCH.w), y: clamp(ty, 0, PITCH.h) };
  });

  // marking: out of possession, positional players pick up the nearest free
  // attacker and stand goal-side of him, closing down the passing lanes
  if (attackSide) {
    const taken = new Set();
    const attackers = match.players
      .map((q, j) => ({ q, j }))
      .filter(({ q, j }) => q.side === attackSide && !q.isGK && j !== ball.ownerId);
    for (const i of positional) {
      const p = match.players[i];
      if (p.side === attackSide) continue;
      let best = null, bestD = MARK_RADIUS;
      for (const a of attackers) {
        if (taken.has(a.j)) continue;
        const d = dist(targets[i].x, targets[i].y, a.q.x, a.q.y);
        if (d < bestD) { bestD = d; best = a; }
      }
      if (!best) continue;
      taken.add(best.j);
      const gx = goalX(match, attackSide) , gy = PITCH.h / 2;   // the goal he defends
      const dx = gx - best.q.x, dy = gy - best.q.y, dd = Math.hypot(dx, dy) || 1;
      const mx = best.q.x + dx / dd * MARK_GAP, my = best.q.y + dy / dd * MARK_GAP;
      targets[i].x = clamp(targets[i].x + (mx - targets[i].x) * MARK_WEIGHT, 0, PITCH.w);
      targets[i].y = clamp(targets[i].y + (my - targets[i].y) * MARK_WEIGHT, 0, PITCH.h);
    }
  }

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

// Runners face where they run; standing players turn to watch the ball;
// the man on the ball keeps his body shape while he holds it.
function updateFacing(match, p, i, dt) {
  const sp = Math.hypot(p.vx, p.vy);
  let fx, fy;
  if (sp > FACING_MIN_SPEED) { fx = p.vx / sp; fy = p.vy / sp; }
  else if (i !== match.ball.ownerId) {
    const dx = match.ball.x - p.x, dy = match.ball.y - p.y, d = Math.hypot(dx, dy);
    if (d < 1e-6) return;
    fx = dx / d; fy = dy / d;
  } else return;
  const f = p.facing ?? { x: fx, y: fy };
  const k = sp > FACING_MIN_SPEED ? 1 : 1 - Math.exp(-TURN_TO_BALL * dt);
  const nx = f.x + (fx - f.x) * k, ny = f.y + (fy - f.y) * k;
  const n = Math.hypot(nx, ny) || 1;
  p.facing = { x: nx / n, y: ny / n };
}

// where a player running at full speed meets the moving ball
function interceptPoint(ball, p) {
  const v = Math.hypot(ball.vx, ball.vy);
  const tau = dist(p.x, p.y, ball.x, ball.y) / (PLAYER_SPEED + v);
  return { x: clamp(ball.x + ball.vx * tau, 0, PITCH.w), y: clamp(ball.y + ball.vy * tau, 0, PITCH.h) };
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
      // pace sets top speed; carrying the ball costs less for good dribblers
      let top = PLAYER_SPEED * paceFactor(p);
      if (i === match.ball.ownerId) top *= carryFactor(p);
      if (p.stunT > 0) top *= STUNNED_SPEED;      // wrong-footed
      if (p.feintT > 0) top *= FEINT_BURST;       // explodes past his man
      const speed = Math.min(top, d / dt); // never overshoot the target
      dvx = (dx / d) * speed;
      dvy = (dy / d) * speed;
    }
    p.vx = (p.vx || 0) + (dvx - (p.vx || 0)) * agility;
    p.vy = (p.vy || 0) + (dvy - (p.vy || 0)) * agility;
    p.x = clamp(p.x + p.vx * dt, 0, PITCH.w);
    p.y = clamp(p.y + p.vy * dt, 0, PITCH.h);
    updateFacing(match, p, i, dt);
    if (p.stunT > 0) p.stunT = Math.max(0, p.stunT - dt);
    if (p.feintT > 0) p.feintT = Math.max(0, p.feintT - dt);
  });
}

export function passOrShoot(match, action, rng = Math.random) {
  const b = match.ball;
  const dx = action.targetX - b.x, dy = action.targetY - b.y;
  const d = Math.hypot(dx, dy) || 1;
  const kicker = b.ownerId !== null ? match.players[b.ownerId] : null;
  const speed = action.type === 'shoot'
    ? SHOT_SPEED * (kicker ? shotPowerFactor(kicker) : 1) : passSpeed(d);
  if (b.ownerId !== null) b.lastSide = match.players[b.ownerId].side;
  b.kickerId = b.ownerId;
  b.sinceKick = 0;
  b.targetId = action.type === 'pass' ? action.targetId ?? null : null;
  b.dribbleTarget = null;
  b.vx = (dx / d) * speed;
  b.vy = (dy / d) * speed;
  // shots rise a little, long passes are chipped over the defence
  if (action.type === 'shoot') b.vz = 3 + rng() * 5;
  else if (d > LOFT_PASS_DIST) b.vz = Math.min(MAX_LOFT_VZ, 4 + d * 0.2 + rng() * 2);
  else b.vz = 0;
  b.z = b.z || 0;
  b.ownerId = null;
}

// Advances the ball; returns the vertical impact speed when it bounces this
// step (for sound), otherwise 0.
export function stepBall(match, dt) {
  const b = match.ball;
  if (b.ownerId !== null) {
    const p = match.players[b.ownerId];
    const dir = match.attackDir[p.side];
    b.x = clamp(p.x + dir * 1.5, 0, PITCH.w);   // ball just ahead of owner
    b.y = p.y; b.vx = 0; b.vy = 0; b.z = 0; b.vz = 0;
    b.holdTime = (b.holdTime || 0) + dt;
    return 0;
  }
  let bounce = 0;
  b.sinceKick = (b.sinceKick ?? 0) + dt;
  b.z = b.z || 0; b.vz = b.vz || 0;
  if (b.z > 0 || b.vz > 0) {
    b.vz -= GRAVITY * dt;
    b.z += b.vz * dt;
    if (b.z <= 0) {
      bounce = -b.vz;
      b.z = 0;
      b.vz = bounce * BALL_BOUNCE;
      if (b.vz < 1.5) b.vz = 0;
    }
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
  return bounce;
}

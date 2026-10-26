// js/view3d/figures.js
// Low-poly footballer and ball meshes (uses the global THREE from index.html).
import { gaitPose, kickPose, keeperPose, feintPose, stumblePose, KICK_TIME } from './gait.js';
import { FEINT_TIME, STUN_TIME } from '../constants.js';

const SKIN = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0xa1665e];
const HAIR = [0x1b1b1b, 0x3b2a1a, 0x6b4423, 0x111111, 0xa67b5b];
export const FIGURE_SCALE = 1.6;   // players drawn a bit larger than life so they read on screen

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.05, ...opts });

function shade(hex, f) {
  const c = new THREE.Color(hex);
  return c.multiplyScalar(f);
}

function numberTexture(num, bg, fg) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = fg;
  ctx.font = 'bold 40px Arial, sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(String(num), 32, 35);
  return new THREE.CanvasTexture(c);
}

// shared geometries: one set for all 22 players
let GEO = null;
function geometries() {
  if (GEO) return GEO;
  const cyl = (rt, rb, h, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);
  const sph = (r, w = 12, h = 10) => new THREE.SphereGeometry(r, w, h);
  GEO = {
    torso: cyl(0.23, 0.18, 0.56, 14),          // shoulders taper to the waist
    shorts: cyl(0.19, 0.2, 0.22, 14),
    shortsLeg: cyl(0.1, 0.1, 0.2),
    thigh: cyl(0.08, 0.06, 0.42),
    knee: sph(0.062, 8, 6),
    shin: cyl(0.062, 0.045, 0.42),
    boot: new THREE.BoxGeometry(0.1, 0.08, 0.25),
    deltoid: sph(0.08, 10, 8),
    sleeve: cyl(0.068, 0.062, 0.16),
    upperArm: cyl(0.052, 0.046, 0.28),
    forearm: cyl(0.045, 0.037, 0.25),
    hand: sph(0.045, 8, 6),
    neck: cyl(0.05, 0.055, 0.1),
    head: sph(0.12, 14, 12),
    hair: new THREE.SphereGeometry(0.126, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    number: new THREE.PlaneGeometry(0.26, 0.26),
  };
  return GEO;
}

// A jointed footballer whose feet are at the group origin, facing +z.
//   group → hips (bob) → legs (hip → knee) and torso (lean/twist) → arms (shoulder → elbow), head
export function createPlayer({ num, kit, text, gk }) {
  const G = geometries();
  const shirt = gk ?? kit;
  const skin = mat(SKIN[num % SKIN.length], { roughness: 0.75 });
  const kitMat = mat(shirt);
  const shortsMat = mat(shade(shirt, 0.55));
  const sockMat = mat(shirt);
  const bootMat = mat(0x111111, { roughness: 0.35 });
  const mesh = (geo, m, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    return o;
  };

  const g = new THREE.Group();
  const hips = new THREE.Group();
  g.add(hips);
  const shorts = mesh(G.shorts, shortsMat, 0, 0.98);
  shorts.scale.z = 0.7;
  hips.add(shorts);

  const leg = (x) => {
    const hip = new THREE.Group();
    hip.position.set(x, 0.92, 0);
    hip.add(mesh(G.shortsLeg, shortsMat, 0, -0.06), mesh(G.thigh, skin, 0, -0.23));
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    knee.add(mesh(G.knee, skin), mesh(G.shin, sockMat, 0, -0.21), mesh(G.boot, bootMat, 0, -0.45, 0.05));
    hip.add(knee);
    hips.add(hip);
    return { hip, knee };
  };
  const L = leg(-0.1), R = leg(0.1);

  const torso = new THREE.Group();            // pivots at the waist
  torso.position.y = 1.0;
  hips.add(torso);
  const chest = mesh(G.torso, kitMat, 0, 0.32);
  chest.scale.z = 0.62;
  const back = new THREE.Mesh(G.number,
    new THREE.MeshStandardMaterial({ map: numberTexture(num, '#' + new THREE.Color(shirt).getHexString(), text), roughness: 0.7 }));
  back.position.set(0, 0.36, -0.15);
  back.rotation.y = Math.PI;
  const hair = mesh(G.hair, mat(HAIR[(num * 7) % HAIR.length], { roughness: 0.9 }), 0, 0.8, -0.01);
  hair.rotation.x = -0.3;
  torso.add(chest, back, mesh(G.neck, skin, 0, 0.62), mesh(G.head, skin, 0, 0.78), hair);

  const arm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.25, 0.54, 0);
    shoulder.add(mesh(G.deltoid, kitMat), mesh(G.sleeve, kitMat, 0, -0.07), mesh(G.upperArm, skin, 0, -0.16));
    const elbow = new THREE.Group();
    elbow.position.y = -0.3;
    elbow.add(mesh(G.forearm, skin, 0, -0.125), mesh(G.hand, skin, 0, -0.27));
    shoulder.add(elbow);
    torso.add(shoulder);
    return { shoulder, elbow, side };
  };
  const AL = arm(-1), AR = arm(1);

  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.scale.setScalar(FIGURE_SCALE);
  return { group: g, hips, torso, L, R, AL, AR, isGK: !!gk, phase: Math.random() * 10, yaw: 0, kickT: -1, recover: null };
}

const lerp = (a, b, k) => a + (b - a) * k;
const KICK_RECOVER = 0.15;   // sec to blend from the follow-through back into running

// pose the rig: running cycle, keeper stance when set, kick on top; `speed`
// is the fraction of top speed
// `skill` carries the match state for feints: { feintT, feintSide, stunT, stunSide }
export function animatePlayer(fig, speed, dt, faceX, faceZ, skill = {}) {
  fig.phase += dt * (4.5 + speed * 8);
  const p = gaitPose(fig.phase, speed);
  let { hipL, hipR, kneeL, kneeR, shoulderL, shoulderR, elbow } = p;
  let armOut = 0.1 + 0.05 * speed;

  if (fig.isGK && speed < 0.2) {                       // ready position
    const k = keeperPose(), w = 1 - speed / 0.2;
    hipL = lerp(hipL, k.hip, w); hipR = lerp(hipR, k.hip, w);
    kneeL = lerp(kneeL, k.knee, w); kneeR = lerp(kneeR, k.knee, w);
    shoulderL = lerp(shoulderL, k.shoulder, w); shoulderR = lerp(shoulderR, k.shoulder, w);
    elbow = lerp(elbow, k.elbow, w); armOut = lerp(armOut, k.armOut, w);
  }
  if (fig.kickT >= 0) {                                // right-footed strike
    fig.kickT += dt / KICK_TIME;
    const k = kickPose(Math.min(fig.kickT, 1));
    if (fig.kickT >= 1) {
      fig.kickT = -1;
      fig.recover = { hip: k.hip, knee: k.knee, w: 1 };  // ease back into the stride
    } else {
      hipR = k.hip; kneeR = k.knee; armOut = k.armOut;
      hipL = -0.1; kneeL = 0.25;                       // standing leg plants
    }
  }
  if (fig.recover && fig.kickT < 0) {
    const r = fig.recover;
    r.w -= dt / KICK_RECOVER;
    if (r.w <= 0) fig.recover = null;
    else { hipR = lerp(hipR, r.hip, r.w); kneeR = lerp(kneeR, r.knee, r.w); }
  }

  fig.L.hip.rotation.x = hipL; fig.L.knee.rotation.x = kneeL;
  fig.R.hip.rotation.x = hipR; fig.R.knee.rotation.x = kneeR;
  for (const [a, sh] of [[fig.AL, shoulderL], [fig.AR, shoulderR]]) {
    a.shoulder.rotation.x = sh;
    a.shoulder.rotation.z = a.side * armOut;           // arms clear of the body
    a.elbow.rotation.x = elbow;
  }
  let sway = 0, stepOver = 0;
  if (skill.feintT > 0) {                              // the fake: dip, step over, go
    const f = feintPose(1 - skill.feintT / FEINT_TIME, skill.feintSide);
    sway = f.lean; stepOver = f.stepOver;
  }
  if (skill.stunT > 0) {                               // bought the dummy
    const s = stumblePose(1 - skill.stunT / STUN_TIME, skill.stunSide);
    sway = s.lean;
    fig.L.knee.rotation.x += s.knee; fig.R.knee.rotation.x += s.knee;
  }
  // step-over: the foot circles over the ball on the fake side
  const over = skill.feintSide > 0 ? fig.R : fig.L;
  over.hip.rotation.z = -(skill.feintSide || 0) * stepOver;
  (over === fig.R ? fig.L : fig.R).hip.rotation.z = 0;

  fig.hips.position.y = p.bob;
  fig.torso.rotation.x = p.lean;
  fig.torso.rotation.y = p.twist;
  fig.torso.rotation.z = sway;

  // turn toward where the player is looking (the match logic decides that)
  if (Math.hypot(faceX, faceZ) > 1e-3) {
    const want = Math.atan2(faceX, faceZ);
    let d = want - fig.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    fig.yaw += d * (1 - Math.exp(-10 * dt));
    fig.group.rotation.y = fig.yaw;
  }
}

function ballTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f7f7f7'; ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = '#151515';
  const pent = (x, y, r) => {
    ctx.beginPath();
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + k * Math.PI * 2 / 5;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.fill();
  };
  // equirectangular layout: poles stretched wider
  for (let i = 0; i < 5; i++) pent(51 + i * 102, 128, 26);
  for (let i = 0; i < 5; i++) { pent(i * 102, 52, 22); pent(i * 102 + 102, 52, 22); }
  for (let i = 0; i < 5; i++) { pent(i * 102, 204, 22); pent(i * 102 + 102, 204, 22); }
  ctx.fillRect(0, 0, 512, 14); ctx.fillRect(0, 242, 512, 14);
  return new THREE.CanvasTexture(c);
}

export const BALL_RADIUS = 0.24;   // ~2× real size for readability

export function createBall() {
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 24, 16),
    new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.45 }));
  ball.castShadow = true;
  return ball;
}

// roll the ball by the distance it moved over the ground
const AXIS = new THREE.Vector3(), Q = new THREE.Quaternion();
export function rollBall(mesh, dx, dz) {
  const d = Math.hypot(dx, dz);
  if (d < 1e-5) return;
  AXIS.set(dz / d, 0, -dx / d);
  Q.setFromAxisAngle(AXIS, d / BALL_RADIUS);
  mesh.quaternion.premultiply(Q);
}

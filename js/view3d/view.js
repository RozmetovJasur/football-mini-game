// js/view3d/view.js
// Three.js renderer for the match. Sits underneath Phaser's transparent
// canvas (which keeps drawing the HUD) and mirrors its size and position.
import { PLAYER_SPEED } from '../constants.js';
import { toWorld, cameraShot, followCamera } from '../camera3d.js';
import { buildStadium } from './stadium.js';
import { createPlayer, animatePlayer, createBall, rollBall, BALL_RADIUS, FIGURE_SCALE } from './figures.js';
import { detectKick, KICK_CONTACT } from './gait.js';

const VIEW_W = 1280, VIEW_H = 720;
export const HEAD_HEIGHT = 2.05 * FIGURE_SCALE;   // world height just above a player's head

class View3D {
  constructor(host) {
    this.host = host;
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(VIEW_W, VIEW_H, false);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // colours are authored as plain hex values, so no sRGB/tone-mapping pass
    const el = this.renderer.domElement;
    el.style.position = 'absolute';
    el.style.zIndex = '0';
    host.prepend(el);

    this.camera = new THREE.PerspectiveCamera(38, VIEW_W / VIEW_H, 0.5, 500);
    this.scene = null;
    this.players = [];
    this.cam = null;
    this.shakeTime = 0;
    this.celebrateTime = 0;
    this.time = 0;
  }

  // (re)build the stadium for a new match; `kits` = { A, B } colour sets
  setMatch(players, kits) {
    if (this.scene) disposeScene(this.scene);
    this.scene = new THREE.Scene();
    const fans = [kits.A.kit, kits.A.text, kits.B.kit, kits.B.text, '#ffffff', '#20232a', '#8d99ae'];
    this.stands = buildStadium(this.scene, this.renderer, fans);

    this.players = players.map((p) => {
      const kit = kits[p.side];
      const fig = createPlayer({ num: p.num, kit: kit.kit, text: kit.text, gk: p.isGK ? kit.gk : undefined });
      this.scene.add(fig.group);
      return fig;
    });
    this.ball = createBall();
    this.scene.add(this.ball);
    this.lastBall = null;
    this.prevBall = null;

    // soft yellow ring under the player on the ball
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.75, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd700, transparent: true, opacity: 0.75, depthWrite: false }));
    this.ring.rotation.x = -Math.PI / 2;
    this.scene.add(this.ring);
    this.cam = null;
  }

  setVisible(on) { this.renderer.domElement.style.display = on ? 'block' : 'none'; }

  shake(seconds = 0.5) { this.shakeTime = seconds; }
  celebrate(seconds = 3) { this.celebrateTime = seconds; }

  // keep our canvas exactly under Phaser's (Phaser scales/centres its own)
  syncTo(canvas) {
    const r = canvas.getBoundingClientRect(), h = this.host.getBoundingClientRect();
    const s = this.renderer.domElement.style;
    s.left = `${r.left - h.left}px`; s.top = `${r.top - h.top}px`;
    s.width = `${r.width}px`; s.height = `${r.height}px`;
  }

  // players / ball in pitch coordinates; mode = broadcast | replay | goal
  update(players, ball, carrier, dt, mode) {
    this.time += dt;
    const bw = toWorld(ball.x, ball.y, ball.z || 0);

    // the striker's leg follows through whenever the ball is struck (live or replay)
    if (this.prevBall) {
      const kicker = detectKick(players, this.prevBall, ball);
      if (kicker !== null) this.players[kicker].kickT = KICK_CONTACT;   // ball already left: follow through
    }
    this.prevBall = { x: ball.x, y: ball.y, vx: ball.vx || 0, vy: ball.vy || 0 };

    players.forEach((p, i) => {
      const fig = this.players[i];
      const w = toWorld(p.x, p.y);
      fig.group.position.set(w.x, 0, w.z);
      const speed = Math.hypot(p.vx || 0, p.vy || 0) / PLAYER_SPEED;
      // pitch y maps to world z, so facing (x, y) is the world (x, z) direction
      const fx = p.fx ?? p.facing?.x ?? 1, fy = p.fy ?? p.facing?.y ?? 0;
      animatePlayer(fig, speed, dt, fx, fy, p);
    });

    this.ball.position.set(bw.x, BALL_RADIUS + bw.y, bw.z);
    if (this.lastBall) rollBall(this.ball, bw.x - this.lastBall.x, bw.z - this.lastBall.z);
    this.lastBall = bw;

    this.ring.visible = carrier !== null && carrier !== undefined;
    if (this.ring.visible) {
      const c = toWorld(players[carrier].x, players[carrier].y);
      this.ring.position.set(c.x, 0.03, c.z);
    }

    this.animateCrowd(dt);

    const shot = cameraShot(mode, ball);
    if (!this.cam || this.lastMode !== mode) {
      // cut, as TV does, when the shot type changes
      this.cam = { pos: { ...shot.pos }, look: { ...shot.look } };
    } else {
      followCamera(this.cam, shot, dt, mode === 'replay' ? 4 : 2.5);
    }
    this.lastMode = mode;
    const { pos, look } = this.cam;
    let jx = 0, jy = 0;
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const a = Math.min(1, this.shakeTime * 2) * 0.6;
      jx = (Math.random() - 0.5) * a; jy = (Math.random() - 0.5) * a;
    }
    this.camera.position.set(pos.x + jx, pos.y + jy, pos.z);
    this.camera.lookAt(look.x, look.y, look.z);
    this.renderer.render(this.scene, this.camera);
  }

  // fans bounce while celebrating, otherwise a gentle sway
  animateCrowd(dt) {
    const { crowd, seats, phases } = this.stands;
    const jumping = this.celebrateTime > 0;
    if (jumping) this.celebrateTime -= dt;
    // idle sway only needs an occasional refresh
    if (!jumping && Math.floor(this.time * 8) === Math.floor((this.time - dt) * 8)) return;
    const m = new THREE.Matrix4();
    const amp = jumping ? 0.35 : 0.04;
    const freq = jumping ? 11 : 2;
    for (let i = 0; i < seats.length; i++) {
      const s = seats[i];
      m.makeTranslation(s.x, s.y + Math.max(0, Math.sin(this.time * freq + phases[i])) * amp, s.z);
      crowd.setMatrixAt(i, m);
    }
    crowd.instanceMatrix.needsUpdate = true;
  }

  // pitch point → Phaser game coordinates (1280×720); null if behind the camera
  project(x, y, z = 0) {
    const w = toWorld(x, y, z);
    const v = new THREE.Vector3(w.x, w.y, w.z).project(this.camera);
    if (v.z > 1) return null;
    return { x: (v.x + 1) / 2 * VIEW_W, y: (1 - v.y) / 2 * VIEW_H };
  }
}

function disposeScene(scene) {
  scene.traverse((o) => {
    o.geometry?.dispose();
    for (const m of [].concat(o.material ?? [])) {
      m.map?.dispose();
      m.emissiveMap?.dispose();
      m.dispose();
    }
  });
}

let view = null;
// one renderer (and WebGL context) for the whole session
export function getView(host) {
  if (!view) view = new View3D(host);
  return view;
}

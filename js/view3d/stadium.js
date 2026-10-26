// js/view3d/stadium.js
// Night-match stadium: striped pitch with markings, goals with nets, ad
// boards, three stands packed with fans, a roof and four floodlight towers.
import { PITCH, GOAL_HALF_HEIGHT } from '../constants.js';

const W = PITCH.w, H = PITCH.h;
const PX = 20;                       // pitch texture pixels per metre
const GOAL_H = 2.44, GOAL_D = 2;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function pitchTexture(renderer) {
  const [c, ctx] = canvas(W * PX, H * PX);
  const stripes = 14;
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 ? '#245f28' : '#2c6d30';
    ctx.fillRect(Math.floor(i * c.width / stripes), 0, Math.ceil(c.width / stripes) + 1, c.height);
  }
  // grain so the grass doesn't look like flat plastic
  for (let i = 0; i < 26000; i++) {
    ctx.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
    ctx.fillRect(Math.random() * c.width, Math.random() * c.height, 2, 2);
  }
  const m = (v) => v * PX;
  ctx.strokeStyle = 'rgba(255,255,255,0.92)';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.lineWidth = 3;
  const rect = (x, y, w, h) => ctx.strokeRect(m(x), m(y), m(w), m(h));
  const arc = (x, y, r, a0 = 0, a1 = Math.PI * 2) => { ctx.beginPath(); ctx.arc(m(x), m(y), m(r), a0, a1); ctx.stroke(); };
  const spot = (x, y) => { ctx.beginPath(); ctx.arc(m(x), m(y), 4, 0, Math.PI * 2); ctx.fill(); };
  rect(0.1, 0.1, W - 0.2, H - 0.2);
  ctx.beginPath(); ctx.moveTo(m(W / 2), 0); ctx.lineTo(m(W / 2), c.height); ctx.stroke();
  arc(W / 2, H / 2, 9.15); spot(W / 2, H / 2);
  for (const [x0, dir] of [[0, 1], [W, -1]]) {
    rect(dir > 0 ? x0 : x0 - 16.5, H / 2 - 20.16, 16.5, 40.32);
    rect(dir > 0 ? x0 : x0 - 5.5, H / 2 - 9.16, 5.5, 18.32);
    spot(x0 + dir * 11, H / 2);
    const a = Math.acos(5.5 / 9.15);
    if (dir > 0) arc(11, H / 2, 9.15, -a, a); else arc(W - 11, H / 2, 9.15, Math.PI - a, Math.PI + a);
  }
  for (const [x, y, a0] of [[0, 0, 0], [W, 0, Math.PI / 2], [W, H, Math.PI], [0, H, -Math.PI / 2]]) arc(x, y, 1, a0, a0 + Math.PI / 2);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

function netTexture() {
  const [c, ctx] = canvas(64, 64);
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 4);
  return t;
}

function boardTexture() {
  const [c, ctx] = canvas(2048, 64);
  const panels = [['#1d3557', 'FUTBOL SIM'], ['#e63946', '3D'], ['#f1faee', 'GOAL!'], ['#2a9d8f', 'PLAY'], ['#ffb703', 'FOOTBALL']];
  const pw = 2048 / 8;
  for (let i = 0; i < 8; i++) {
    const [bg, label] = panels[i % panels.length];
    ctx.fillStyle = bg; ctx.fillRect(i * pw, 0, pw, 64);
    ctx.fillStyle = bg === '#f1faee' || bg === '#ffb703' ? '#1d3557' : '#ffffff';
    ctx.font = 'bold 36px Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, i * pw + pw / 2, 34);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function glowTexture() {
  const [c, ctx] = canvas(128, 128);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,240,1)');
  g.addColorStop(0.25, 'rgba(255,255,220,0.55)');
  g.addColorStop(1, 'rgba(255,255,200,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

function buildGoal(scene, side) {
  const x = side * W / 2;
  const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.2 });
  const r = 0.07;
  const post = (z) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, GOAL_H, 12), postMat);
    m.position.set(x, GOAL_H / 2, z);
    m.castShadow = true;
    scene.add(m);
  };
  post(-GOAL_HALF_HEIGHT); post(GOAL_HALF_HEIGHT);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(r, r, GOAL_HALF_HEIGHT * 2 + r * 2, 12), postMat);
  bar.rotation.x = Math.PI / 2;
  bar.position.set(x, GOAL_H, 0);
  bar.castShadow = true;
  scene.add(bar);

  // net: open-fronted box behind the goal line
  const net = new THREE.MeshStandardMaterial({
    map: netTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 1,
  });
  const none = new THREE.MeshBasicMaterial({ visible: false });
  // BoxGeometry faces: +x, -x, +y, -y, +z, -z — the front faces the pitch
  const faces = side > 0 ? [net, none, net, none, net, net] : [none, net, net, none, net, net];
  const box = new THREE.Mesh(new THREE.BoxGeometry(GOAL_D, GOAL_H, GOAL_HALF_HEIGHT * 2), faces);
  box.position.set(x + side * GOAL_D / 2, GOAL_H / 2, 0);
  scene.add(box);
}

// stepped concrete tiers with fans; returns the instanced crowd
function buildStands(scene, fanColors) {
  const ROWS = 12, STEP_D = 0.9, STEP_H = 0.6, GAP = 7;
  const concrete = new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.95 });
  const seats = [];
  // each stand: centre, length along it, outward direction (unit x/z)
  const stands = [
    { len: W + 30, out: [0, -1], dist: H / 2 + GAP },     // far side
    { len: H + 14, out: [-1, 0], dist: W / 2 + GAP + 2 }, // left end
    { len: H + 14, out: [1, 0], dist: W / 2 + GAP + 2 },  // right end
  ];
  for (const s of stands) {
    const [ox, oz] = s.out;
    const along = ox === 0 ? [1, 0] : [0, 1];
    for (let r = 0; r < ROWS; r++) {
      const d = s.dist + r * STEP_D;
      const y = 1 + r * STEP_H;
      const step = new THREE.Mesh(new THREE.BoxGeometry(
        along[0] ? s.len : STEP_D, y, along[1] ? s.len + r * 2 * STEP_D : STEP_D), concrete);
      step.position.set(ox * (d + STEP_D / 2), y / 2, oz * (d + STEP_D / 2));
      step.receiveShadow = true;
      scene.add(step);
      for (let t = -s.len / 2 + 0.4; t < s.len / 2; t += 0.62) {
        if (Math.random() < 0.12) continue;            // a few empty seats
        seats.push({
          x: ox * (d + STEP_D / 2) + along[0] * t,
          y: y + 0.45,
          z: oz * (d + STEP_D / 2) + along[1] * t,
        });
      }
    }
    // roof over the stand
    const roofD = ROWS * STEP_D + 4;
    const roof = new THREE.Mesh(new THREE.BoxGeometry(along[0] ? s.len + 4 : roofD, 0.4, along[1] ? s.len + 4 : roofD),
      new THREE.MeshStandardMaterial({ color: 0x1c2029, roughness: 0.8 }));
    roof.position.set(ox * (s.dist + roofD / 2 - 1), ROWS * STEP_H + 7, oz * (s.dist + roofD / 2 - 1));
    roof.rotation.set(oz ? -oz * 0.08 : 0, 0, ox ? ox * 0.08 : 0);
    scene.add(roof);
  }

  const fan = new THREE.BoxGeometry(0.42, 0.8, 0.32);
  const crowd = new THREE.InstancedMesh(fan, new THREE.MeshLambertMaterial(), seats.length);
  const m = new THREE.Matrix4(), col = new THREE.Color();
  seats.forEach((p, i) => {
    m.makeTranslation(p.x, p.y, p.z);
    crowd.setMatrixAt(i, m);
    col.set(fanColors[Math.floor(Math.random() * fanColors.length)]);
    col.multiplyScalar(0.75 + Math.random() * 0.35);
    crowd.setColorAt(i, col);
  });
  crowd.instanceMatrix.needsUpdate = true;
  scene.add(crowd);
  return { crowd, seats, phases: seats.map(() => Math.random() * Math.PI * 2) };
}

function buildFloodlights(scene) {
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x8a919e, metalness: 0.6, roughness: 0.4 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfffbe6, emissiveIntensity: 1.5 });
  const glow = glowTexture();
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const x = sx * (W / 2 + 18), z = sz * (H / 2 + 16);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 36, 10), poleMat);
    pole.position.set(x, 18, z);
    scene.add(pole);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(7, 3.5, 0.6), lampMat);
    lamp.position.set(x, 37, z);
    lamp.lookAt(0, 0, 0);
    scene.add(lamp);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glow, color: 0xffffee, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    halo.scale.set(26, 26, 1);
    halo.position.set(x, 37, z);
    scene.add(halo);
  }
}

function buildLights(scene) {
  scene.add(new THREE.HemisphereLight(0xb8c8ff, 0x1d3320, 0.45));
  const key = new THREE.DirectionalLight(0xffffff, 0.95);
  key.position.set(35, 70, 30);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera;
  sc.left = -75; sc.right = 75; sc.top = 55; sc.bottom = -55; sc.near = 10; sc.far = 200;
  key.shadow.bias = -0.0005;
  scene.add(key);
  // second floodlight bank from the other side, no shadow: softens the contrast
  const fill = new THREE.DirectionalLight(0xdfe8ff, 0.3);
  fill.position.set(-40, 60, -35);
  scene.add(fill);
}

export function buildStadium(scene, renderer, fanColors) {
  scene.background = new THREE.Color(0x070b14);
  scene.fog = new THREE.Fog(0x070b14, 140, 300);
  buildLights(scene);

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ color: 0x14181f, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  scene.add(ground);

  const apron = new THREE.Mesh(new THREE.PlaneGeometry(W + 14, H + 12), new THREE.MeshStandardMaterial({ color: 0x1f5523, roughness: 0.95 }));
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.02;
  apron.receiveShadow = true;
  scene.add(apron);

  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(W, H),
    new THREE.MeshStandardMaterial({ map: pitchTexture(renderer), roughness: 0.92 }));
  pitch.rotation.x = -Math.PI / 2;
  pitch.receiveShadow = true;
  scene.add(pitch);

  buildGoal(scene, -1);
  buildGoal(scene, 1);

  // advertising boards around the pitch
  const boards = boardTexture();
  const boardRun = (len, x, z, rotY) => {
    const t = boards.clone();
    t.needsUpdate = true;
    t.repeat.set(len / 60, 1);
    const b = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, 0.15),
      [null, null, null, null, null, null].map((_, i) => (i === 4 || i === 5)
        ? new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.35 })
        : new THREE.MeshStandardMaterial({ color: 0x111111 })));
    b.position.set(x, 0.45, z);
    b.rotation.y = rotY;
    b.castShadow = true;
    scene.add(b);
  };
  boardRun(W + 8, 0, -(H / 2 + 4), 0);
  boardRun(H + 4, -(W / 2 + 5), 0, Math.PI / 2);
  boardRun(H + 4, W / 2 + 5, 0, Math.PI / 2);

  const stands = buildStands(scene, fanColors);
  buildFloodlights(scene);
  return stands;
}

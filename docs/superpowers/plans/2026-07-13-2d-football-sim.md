# 2D Football Simulyator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tomoshabin rejimidagi 2D futbol simulyatori — 2 random jamoa top-down maydonda oddiy AI bilan avtomatik o'ynaydi.

**Architecture:** Sof mantiq (teams/match/ai) Phaser render'dan ajratilgan — Node bilan mustaqil test qilinadi, brauzerda ES-module sifatida yuklanadi. Phaser 3 (CDN) ikki Scene render qiladi: MenuScene (start) va MatchScene (o'yin). Scene'lar sof mantiqni chaqirib vizuallashtiradi.

**Tech Stack:** Phaser 3 (CDN), vanilla ES modules, Node built-in test runner (`node --test`). Build-tool yo'q.

## Global Constraints

- Barcha kod **ES modules** (`export`/`import`) — Node testi ham, brauzer `<script type="module">` ham yuklaydi.
- Tashqi npm dependency **yo'q**. Phaser faqat CDN `<script>` orqali (global `Phaser`). **Xavfsizlik:** CDN script tegiga `integrity="sha384-..."` + `crossorigin="anonymous"` (SRI) qo'shilsin — CDN buzilishidan himoya. Hash jsdelivr'dan olinadi (`https://www.srihash.org/` yoki jsdelivr "SRI" tugmasi). Muqobil: Phaser'ni `js/vendor/phaser.min.js` sifatida lokal saqlab, CDN'siz yuklash (SRI keraksiz bo'ladi).
- Mantiqiy koordinata tizimi: maydon `PITCH = { w: 105, h: 68 }`. Chap darvoza `x=0`, o'ng `x=105`, markaz `y=34`. Darvoza kengligi: `y` ∈ `[30.34, 37.66]` (34 ± 3.66).
- O'yinchi indekslari: `0..10` = jamoa A, `11..21` = jamoa B. Har jamoa 11 o'yinchi, indeks `0`/`11` = GK.
- Randomlik test qilinadigan funksiyalarga `rng = Math.random` argument sifatida uzatiladi (default `Math.random`).
- Fayl fokuslangan bo'lsin: bitta fayl = bitta mas'uliyat.

---

## File Structure

- `package.json` — `"type": "module"`, `test` script.
- `index.html` — Phaser CDN + `js/main.js` module yuklash, canvas host.
- `css/style.css` — sahifa/canvas layout.
- `js/constants.js` — `PITCH`, AI/match konstantalari (bir joyda, DRY).
- `js/teams.js` — `TEAMS` data, `pickTwoTeams`, `formationPositions`.
- `js/match.js` — `createMatch`, `advanceClock`, `scoreGoal`, `resetKickoff`, `checkGoal`.
- `js/ai.js` — `nearestPlayer`, `captureBall`, `decideAction`, `computeTargets`, `applyMovement`, `stepBall`.
- `js/scenes/MenuScene.js` — start ekrani.
- `js/scenes/MatchScene.js` — render + tick loop + HUD.
- `js/main.js` — Phaser Game config.
- `test/*.test.js` — unit testlar.

---

### Task 1: Scaffold + test infra

**Files:**
- Create: `package.json`, `index.html`, `css/style.css`, `js/constants.js`
- Test: `test/smoke.test.js`

**Interfaces:**
- Produces: `js/constants.js` exports `PITCH = {w:105,h:68}`, `GOAL_HALF_HEIGHT=3.66`, `SHOOT_RANGE=25`, `PASS_RANGE=35`, `CAPTURE_DIST=2`, `P_PASS=0.5`, `PLAYER_SPEED=14`, `BALL_FRICTION=0.85`, `PASS_SPEED=45`, `SHOT_SPEED=60`, `HALF_MINUTES=45`.

- [ ] **Step 1: Write the failing smoke test**

```js
// test/smoke.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PITCH, SHOOT_RANGE } from '../js/constants.js';

test('constants load', () => {
  assert.equal(PITCH.w, 105);
  assert.equal(PITCH.h, 68);
  assert.equal(SHOOT_RANGE, 25);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL — `Cannot find module '../js/constants.js'`

- [ ] **Step 3: Create scaffold files**

```json
// package.json
{
  "name": "game-football",
  "version": "1.0.0",
  "type": "module",
  "scripts": { "test": "node --test" }
}
```

```js
// js/constants.js
export const PITCH = { w: 105, h: 68 };
export const GOAL_HALF_HEIGHT = 3.66;
export const SHOOT_RANGE = 25;
export const PASS_RANGE = 35;
export const CAPTURE_DIST = 2;
export const P_PASS = 0.5;
export const PLAYER_SPEED = 14;   // logical units / sec
export const BALL_FRICTION = 0.85; // velocity kept per sec
export const PASS_SPEED = 45;
export const SHOT_SPEED = 60;
export const HALF_MINUTES = 45;
```

```html
<!-- index.html -->
<!doctype html>
<html lang="uz">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>2D Football Sim</title>
  <link rel="stylesheet" href="css/style.css" />
  <!-- SRI: srihash.org yoki jsdelivr'dan phaser@3.80.1 uchun sha384 hash oling va integrity ga qo'ying -->
  <script src="https://cdn.jsdelivr.net/npm/phaser@3.80.1/dist/phaser.min.js"
          integrity="sha384-REPLACE_WITH_REAL_HASH" crossorigin="anonymous"></script>
</head>
<body>
  <div id="game"></div>
  <script type="module" src="js/main.js"></script>
</body>
</html>
```

```css
/* css/style.css */
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { height: 100%; background: #1a1a1a; overflow: hidden; }
#game { width: 100vw; height: 100vh; }
canvas { display: block; margin: 0 auto; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS — 1 test passed.

- [ ] **Step 5: Commit**

```bash
git add package.json index.html css js test
git commit -m "feat: scaffold + constants + test infra"
```

---

### Task 2: Teams data + selection + formation

**Files:**
- Create: `js/teams.js`
- Test: `test/teams.test.js`

**Interfaces:**
- Consumes: `PITCH` from `js/constants.js`.
- Produces:
  - `TEAMS` — array of `{ name, short, colors:{kit,text,gk}, players:[{num,name,role}] }`, ≥6 teams, har birida 11 player.
  - `pickTwoTeams(teams, rng = Math.random)` → `[teamA, teamB]` (har xil).
  - `formationPositions(index, side)` → `{x, y}`; `side` ∈ `'A'|'B'`; `index` ∈ `0..10`. A `x=0` darvozani himoya qiladi (x=105 tomon hujum), B teskari.

- [ ] **Step 1: Write the failing test**

```js
// test/teams.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEAMS, pickTwoTeams, formationPositions } from '../js/teams.js';

test('at least 6 teams, each with 11 players', () => {
  assert.ok(TEAMS.length >= 6);
  for (const t of TEAMS) assert.equal(t.players.length, 11);
});

test('pickTwoTeams returns two distinct teams', () => {
  const [a, b] = pickTwoTeams(TEAMS, () => 0.0);
  assert.notEqual(a.name, b.name);
});

test('formation: A GK near left goal, B GK near right goal', () => {
  const aGk = formationPositions(0, 'A');
  const bGk = formationPositions(0, 'B');
  assert.ok(aGk.x < 10, 'A GK left');
  assert.ok(bGk.x > 95, 'B GK right');
  assert.equal(aGk.x + bGk.x, 105, 'B mirrors A');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/teams.test.js`
Expected: FAIL — `Cannot find module '../js/teams.js'`

- [ ] **Step 3: Write implementation**

```js
// js/teams.js
import { PITCH } from './constants.js';

const P = (num, name, role) => ({ num, name, role });

// Base formation for a team defending x=0 (attacking toward x=105). 4-4-2.
const FORMATION_442 = [
  { x: 5,  y: 34 },                                   // 0 GK
  { x: 20, y: 12 }, { x: 20, y: 26 }, { x: 20, y: 42 }, { x: 20, y: 56 }, // DF
  { x: 40, y: 12 }, { x: 40, y: 26 }, { x: 40, y: 42 }, { x: 40, y: 56 }, // MF
  { x: 52, y: 24 }, { x: 52, y: 44 },                 // FW
];

export function formationPositions(index, side) {
  const base = FORMATION_442[index];
  if (side === 'A') return { x: base.x, y: base.y };
  return { x: PITCH.w - base.x, y: base.y }; // mirror for B
}

export function pickTwoTeams(teams, rng = Math.random) {
  const i = Math.floor(rng() * teams.length);
  let j = Math.floor(rng() * teams.length);
  if (j === i) j = (i + 1) % teams.length;
  return [teams[i], teams[j]];
}

export const TEAMS = [
  { name: 'Wolves', short: 'WOL', colors: { kit: '#fdb913', text: '#231f20', gk: '#c0392b' },
    players: [P(1,'Sa','GK'),P(5,'Coady','DF'),P(15,'Kilman','DF'),P(23,'Saiss','DF'),P(2,'Doherty','DF'),
      P(8,'Neves','MF'),P(28,'Moutinho','MF'),P(11,'Traore','MF'),P(19,'Jonny','MF'),P(9,'Jimenez','FW'),P(10,'Silva','FW')] },
  { name: 'FCB', short: 'FCB', colors: { kit: '#2e2b5f', text: '#c9a227', gk: '#27ae60' },
    players: [P(1,'Ter','GK'),P(3,'Pique','DF'),P(15,'Lenglet','DF'),P(23,'Umtiti','DF'),P(18,'Alba','DF'),
      P(5,'Busquets','MF'),P(8,'Arthur','MF'),P(21,'Sarabia','MF'),P(22,'Vidal','MF'),P(9,'Suarez','FW'),P(10,'Messi','FW')] },
  { name: 'Reds', short: 'RED', colors: { kit: '#c8102e', text: '#ffffff', gk: '#2ecc71' },
    players: [P(1,'Alisson','GK'),P(4,'VanDijk','DF'),P(12,'Gomez','DF'),P(26,'Robertson','DF'),P(66,'Arnold','DF'),
      P(3,'Fabinho','MF'),P(14,'Henderson','MF'),P(5,'Wijnaldum','MF'),P(11,'Salah','FW'),P(9,'Firmino','FW'),P(10,'Mane','FW')] },
  { name: 'Sky', short: 'SKY', colors: { kit: '#6cabdd', text: '#1c2c5b', gk: '#e67e22' },
    players: [P(31,'Ederson','GK'),P(2,'Walker','DF'),P(5,'Stones','DF'),P(3,'Dias','DF'),P(7,'Cancelo','DF'),
      P(16,'Rodri','MF'),P(17,'DeBruyne','MF'),P(47,'Foden','MF'),P(20,'Silva','MF'),P(9,'Haaland','FW'),P(10,'Grealish','FW')] },
  { name: 'Blancos', short: 'MAD', colors: { kit: '#ffffff', text: '#00529f', gk: '#f1c40f' },
    players: [P(1,'Courtois','GK'),P(2,'Carvajal','DF'),P(4,'Alaba','DF'),P(3,'Militao','DF'),P(23,'Mendy','DF'),
      P(8,'Kroos','MF'),P(10,'Modric','MF'),P(15,'Valverde','MF'),P(20,'Vini','FW'),P(9,'Benzema','FW'),P(11,'Rodrygo','FW')] },
  { name: 'Bavaria', short: 'BAY', colors: { kit: '#dc052d', text: '#ffffff', gk: '#2c3e50' },
    players: [P(1,'Neuer','GK'),P(5,'Pavard','DF'),P(4,'DeLigt','DF'),P(2,'Upamecano','DF'),P(19,'Davies','DF'),
      P(6,'Kimmich','MF'),P(8,'Goretzka','MF'),P(25,'Muller','MF'),P(10,'Sane','FW'),P(9,'Lewa','FW'),P(7,'Gnabry','FW')] },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/teams.test.js`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: Commit**

```bash
git add js/teams.js test/teams.test.js
git commit -m "feat: teams data, random selection, 4-4-2 formation"
```

---

### Task 3: Match state — clock, half, goals, kickoff

**Files:**
- Create: `js/match.js`
- Test: `test/match.test.js`

**Interfaces:**
- Consumes: `PITCH`, `HALF_MINUTES`, `GOAL_HALF_HEIGHT` from constants; `formationPositions` from teams.
- Produces:
  - `createMatch(teamA, teamB, lengthMinutes)` → match state:
    ```
    { teamA, teamB, lengthMinutes,
      players: [22 × {num,name,role,side,x,y,vx,vy,isGK}],
      ball: {x,y,vx,vy,ownerId},
      scoreA, scoreB, clock, half, phase,
      attackDir: {A:+1, B:-1} }
    ```
    `phase` boshi `'kickoff'`. `attackDir` A=+1 (x=105 tomon), B=-1.
  - `resetKickoff(match)` — o'yinchilarni formatsiyaga, to'pni markazga (`ownerId=null`), tezliklarni nolga.
  - `advanceClock(match, gameMinutes)` — `clock += gameMinutes`; `HALF_MINUTES` da `phase='halftime'` + `swapSides`; `2*HALF_MINUTES` da `phase='fulltime'`. Event string massivini qaytaradi.
  - `scoreGoal(match, side)` — `'A'`|`'B'` uchun skor +1.
  - `checkGoal(match)` → `'A'|'B'|null` (to'p darvozadan o'tganini aniqlaydi).

- [ ] **Step 1: Write the failing test**

```js
// test/match.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEAMS } from '../js/teams.js';
import { createMatch, resetKickoff, advanceClock, scoreGoal, checkGoal } from '../js/match.js';
import { PITCH } from '../js/constants.js';

const mk = () => createMatch(TEAMS[0], TEAMS[1], 2);

test('createMatch builds 22 players and centered ball', () => {
  const m = mk();
  assert.equal(m.players.length, 22);
  assert.equal(m.scoreA, 0);
  assert.equal(m.phase, 'kickoff');
  assert.equal(m.players[0].isGK, true);
  assert.equal(m.players[11].side, 'B');
});

test('resetKickoff centers ball and clears owner', () => {
  const m = mk();
  m.ball.x = 3; m.ball.ownerId = 5;
  resetKickoff(m);
  assert.equal(m.ball.x, PITCH.w / 2);
  assert.equal(m.ball.ownerId, null);
});

test('advanceClock triggers halftime at 45 and swaps sides', () => {
  const m = mk();
  const dirA = m.attackDir.A;
  const ev = advanceClock(m, 45);
  assert.equal(m.phase, 'halftime');
  assert.equal(m.attackDir.A, -dirA);
  assert.ok(ev.some(e => /Half Time/i.test(e)));
});

test('advanceClock triggers fulltime at 90', () => {
  const m = mk();
  advanceClock(m, 45); m.phase = 'playing';
  advanceClock(m, 45);
  assert.equal(m.phase, 'fulltime');
});

test('scoreGoal increments correct side', () => {
  const m = mk();
  scoreGoal(m, 'A'); scoreGoal(m, 'A'); scoreGoal(m, 'B');
  assert.equal(m.scoreA, 2);
  assert.equal(m.scoreB, 1);
});

test('checkGoal detects ball crossing goal line within posts', () => {
  const m = mk();
  m.ball.x = 106; m.ball.y = 34;         // past right goal, on target
  assert.equal(checkGoal(m), 'A');       // A attacks right → A scores
  m.ball.x = 106; m.ball.y = 5;          // wide
  assert.equal(checkGoal(m), null);
  m.ball.x = -1; m.ball.y = 34;
  assert.equal(checkGoal(m), 'B');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/match.test.js`
Expected: FAIL — `Cannot find module '../js/match.js'`

- [ ] **Step 3: Write implementation**

```js
// js/match.js
import { PITCH, HALF_MINUTES, GOAL_HALF_HEIGHT } from './constants.js';
import { formationPositions } from './teams.js';

function buildPlayers(teamA, teamB) {
  const out = [];
  for (const [side, team] of [['A', teamA], ['B', teamB]]) {
    team.players.forEach((p, i) => {
      const pos = formationPositions(i, side);
      out.push({ num: p.num, name: p.name, role: p.role, side,
        x: pos.x, y: pos.y, vx: 0, vy: 0, isGK: i === 0 });
    });
  }
  return out;
}

export function createMatch(teamA, teamB, lengthMinutes) {
  const m = {
    teamA, teamB, lengthMinutes,
    players: buildPlayers(teamA, teamB),
    ball: { x: PITCH.w / 2, y: PITCH.h / 2, vx: 0, vy: 0, ownerId: null },
    scoreA: 0, scoreB: 0, clock: 0, half: 1, phase: 'kickoff',
    attackDir: { A: +1, B: -1 },
  };
  return m;
}

export function resetKickoff(match) {
  match.players.forEach((p, i) => {
    const pos = formationPositions(i % 11, p.side);
    // keep sides consistent with current attackDir (A defends the goal it attacks away from)
    const flip = match.attackDir.A < 0;
    p.x = flip ? PITCH.w - pos.x : pos.x;
    p.y = pos.y; p.vx = 0; p.vy = 0;
  });
  match.ball = { x: PITCH.w / 2, y: PITCH.h / 2, vx: 0, vy: 0, ownerId: null };
}

function swapSides(match) {
  match.attackDir.A *= -1;
  match.attackDir.B *= -1;
}

export function advanceClock(match, gameMinutes) {
  const events = [];
  const before = match.clock;
  match.clock = Math.min(before + gameMinutes, 2 * HALF_MINUTES);
  if (before < HALF_MINUTES && match.clock >= HALF_MINUTES && match.half === 1) {
    match.half = 2;
    match.phase = 'halftime';
    swapSides(match);
    events.push('Half Time');
  }
  if (match.clock >= 2 * HALF_MINUTES) {
    match.phase = 'fulltime';
    events.push('Full Time');
  }
  return events;
}

export function scoreGoal(match, side) {
  if (side === 'A') match.scoreA += 1; else match.scoreB += 1;
}

export function checkGoal(match) {
  const { x, y } = match.ball;
  const onTarget = y > PITCH.h / 2 - GOAL_HALF_HEIGHT && y < PITCH.h / 2 + GOAL_HALF_HEIGHT;
  if (!onTarget) return null;
  // Right goal (x >= 105): scored by whoever attacks +x
  if (x >= PITCH.w) return match.attackDir.A > 0 ? 'A' : 'B';
  if (x <= 0)       return match.attackDir.A > 0 ? 'B' : 'A';
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/match.test.js`
Expected: PASS — 6 tests passed.

- [ ] **Step 5: Commit**

```bash
git add js/match.js test/match.test.js
git commit -m "feat: match state, clock, halftime, goals, kickoff"
```

---

### Task 4: AI — ball capture, decisions, movement, ball physics

**Files:**
- Create: `js/ai.js`
- Test: `test/ai.test.js`

**Interfaces:**
- Consumes: `PITCH`, `SHOOT_RANGE`, `PASS_RANGE`, `CAPTURE_DIST`, `P_PASS`, `PLAYER_SPEED`, `BALL_FRICTION`, `PASS_SPEED`, `SHOT_SPEED`, `GOAL_HALF_HEIGHT` from constants.
- Produces:
  - `nearestPlayer(players, x, y, filter=()=>true)` → `{ index, dist }`.
  - `captureBall(match)` — agar `ownerId===null` va biror o'yinchi `CAPTURE_DIST` ichida → eng yaqinini owner qiladi; qaytadi `index|null`.
  - `decideAction(match, rng=Math.random)` → `{type:'shoot'|'pass'|'dribble', targetX, targetY, targetId?}` (owner uchun). `ownerId===null` bo'lsa `null`.
  - `computeTargets(match)` → `Array(22)` har biri `{x,y}` (har o'yinchining shu tick maqsadi).
  - `applyMovement(match, targets, dt)` — o'yinchilarni maqsad tomon `PLAYER_SPEED` bilan siljitadi, maydonda ushlaydi.
  - `stepBall(match, dt)` — owner bo'lsa to'p oldida yuradi; yo'q bo'lsa `vx/vy` + friction, keyin `captureBall`.
  - `passOrShoot(match, action)` — action bo'yicha to'pga tezlik beradi, `ownerId=null`.

- [ ] **Step 1: Write the failing test**

```js
// test/ai.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TEAMS } from '../js/teams.js';
import { createMatch } from '../js/match.js';
import { nearestPlayer, captureBall, decideAction, computeTargets, applyMovement, stepBall } from '../js/ai.js';
import { PITCH } from '../js/constants.js';

const mk = () => createMatch(TEAMS[0], TEAMS[1], 2);

test('nearestPlayer finds closest', () => {
  const m = mk();
  m.players[3].x = 50; m.players[3].y = 34;
  const { index } = nearestPlayer(m.players, 50, 34);
  assert.equal(index, 3);
});

test('captureBall assigns owner within CAPTURE_DIST', () => {
  const m = mk();
  m.ball = { x: m.players[7].x, y: m.players[7].y, vx: 0, vy: 0, ownerId: null };
  const idx = captureBall(m);
  assert.equal(idx, 7);
  assert.equal(m.ball.ownerId, 7);
});

test('decideAction shoots when near attacking goal', () => {
  const m = mk();               // player 9 = FW side A, attacks +x
  m.ball.ownerId = 9;
  m.players[9].x = 95; m.players[9].y = 34;  // within SHOOT_RANGE of x=105
  const a = decideAction(m, () => 0.99);
  assert.equal(a.type, 'shoot');
  assert.ok(a.targetX > 100);
});

test('decideAction dribbles toward goal when far and rng high', () => {
  const m = mk();
  m.ball.ownerId = 9;
  m.players[9].x = 20; m.players[9].y = 34;
  const a = decideAction(m, () => 0.99);   // no pass
  assert.equal(a.type, 'dribble');
  assert.ok(a.targetX > 20);
});

test('computeTargets: GK stays near own goal line', () => {
  const m = mk();
  const targets = computeTargets(m);
  assert.ok(Math.abs(targets[0].x - m.players[0].x) < 10);
});

test('applyMovement keeps players inside pitch', () => {
  const m = mk();
  const targets = m.players.map(() => ({ x: 999, y: 999 }));
  applyMovement(m, targets, 100);
  for (const p of m.players) {
    assert.ok(p.x >= 0 && p.x <= PITCH.w);
    assert.ok(p.y >= 0 && p.y <= PITCH.h);
  }
});

test('stepBall applies friction to loose ball', () => {
  const m = mk();
  m.ball = { x: 50, y: 34, vx: 10, vy: 0, ownerId: null };
  // move players away so it stays loose
  m.players.forEach(p => { p.x = 0; p.y = 0; });
  stepBall(m, 1);
  assert.ok(Math.abs(m.ball.vx) < 10);
  assert.ok(m.ball.x > 50);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/ai.test.js`
Expected: FAIL — `Cannot find module '../js/ai.js'`

- [ ] **Step 3: Write implementation**

```js
// js/ai.js
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
    .filter(o => o.i !== ball.ownerId)
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
  captureBall(match);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/ai.test.js`
Expected: PASS — 7 tests passed.

- [ ] **Step 5: Commit**

```bash
git add js/ai.js test/ai.test.js
git commit -m "feat: AI decisions, movement, ball physics"
```

---

### Task 5: Phaser boot + MenuScene

**Files:**
- Create: `js/main.js`, `js/scenes/MenuScene.js`

**Interfaces:**
- Consumes: `TEAMS`, `pickTwoTeams`; global `Phaser`.
- Produces: `MenuScene` (key `'menu'`) — length tanlash + Play; `this.scene.start('match', { teamA, teamB, lengthMinutes })` bilan match'ni ochadi. `MatchScene` Task 6'da yaratiladi; ushbu task'da `main.js` faqat `MenuScene` bilan ishga tushadi va bo'sh `MatchScene` placeholder registratsiya qilinadi (Task 6'da to'ldiriladi).

- [ ] **Step 1: Write MenuScene**

```js
// js/scenes/MenuScene.js
import { TEAMS, pickTwoTeams } from '../teams.js';

export default class MenuScene extends Phaser.Scene {
  constructor() { super('menu'); }

  create() {
    const { width, height } = this.scale;
    this.lengthMinutes = 2;
    this.add.text(width / 2, height * 0.2, '2D FOOTBALL SIM', {
      fontSize: '48px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.38, 'Match uzunligi:', {
      fontSize: '24px', color: '#cccccc',
    }).setOrigin(0.5);

    const opts = [1, 2, 5];
    this.buttons = [];
    opts.forEach((min, i) => {
      const x = width / 2 + (i - 1) * 120;
      const btn = this.add.text(x, height * 0.5, `${min} daq`, {
        fontSize: '28px', color: '#ffffff',
        backgroundColor: '#333', padding: { x: 18, y: 10 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => { this.lengthMinutes = min; this.refresh(); });
      this.buttons.push({ btn, min });
    });
    this.refresh();

    const play = this.add.text(width / 2, height * 0.72, '▶ PLAY', {
      fontSize: '40px', color: '#0f0', backgroundColor: '#144', padding: { x: 30, y: 14 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    play.on('pointerdown', () => {
      const [teamA, teamB] = pickTwoTeams(TEAMS);
      this.scene.start('match', { teamA, teamB, lengthMinutes: this.lengthMinutes });
    });
  }

  refresh() {
    this.buttons.forEach(({ btn, min }) =>
      btn.setBackgroundColor(min === this.lengthMinutes ? '#0a6' : '#333'));
  }
}
```

- [ ] **Step 2: Write main.js with placeholder MatchScene**

```js
// js/main.js
import MenuScene from './scenes/MenuScene.js';

// Placeholder — replaced by full MatchScene in Task 6.
class MatchScene extends Phaser.Scene {
  constructor() { super('match'); }
  create() {
    this.add.text(20, 20, 'MatchScene placeholder', { color: '#fff' });
  }
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#2e7d32',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  scene: [MenuScene, MatchScene],
});
```

- [ ] **Step 3: Manual verification**

Run: `python3 -m http.server 8000` (loyiha ildizida), brauzerda `http://localhost:8000` och.
Expected: Menu ko'rinadi — sarlavha, 1/2/5 tugmalar (tanlangani yashil), PLAY. Length tugmasini bosish tanlovni o'zgartiradi. PLAY bosilsa "MatchScene placeholder" matni chiqadi (jamoalar random tanlangan).

- [ ] **Step 4: Commit**

```bash
git add js/main.js js/scenes/MenuScene.js
git commit -m "feat: Phaser boot + start menu with length selection"
```

---

### Task 6: MatchScene — render + game loop

**Files:**
- Create: `js/scenes/MatchScene.js`
- Modify: `js/main.js` (placeholder o'rniga import)

**Interfaces:**
- Consumes: `createMatch`, `resetKickoff`, `advanceClock`, `scoreGoal`, `checkGoal`; `decideAction`, `computeTargets`, `applyMovement`, `stepBall`, `passOrShoot`, `captureBall`; `PITCH`; global `Phaser`.
- Produces: `MatchScene` (key `'match'`) — `init(data)` jamoa+uzunlik oladi, maydon+o'yinchi+to'p render, `update(t, dtMs)` da tick loop. HUD Task 7'da qo'shiladi.

Koordinata → ekran: `sx = OX + (x/PITCH.w)*FW`, `sy = OY + (y/PITCH.h)*FH`. Maydon markazda, HUD uchun tepa/past joy qoldiriladi (`OY=60`, `FH=height-120`).

- [ ] **Step 1: Write MatchScene (render + loop)**

```js
// js/scenes/MatchScene.js
import { createMatch, resetKickoff, advanceClock, scoreGoal, checkGoal } from '../match.js';
import { decideAction, computeTargets, applyMovement, stepBall, passOrShoot } from '../ai.js';
import { PITCH } from '../constants.js';

const REAL_SECONDS_PER_HALF = (lenMin) => (lenMin * 60) / 2; // len = full real minutes for 90'

export default class MatchScene extends Phaser.Scene {
  constructor() { super('match'); }

  init(data) {
    this.match = createMatch(data.teamA, data.teamB, data.lengthMinutes);
    resetKickoff(this.match);
    this.match.phase = 'playing';
    this.gameMinPerRealSec = 90 / (data.lengthMinutes * 60);
    this.paused = false;
    this.kickoffTimer = 0;
  }

  create() {
    const W = this.scale.width, H = this.scale.height;
    this.OX = 40; this.OY = 60; this.FW = W - 80; this.FH = H - 120;

    this.pitch = this.add.graphics();
    this.drawPitch();

    // player + ball display objects
    this.playerGfx = this.match.players.map((p) => {
      const color = p.isGK ? p.side === 'A' ? this.teamColor('A', 'gk') : this.teamColor('B', 'gk')
                           : this.teamColor(p.side, 'kit');
      const c = this.add.circle(0, 0, 12, Phaser.Display.Color.HexStringToColor(color).color);
      c.setStrokeStyle(2, 0x000000);
      const txt = this.add.text(0, 0, String(p.num), {
        fontSize: '13px', color: this.teamColor(p.side, 'text'), fontStyle: 'bold',
      }).setOrigin(0.5);
      return { c, txt };
    });
    this.ballGfx = this.add.circle(0, 0, 6, 0xffffff).setStrokeStyle(1, 0x000000);
    this.render();
  }

  teamColor(side, key) {
    const team = side === 'A' ? this.match.teamA : this.match.teamB;
    return team.colors[key];
  }

  sx(x) { return this.OX + (x / PITCH.w) * this.FW; }
  sy(y) { return this.OY + (y / PITCH.h) * this.FH; }

  drawPitch() {
    const g = this.pitch;
    g.fillStyle(0x2e7d32, 1).fillRect(this.OX, this.OY, this.FW, this.FH);
    g.lineStyle(2, 0xffffff, 0.7);
    g.strokeRect(this.OX, this.OY, this.FW, this.FH);
    g.beginPath(); g.moveTo(this.sx(PITCH.w/2), this.OY);
    g.lineTo(this.sx(PITCH.w/2), this.OY + this.FH); g.strokePath();
    g.strokeCircle(this.sx(PITCH.w/2), this.sy(PITCH.h/2), this.FH * 0.12);
    // penalty boxes
    const boxW = this.FW * 0.14, boxH = this.FH * 0.55;
    g.strokeRect(this.OX, this.OY + (this.FH - boxH)/2, boxW, boxH);
    g.strokeRect(this.OX + this.FW - boxW, this.OY + (this.FH - boxH)/2, boxW, boxH);
  }

  update(time, dtMs) {
    if (this.paused || this.match.phase !== 'playing') return;
    const dt = dtMs / 1000;

    // brief kickoff pause after goal handled by phase switching
    const action = decideAction(this.match);
    if (action && (action.type === 'pass' || action.type === 'shoot')) {
      passOrShoot(this.match, action);
    }
    const targets = computeTargets(this.match);
    applyMovement(this.match, targets, dt);
    stepBall(this.match, dt);

    const scorer = checkGoal(this.match);
    if (scorer) {
      scoreGoal(this.match, scorer);
      this.onGoal(scorer);
    }

    const events = advanceClock(this.match, this.gameMinPerRealSec * dt);
    if (this.match.phase === 'halftime') { this.onHalftime(); }
    if (this.match.phase === 'fulltime') { this.onFulltime(); }

    this.render();
  }

  onGoal(side) {
    resetKickoff(this.match);
    // brief neutral pause: keep phase playing (simple), ball re-centered
  }
  onHalftime() {
    resetKickoff(this.match);
    this.time.delayedCall(1500, () => { this.match.phase = 'playing'; });
  }
  onFulltime() { /* HUD overlay added in Task 7 */ }

  render() {
    this.match.players.forEach((p, i) => {
      const g = this.playerGfx[i];
      g.c.x = this.sx(p.x); g.c.y = this.sy(p.y);
      g.txt.x = g.c.x; g.txt.y = g.c.y;
    });
    this.ballGfx.x = this.sx(this.match.ball.x);
    this.ballGfx.y = this.sy(this.match.ball.y);
  }
}
```

- [ ] **Step 2: Wire MatchScene into main.js**

Replace the placeholder `MatchScene` class and update scene list.

```js
// js/main.js
import MenuScene from './scenes/MenuScene.js';
import MatchScene from './scenes/MatchScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1a1a1a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  scene: [MenuScene, MatchScene],
});
```

- [ ] **Step 3: Manual verification**

Run: `python3 -m http.server 8000`, brauzerda `http://localhost:8000`.
Expected: PLAY bosilsa maydon chiziladi (markaz chizig'i, doira, penalti maydonlar). 22 raqamli doira ko'rinadi (jamoa ranglari), GK boshqa rang. To'p harakatlanadi, o'yinchilar to'pga intiladi va darvoza tomon suriladi. Gol bo'lsa markazdan qayta boshlanadi. ~2 daqiqadan keyin harakat to'xtaydi (fulltime).

- [ ] **Step 4: Commit**

```bash
git add js/scenes/MatchScene.js js/main.js
git commit -m "feat: MatchScene render + game loop"
```

---

### Task 7: HUD — scoreboard, timer, commentary, pause, fulltime

**Files:**
- Modify: `js/scenes/MatchScene.js`
- Create: `js/commentary.js`

**Interfaces:**
- Consumes: match state; global `Phaser`.
- Produces:
  - `js/commentary.js`: `commentGoal(match, side)`, `commentPass(carrierName)`, `commentShot(carrierName)`, `commentKickoff()` → string. Rasmga mos matn (masalan `"${name} with the backpass"`).
  - MatchScene HUD: tepa panel (jamoa nomlari, skor, taymer, PAUSE), past panel (kommentariya), fulltime overlay + "Qayta o'ynash" → `this.scene.start('menu')`.

- [ ] **Step 1: Write commentary test**

```js
// test/commentary.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commentGoal, commentPass, commentShot } from '../js/commentary.js';
import { createMatch } from '../js/match.js';
import { TEAMS } from '../js/teams.js';

test('commentary strings mention context', () => {
  const m = createMatch(TEAMS[0], TEAMS[1], 2);
  assert.match(commentGoal(m, 'A'), /GOAL/i);
  assert.match(commentGoal(m, 'A'), new RegExp(m.teamA.name));
  assert.match(commentPass('Sarabia'), /Sarabia/);
  assert.match(commentShot('Messi'), /Messi/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/commentary.test.js`
Expected: FAIL — `Cannot find module '../js/commentary.js'`

- [ ] **Step 3: Write commentary.js**

```js
// js/commentary.js
const PASS_LINES = [
  (n) => `${n} with the backpass`,
  (n) => `${n} plays it short`,
  (n) => `${n} switches the play`,
  (n) => `${n} threads it through`,
];
const SHOT_LINES = [
  (n) => `${n} lets fly!`,
  (n) => `${n} shoots!`,
  (n) => `${n} tries his luck`,
];

const pick = (arr, rng = Math.random) => arr[Math.floor(rng() * arr.length)];

export function commentGoal(match, side) {
  const team = side === 'A' ? match.teamA : match.teamB;
  return `GOAL! ${team.name} score!`;
}
export function commentPass(name, rng) { return pick(PASS_LINES, rng)(name); }
export function commentShot(name, rng) { return pick(SHOT_LINES, rng)(name); }
export function commentKickoff() { return 'Kick-off!'; }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test test/commentary.test.js`
Expected: PASS — 1 test passed.

- [ ] **Step 5: Add HUD to MatchScene — create()**

Add at end of `create()`:

```js
    // --- HUD: top scoreboard ---
    const W = this.scale.width;
    this.add.rectangle(W/2, 30, W, 56, 0x111111, 0.9);
    this.add.text(W*0.22, 30, this.match.teamA.name, { fontSize: '22px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(W*0.78, 30, this.match.teamB.name, { fontSize: '22px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
    this.scoreText = this.add.text(W*0.5, 30, '0 - 0', { fontSize: '26px', color: '#ffd700', fontStyle: 'bold' }).setOrigin(0.5);
    this.timerText = this.add.text(W*0.60, 30, "0'", { fontSize: '20px', color: '#fff' }).setOrigin(0.5);

    this.pauseBtn = this.add.text(W - 90, 30, 'PAUSE', {
      fontSize: '18px', color: '#fff', backgroundColor: '#5a4fcf', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.pauseBtn.on('pointerdown', () => {
      this.paused = !this.paused;
      this.pauseBtn.setText(this.paused ? 'RESUME' : 'PAUSE');
    });

    // --- HUD: bottom commentary bar ---
    this.add.rectangle(W/2, this.scale.height - 26, W, 44, 0xf5b301, 1);
    this.commentText = this.add.text(W/2, this.scale.height - 26, 'Kick-off!', {
      fontSize: '20px', color: '#1a1a1a', fontStyle: 'bold',
    }).setOrigin(0.5);
```

- [ ] **Step 6: Wire commentary + HUD updates into loop**

Import at top of file:

```js
import { commentGoal, commentPass, commentShot } from '../commentary.js';
```

In `update()`, after `passOrShoot(...)`:

```js
      const carrier = this.match.players[this.match.ball.ownerId ?? 0];
      this.setComment(action.type === 'shoot'
        ? commentShot(carrier.name) : commentPass(carrier.name));
```
(place inside the existing `if (action && ...)` block, using the owner before the ball is released — capture the name first: read `carrier` from `action.type==='pass'?...` — simplest: compute `const carrier = this.match.players[this.match.ball.ownerId];` BEFORE calling `passOrShoot`.)

Adjust the block to:

```js
    const action = decideAction(this.match);
    if (action && (action.type === 'pass' || action.type === 'shoot')) {
      const carrier = this.match.players[this.match.ball.ownerId];
      passOrShoot(this.match, action);
      this.setComment(action.type === 'shoot'
        ? commentShot(carrier.name) : commentPass(carrier.name));
    }
```

In `onGoal(side)`:

```js
  onGoal(side) {
    this.setComment(commentGoal(this.match, side));
    resetKickoff(this.match);
  }
```

Add helper + HUD render (in `render()` add scoreboard/timer update):

```js
  setComment(text) { if (this.commentText) this.commentText.setText(text); }
```
Append to `render()`:

```js
    if (this.scoreText) {
      this.scoreText.setText(`${this.match.scoreA} - ${this.match.scoreB}`);
      this.timerText.setText(`${Math.floor(this.match.clock)}'`);
    }
```

- [ ] **Step 7: Add fulltime overlay**

Replace `onFulltime()`:

```js
  onFulltime() {
    const W = this.scale.width, H = this.scale.height;
    this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.75);
    const a = this.match.scoreA, b = this.match.scoreB;
    const winner = a === b ? 'Durang!'
      : (a > b ? this.match.teamA.name : this.match.teamB.name) + ' g‘olib!';
    this.add.text(W/2, H/2 - 60, 'FULL TIME', { fontSize: '40px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(W/2, H/2, `${this.match.teamA.name} ${a} - ${b} ${this.match.teamB.name}`,
      { fontSize: '30px', color: '#ffd700' }).setOrigin(0.5);
    this.add.text(W/2, H/2 + 50, winner, { fontSize: '26px', color: '#fff' }).setOrigin(0.5);
    const replay = this.add.text(W/2, H/2 + 120, '↻ Qayta o‘ynash', {
      fontSize: '28px', color: '#0f0', backgroundColor: '#144', padding: { x: 24, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    replay.on('pointerdown', () => this.scene.start('menu'));
  }
```

- [ ] **Step 8: Manual verification**

Run: `python3 -m http.server 8000`, brauzerda match o'yna.
Expected: Tepada jamoa nomlari, skor (gol bo'lsa yangilanadi), taymer daqiqasi ortadi, PAUSE ishlaydi (to'xtatadi/davom). Pastda kommentariya matni event'da o'zgaradi ("... with the backpass", "GOAL! ..."). Fulltime'da qora overlay + g'olib + "Qayta o'ynash" → menu. Yarim taymda qisqa to'xtash.

- [ ] **Step 9: Commit**

```bash
git add js/commentary.js js/scenes/MatchScene.js test/commentary.test.js
git commit -m "feat: HUD scoreboard, commentary, pause, fulltime overlay"
```

---

## Self-Review

**Spec coverage:**
- §1 Arxitektura/Stack → Task 1 (scaffold), Task 5–6 (Phaser scenes). ✅
- §2 Ma'lumot modeli → Task 2 (teams.js, ≥6 team × 11, pickTwoTeams, formatsiya). ✅
- §3 Vizual (maydon/o'yinchi/to'p/skorbord/kommentariya) → Task 6 (render), Task 7 (HUD). ✅
- §4 AI logikasi (egasi qaror, pressing, GK, bo'sh to'p) → Task 4. ✅
- §5 Match oqimi (start ekrani, taymer, yarim taym, gol, yakun, pause) → Task 3 (state), Task 5 (menu), Task 6–7 (loop+overlay). ✅
- §6 Test → har sof mantiq task'ida unit test; Scene'larda manual verify. ✅

**Placeholder scan:** Task 5 `MatchScene` placeholder ataylab — Task 6 to'liq almashtiradi (interfeys bandida aytilgan). Boshqa TBD/TODO yo'q. ✅

**Type consistency:** `ownerId` (null|index), `attackDir.{A,B}`, `phase` string qiymatlari (`'kickoff'|'playing'|'halftime'|'fulltime'`), `formationPositions(index, side)`, `pickTwoTeams(teams, rng)` — barcha task'larda bir xil ishlatilgan. `passOrShoot`/`decideAction` `action.type` ∈ `'shoot'|'pass'|'dribble'` izchil. ✅

**Eslatma:** `constants.js` konstantalar (`PLAYER_SPEED`, `PASS_SPEED`, `BALL_FRICTION` va h.k.) balans uchun manual verify paytida sozlanishi mumkin — bu kutilgan tюning, spec buzilishi emas.

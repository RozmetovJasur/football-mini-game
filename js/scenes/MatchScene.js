// js/scenes/MatchScene.js
import { createMatch, resetKickoff, advanceClock, scoreGoal, checkGoal } from '../match.js';
import { decideAction, computeTargets, applyMovement, stepBall, passOrShoot } from '../ai.js';
import { PITCH } from '../constants.js';
import { commentGoal, commentPass, commentShot } from '../commentary.js';

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

    // --- HUD: top scoreboard ---
    const W2 = this.scale.width;
    this.add.rectangle(W2/2, 30, W2, 56, 0x111111, 0.9);
    this.add.text(W2*0.22, 30, this.match.teamA.name, { fontSize: '22px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(W2*0.78, 30, this.match.teamB.name, { fontSize: '22px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5);
    this.scoreText = this.add.text(W2*0.5, 30, '0 - 0', { fontSize: '26px', color: '#ffd700', fontStyle: 'bold' }).setOrigin(0.5);
    this.timerText = this.add.text(W2*0.60, 30, "0'", { fontSize: '20px', color: '#fff' }).setOrigin(0.5);

    this.pauseBtn = this.add.text(W2 - 90, 30, 'PAUSE', {
      fontSize: '18px', color: '#fff', backgroundColor: '#5a4fcf', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    this.pauseBtn.on('pointerdown', () => {
      this.paused = !this.paused;
      this.pauseBtn.setText(this.paused ? 'RESUME' : 'PAUSE');
    });

    // --- HUD: bottom commentary bar ---
    this.add.rectangle(W2/2, this.scale.height - 26, W2, 44, 0xf5b301, 1);
    this.commentText = this.add.text(W2/2, this.scale.height - 26, 'Kick-off!', {
      fontSize: '20px', color: '#1a1a1a', fontStyle: 'bold',
    }).setOrigin(0.5);

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
      const carrier = this.match.players[this.match.ball.ownerId];
      passOrShoot(this.match, action);
      this.setComment(action.type === 'shoot'
        ? commentShot(carrier.name) : commentPass(carrier.name));
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
    this.setComment(commentGoal(this.match, side));
    resetKickoff(this.match);
    // brief neutral pause: keep phase playing (simple), ball re-centered
  }
  onHalftime() {
    resetKickoff(this.match);
    this.time.delayedCall(1500, () => { this.match.phase = 'playing'; });
  }
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

  setComment(text) { if (this.commentText) this.commentText.setText(text); }

  render() {
    this.match.players.forEach((p, i) => {
      const g = this.playerGfx[i];
      g.c.x = this.sx(p.x); g.c.y = this.sy(p.y);
      g.txt.x = g.c.x; g.txt.y = g.c.y;
    });
    this.ballGfx.x = this.sx(this.match.ball.x);
    this.ballGfx.y = this.sy(this.match.ball.y);

    if (this.scoreText) {
      this.scoreText.setText(`${this.match.scoreA} - ${this.match.scoreB}`);
      this.timerText.setText(`${Math.floor(this.match.clock)}'`);
    }
  }
}

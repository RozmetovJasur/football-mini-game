// js/scenes/MatchScene.js
import { createMatch, resetKickoff, advanceClock, scoreGoal, checkGoal } from '../match.js';
import {
  decideAction, computeTargets, applyMovement, stepBall, passOrShoot, readyToAct, commitDribble, tryTackle, tryFeint,
} from '../ai.js';
import { getView, HEAD_HEIGHT } from '../view3d/view.js';
import {
  commentGoal, commentPass, commentShot, commentTackle, commentFeint, commentKickoff, commentHalftime,
} from '../commentary.js';
import { t } from '../i18n.js';
import { kitsClash } from '../teams.js';
import { addCrest } from '../crests.js';
import { createRecorder, frameAt, clipDuration } from '../replay.js';
import {
  initAudio, toggleMute, isMuted, playKick, playBounce, playShotOoh, playGoalRoar,
  playKickoffWhistle, playHalftimeWhistle, playFulltimeWhistle,
} from '../audio.js';

const DEPTH_HUD = 2000;
const DEPTH_OVERLAY = 3000;
const DEPTH_TAGS = 1500;      // above every player, below the HUD
const REPLAY_SPEED = 0.6;     // slow motion
const GOAL_CLIP_SECS = 4.5;
const CHANCE_DELAY = 1.5;     // sec after a shot before the chance is saved as a highlight

export default class MatchScene extends Phaser.Scene {
  constructor() { super('match'); }

  init(data) {
    this.match = createMatch(data.teamA, data.teamB, data.lengthMinutes);
    // away side switches to its second kit when the colours are too alike
    const b = data.teamB.colors;
    this.kits = { A: data.teamA.colors, B: kitsClash(data.teamA, data.teamB) ? { ...b, ...b.away } : b };
    resetKickoff(this.match);
    this.match.phase = 'playing';
    this.gameMinPerRealSec = 90 / (data.lengthMinutes * 60);
    this.paused = false;
    this.stoppage = false;        // play halted after a goal
    this.recorder = createRecorder({ seconds: 6, fps: 30 });
    this.highlight = null;        // last goal or big chance, for the replay button
    this.pendingChance = null;
    this.replayState = null;
    this.showNames = true;
  }

  create() {
    // the pitch, players and stadium are drawn in 3D underneath this scene
    this.view = getView(document.getElementById('game'));
    this.view.setMatch(this.match.players, this.kits);
    this.view.setVisible(true);
    this.events.once('shutdown', () => this.view.setVisible(false));
    this.tags = this.match.players.map((p) => this.makeTag(p));

    this.createHud();

    // audio is unlocked by the PLAY click; tapping the canvas also resumes it
    this.input.on('pointerdown', () => initAudio());
    this.input.keyboard?.on('keydown-M', () => this.toggleSound());
    this.input.keyboard?.on('keydown-SPACE', () => this.togglePause());
    this.input.keyboard?.on('keydown-R', () => this.toggleReplay());
    this.input.keyboard?.on('keydown-N', () => { this.showNames = !this.showNames; this.render(); });
    this.input.keyboard?.on('keydown-ESC', () => this.endReplay());
    playKickoffWhistle();

    this.render();
  }

  createHud() {
    const W = this.scale.width, H = this.scale.height;
    const hud = (o) => o.setDepth(DEPTH_HUD);
    hud(this.add.rectangle(W/2, 28, W, 56, 0x111111, 0.92));
    // left: TV-style "RMA  0 - 0  BAR   12'" with formations underneath, right: buttons
    const sx = W * 0.3;
    const { teamA, teamB } = this.match;
    const label = (x, team, side, align) => {
      const dir = align ? -1 : 1;
      hud(addCrest(this, x + dir * 16, 28, team, 34));
      hud(this.add.text(x + dir * 40, 22, team.short, { fontSize: '22px', color: '#fff', fontStyle: 'bold' }).setOrigin(align, 0.5));
      hud(this.add.text(x + dir * 40, 44, team.formation, { fontSize: '12px', color: '#9aa' }).setOrigin(align, 0.5));
    };
    label(sx - 56, teamA, 'A', 1);
    label(sx + 56, teamB, 'B', 0);
    this.scoreText = hud(this.add.text(sx, 28, '0 - 0', { fontSize: '26px', color: '#ffd700', fontStyle: 'bold' }).setOrigin(0.5));
    this.timerText = hud(this.add.text(W * 0.53, 28, "0'", { fontSize: '20px', color: '#fff' }).setOrigin(0.5));

    this.pauseBtn = hud(this.add.text(W - 70, 28, t('pause'), {
      fontSize: '18px', color: '#fff', backgroundColor: '#5a4fcf', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }));
    this.pauseBtn.on('pointerdown', () => this.togglePause());

    this.soundBtn = hud(this.add.text(W - 190, 28, '', {
      fontSize: '18px', color: '#fff', backgroundColor: '#2d6a4f', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }));
    this.soundBtn.on('pointerdown', () => this.toggleSound());
    this.refreshSoundBtn();

    this.replayBtn = hud(this.add.text(W - 320, 28, t('replayBtn'), {
      fontSize: '18px', color: '#fff', backgroundColor: '#b23a48', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }));
    this.replayBtn.on('pointerdown', () => this.toggleReplay());
    this.refreshReplayBtn();

    // replay overlay: letterbox bars, badge and skip hint
    const bar = (y) => this.add.rectangle(W/2, y, W, 34, 0x000000, 0.7);
    const badge = this.add.text(24, 56 + 17, t('replayBadge'), {
      fontSize: '20px', color: '#fff', backgroundColor: '#c1121f', fontStyle: 'bold', padding: { x: 10, y: 4 },
    }).setOrigin(0, 0.5);
    const hint = this.add.text(W - 24, H - 48 - 17, t('replayHint'), { fontSize: '16px', color: '#ffffff' }).setOrigin(1, 0.5);
    const bars = [bar(56 + 17), bar(H - 48 - 17)];
    bars.forEach(o => o.setDepth(DEPTH_HUD - 3));
    [badge, hint].forEach(o => o.setDepth(DEPTH_HUD - 2));   // explicit: equal depths don't keep order
    this.replayUi = [...bars, badge, hint];
    this.replayUi.forEach(o => o.setVisible(false));
    this.tweens.add({ targets: badge, alpha: 0.7, duration: 600, yoyo: true, repeat: -1 });

    hud(this.add.rectangle(W/2, H - 24, W, 48, 0xf5b301, 1));
    this.commentText = hud(this.add.text(W/2, H - 24, commentKickoff(), {
      fontSize: '20px', color: '#1a1a1a', fontStyle: 'bold',
    }).setOrigin(0.5));
  }

  togglePause() {
    this.paused = !this.paused;
    this.pauseBtn.setText(this.paused ? t('resume') : t('pause'));
  }

  refreshReplayBtn() {
    this.replayBtn.setAlpha(this.highlight ? 1 : 0.45);
  }

  toggleReplay() {
    if (this.replayState) { this.endReplay(); return; }
    if (!this.highlight || this.stoppage || this.match.phase !== 'playing') return;
    this.startReplay(this.highlight);
  }

  startReplay(clip, onDone) {
    if (clip.length < 2) { onDone?.(); return; }
    this.replayState = { clip, time: 0, duration: clipDuration(clip), onDone };
    this.replayUi.forEach(o => o.setVisible(true));
  }

  endReplay() {
    const st = this.replayState;
    if (!st) return;
    this.replayState = null;
    this.replayUi.forEach(o => o.setVisible(false));
    st.onDone?.();
    this.render();
  }

  updateReplay(dt) {
    const st = this.replayState;
    st.time += dt * REPLAY_SPEED;
    this.render(dt * REPLAY_SPEED, frameAt(st.clip, st.time));
    if (st.time >= st.duration) this.endReplay();
  }

  toggleSound() {
    initAudio();
    toggleMute();
    this.refreshSoundBtn();
  }

  refreshSoundBtn() {
    this.soundBtn.setText(isMuted() ? t('soundOff') : t('soundOn'));
    this.soundBtn.setBackgroundColor(isMuted() ? '#6c757d' : '#2d6a4f');
  }

  teamColor(side, key) { return this.kits[side][key]; }

  // name tag floating above a player: fixed size so far-side names stay readable
  makeTag(p) {
    return this.add.text(0, 0, p.label, {
      fontSize: '12px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5, 1).setDepth(DEPTH_TAGS);
  }

  update(time, dtMs) {
    const dt = dtMs / 1000;
    if (this.replayState) { this.updateReplay(dt); return; }
    if (this.paused || this.stoppage || this.match.phase !== 'playing') return;

    const m = this.match;
    const feint = tryFeint(m, dt);
    if (feint?.success) {
      this.setComment(commentFeint(m.players[feint.carrier].name, m.players[feint.defender].name));
      playShotOoh();
    } else if (feint && m.ball.ownerId === feint.defender) {
      playKick(0.3);
      this.setComment(commentTackle(m.players[feint.defender].name));
    }
    const tackler = tryTackle(m, dt);
    if (tackler !== null) { playKick(0.3); this.setComment(commentTackle(m.players[tackler].name)); }

    // the carrier holds the ball briefly, then passes, shoots or carries on
    if (readyToAct(m)) {
      const action = decideAction(m);
      const carrier = m.players[m.ball.ownerId];
      if (action.type === 'dribble') {
        commitDribble(m, action);
      } else {
        passOrShoot(m, action);
        if (action.type === 'shoot') {
          playKick(1); playShotOoh();
          this.setComment(commentShot(carrier.name));
          this.pendingChance = CHANCE_DELAY;
        } else {
          const mate = m.players[action.targetId];
          const back = (mate.x - carrier.x) * m.attackDir[carrier.side] < 0;
          playKick(0.55);
          this.setComment(commentPass(carrier.name, mate.name, { back }));
        }
      }
    }
    const targets = computeTargets(this.match);
    applyMovement(this.match, targets, dt);
    const impact = stepBall(this.match, dt);
    if (impact > 3) playBounce(impact);
    this.recorder.record(m, dt);

    // a shot that didn't go in becomes the latest highlight once it plays out
    if (this.pendingChance !== null && (this.pendingChance -= dt) <= 0) {
      this.pendingChance = null;
      this.highlight = this.recorder.clip();
      this.refreshReplayBtn();
    }

    const scorer = checkGoal(this.match);
    if (scorer) {
      scoreGoal(this.match, scorer);
      this.onGoal(scorer);
    }

    advanceClock(this.match, this.gameMinPerRealSec * dt);
    if (this.match.phase === 'halftime') { this.onHalftime(); }
    if (this.match.phase === 'fulltime') { this.onFulltime(); }

    this.render(dt);
  }

  onGoal(side) {
    this.pendingChance = null;
    this.stoppage = true;
    const clip = this.recorder.clip(GOAL_CLIP_SECS);
    this.highlight = clip;
    this.refreshReplayBtn();
    this.setComment(commentGoal(this.match, side));
    playGoalRoar();
    this.view.shake(0.6);
    this.view.celebrate(4);
    this.cameras.main.flash(250, 255, 255, 255);
    const W = this.scale.width, H = this.scale.height;
    const banner = this.add.text(W / 2, H / 2, t('goalBanner'), {
      fontSize: '96px', color: '#ffd700', fontStyle: 'bold', stroke: '#000', strokeThickness: 8,
    }).setOrigin(0.5).setDepth(DEPTH_HUD - 1).setScale(0.2);
    this.tweens.add({
      targets: banner, scale: 1.2, duration: 450, ease: 'Back.Out',
      yoyo: true, hold: 900, onComplete: () => banner.destroy(),
    });
    // celebrate, show the goal again in slow motion, then kick off
    this.time.delayedCall(1700, () => this.startReplay(clip, () => {
      resetKickoff(this.match);
      this.recorder.reset();
      this.stoppage = false;
      this.setComment(commentKickoff());
      playKickoffWhistle();
    }));
  }
  onHalftime() {
    playHalftimeWhistle();
    this.setComment(commentHalftime());
    resetKickoff(this.match);
    this.recorder.reset();
    this.pendingChance = null;
    this.time.delayedCall(1500, () => { this.match.phase = 'playing'; playKickoffWhistle(); });
  }
  onFulltime() {
    playFulltimeWhistle();
    this.showNames = false;
    this.render();
    const W = this.scale.width, H = this.scale.height;
    const top = (o) => o.setDepth(DEPTH_OVERLAY);
    top(this.add.rectangle(W/2, H/2, W, H, 0x000000, 0.75));
    const a = this.match.scoreA, b = this.match.scoreB;
    const winner = a === b ? t('draw')
      : t('winner', { team: a > b ? this.match.teamA.name : this.match.teamB.name });
    top(this.add.text(W/2, H/2 - 60, t('fullTime'), { fontSize: '40px', color: '#fff', fontStyle: 'bold' }).setOrigin(0.5));
    top(this.add.text(W/2, H/2, `${this.match.teamA.name} ${a} - ${b} ${this.match.teamB.name}`,
      { fontSize: '30px', color: '#ffd700' }).setOrigin(0.5));
    top(addCrest(this, W/2 - 330, H/2 - 150, this.match.teamA, 96));
    top(addCrest(this, W/2 + 330, H/2 - 150, this.match.teamB, 96));
    top(this.add.text(W/2, H/2 + 50, winner, { fontSize: '26px', color: '#fff' }).setOrigin(0.5));
    const replay = top(this.add.text(W/2, H/2 + 120, t('playAgain'), {
      fontSize: '28px', color: '#0f0', backgroundColor: '#144', padding: { x: 24, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }));
    replay.on('pointerdown', () => this.scene.start('menu'));
  }

  setComment(text) { if (this.commentText) this.commentText.setText(text); }

  nearestTo(frame) {
    let best = null, bestD = 2.5;
    frame.players.forEach((p, i) => {
      const d = Math.hypot(p.x - frame.ball.x, p.y - frame.ball.y);
      if (d < bestD && frame.ball.z < 1) { bestD = d; best = i; }
    });
    return best;
  }

  // draws the live match, or a recorded replay frame when one is given
  render(dt = 0, frame = null) {
    const players = frame ? frame.players : this.match.players;
    const ball = frame ? frame.ball : this.match.ball;
    // live: whoever has the ball; replay: nearest player to the ball if it's at his feet
    const carrier = frame ? this.nearestTo(frame) : this.match.ball.ownerId;
    const mode = this.replayState ? 'replay' : this.stoppage ? 'goal' : 'broadcast';

    this.view.syncTo(this.game.canvas);
    this.view.update(players, ball, carrier, dt, mode);

    players.forEach((p, i) => {
      const tag = this.tags[i];
      const pt = this.showNames ? this.view.project(p.x, p.y, HEAD_HEIGHT) : null;
      tag.setVisible(!!pt);
      if (!pt) return;
      tag.setPosition(pt.x, pt.y);
      // the man on the ball stands out; nearer tags sit on top of farther ones
      const onBall = i === carrier;
      tag.setColor(onBall ? '#ffd700' : '#ffffff');
      tag.setAlpha(onBall ? 1 : 0.8);
      tag.setDepth(DEPTH_TAGS + (onBall ? 400 : pt.y / 1000));   // stays under the HUD (2000)
    });

    if (this.scoreText) {
      this.scoreText.setText(`${this.match.scoreA} - ${this.match.scoreB}`);
      this.timerText.setText(`${Math.floor(this.match.clock)}'`);
    }
  }
}

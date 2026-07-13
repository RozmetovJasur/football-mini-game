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

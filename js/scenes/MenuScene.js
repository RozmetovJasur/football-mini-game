// js/scenes/MenuScene.js
import { TEAMS, pickTwoIndices, cycleTeam } from '../teams.js';
import { FORMATION_NAMES, formationPositions } from '../formations.js';
import { teamRating, teamRatings } from '../stats.js';
import { PITCH } from '../constants.js';
import { initAudio } from '../audio.js';
import { addCrest, crestKey } from '../crests.js';
import { t, getLang, setLang, LANGS } from '../i18n.js';

const toColor = (hex) => Phaser.Display.Color.HexStringToColor(hex).color;
const CARD_W = 440, CARD_H = 270;
const MINI_W = 200, MINI_H = 124;

// gold for elite sides, then silver, then bronze
const ratingColor = (r) => (r >= 83 ? 0xf5b301 : r >= 78 ? 0xc0c7d0 : 0xcd7f32);

export default class MenuScene extends Phaser.Scene {
  constructor() { super('menu'); }

  init(data) {
    this.lengthMinutes = data?.lengthMinutes ?? 2;
    // a fresh random pairing each visit; kept when only the language changes
    this.teamIdx = data?.teamIdx ?? pickTwoIndices(TEAMS.length);
    this.formations = data?.formations ?? this.teamIdx.map(i => TEAMS[i].formation);
  }

  create() {
    const { width, height } = this.scale;
    this.add.text(width / 2, height * 0.075, t('title'), {
      fontSize: '44px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);

    // language switch: redraw the menu in the chosen language
    LANGS.forEach((lang, i) => {
      const active = lang === getLang();
      const btn = this.add.text(width - 130 + i * 70, 40, lang.toUpperCase(), {
        fontSize: '22px', color: active ? '#1a1a1a' : '#ffffff',
        backgroundColor: active ? '#f5b301' : '#333', padding: { x: 12, y: 6 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => {
        setLang(lang);
        this.scene.restart({ lengthMinutes: this.lengthMinutes, teamIdx: this.teamIdx, formations: this.formations });
      });
    });

    // --- team selection ---
    this.add.text(width / 2, height * 0.16, t('chooseTeams'), {
      fontSize: '22px', color: '#cccccc',
    }).setOrigin(0.5);
    const cy = height * 0.4;
    this.cards = [0, 1].map((slot) => this.makeTeamCard(width / 2 + (slot ? 1 : -1) * (CARD_W / 2 + 30), cy, slot));
    this.add.text(width / 2, cy, 'VS', { fontSize: '34px', color: '#f5b301', fontStyle: 'bold' }).setOrigin(0.5);
    const random = this.add.text(width / 2, height * 0.645, t('random'), {
      fontSize: '22px', color: '#ffffff', backgroundColor: '#5a4fcf', padding: { x: 16, y: 8 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    random.on('pointerdown', () => {
      this.teamIdx = pickTwoIndices(TEAMS.length);
      this.formations = this.teamIdx.map(i => TEAMS[i].formation);
      this.refreshTeams();
    });
    this.refreshTeams();

    // --- match length ---
    this.add.text(width / 2, height * 0.725, t('matchLength'), {
      fontSize: '22px', color: '#cccccc',
    }).setOrigin(0.5);

    const opts = [1, 2, 5];
    this.buttons = [];
    opts.forEach((min, i) => {
      const x = width / 2 + (i - 1) * 140;
      const btn = this.add.text(x, height * 0.795, t('minutes', { n: min }), {
        fontSize: '26px', color: '#ffffff',
        backgroundColor: '#333', padding: { x: 18, y: 8 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      btn.on('pointerdown', () => { this.lengthMinutes = min; this.refresh(); });
      this.buttons.push({ btn, min });
    });
    this.refresh();

    const play = this.add.text(width / 2, height * 0.915, t('play'), {
      fontSize: '36px', color: '#0f0', backgroundColor: '#144', padding: { x: 30, y: 12 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    play.on('pointerdown', () => {
      initAudio();   // browsers only allow audio after a user gesture
      const [teamA, teamB] = this.teamIdx.map((i, slot) => ({ ...TEAMS[i], formation: this.formations[slot] }));
      this.scene.start('match', { teamA, teamB, lengthMinutes: this.lengthMinutes });
    });
  }

  arrowBtn(x, y, label, onClick, size = 24) {
    const a = this.add.text(x, y, label, {
      fontSize: `${size}px`, color: '#ffffff', backgroundColor: '#333', padding: { x: 9, y: 4 },
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    a.on('pointerdown', onClick);
    return a;
  }

  // Card: team name with ◀ ▶, kit + overall rating, formation on a mini pitch
  // with its own ◀ ▶, and the squad's average attributes.
  makeTeamCard(x, y, slot) {
    this.add.rectangle(x, y, CARD_W, CARD_H, 0x262a33).setStrokeStyle(2, 0x3a3f4b);
    const top = y - CARD_H / 2;

    const changeTeam = (step) => {
      this.teamIdx[slot] = cycleTeam(this.teamIdx[slot], step, this.teamIdx[1 - slot], TEAMS.length);
      this.formations[slot] = TEAMS[this.teamIdx[slot]].formation;
      this.refreshTeams();
    };
    this.arrowBtn(x - CARD_W / 2 + 26, top + 30, '◀', () => changeTeam(-1));
    this.arrowBtn(x + CARD_W / 2 - 26, top + 30, '▶', () => changeTeam(+1));
    const name = this.add.text(x, top + 30, '', { fontSize: '24px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);

    // left column: crest and rating
    const lx = x - CARD_W / 2 + 70;
    const crest = addCrest(this, lx, top + 94, TEAMS[this.teamIdx[slot]], 66);
    const badge = this.add.rectangle(lx, top + 158, 76, 48, 0xf5b301);
    const rating = this.add.text(lx, top + 158, '', { fontSize: '30px', color: '#1a1a1a', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(lx, top + 196, t('rating'), { fontSize: '14px', color: '#aab' }).setOrigin(0.5);

    // right column: formation board
    const mx = x + 50, my = top + 122;
    const board = this.add.graphics();
    const changeFormation = (step) => {
      const n = FORMATION_NAMES.length;
      const i = FORMATION_NAMES.indexOf(this.formations[slot]);
      this.formations[slot] = FORMATION_NAMES[(i + step + n) % n];
      this.refreshTeams();
    };
    this.arrowBtn(mx - 70, my + MINI_H / 2 + 22, '◀', () => changeFormation(-1), 18);
    this.arrowBtn(mx + 70, my + MINI_H / 2 + 22, '▶', () => changeFormation(+1), 18);
    const formation = this.add.text(mx, my + MINI_H / 2 + 22, '', { fontSize: '20px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);

    const stats = this.add.text(x, top + CARD_H - 18, '', { fontSize: '14px', color: '#cfd3dc' }).setOrigin(0.5);
    return { slot, name, crest, badge, rating, board, mx, my, formation, stats };
  }

  drawBoard(card, team, formationName) {
    const g = card.board, w = MINI_W, h = MINI_H;
    const x0 = card.mx - w / 2, y0 = card.my - h / 2;
    g.clear();
    g.fillStyle(0x2e7d32, 1).fillRect(x0, y0, w, h);
    g.lineStyle(1, 0xffffff, 0.6);
    g.strokeRect(x0, y0, w, h);
    g.lineBetween(x0 + w / 2, y0, x0 + w / 2, y0 + h);
    g.strokeCircle(x0 + w / 2, y0 + h / 2, h * 0.13);
    const bw = w * 0.15, bh = h * 0.58;
    g.strokeRect(x0, y0 + (h - bh) / 2, bw, bh);
    g.strokeRect(x0 + w - bw, y0 + (h - bh) / 2, bw, bh);
    // left card attacks right, right card attacks left — they face each other
    const side = card.slot === 0 ? 'A' : 'B';
    const kit = toColor(team.colors.kit), gk = toColor(team.colors.gk);
    for (let i = 0; i < 11; i++) {
      const p = formationPositions(i, side, formationName);
      g.fillStyle(i === 0 ? gk : kit, 1);
      g.lineStyle(1.5, 0x000000, 0.8);
      const px = x0 + p.x / PITCH.w * w, py = y0 + p.y / PITCH.h * h;
      g.fillCircle(px, py, 5.5);
      g.strokeCircle(px, py, 5.5);
    }
  }

  refreshTeams() {
    this.cards.forEach((card) => {
      const team = TEAMS[this.teamIdx[card.slot]];
      const formationName = this.formations[card.slot];
      const r = teamRating(team);
      card.name.setText(team.name);
      card.crest.setTexture(crestKey(this, team)).setDisplaySize(66, 66);
      card.rating.setText(String(r));
      card.badge.setFillStyle(ratingColor(r));
      card.formation.setText(formationName);
      card.stats.setText(t('stats', teamRatings(team)));
      this.drawBoard(card, team, formationName);
    });
  }

  refresh() {
    this.buttons.forEach(({ btn, min }) =>
      btn.setBackgroundColor(min === this.lengthMinutes ? '#0a6' : '#333'));
  }
}

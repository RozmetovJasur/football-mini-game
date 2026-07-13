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

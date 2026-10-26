// js/main.js
import MenuScene from './scenes/MenuScene.js';
import MatchScene from './scenes/MatchScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  transparent: true,   // the 3D match view shows through from underneath
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1280,
    height: 720,
  },
  scene: [MenuScene, MatchScene],
});

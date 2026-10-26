// test/commentary.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commentGoal, commentPass, commentShot, commentTackle, commentFeint } from '../js/commentary.js';
import { setLang, t, LANGS } from '../js/i18n.js';
import { createMatch } from '../js/match.js';
import { TEAMS } from '../js/teams.js';

test('commentary strings mention context', () => {
  const m = createMatch(TEAMS[0], TEAMS[1], 2);
  for (const lang of LANGS) {
    setLang(lang);
    assert.match(commentGoal(m, 'A'), new RegExp(m.teamA.name));
    assert.match(commentPass('Sarabia', 'Messi'), /Sarabia.*Messi/);
    assert.match(commentPass('Kroos', 'Alaba', { back: true }), /Kroos.*Alaba/);
    assert.match(commentShot('Messi'), /Messi/);
    assert.match(commentTackle('Busquets'), /Busquets/);
    assert.match(commentFeint('Vinícius', 'Koundé'), /Vinícius.*Koundé/);
  }
});

test('goal call is localized', () => {
  const m = createMatch(TEAMS[0], TEAMS[1], 2);
  setLang('uz');
  assert.match(commentGoal(m, 'A'), /^GOL!/);
  setLang('ru');
  assert.match(commentGoal(m, 'A'), /^ГОЛ!/);
});

test('ui strings switch language and fill params', () => {
  setLang('uz');
  assert.equal(t('minutes', { n: 5 }), '5 daq');
  setLang('ru');
  assert.equal(t('minutes', { n: 5 }), '5 мин');
  assert.equal(t('winner', { team: 'FCB' }), 'Победа: FCB!');
  setLang('xx');                       // unknown language is ignored
  assert.equal(t('pause'), 'ПАУЗА');
  setLang('uz');
});

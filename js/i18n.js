// js/i18n.js
// Interface language (uz / ru). Choice is remembered per browser.

export const LANGS = ['uz', 'ru'];
const KEY = 'football.lang';

const STRINGS = {
  uz: {
    title: 'FUTBOL SIMULYATORI',
    matchLength: 'O‘yin davomiyligi:',
    chooseTeams: 'Jamoalarni tanlang:',
    random: '⟳ Tasodifiy',
    rating: 'Reyting',
    formation: 'Sxema',
    stats: 'TEZ {pac}  DRB {dri}  PAS {pas}  ZRB {sho}  HIM {def}',
    minutes: '{n} daq',
    play: '▶ O‘YNASH',
    pause: 'PAUZA',
    resume: 'DAVOM',
    soundOn: '♪ Ovoz',
    soundOff: '♪ O‘chiq',
    goalBanner: 'GOL!',
    fullTime: 'O‘YIN TUGADI',
    draw: 'Durang!',
    winner: '{team} g‘olib!',
    playAgain: '↻ Qayta o‘ynash',
    replayBtn: '↺ Takror',
    replayBadge: '● TAKRORIY',
    replayHint: 'ESC — o‘tkazib yuborish',
  },
  ru: {
    title: 'ФУТБОЛЬНЫЙ СИМУЛЯТОР',
    matchLength: 'Длительность матча:',
    chooseTeams: 'Выберите команды:',
    random: '⟳ Случайно',
    rating: 'Рейтинг',
    formation: 'Схема',
    stats: 'СКР {pac}  ДРБ {dri}  ПАС {pas}  УДР {sho}  ЗАЩ {def}',
    minutes: '{n} мин',
    play: '▶ ИГРАТЬ',
    pause: 'ПАУЗА',
    resume: 'ДАЛЕЕ',
    soundOn: '♪ Звук',
    soundOff: '♪ Выкл',
    goalBanner: 'ГОЛ!',
    fullTime: 'МАТЧ ОКОНЧЕН',
    draw: 'Ничья!',
    winner: 'Победа: {team}!',
    playAgain: '↻ Сыграть ещё',
    replayBtn: '↺ Повтор',
    replayBadge: '● ПОВТОР',
    replayHint: 'ESC — пропустить',
  },
};

function load() {
  try {
    const saved = globalThis.localStorage?.getItem(KEY);
    if (LANGS.includes(saved)) return saved;
  } catch { /* storage blocked: fall back to default */ }
  return 'uz';
}

let lang = load();

export function getLang() { return lang; }

export function setLang(next) {
  if (!LANGS.includes(next)) return;
  lang = next;
  try { globalThis.localStorage?.setItem(KEY, next); } catch { /* not persisted */ }
}

// fill {placeholders} in a template
export function format(template, params = {}) {
  return template.replace(/\{(\w+)\}/g, (_, k) => (k in params ? params[k] : `{${k}}`));
}

export function t(key, params) {
  const s = STRINGS[lang][key] ?? STRINGS.uz[key] ?? key;
  return format(s, params);
}

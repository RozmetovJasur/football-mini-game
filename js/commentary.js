// js/commentary.js
import { getLang, format } from './i18n.js';

const LINES = {
  uz: {
    pass: ['{a} {b}ga uzatdi', '{a} {b}ni topdi', '{a} qisqa pas — {b}', '{a} oldinga uzatma — {b}'],
    back: ['{a} orqaga uzatdi — {b}', '{a} to‘pni {b}ga qaytardi'],
    shot: ['{n} darvozaga zarba berdi!', '{n} uradi!', '{n} omadini sinab ko‘rdi'],
    tackle: ['{n} to‘pni olib qo‘ydi', '{n} hujumni to‘xtatdi'],
    feint: ['{a} {b}ni aldab o‘tdi!', '{a} chiroyli finta — {b} ortda qoldi!', '{a} {b}ni joyida qoldirdi!'],
    goal: ['GOL! {team} gol urdi!'],
    kickoff: ['O‘yin boshlandi!'],
    halftime: ['Tanaffus'],
  },
  ru: {
    pass: ['{a} — пас на {b}', '{a} находит партнёра: {b}', '{a} коротко на {b}', '{a} обостряет на {b}'],
    back: ['{a} откатывает назад — {b}', '{a} возвращает мяч: {b}'],
    shot: ['{n} бьёт!', '{n} наносит удар!', '{n} пробует издали'],
    tackle: ['{n} отбирает мяч', '{n} прерывает атаку'],
    feint: ['{a} обыгрывает {b}!', '{a} финтом убирает {b}!', '{a} оставляет {b} на месте!'],
    goal: ['ГОЛ! {team} забивает!'],
    kickoff: ['Матч начался!'],
    halftime: ['Перерыв'],
  },
};

const pick = (arr, rng = Math.random) => arr[Math.floor(rng() * arr.length)];
const line = (kind, params, rng) => format(pick(LINES[getLang()][kind], rng), params);

export function commentGoal(match, side, rng) {
  const team = side === 'A' ? match.teamA : match.teamB;
  return line('goal', { team: team.name }, rng);
}
export function commentPass(from, to, { back = false, rng } = {}) {
  return line(back ? 'back' : 'pass', { a: from, b: to }, rng);
}
export function commentShot(name, rng) { return line('shot', { n: name }, rng); }
export function commentTackle(name, rng) { return line('tackle', { n: name }, rng); }
export function commentFeint(carrier, defender, rng) { return line('feint', { a: carrier, b: defender }, rng); }
export function commentKickoff() { return line('kickoff', {}); }
export function commentHalftime() { return line('halftime', {}); }

# 2D Football Simulyator — Dizayn Spec

**Sana:** 2026-07-13
**Status:** Tasdiqlangan (brainstorming)

## Umumiy maqsad

Tomoshabin rejimidagi 2D futbol simulyatori. Foydalanuvchi match uzunligini tanlaydi va "Play" bosadi. Ikki jamoa random tanlanadi va yuqoridan ko'rinishdagi (top-down) maydonda avtomatik o'ynaydi. O'yinchilar oddiy AI bilan harakatlanadi. Foydalanuvchi o'yinni boshqarmaydi — faqat kuzatadi (PAUSE bor).

Vizual maqsad: FM23 Mobile 2D match view uslubi — raqamli rangli doiralar, to'p, tepada skorbord+taymer, pastda kommentariya bar.

## 1. Arxitektura / Stack

- **Phaser 3** o'yin dvigateli, CDN'dan yuklanadi. Build-tool yo'q — brauzerda `index.html` ochib ishlaydi.
- Fayl tuzilishi:
  - `index.html` — Phaser CDN + config, canvas host.
  - `css/style.css` — sahifa layout, HUD (agar DOM ustma-ust ishlatilsa).
  - `js/main.js` — Phaser Game config, scene ro'yxati.
  - `js/teams.js` — jamoa/o'yinchi ma'lumotlari (sof data).
  - `js/ai.js` — harakat va qaror mantiqi (Phaser'ga bog'liq emas, sof funksiyalar).
  - `js/match.js` — match state (skor, taymer, yarim taym, gol, yakun) sof mantiq.
  - `js/scenes/MenuScene.js` — start ekrani.
  - `js/scenes/MatchScene.js` — o'yin render + tick loop.
- Ikki Phaser Scene mustaqil: `MenuScene` (start) va `MatchScene` (o'yin). Toza chegara — biri ikkinchisining ichki ishiga bog'liq emas.

**Isolation printsipi:** sof mantiq (`ai.js`, `teams.js`, `match.js`) Phaser render'dan ajratilgan — mustaqil test qilinadi. Scene'lar shu mantiqni chaqiradi va vizuallashtiradi.

## 2. Ma'lumot modeli (`js/teams.js`)

Kodda tayyor jamoa ro'yxati:

```js
{
  name: "Wolves",
  short: "WOL",
  colors: { kit: "#fdb913", text: "#231f20", gk: "#c0392b" },
  players: [
    { num: 1,  name: "Sa",    role: "GK" },
    { num: 5,  name: "Coady", role: "DF" },
    // ...jami 11 ta
  ]
}
```

- ~6–8 ta jamoa, har birida **11 o'yinchi** (`num` raqam, `name` qisqa ism, `role`: GK/DF/MF/FW).
- Rol → boshlang'ich formatsiya pozitsiyasi (4-4-2 asos).
- `pickTwoTeams(teams)` — 2 ta **har xil** jamoa random qaytaradi.

## 3. Match sahnasi (vizual)

Layout (rasmga mos):

- **Maydon**: gorizontal top-down, yashil, chiziqli (penalti maydonlari, markaz doira, darvozalar). Ekran kengligiga proporsional.
- **O'yinchilar**: rangli doira + ichida oq raqam. Jamoa `kit` rangi bo'yicha. Darvozabon `gk` rangi. To'p egasi ostida ismi ko'rsatiladi.
- **To'p**: kichik oq doira. Egasi yonida yuradi; uzatish/zarbada mustaqil uchadi.
- **Skorbord (tepa panel)**: `[chap jamoa nomi] [skor A–B] [o'ng jamoa nomi] ... [taymer M:SS] [PAUSE] [⚙]`.
- **Kommentariya bar (past panel)**: event matni — masalan "Sarabia with the backpass", "GOAL!", "Shot saved".

**Koordinata tizimi:** maydon mantiqiy birlikda (0–100 x, 0–100 y). Render'da ekran o'lchamiga skalalanadi → responsive. AI shu mantiqiy koordinatada ishlaydi.

## 4. AI / harakat logikasi (`js/ai.js`)

Har tick (frame) uchun sof funksiyalar. Barcha harakat tezligi cheklangan (real ko'rinish).

**To'p egasi** (biroz random + mantiq):
- Darvozaga masofa < `SHOOT_RANGE` → **zarba**. Muvaffaqiyat ehtimoli = f(masofa, random).
- Aks holda: oldinda/yaqin sherik bor → ehtimol `P_PASS` bilan **uzatish**; yo'q bo'lsa yoki random → **darvoza tomon yugurish**.
- Uzatish/zarba → to'pni egasiz uchiradi.

**To'psiz o'yinchilar**:
- To'pga eng yaqin 1–2 o'yinchi → to'pga intiladi (pressing).
- Qolganlar → formatsiya pozitsiyasi atrofida (biroz drift), to'p tomon umumiy siljish.
- **Darvozabon** → darvoza chizig'ida to'p y-o'qiga qarab harakat.

**Bo'sh to'p** (uzatish/zarba orasida): tezlik bilan uchadi, ishqalanish bilan sekinlashadi, eng yaqin o'yinchi egallaydi (`captureBall`).

**Chegaralar**: o'yinchi/to'p maydondan chiqmaydi. To'p chiqsa — soddalashtirilgan qayta boshlash (throw-in / goal-kick — eng yaqin nuqtadan yaqin o'yinchiga to'p beriladi).

## 5. Match oqimi (`js/match.js` + `MatchScene` state machine)

- **Start ekrani** (`MenuScene`): uzunlik tanlash (1 / 2 / 5 daqiqa) + **Play** → 2 random jamoa → `MatchScene`.
- **Kick-off**: to'p markazda, jamoalar o'z yarmida.
- **Taymer**: real vaqt → o'yin daqiqasiga siqiladi (tanlangan uzunlik = 90' o'yin). Tepada `M:SS`.
- **Yarim taym**: o'rtada qisqa pauza + "Half Time" bar; jamoalar tomon almashadi (hujum yo'nalishi teskari).
- **Gol**: skor +1, "GOAL!" kommentariya, qisqa nishonlash, gol yegan jamoada markazdan kick-off.
- **Yakun**: taymer tugadi → "Full Time" overlay, g'olib yoki durang + skor, **"Qayta o'ynash"** → `MenuScene`.
- **PAUSE**: o'yinni to'xtatadi/davom ettiradi.

State'lar: `KICKOFF → PLAYING → (GOAL → KICKOFF) → HALFTIME → PLAYING → FULLTIME`.

## 6. Test yondashuvi

Sof mantiqni Phaser'dan ajratib test qilamiz. Test-first: har mantiq bo'lagi uchun avval test, keyin kod.

**Unit testlar** (yengil runner — Vitest yoki oddiy assert):
- `pickTwoTeams` — 2 ta har xil jamoa qaytaradimi.
- AI qarori — darvozaga yaqin → zarba; yaqin sherik → uzatish ehtimoli.
- `captureBall` — eng yaqin o'yinchi to'pni egallaydi.
- Gol → skor +1, kick-off reset.
- Taymer → yakun/yarim taym triggeri to'g'ri vaqtda.

**Vizual/manual**: brauzerda match ochib render, animatsiya, layout ko'z bilan tekshirish.

## Ochiq bo'lmagan (YAGNI — kiritilmaydi)

- Foydalanuvchi boshqaruvi (o'yinchi harakatlantirish).
- Real vaqt ma'lumot / API.
- Multiplayer, saqlash, statistika tarixi.
- Ovoz / murakkab animatsiya.

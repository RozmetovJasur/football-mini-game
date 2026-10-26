// js/crests.js
// Stylised club crests drawn from each team's crest spec (club colours and a
// simple pattern) — not the official trademarked badges.

const SIZE = 128;   // drawn large once, scaled down where used

function shapePath(ctx, shape, s) {
  ctx.beginPath();
  if (shape === 'circle') {
    ctx.arc(s / 2, s / 2, s / 2 - 4, 0, Math.PI * 2);
  } else {
    // shield: flat top, straight sides, curving to a point
    const l = s * 0.12, r = s * 0.88, top = s * 0.08;
    ctx.moveTo(l, top);
    ctx.lineTo(r, top);
    ctx.lineTo(r, s * 0.5);
    ctx.quadraticCurveTo(r, s * 0.8, s / 2, s * 0.95);
    ctx.quadraticCurveTo(l, s * 0.8, l, s * 0.5);
    ctx.closePath();
  }
}

function fillPattern(ctx, { pattern, colors }, s) {
  const [a, b = a] = colors;
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, s, s);
  ctx.fillStyle = b;
  if (pattern === 'stripes') {
    const w = s / 7;
    for (let i = 1; i < 7; i += 2) ctx.fillRect(i * w, 0, w, s);
  } else if (pattern === 'band') {
    ctx.fillRect(s * 0.38, 0, s * 0.24, s);
  } else if (pattern === 'halves') {
    ctx.fillRect(0, s * 0.55, s, s);
  } else if (pattern === 'checks') {
    // diamond lozenges
    const d = s / 6;
    for (let y = -1; y < 7; y++) for (let x = -1; x < 7; x++) {
      if ((x + y) % 2) continue;
      const cx = x * d + d / 2, cy = y * d + d / 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - d / 2); ctx.lineTo(cx + d / 2, cy); ctx.lineTo(cx, cy + d / 2); ctx.lineTo(cx - d / 2, cy);
      ctx.fill();
    }
  }
}

// Returns the texture key for a team's crest, creating it on first use.
export function crestKey(scene, team) {
  const key = `crest-${team.short}`;
  if (scene.textures.exists(key)) return key;
  const tex = scene.textures.createCanvas(key, SIZE, SIZE);
  const ctx = tex.getContext();
  const c = team.crest;

  ctx.save();
  shapePath(ctx, c.shape, SIZE);
  ctx.clip();
  fillPattern(ctx, c, SIZE);
  ctx.restore();

  shapePath(ctx, c.shape, SIZE);
  ctx.lineWidth = 8;
  ctx.strokeStyle = c.rim;
  ctx.stroke();

  ctx.font = `bold ${c.text.length > 2 ? 34 : 44}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 6;
  ctx.strokeStyle = 'rgba(0,0,0,0.65)';
  const ty = c.shape === 'shield' ? SIZE * 0.47 : SIZE / 2;
  ctx.strokeText(c.text, SIZE / 2, ty);
  ctx.fillStyle = c.textColor;
  ctx.fillText(c.text, SIZE / 2, ty);

  tex.refresh();
  return key;
}

// add a crest image `px` pixels wide
export function addCrest(scene, x, y, team, px) {
  return scene.add.image(x, y, crestKey(scene, team)).setDisplaySize(px, px);
}

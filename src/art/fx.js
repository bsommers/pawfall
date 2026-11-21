// art module 'fx': particle sprites, PAWFALL logo, title scene, cursor paw, touch button base.
// Pure + deterministic; PixBuf only; colours from defs.PAL.
import { PixBuf, hash2 } from './pixbuf.js';
import { PAL } from '../core/defs.js';

const O = PAL.outline;
const mk = (w, h) => new PixBuf(w, h);

/** Filled rotated ellipse (semi-axes a along the angle, b across). col(u, v) -> colour, u along, v across. */
function rotEllipse(b, cx, cy, a, bb, ang, col) {
  const ca = Math.cos(ang), sa = Math.sin(ang), R = Math.ceil(Math.max(a, bb)) + 1;
  for (let y = Math.floor(cy - R); y <= Math.ceil(cy + R); y++)
    for (let x = Math.floor(cx - R); x <= Math.ceil(cx + R); x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
      if ((u * u) / (a * a) + (v * v) / (bb * bb) <= 1) b.set(x, y, col(u, v));
    }
}

// ------------------------------------------------------------------ water / tar splashes
function splash(f, colors, tall) {
  const b = mk(16, 12), [c1, c2, c3] = colors, t = (f + 1) * 0.85;
  const drops = [[-1.6, 3.4], [-1.0, 4.4], [-0.45, 5.2], [0.45, 5.2], [1.0, 4.4], [1.6, 3.4]];
  drops.forEach(([vx, vy], i) => {
    const x = 7.5 + vx * t * 2.2, y = 10 - (vy * t * 1.25 - 0.55 * t * t * 1.5) * (tall ? 1 : 0.9);
    const big = f < 2 && i % 2 === 0;
    b.rect(x, y, big ? 2 : 1, big ? 2 : 1, i % 3 === 0 ? c2 : c1);
    if (big) b.set(x, y, c3);
  });
  const colH = [5, 4, 2, 0][f];                       // central column rises then collapses
  if (colH) { b.rect(6, 10 - colH, 4, colH, c1); b.rect(6, 10 - colH, 1, colH, c3); b.rect(7, 9 - colH, 2, 1, c2); }
  const rw = 3 + f * 2;                               // widening ripple at the base
  b.hline(8 - rw, 11, rw * 2, c1); if (f > 1) { b.set(8 - rw, 10, c2); b.set(7 + rw, 10, c2); }
  b.hline(8 - rw + 1, 11, 2, c3);
  return b;
}
const fxSplash = (f) => splash(f, [PAL.water, PAL.waterL, PAL.white], true);
const fxTar = (f) => splash(f, [PAL.tar, PAL.tarL, PAL.tarL], false);

// ------------------------------------------------------------------ dust / sparkle / stars / bubble / poof
function dust(f) {
  const b = mk(8, 6), r = [1.4, 2.2, 2.8, 3.2][f], cols = [PAL.pathL, PAL.path, PAL.pathL, PAL.path];
  const hollow = f >= 2;
  for (const [dx, dy, k] of [[0, 0, 1], [-1.8, 0.6, 0.75], [1.8, 0.6, 0.75]]) {
    const rr = r * k * (f === 3 ? 0.8 : 1);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 8; x++) {
      const d = Math.hypot(x + 0.5 - (4 + dx), y + 0.5 - (3.2 - f * 0.25 + dy));
      if (d <= rr && !(hollow && d < rr - 1.1 && (x + y) % 2)) b.set(x, y, (x + y) % 3 === 0 ? PAL.cream : cols[f]);
    }
  }
  return b;
}
function sparkle(f) {
  const b = mk(8, 8), W = PAL.white, G = PAL.gold, F = PAL.fireL;
  const spark = (p) => p.setMat({ emit: 0.9, spark: 1 });
  if (f === 0) { b.rect(3, 3, 2, 2, W); b.set(3, 2, G); b.set(4, 5, G); b.set(2, 4, G); b.set(5, 3, G); }
  else if (f === 1) { b.rect(3, 3, 2, 2, W); b.vline(3, 0, 8, G); b.vline(4, 0, 8, G); b.hline(0, 3, 8, G); b.hline(0, 4, 8, G); b.rect(3, 3, 2, 2, W); b.set(3, 0, F); b.set(4, 7, F); }
  else if (f === 2) { b.rect(3, 3, 2, 2, W); b.vline(3, 1, 6, G); b.vline(4, 1, 6, G); b.hline(1, 3, 6, G); b.hline(1, 4, 6, G); b.rect(3, 3, 2, 2, W);
    for (const [x, y] of [[1, 1], [6, 1], [1, 6], [6, 6]]) b.set(x, y, F); }
  else { for (const [x, y] of [[3, 0], [4, 7], [0, 4], [7, 3], [1, 1], [6, 6], [1, 6], [6, 1]]) b.set(x, y, f === 3 ? G : F); b.set(3, 3, W); b.set(4, 4, F); }
  return spark(b);
}
function stars(f) {
  const b = mk(14, 6), pts = [];
  for (let i = 0; i < 3; i++) {
    const a = (f * (Math.PI * 2 / 9)) + i * (Math.PI * 2 / 3);
    pts.push({ x: Math.round(7 + Math.cos(a) * 5), y: Math.round(3 + Math.sin(a) * 2), z: Math.sin(a) });
  }
  pts.sort((p, q) => p.z - q.z);                      // back stars first
  for (const p of pts) {
    b.set(p.x, p.y, PAL.white);
    const arm = p.z > -0.2 ? PAL.gold : PAL.goldD;
    b.set(p.x - 1, p.y, arm); b.set(p.x + 1, p.y, arm); b.set(p.x, p.y - 1, arm); b.set(p.x, p.y + 1, arm);
  }
  return b.setMat({ emit: 0.7, spark: 0.8 });
}
function bubble(f) {
  const b = mk(4, 4);
  b.rect(1, 0, 2, 4, PAL.waterL); b.rect(0, 1, 4, 2, PAL.waterL);
  b.rect(1, 1, 2, 2, PAL.water);                       // hollow-ish glassy centre
  if (f === 0) b.set(1, 1, PAL.white); else b.set(2, 1, PAL.white);
  b.set(0, 0, [0, 0, 0, 0]); b.set(3, 0, [0, 0, 0, 0]); b.set(0, 3, [0, 0, 0, 0]); b.set(3, 3, [0, 0, 0, 0]);
  return b;
}
function poof(f) {
  const b = mk(16, 16), R = [1, 3.5, 5.5, 6.5][f], r = [3.6, 4.2, 3.6, 2.4][f], n = 6;
  for (let i = 0; i < n; i++) {
    const a = i * (Math.PI * 2 / n) + 0.4, cx = 8 + Math.cos(a) * R, cy = 8 + Math.sin(a) * R * 0.92;
    if (f === 3 && i % 2) continue;
    b.circle(cx, cy, r, i % 2 ? PAL.scorp : PAL.white);
  }
  if (f < 3) b.circle(8, 8, [3.6, 3.6, 2.8][f], PAL.white);
  b.map((x, y, p) => (p.a > 0 && (x + y * 2) % 7 === 0 ? PAL.scorp : undefined));
  const q = b.clone(); q.outline(PAL.scorpD);          // soft grey rim instead of black: keeps it airy
  return q;
}
function leaf(f) {
  const b = mk(6, 6), ang = [-Math.PI / 4, 0, Math.PI / 4, Math.PI / 2][f];
  const sq = f === 1 ? 0.8 : f === 3 ? 0.8 : 1;
  rotEllipse(b, 3, 3, 2.9, 1.5 * sq, ang, (u, v) => (Math.abs(v) < 0.45 ? PAL.leafD : v < 0 ? PAL.leafL : PAL.leaf));
  b.set(3 - Math.round(Math.cos(ang) * 2.6), 3 - Math.round(Math.sin(ang) * 2.6), PAL.leafHL);
  return b;
}

// ------------------------------------------------------------------ cursor paw / touch button
function paw(f) {
  const b = mk(10, 10), ox = 1, oy = f ? 2 : 1;
  const T = (x, y) => { b.rect(ox + x, oy + y, 2, 2, PAL.fur); b.set(ox + x, oy + y, PAL.furL); };
  T(0, 2); T(2, 0); T(4, 0); T(6, 2);
  b.ellipse(ox + 4, oy + 4.7, 3.4, 2.3, PAL.fur);
  b.hline(ox + 2, oy + 3, 3, PAL.furL);
  b.rect(ox + 3, oy + 4, 2, 2, PAL.nose);
  b.set(ox + 6, oy + 5, PAL.furD); b.set(ox + 5, oy + 6, PAL.furD); b.set(ox + 4, oy + 6, PAL.furD);
  return b.outline(O);
}
function touchBtn(f) {
  const b = mk(32, 32), cx = 16, cy = 16;
  b.circle(cx, cy, 15.2, O);
  b.circle(cx, cy, 13.6, f ? PAL.gold : PAL.hudDim);                    // rim
  b.circle(cx, cy, 11.6, f ? PAL.goldD : [10, 7, 16, 215]);             // face
  if (!f) {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > 8 && d < 11.6 && x + y < 28) b.set(x, y, [255, 246, 224, 70]);   // upper-left highlight arc
    }
    b.set(9, 9, PAL.white); b.set(10, 8, PAL.white);
  }
  return b;
}

// ------------------------------------------------------------------ PAWFALL logo
const GLYPH = {
  P: ['1111.', '1...1', '1...1', '1111.', '1....', '1....', '1....'],
  A: ['.111.', '1...1', '1...1', '11111', '1...1', '1...1', '1...1'],
  W: ['1...1', '1...1', '1...1', '1.1.1', '1.1.1', '11011', '1...1'],
  F: ['11111', '1....', '1....', '1111.', '1....', '1....', '1....'],
  L: ['1....', '1....', '1....', '1....', '1....', '1....', '11111'],
};
const CELL = 5, DEPTH = 3;
function letter(b, ch, x0, y0) {
  const g = GLYPH[ch], inMask = (x, y) => {
    const cx = (x / CELL) | 0, cy = (y / CELL) | 0;
    return x >= 0 && y >= 0 && cx < 5 && cy < 7 && g[cy][cx] === '1';
  };
  const ext = [null, PAL.furD, PAL.stripe, PAL.fireD];
  for (let d = DEPTH; d >= 1; d--)
    for (let y = 0; y < 7 * CELL; y++) for (let x = 0; x < 5 * CELL; x++) if (inMask(x, y)) b.set(x0 + x + d, y0 + y + d, ext[d]);
  const face = (y) => (y < 9 ? PAL.fireL : y < 17 ? PAL.gold : y < 26 ? PAL.fire : PAL.fur);
  for (let y = 0; y < 7 * CELL; y++) for (let x = 0; x < 5 * CELL; x++) {
    if (!inMask(x, y)) continue;
    let c = face(y);
    if (!inMask(x, y - 1) || !inMask(x - 1, y)) c = PAL.cream;                               // lit top/left edge
    else if (!inMask(x + 1, y) || !inMask(x, y + 1)) c = y < 17 ? PAL.gold : PAL.furD;       // shaded bottom/right edge
    b.set(x0 + x, y0 + y, c);
  }
  if (ch === 'A') {                                    // paw-print counter
    const hx = x0 + CELL, hy = y0 + CELL;
    for (let y = 0; y < 2 * CELL; y++) for (let x = 0; x < 3 * CELL; x++) if (!b.has(hx + x, hy + y)) b.set(hx + x, hy + y, PAL.tunnelDark);
    const px = hx + 7, py = hy;
    for (const [tx, ty] of [[-5, 3], [-2, 1], [1, 1], [4, 3]]) { b.rect(px + tx, py + ty, 2, 2, PAL.gold); }
    b.rect(px - 3, py + 5, 6, 3, PAL.gold); b.rect(px - 2, py + 4, 4, 1, PAL.gold); b.hline(px - 3, py + 7, 6, PAL.fireL);
  }
}
function leafPair(b, x, y, up, big) {
  const s = up ? -1 : 1, a = big ? 3.4 : 2.8;
  rotEllipse(b, x + 3, y + s * 2, a, 1.5, s * -0.6, (u, v) => (v < 0 ? PAL.leafL : PAL.leafM));
  rotEllipse(b, x - 3, y - s * 2, a, 1.5, s * -0.6 + Math.PI, (u, v) => (v < 0 ? PAL.leaf : PAL.leafD));
}
function logo() {
  const b = mk(224, 56), word = 'PAWFALL';
  for (let i = 0; i < word.length; i++) letter(b, word[i], 8 + i * 30, 4);
  // vine trim along the bottom
  for (let x = 0; x < 224; x++) {
    const y = 49 + Math.round(2.2 * Math.sin(x / 9));
    b.set(x, y, PAL.leafM); b.set(x, y + 1, PAL.leafD);
  }
  for (let k = 0; k < 16; k++) {
    const x = 6 + k * 14, y = 49 + Math.round(2.2 * Math.sin(x / 9));
    leafPair(b, x, y + 1, k % 2 === 0, k % 4 === 0);
    if (k % 3 === 1) { b.rect(x + 7, y - 3, 2, 2, PAL.nose); b.set(x + 7, y - 3, PAL.white); b.set(x + 8, y - 2, PAL.gold); }
  }
  // corner tendrils climbing up beside the first and last letter
  for (const [sx, dir] of [[2, 1], [221, -1]]) {
    for (let y = 46; y > 14; y--) { const x = sx + dir * Math.round(1.6 * Math.sin(y / 4)); b.set(x, y, PAL.leafM); b.set(x + dir, y, PAL.leafD); }
    for (let y = 44; y > 18; y -= 8) leafPair(b, sx + dir * 2, y, (y / 8) % 2 === 0, false);
  }
  return b.outline(O, { diagonal: true });
}

// ------------------------------------------------------------------ title scene (320x110)
const COLBY = [
  '....ff.....',
  '....ff.....',
  '...hhhhh...',
  '..hhhhhhH..',
  '..bbbbbbb..',
  '.fFffffFf..',
  '.fcfefcfe..',
  '..fcccnc...',
  '..ssssss...',
  '..ffFfff...',
  '..fFfffFf..',
  '..fffff.f..',
  '...kk.kk...',
];
function tinyColby(b, x0, y0, kick) {
  const key = { f: PAL.fur, F: PAL.stripe, c: PAL.cream, e: PAL.eyeD, n: PAL.nose, h: PAL.hat, H: PAL.hatD, b: PAL.hatBand, s: PAL.scarf, k: PAL.boot };
  const t = mk(11, 13);
  COLBY.forEach((row, y) => [...row].forEach((ch, x) => { if (key[ch]) t.set(x, y, key[ch]); }));
  t.set(4, 6, PAL.eye); t.set(7, 6, PAL.eye);
  if (kick) { t.erase(3, 12); t.erase(4, 12); t.set(6, 12, PAL.boot); }
  for (const [x, y] of [[1, 8], [0, 9], [0, 10], [1, 11], [0, 12]]) t.set(x, y, PAL.fur);   // curling tail
  t.set(0, 11, PAL.furD); t.set(0, 12, PAL.furD);
  b.blit(t.clone().outline(O, { diagonal: true }), x0 - 1, y0 - 1);
}
function ridgeLayer(b, peaks, litCol, shdCol, snow) {
  for (let x = 0; x < 320; x++) {
    let top = 1e9, side = 0, which = -1;
    peaks.forEach(([px, py, sl], i) => { const y = py + Math.abs(x - px) * sl; if (y < top) { top = y; side = x < px ? 0 : 1; which = i; } });
    for (let y = Math.max(0, Math.floor(top)); y < 100; y++) {
      let c = side === 0 ? litCol : shdCol;
      const [px, py] = peaks[which];
      if (snow && snow.includes(which) && y < py + 10 + hash2(x >> 1, 3, 9) * 5 + Math.abs(x - px) * 0.2 && y - top < 14) c = side === 0 ? PAL.white : PAL.silver;
      else if ((x + y) % 4 === 0 && y - top > 6 && side === 1) c = PAL.peteFurD;
      b.set(x, y, c);
    }
  }
}
function canopyBlob(b, cx, cy, r, base, rim) {
  b.circle(cx, cy, r, base);
  for (let a = 0; a < 12; a++) { const x = cx + Math.cos(a * 0.5 + 0.2) * r * 0.55, y = cy + Math.sin(a * 0.5 + 0.2) * r * 0.55; if (y < cy) b.set(x, y, rim); }
}
function titleScene() {
  const b = mk(320, 110);
  // big sun with retro cut stripes
  const sx = 206, sy = 52;
  b.circle(sx, sy, 28, PAL.fire); b.circle(sx, sy, 26, PAL.fireL); b.circle(sx, sy, 24, PAL.gold); b.circle(sx - 4, sy - 4, 15, PAL.fireL);
  b.map((x, y, p) => (p.a > 0 && Math.hypot(x - sx, y - sy) < 28 && (x + y) % 2 === 0 && Math.hypot(x - sx, y - sy) > 25 ? [0, 0, 0, 0] : undefined));
  for (let k = 0; k < 4; k++) for (let h = 0; h <= k; h++) for (let x = sx - 30; x < sx + 30; x++) b.erase(x, sy + 7 + k * 5 + h);   // retro cut stripes, thicker toward the horizon
  b.setMat({ emit: 1 }, sx - 30, sy - 30, 60, 60);
  // mountains (far lit left, shaded right) + snow caps
  ridgeLayer(b, [[62, 30, 1.25], [150, 58, 1.0], [250, 64, 1.1], [315, 52, 1.0]], PAL.peteSuitL, PAL.peteSuit, [0, 3]);
  // far tree-line
  for (let x = -4; x < 330; x += 7) { const h = hash2(x, 1, 5); b.circle(x, 88 + h * 5, 6 + h * 4, PAL.leafD); }
  for (let x = 0; x < 320; x++) for (let y = 90; y < 100; y++) b.set(x, y, PAL.leafD);
  for (let x = 0; x < 320; x += 2) { const y = 82 + Math.round(hash2(x, 2, 5) * 4); if (b.has(x, y) ) b.set(x, y, PAL.leaf); }
  // foreground silhouette trunks + ground
  for (const [tx, tw] of [[14, 9], [38, 5], [292, 10], [268, 5]]) { b.rect(tx, 40, tw, 66, PAL.trunkD); b.rect(tx, 40, 2, 66, PAL.trunk); }
  for (let x = 0; x < 320; x++) { const gy = 98 + Math.round(Math.sin(x / 11) * 1.5 + hash2(x >> 2, 4, 1) * 3); b.rect(x, gy, 1, 110 - gy, PAL.leafDark2); if (hash2(x, 8, 2) > 0.7) b.vline(x, gy - 3, 3, PAL.leafD); }
  // canopy at the top corners
  for (let i = 0; i < 9; i++) canopyBlob(b, 6 + i * 13, 4 + hash2(i, 1, 3) * 14, 12 + hash2(i, 2, 3) * 6, i % 2 ? PAL.leafDark2 : PAL.leafD, PAL.leaf);
  for (let i = 0; i < 9; i++) canopyBlob(b, 318 - i * 14, 3 + hash2(i, 5, 3) * 16, 12 + hash2(i, 6, 3) * 6, i % 2 ? PAL.leafD : PAL.leafDark2, PAL.leaf);
  // the vine: pivot in the right canopy, Colby mid-swing in front of the sun
  const px = 256, py = 12, len = 60, a = -0.62, tx = px + Math.sin(a) * len, ty = py + Math.cos(a) * len;
  b.rect(px - 4, py - 3, 8, 5, PAL.trunk); b.hline(px - 4, py - 3, 8, PAL.trunkL);
  b.line(px, py, tx, ty, PAL.leafM); b.line(px + 1, py, tx + 1, ty, PAL.leafD);
  for (let k = 1; k < 5; k++) { const x = px + (tx - px) * (k / 5), y = py + (ty - py) * (k / 5); b.set(x + 2, y, PAL.leafL); b.set(x + 3, y + 1, PAL.leaf); }
  tinyColby(b, Math.round(tx) - 5, Math.round(ty) - 1, true);
  // a few fireflies / glints
  for (const [x, y] of [[96, 70], [128, 58], [300, 80], [40, 76]]) { b.set(x, y, PAL.gold); b.set(x + 1, y, PAL.fireL); }
  return b;
}

export function build() {
  return {
    fx_splash: [0, 1, 2, 3].map(fxSplash),
    fx_tarsplat: [0, 1, 2, 3].map(fxTar),
    fx_dust: [0, 1, 2, 3].map(dust),
    fx_sparkle: [0, 1, 2, 3].map(sparkle),
    fx_stars: [0, 1, 2].map(stars),
    fx_bubble: [0, 1].map(bubble),
    fx_poof: [0, 1, 2, 3].map(poof),
    fx_leaf: [0, 1, 2, 3].map(leaf),
    logo: logo(),
    title_scene: titleScene(),
    cursor_paw: [0, 1].map(paw),
    touch_btn: [0, 1].map(touchBtn),
  };
}

// art module 'world': jungle scenery (tiles, trunks, canopy, parallax layers, decor, billboard).
// Pure + deterministic; PixBuf only; colours from defs.PAL (plus shade/mix of them).
import { PixBuf, hash2, mix } from './pixbuf.js';
import { PAL } from '../core/defs.js';

const BAY = [[0, 2], [3, 1]];
const bay = (x, y) => (BAY[y & 1][x & 1] + 0.5) / 4;
const mod = (a, n) => ((a % n) + n) % n;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hx = (k) => (c) => c; // identity (colours are strings or inks)
const mixh = (a, b, t) => mix(a, b, t);
const H = (x, y, s) => hash2(x, y, s);
/** periodic value noise: cell-sized blocks wrapping at (w,h) */
const vn = (x, y, w, h, s, cell = 1) => H(mod(Math.floor(x / cell), Math.ceil(w / cell)), mod(Math.floor(y / cell), Math.ceil(h / cell)), s);
/** pick tone from dark->light ramp by value v in 0..1 with ordered dither */
function tone(t, v, x, y, spread = 0.9) {
  const i = clamp(Math.round(v * (t.length - 1) + (bay(x, y) - 0.5) * spread), 0, t.length - 1);
  return t[i];
}
const LEAF = [PAL.leafDark2, PAL.leafD, PAL.leaf, PAL.leafM, PAL.leafL, PAL.leafHL];

/** dithered-shaded ellipse lit from the upper left; wraps horizontally when ww given. */
function blob(b, cx, cy, rx, ry, tones, ww = 0, lightBias = 0) {
  const offs = ww ? [-ww, 0, ww] : [0];
  for (const o of offs) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx + o - rx); x <= Math.ceil(cx + o + rx); x++) {
        const u = (x + 0.5 - (cx + o)) / rx, v = (y + 0.5 - cy) / ry, d = u * u + v * v;
        if (d > 1) continue;
        const lu = (x + 0.5 - (cx + o - rx * 0.35)) / (rx * 1.35), lv = (y + 0.5 - (cy - ry * 0.4)) / (ry * 1.35);
        let s = clamp(1 - (lu * lu + lv * lv) + lightBias, 0, 1);
        if (d > 0.72 && (u + v) > 0.2) s *= 0.35;           // dark rim on the shadow side
        if (x >= 0 && x < b.w) b.set(x, y, tone(tones, s, x, y));
      }
    }
  }
}

// ------------------------------------------------------------------ tiles
function dirtPix(x, y, w, h, s) {
  const n = vn(x, y, w, h, s, 2), m = vn(x, y, w, h, s + 7, 1);
  let c = PAL.dirt;
  if (n > 0.78) c = PAL.dirtL; else if (n < 0.28) c = PAL.dirtD;
  if (m > 0.93) c = PAL.dirtL; else if (m < 0.06) c = PAL.dirtD;
  return c;
}
function tilePath(v) {
  const b = new PixBuf(16, 10), s = 11 + v * 5;
  for (let y = 0; y < 10; y++) for (let x = 0; x < 16; x++) {
    let c;
    if (y < 3) { // grass lip with blades
      const blade = H(x, 0, s) > 0.55;
      c = y === 0 ? (blade ? PAL.leafHL : PAL.leafM) : y === 1 ? (H(x, 1, s) > 0.5 ? PAL.grass : PAL.leafL) : (bay(x, y) < 0.5 ? PAL.grassD : PAL.grass);
      if (y === 0 && !blade && H(x, 5, s) > 0.5) c = PAL.grassD;
    } else {
      const t = (y - 3) / 6, n = vn(x, y, 16, 10, s, 2);
      c = tone([PAL.pathD, PAL.path, PAL.pathL], clamp(0.62 - t * 0.5 + (n - 0.5) * 0.7, 0, 1), x, y, 0.8);
      if (vn(x, y, 16, 10, s + 3) > 0.94) c = PAL.pathD;
      if (y === 3 && bay(x, y) > 0.4) c = PAL.dirtL;
      if (y === 9) c = bay(x, y) < 0.5 ? PAL.dirtD : PAL.pathD;
    }
    if (c) b.set(x, y, c);
  }
  // pebbles (wrapping)
  const px = 3 + v * 7, py = 6 + v;
  b.set(px, py, PAL.pathL); b.set(mod(px + 1, 16), py, PAL.pathL); b.set(px, py + 1, PAL.pathD); b.set(mod(px + 1, 16), py + 1, PAL.pathD);
  return b;
}
function tileDirt(v) {
  const b = new PixBuf(16, 16), s = 31 + v * 9;
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) b.set(x, y, dirtPix(x, y, 16, 16, s));
  for (let k = 0; k < 3; k++) { // little stones
    const x = Math.floor(H(k, 1, s) * 16), y = Math.floor(H(k, 2, s) * 16);
    b.set(x, y, PAL.dirtL); b.set(mod(x + 1, 16), y, PAL.dirtL); b.set(x, mod(y + 1, 16), PAL.dirtD); b.set(mod(x + 1, 16), mod(y + 1, 16), PAL.dirtD);
  }
  return b;
}
function tileCeil(v) {
  const b = new PixBuf(16, 10), s = 31 + v * 9;
  for (let y = 0; y < 10; y++) for (let x = 0; x < 16; x++) {
    let c = dirtPix(x, y, 16, 16, s);
    if (y >= 5) { // fade toward the dark tunnel with a dither
      const f = (y - 4) / 6;
      if (bay(x, y) < f * 0.9) c = y >= 8 ? PAL.tunnelMid : PAL.dirtD;
    }
    b.set(x, y, c);
  }
  for (let i = 0; i < 3; i++) { // hanging roots
    const x = Math.floor(H(i, 3, s) * 15) + 0, len = 3 + Math.floor(H(i, 4, s) * 4);
    for (let y = 4; y < 4 + len && y < 10; y++) b.set(x, y, y % 3 === 0 ? PAL.trunkL : PAL.trunk);
    b.set(mod(x + 1, 16), 4, PAL.trunkD); b.set(x, 3, PAL.trunkD);
  }
  return b;
}
function tileBrick() {
  const b = new PixBuf(16, 8);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) {
    const row = y >> 2, ry = y & 3, off = row ? 4 : 0, bx = mod(x - off, 8);
    let c;
    if (ry === 0 || bx === 0) c = PAL.mortar;
    else {
      c = H(Math.floor(mod(x - off, 16) / 8), row, 5) > 0.5 ? PAL.brick : mixh(PAL.brick, PAL.brickL, 0.25);
      if (ry === 1) c = PAL.brickL; else if (ry === 3 || bx === 7) c = PAL.brickD;
      if (bx === 1 && ry === 1) c = PAL.brickL;
      if (vn(x, y, 16, 8, 9) > 0.9) c = PAL.brickD;
    }
    b.set(x, y, c);
  }
  return b;
}
function tileTunnel() {
  const b = new PixBuf(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const n = vn(x, y, 16, 16, 77, 1);
    b.set(x, y, n > 0.9 ? PAL.tunnelMid : PAL.tunnelDark);
  }
  return b;
}
// animated surfaces: pattern period 8 px so the 16px tile is seamless; shifts 0,3,5 (≈ 8/3 per frame)
const SHIFT = [0, 3, 5];
function tileWater(f) {
  const b = new PixBuf(16, 10), sh = SHIFT[f];
  for (let y = 0; y < 10; y++) for (let x = 0; x < 16; x++) {
    const xs = mod(x - sh, 8);
    let c = y < 2 ? PAL.waterL : y < 5 ? PAL.water : PAL.waterD;
    if (y === 0) c = (xs < 5 ? PAL.waterL : PAL.white);
    else if (y === 1) c = xs < 3 ? PAL.water : PAL.waterL;
    // ripple dashes
    if (y === 3 && xs >= 1 && xs <= 3) c = PAL.waterL;
    if (y === 5 && xs >= 5 && xs <= 7) c = PAL.water;
    if (y === 7 && xs >= 2 && xs <= 3) c = PAL.water;
    if (y >= 6 && bay(x, y) < 0.3) c = PAL.waterD;
    b.set(x, y, c);
  }
  return b;
}
function tileTar(f) {
  const b = new PixBuf(16, 10);
  for (let y = 0; y < 10; y++) for (let x = 0; x < 16; x++) {
    let c = y === 0 ? PAL.tarL : PAL.tar;
    if (y === 0 && bay(x, y) < 0.4) c = PAL.tar;
    if (y === 1 && vn(x, y, 16, 10, 3, 2) > 0.6) c = PAL.tarL;
    if (y > 2 && vn(x + f * 2, y, 16, 10, 3 + f, 2) > 0.93) c = PAL.tarL;
    b.set(x, y, c);
  }
  // bubbles: 2 bubbles at different growth phases per frame (wrap-safe positions)
  const bubs = [[3, 4], [11, 6]];
  bubs.forEach(([bx, by], i) => {
    const ph = (f + i) % 3;
    if (ph === 0) b.set(bx, by, PAL.tarL);
    else if (ph === 1) { b.set(bx, by, PAL.tarL); b.set(bx + 1, by, PAL.tarL); b.set(bx, by - 1, PAL.tarL); b.set(bx + 1, by - 1, PAL.tarL); b.set(bx, by - 1, PAL.white); }
    else { b.set(bx - 1, by, PAL.tarL); b.set(bx + 2, by, PAL.tarL); b.set(bx, by - 1, PAL.tarL); b.set(bx + 1, by - 1, PAL.tarL); b.set(bx, by, PAL.tar); b.set(bx + 1, by, PAL.tar); b.set(bx, by - 2, PAL.tarL); }
  });
  return b;
}
function tileQuick(f) {
  const b = new PixBuf(16, 10), sh = SHIFT[f];
  for (let y = 0; y < 10; y++) for (let x = 0; x < 16; x++) {
    const xs = mod(x - sh, 8), ys = (y + (xs > 3 ? 1 : 0)) % 4;
    let c = y === 0 ? PAL.quick : y < 3 ? PAL.quick : PAL.quickD;
    if (y === 0 && bay(x, y) < 0.5) c = PAL.pathL;
    if (ys === 1 && (xs % 8 < 5)) c = y < 5 ? PAL.quickD : PAL.quick;      // swirl bands that drift with the frame
    if (y >= 5 && bay(x, y) < 0.35) c = PAL.pathD;
    b.set(x, y, c);
  }
  return b;
}
function pitDepth() {
  const b = new PixBuf(16, 16);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const n = vn(x, y, 16, 16, 55, 2);
    let c = n > 0.7 ? PAL.dirt : PAL.dirtD;
    if (n < 0.2 || vn(x, y, 16, 16, 56) > 0.9) c = PAL.tunnelMid;
    if (x < 1 || x > 14) c = bay(x, y) < 0.5 ? PAL.tunnelMid : PAL.dirtD;
    b.set(x, y, c);
  }
  return b;
}

// ------------------------------------------------------------------ ladder
function ladder() {
  const b = new PixBuf(12, 8);
  for (const x of [1, 9]) { b.vline(x, 0, 8, PAL.trunkL); b.vline(x + 1, 0, 8, PAL.trunk); b.set(x, 0, PAL.trunkHL); b.set(x + 1, 7, PAL.trunkD); }
  b.rect(3, 3, 6, 2, PAL.trunkL); b.hline(3, 3, 6, PAL.trunkHL); b.hline(3, 5, 6, PAL.trunkD);
  return b;
}
function ladderTop() {
  const b = ladder();
  b.rect(0, 0, 12, 2, PAL.path); b.hline(0, 0, 12, PAL.pathL); b.hline(0, 1, 12, PAL.pathD);    // hole rim
  b.rect(0, 0, 2, 3, PAL.pathD); b.rect(10, 0, 2, 3, PAL.pathD); b.hline(0, 0, 2, PAL.path); b.hline(10, 0, 2, PAL.path);
  b.rect(2, 0, 8, 1, PAL.tunnelDark); b.rect(2, 1, 8, 1, PAL.tunnelMid);                         // dark opening between rim blocks
  for (const x of [1, 9]) { b.vline(x, 2, 6, PAL.trunkL); b.vline(x + 1, 2, 6, PAL.trunk); }
  return b;
}

// ------------------------------------------------------------------ trunks
function trunk(v) {
  const W = 14, Hh = 64, b = new PixBuf(W, Hh), s = 101 + v * 13;
  const wTop = [8, 9, 8][v], wBot = [12, 14, 13][v];
  for (let y = 0; y < Hh; y++) {
    const t = y / (Hh - 1);
    const flare = Math.max(0, (y - 50) / 13);                       // root flare in the bottom 14 rows
    const sway = Math.round(Math.sin(y * 0.12 + v * 2) * 0.8);
    const w = Math.round(wTop + (wBot - wTop) * Math.pow(flare, 1.4) + (v === 1 ? t * 0.8 : 0));
    const x0 = Math.round((W - w) / 2 + sway * (1 - flare));
    for (let i = 0; i < w; i++) {
      const x = x0 + i, u = i / (w - 1);
      let l = 0.75 - u * 0.65;                                      // light from the left
      const ridge = vn(i + Math.floor(y / 14) * 2, y, 64, 64, s, 1);
      const col = H(i, Math.floor(y / 5), s);
      l += (col - 0.5) * 0.35 + (ridge > 0.85 ? -0.3 : 0);
      if (i % 3 === 1 && H(i, Math.floor(y / 9), s + 1) > 0.45) l -= 0.22; // vertical bark grooves
      let c = tone([PAL.trunkD, PAL.trunk, PAL.trunkL, PAL.trunkHL], clamp(l, 0, 1), x, y, 0.7);
      if (i === 0 || i === w - 1) c = i === 0 ? PAL.trunkL : PAL.trunkD;
      if (i === w - 1 || i === w - 2) c = i === w - 1 ? PAL.trunkD : (bay(x, y) < 0.5 ? PAL.trunkD : PAL.trunk);
      b.set(x, y, c);
    }
    if (y > 5 && y % 11 === (3 + v) && H(y, 1, s) > 0.3) { // knots
      const kx = x0 + 2 + Math.floor(H(y, 2, s) * Math.max(1, w - 5));
      b.set(kx, y, PAL.trunkD); b.set(kx + 1, y, PAL.trunkD); b.set(kx, y + 1, PAL.trunkD);
    }
  }
  // moss tuft near the bottom + hanging vine bit
  for (let i = 0; i < 4; i++) b.set(2 + i * 2 + v, 56 + (i & 1), i & 1 ? PAL.leaf : PAL.leafM);
  return b;
}

// ------------------------------------------------------------------ canopy
function canopyBlobs(w, h, seed, bigR, top) {
  const b = new PixBuf(w, h), r = (k) => H(k, 0, seed);
  // solid band at the top, dithered
  for (let y = 0; y < top; y++) for (let x = 0; x < w; x++) {
    const n = vn(x, y, w, 64, seed, 2);
    b.set(x, y, tone(LEAF.slice(0, 4), 0.25 + n * 0.5 - y / top * 0.15, x, y));
  }
  // back row of big blobs (darker), then front row (brighter), light upper-left
  const n = Math.round(w / (bigR * 1.1));
  for (let k = 0; k < n; k++) {
    const cx = (k + 0.5) * w / n + (r(k) - 0.5) * 4, cy = top - 2 + r(k + 9) * 6, rr = bigR * (0.85 + r(k + 3) * 0.35);
    blob(b, cx, cy, rr * 1.15, rr * 0.9, LEAF.slice(0, 5), w);
  }
  for (let k = 0; k < n + 1; k++) {
    const cx = (k) * w / (n + 1) + (r(k + 40) - 0.5) * 5, cy = top + 2 + r(k + 19) * (h - top - bigR * 0.9 - 3), rr = bigR * (0.5 + r(k + 23) * 0.45);
    blob(b, cx, cy, rr * 1.2, rr, LEAF, w, 0.1);
  }
  return b;
}
function canopy(v) {
  const b = canopyBlobs(64, 36, 201 + v * 17, [8, 9, 7][v], [14, 12, 16][v]);
  // hang tendril leaf points under the cluster
  for (let k = 0; k < 6; k++) {
    const x = Math.floor(H(k, 1, 300 + v) * 64);
    let lowest = -1; for (let y = 35; y >= 0; y--) if (b.has(x, y)) { lowest = y; break; }
    if (lowest > 8 && lowest < 34) { b.set(x, lowest + 1, PAL.leafD); b.set(mod(x + 1, 64), lowest + 1, PAL.leafDark2); }
  }
  return b;
}
function canopyFar(v) {
  const b = canopyBlobs(64, 28, 401 + v * 23, [6, 7][v], [10, 9][v]);
  // push toward the haze: darker, bluish
  return b.map((x, y, p) => (p.a < 128 ? undefined : mixh({ __ink: true, r: p.r, g: p.g, b: p.b, a: 255, emit: 0, gloss: 0, spark: 0 }, PAL.leafDark2, 0.35)));
}

// ------------------------------------------------------------------ parallax layers
const HAZE = [mixh(PAL.peteSuit, PAL.leafDark2, 0.35), PAL.peteSuit, mixh(PAL.peteSuit, PAL.peteSuitL, 0.5), PAL.peteSuitL, mixh(PAL.peteSuitL, PAL.peteStripe, 0.45)];
function mountains() {
  const W = 160, Hh = 48, b = new PixBuf(W, Hh), TAU = Math.PI * 2;
  const ridge = (x, ph, amp, base) => base + amp * (0.5 * Math.sin(TAU * 1 * x / W + ph) + 0.35 * Math.sin(TAU * 3 * x / W + ph * 2.1) + 0.2 * Math.sin(TAU * 7 * x / W + ph * 3.3));
  const tops = new Array(W).fill(0), tops2 = new Array(W).fill(0);
  for (let x = 0; x < W; x++) { tops[x] = Math.round(ridge(x, 0.4, 14, 20)); tops2[x] = Math.round(ridge(x, 2.2, 9, 30)); }
  // far (lighter) range then near (darker) range
  for (let x = 0; x < W; x++) {
    const t0 = clamp(tops[x], 2, 44);
    for (let y = t0; y < Hh; y++) {
      const d = y - t0, shade = x < W && tops[mod(x - 1, W)] > tops[x] ? 0.2 : 0;
      let v = clamp(0.8 - d * 0.045 + shade + (vn(x, y, W, 64, 5, 2) - 0.5) * 0.25, 0, 1);
      if (d <= 1 && tops[mod(x + 1, W)] < tops[x] + 2) v = 1;            // sunlit ridge line
      b.set(x, y, tone(HAZE, v * 0.8 + 0.1, x, y, 0.8));
    }
  }
  for (let x = 0; x < W; x++) {
    const t0 = clamp(tops2[x], 8, 46);
    for (let y = t0; y < Hh; y++) {
      const d = y - t0;
      let v = clamp(0.5 - d * 0.04 + (vn(x, y, W, 64, 6, 2) - 0.5) * 0.3 + (tops2[mod(x - 1, W)] > tops2[x] ? 0.12 : 0), 0, 1);
      b.set(x, y, tone(HAZE.slice(0, 4), v, x, y, 0.8));
    }
  }
  // peaks catch a pale cap
  for (let x = 0; x < W; x++) if (tops[x] <= 8 && tops[x] < tops[mod(x - 1, W)] + 1) { b.set(x, tops[x], PAL.peteStripe); b.set(x, tops[x] + 1, bay(x, 1) < 0.5 ? PAL.peteStripe : HAZE[4]); }
  return b;
}
function bgTrees(v) {
  const W = 160, Hh = 56, b = new PixBuf(W, Hh), s = 500 + v * 31;
  const tone4 = [mixh(PAL.leafDark2, PAL.peteSuit, 0.35), mixh(PAL.leafD, PAL.peteSuit, 0.35), mixh(PAL.leaf, PAL.peteSuitL, 0.4), mixh(PAL.leafM, PAL.peteSuitL, 0.4)];
  const trunkC = mixh(PAL.trunkD, PAL.peteSuit, 0.4);
  const n = 11 + v * 2;
  for (let k = 0; k < n; k++) {
    const cx = (k + 0.5) * W / n + (H(k, 1, s) - 0.5) * 6, top = 10 + Math.floor(H(k, 2, s) * 16), rr = 8 + Math.floor(H(k, 3, s) * 5);
    for (const o of [-W, 0, W]) { // trunk
      for (let y = top + rr; y < Hh; y++) { const x = Math.round(cx + o); b.set(x, y, trunkC); b.set(x + 1, y, mixh(trunkC, PAL.leafDark2, 0.4)); }
    }
    blob(b, cx, top + rr * 0.8, rr * 1.2, rr * 0.8, tone4, W);
    blob(b, cx - rr * 0.7, top + rr * 1.1, rr * 0.8, rr * 0.6, tone4, W);
    blob(b, cx + rr * 0.7, top + rr * 1.0, rr * 0.8, rr * 0.6, tone4, W);
  }
  // understory haze at the base
  for (let y = 40; y < Hh; y++) for (let x = 0; x < W; x++) {
    const f = (y - 40) / 16;
    if (bay(x, y) < f) b.set(x, y, tone4[1]);
    if (y > 50) b.set(x, y, tone4[0]);
  }
  return b;
}
function cloud(v) {
  const b = new PixBuf(40, 14), s = 600 + v * 11;
  const spec = [[[8, 9, 7, 4], [18, 6, 9, 6], [29, 8, 8, 5]], [[10, 9, 8, 4], [22, 7, 10, 6], [32, 9, 6, 4]], [[6, 9, 5, 4], [14, 7, 8, 6], [25, 6, 9, 6], [34, 9, 5, 4]]][v];
  const T = [mixh(PAL.silver, PAL.silverD, 0.35), PAL.silver, mixh(PAL.silver, PAL.white, 0.5), PAL.white];
  for (const [cx, cy, rx, ry] of spec) blob(b, cx, cy, rx, ry, T, 0, 0.15);
  // flat bottom
  for (let y = 11; y < 14; y++) for (let x = 0; x < 40; x++) b.erase(x, y);
  for (let x = 0; x < 40; x++) if (b.has(x, 10)) b.set(x, 10, bay(x, 10) < 0.5 ? T[0] : T[1]);
  void s;
  return b;
}

// ------------------------------------------------------------------ foreground leaves (dark silhouettes, spine from the left edge)
function fgLeaf(v) {
  const W = 40, Hh = 72, b = new PixBuf(W, Hh), s = 700 + v * 19;
  const D = PAL.leafDark2, D1 = PAL.leafD;
  const frond = (x0, y0, len, ang, curl, wid) => {
    let x = x0, y = y0, a = ang; const pts = [];
    for (let i = 0; i < len; i++) {
      pts.push([x, y]); x += Math.cos(a); y += Math.sin(a); a += curl;
    }
    pts.forEach(([px, py], i) => {
      const t = i / len, lw = Math.max(1, Math.round(wid * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.05))));
      b.set(Math.round(px), Math.round(py), D);
      if (i > 2) { // leaflets
        for (let k = 1; k <= lw; k++) {
          b.set(Math.round(px + k * 0.5), Math.round(py - k), D); b.set(Math.round(px - k * 0.4), Math.round(py + k), D);
          if (k > 1) { b.set(Math.round(px + k * 0.8), Math.round(py - k), D); b.set(Math.round(px + k * 0.2), Math.round(py + k + 0), D); }
        }
      }
    });
    // lit edge: top-left facing pixels of the silhouette get the lighter dark tone
    return pts;
  };
  const f = [[0, 14, 34, 0.1, 0.03, 4], [0, 30, 30, -0.35, 0.05, 3], [0, 48, 36, 0.35, -0.03, 4], [0, 62, 24, -0.1, -0.02, 3], [0, 4, 22, 0.55, 0.0, 3]];
  f.forEach(([x0, y0, len, ang, curl, wid], i) => frond(x0, y0 + Math.round((H(i, 1, s) - 0.5) * 6 * (v + 1) / 2), len - v * 2, ang + (v - 1) * 0.12, curl, wid));
  // big leaf blobs at the edge for mass
  blob(b, 0, 22 + v * 4, 7, 9, [D, D, D1], 0);
  blob(b, 0, 55 - v * 5, 8, 10, [D, D, D1], 0);
  // lighter rim on upper-left edges of the silhouette
  const rim = [];
  for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) if (b.has(x, y) && (!b.has(x, y - 1) || !b.has(x - 1, y)) && H(x, y, s) > 0.45) rim.push([x, y]);
  rim.forEach(([x, y]) => b.set(x, y, D1));
  return b;
}

// ------------------------------------------------------------------ decor
function bush(v) {
  const b = new PixBuf(24, 14), cfg = [[[7, 9, 6, 5], [14, 8, 7, 6], [19, 10, 5, 4]], [[6, 10, 5, 4], [12, 7, 7, 6], [18, 9, 6, 5]], [[12, 8, 9, 6], [5, 10, 4, 3], [20, 10, 4, 3]]][v];
  for (const [cx, cy, rx, ry] of cfg) blob(b, cx, cy, rx, ry, LEAF.slice(0, 5), 0);
  for (let x = 2; x < 22; x++) b.set(x, 13, bay(x, 13) < 0.5 ? PAL.leafDark2 : PAL.leafD);
  if (v === 1) { b.set(9, 6, PAL.red); b.set(15, 5, PAL.red); b.set(12, 9, PAL.red); } // berries
  if (v === 2) { b.set(8, 6, PAL.fireL); b.set(16, 7, PAL.fireL); }                     // flowers
  return b;
}
function rock(v) {
  const b = new PixBuf(14, 10), T = [mixh(PAL.dirtD, PAL.tunnelMid, 0.4), PAL.dirtD, PAL.dirt, PAL.dirtL, mixh(PAL.dirtL, PAL.path, 0.4)];
  blob(b, 7, 6, v ? 5.5 : 6.2, v ? 3.6 : 4.2, T, 0);
  if (!v) blob(b, 4, 7, 3.5, 2.5, T, 0);
  for (let x = 2; x < 12; x++) if (b.has(x, 8) || b.has(x, 9)) { /* keep */ }
  b.set(9, 3, PAL.leafM); b.set(10, 4, PAL.leaf); b.set(8, 3, PAL.leafL); b.set(5, 3, PAL.leaf);                    // moss
  return b;
}
function mushroom(v) {
  const b = new PixBuf(10, 10), cap = v ? PAL.hat : PAL.scarf, capD = v ? PAL.hatD : PAL.fireD, capL = v ? PAL.cream : PAL.fire;
  b.rect(4, 6, 2, 4, PAL.cream); b.set(5, 6, PAL.silver); b.set(5, 7, PAL.silver); b.set(5, 9, PAL.silver);
  blob(b, 5, 4.5, 4.5, 3.6, [capD, cap, cap, capL], 0);
  b.hline(1, 6, 8, capD); b.set(0, 6, null === 0 ? capD : capD);
  b.set(3, 3, PAL.white); b.set(6, 2, PAL.white); b.set(7, 4, PAL.white); b.set(4, 4, PAL.white);
  b.set(0, 6, 0 ? PAL.white : PAL.white); b.erase(0, 6);
  return b;
}
function vineKnot() {
  const b = new PixBuf(6, 6);
  b.rect(2, 1, 2, 2, PAL.trunkL); b.rect(1, 3, 4, 2, PAL.trunk); b.hline(1, 4, 4, PAL.trunkD); b.set(2, 1, PAL.trunkHL); b.set(2, 3, PAL.trunkHL);
  b.vline(2, 0, 1, PAL.leaf); b.set(3, 0, PAL.leaf); b.set(4, 1, PAL.leafM); b.set(5, 1, PAL.leafHL); b.set(4, 0, PAL.leafL);
  b.set(3, 5, PAL.trunkD); b.erase(1, 3); b.set(1, 3, PAL.trunk);
  return b;
}
function vinePivot() {
  const b = new PixBuf(12, 10);
  b.rect(0, 1, 10, 5, PAL.trunk); b.hline(0, 1, 10, PAL.trunkHL); b.hline(0, 2, 10, PAL.trunkL); b.hline(0, 5, 10, PAL.trunkD); b.rect(10, 2, 2, 3, PAL.trunkL);
  b.set(11, 3, PAL.trunkD); b.set(3, 3, PAL.trunkD); b.set(6, 4, PAL.trunkD); b.set(8, 3, PAL.trunkL);
  b.rect(5, 6, 2, 3, PAL.trunkD); b.rect(4, 5, 4, 1, PAL.trunk); b.set(5, 9, PAL.leafM);        // hanging attach nub (x 5..6)
  blob(b, 2, 2, 2.4, 1.8, LEAF.slice(1, 5), 0); blob(b, 8, 1.5, 2.6, 1.6, LEAF.slice(1, 5), 0);
  return b;
}

// ------------------------------------------------------------------ ambient
function bat(f) {
  const b = new PixBuf(12, 8), C = PAL.peteFurD, C2 = PAL.peteFur;
  b.rect(5, 3, 2, 3, C); b.set(5, 2, C); b.set(6, 2, C); b.set(5, 1, C2); b.set(6, 1, C2); b.set(5, 4, PAL.red); b.set(6, 4, PAL.red); b.set(5, 6, C);
  if (f === 0) { // wings up
    b.poly([[5, 3], [0, 0], [1, 3], [3, 5]], C); b.poly([[6, 3], [11, 0], [10, 3], [8, 5]], C); b.set(1, 1, C2); b.set(10, 1, C2);
  } else {      // wings down
    b.poly([[5, 3], [0, 6], [2, 4], [3, 3]], C); b.poly([[6, 3], [11, 6], [9, 4], [8, 3]], C); b.set(1, 5, C2); b.set(10, 5, C2);
  }
  return b;
}
function firefly(f) {
  const b = new PixBuf(3, 3);
  b.set(1, 1, PAL.fireL);
  if (f) { b.set(0, 1, PAL.slime); b.set(2, 1, PAL.slime); b.set(1, 0, PAL.slime); b.set(1, 2, PAL.slime); b.set(1, 1, PAL.white); }
  else { b.set(1, 0, PAL.slime); b.set(1, 2, PAL.slime); }
  return b;
}
function star(f) {
  const b = new PixBuf(3, 3);
  b.set(1, 1, PAL.white);
  if (f) { b.set(1, 0, PAL.white); b.set(1, 2, PAL.white); b.set(0, 1, PAL.white); b.set(2, 1, PAL.white); }
  return b;
}
function sun() {
  const b = new PixBuf(20, 20), T = [PAL.silver, PAL.white, PAL.white, PAL.white];
  blob(b, 10, 10, 8.6, 8.6, [mixh(PAL.silver, PAL.silverD, 0.3), PAL.silver, PAL.white, PAL.white], 0, 0.25);
  for (let k = 0; k < 8; k++) { // blocky rays
    const a = k * Math.PI / 4, x = Math.round(10 + Math.cos(a) * 9.6), y = Math.round(10 + Math.sin(a) * 9.6);
    if (k % 2 === 0) { b.set(x, y, PAL.white); } else b.set(x, y, PAL.silver);
  }
  void T;
  return b;
}

// ------------------------------------------------------------------ Pete's billboard
const F35 = {
  P: ['XX.', 'X.X', 'XX.', 'X..', 'X..'], E: ['XXX', 'X..', 'XX.', 'X..', 'XXX'], T: ['XXX', '.X.', '.X.', '.X.', '.X.'], S: ['.XX', 'X..', '.X.', '..X', 'XX.'],
  A: ['.X.', 'X.X', 'XXX', 'X.X', 'X.X'], R: ['XX.', 'X.X', 'XX.', 'X.X', 'X.X'], K: ['X.X', 'X.X', 'XX.', 'X.X', 'X.X'], W: ['X.X', 'X.X', 'X.X', 'XXX', 'X.X'],
  Y: ['X.X', 'X.X', '.X.', '.X.', '.X.'], I: ['XXX', '.X.', '.X.', '.X.', 'XXX'], C: ['.XX', 'X..', 'X..', 'X..', '.XX'], L: ['X..', 'X..', 'X..', 'X..', 'XXX'], "'": ['.X.', '.X.', '...', '...', '...'],
};
function text35(b, str, x, y, c) {
  for (const ch of str) { const g = F35[ch]; if (g) g.forEach((row, j) => [...row].forEach((v, i) => { if (v === 'X') b.set(x + i, y + j, c); })); x += 4; }
}
function signPete(f) {
  const b = new PixBuf(40, 32);
  // posts + staked ground
  b.rect(5, 25, 3, 7, PAL.trunk); b.vline(5, 25, 7, PAL.trunkL); b.vline(7, 25, 7, PAL.trunkD);
  b.rect(32, 25, 3, 7, PAL.trunk); b.vline(32, 25, 7, PAL.trunkL); b.vline(34, 25, 7, PAL.trunkD);
  // board (frame 1 = flapped: top-right corner lifted, right edge shifted down)
  const lift = f ? 1 : 0;
  b.rect(0, 0, 40, 26, PAL.trunkD); b.rect(1, 1, 38, 24, PAL.leafM);
  b.hline(1, 1, 38, PAL.leafHL); b.hline(1, 24, 38, PAL.leafD);
  for (let y = 2; y < 24; y++) for (let x = 2; x < 38; x++) if (bay(x, y) < 0.18 && y > 14) b.set(x, y, PAL.leaf);
  b.rect(0, 0, 1, 26, PAL.trunk); b.set(1, 1, PAL.trunkL);
  // text
  text35(b, "PETE'S", 3, 3, PAL.white); text35(b, 'PARKWAY', 1, 9, PAL.fireL);
  text35(b, 'PICKLES', 11, 18, PAL.white);
  for (const [x, y] of [[3, 3], [0, 0]]) void x, void y;
  // pickle jar (bottom-left)
  b.rect(3, 15, 8, 9, PAL.can); b.rect(4, 16, 6, 7, PAL.leafL); b.rect(4, 14, 6, 1, PAL.gold); b.hline(4, 15, 6, PAL.goldD);
  b.vline(3, 15, 9, PAL.white); b.vline(10, 16, 8, PAL.silverD); b.hline(3, 23, 8, PAL.silverD);
  b.rect(5, 17, 2, 5, PAL.leaf); b.set(5, 17, PAL.leafHL); b.rect(8, 18, 1, 4, PAL.leaf); b.set(8, 18, PAL.leafHL);
  // Pete's grinning face (right)
  b.rect(29, 3, 9, 9, PAL.peteFur); b.rect(28, 5, 1, 5, PAL.peteFur);
  b.rect(29, 1, 2, 3, PAL.peteEar); b.rect(36, 1, 2, 3, PAL.peteEar); b.set(29, 1, PAL.peteFurD); b.set(37, 1, PAL.peteFurD);
  b.rect(29, 5, 9, 2, PAL.peteShade); b.set(33, 5, PAL.peteFurD);                           // shades
  b.set(30, 5, PAL.silverD); b.set(36, 5, PAL.silverD);
  b.rect(31, 8, 6, 1, PAL.peteFurD); b.set(33, 7, PAL.nose);
  b.rect(30, 9, 8, 2, PAL.white); b.set(32, 9, PAL.peteTooth); b.set(32, 10, PAL.peteTooth);   // grin, gold tooth
  b.hline(30, 11, 8, PAL.peteShade); b.set(30, 9, PAL.peteShade); b.set(37, 9, PAL.peteShade);
  b.rect(37, 10, 5, 1, PAL.cheese); b.set(41 > 39 ? 39 : 41, 10, PAL.cheeseD); // cheese stick (clipped at the board edge)
  b.rect(29, 12, 9, 2, PAL.peteSuit); b.set(33, 12, PAL.peteTie); b.set(33, 13, PAL.peteTie);   // collar/suit
  b.set(30, 13, PAL.peteStripe); b.set(36, 13, PAL.peteStripe);
  if (f) { // flap: board's top-right corner curls (corner pixels dropped, edge highlight moved)
    b.erase(39, 0); b.erase(38, 0); b.erase(39, 1); b.set(38, 1, PAL.trunkD); b.set(39, 2, PAL.trunkD); b.set(37, 0, PAL.trunkL);
    b.set(0, 25, PAL.trunkD); b.set(1, 25, PAL.trunkD);
  }
  return b;
}

// ------------------------------------------------------------------ manifest
export function build() {
  return {
    tile_path: [tilePath(0), tilePath(1)],
    tile_dirt: [tileDirt(0), tileDirt(1)],
    tile_ceil: [tileCeil(0), tileCeil(1)],
    tile_brick: tileBrick(),
    tile_tunnel: tileTunnel(),
    tile_water: [0, 1, 2].map(tileWater),
    tile_tar: [0, 1, 2].map(tileTar),
    tile_quick: [0, 1, 2].map(tileQuick),
    pit_depth: pitDepth(),
    ladder: ladder(),
    ladder_top: ladderTop(),
    trunk: [0, 1, 2].map(trunk),
    canopy: [0, 1, 2].map(canopy),
    canopy_far: [0, 1].map(canopyFar),
    bg_mountains: mountains(),
    bg_trees: [0, 1].map(bgTrees),
    cloud: [0, 1, 2].map(cloud),
    fg_leaf: [0, 1, 2].map(fgLeaf),
    bush: [0, 1, 2].map(bush),
    rock: [0, 1].map(rock),
    mushroom: [0, 1].map(mushroom),
    vine_knot: vineKnot(),
    vine_pivot: vinePivot(),
    sign_pete: [0, 1].map(signPete),
    bat: [0, 1].map(bat),
    firefly: [0, 1].map(firefly),
    star: [0, 1].map(star),
    sun: sun(),
  };
}

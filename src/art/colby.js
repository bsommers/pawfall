// art module 'colby': the hero (SuperColby, orange tabby in a caped C-shield shirt) and the villain (Perring Parkway Pete).
// Pure + deterministic; PixBuf only; colours from defs.PAL. Characters get a 1px PAL.outline.
import { PixBuf, hex } from './pixbuf.js';
import { PAL } from '../core/defs.js';

const OUT = PAL.outline;
const same = (b, x, y, col) => { const p = b.get(x, y); return !!p && p.a > 0 && hex(p) === col; };

// ------------------------------------------------------------------ Colby
// Body-part helpers. Everything is drawn into a 16x24 buffer, outline is added last
// (so the art lives inside a 1px margin; feet sit on row 22, outline on row 23).

/** two-pixel-thick limb from (x0,y0) to (x1,y1) */
function limb(b, x0, y0, x1, y1, c, c2 = c) {
  b.line(x0, y0, x1, y1, c); b.line(x0 + 1, y0, x1 + 1, y1, c2);
}
function boot(b, x, y) { // 4x2 boot, toe pointing right, bottom row = y
  b.rect(x - 1, y - 1, 3, 2, PAL.boot); b.set(x + 2, y, PAL.boot); b.set(x - 1, y - 1, PAL.furD);
}
function leg(b, hx, hy, fx, fy) { // hip -> foot, boot at foot
  limb(b, hx, hy, fx, Math.max(hy, fy - 2), PAL.fur, PAL.furD);
  boot(b, fx, fy);
}
function arm(b, sx, sy, hx, hy) { limb(b, sx, sy, hx, hy, PAL.fur, PAL.fur); b.set(hx, hy, PAL.cream); b.set(hx + 1, hy, PAL.cream); }

function tail(b, pts) { // polyline of 2px fur, striped, with light tip
  for (let i = 0; i < pts.length - 1; i++) b.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], PAL.fur);
  pts.forEach(([x, y], i) => { b.set(x, y, i % 2 ? PAL.furD : PAL.fur); });
  const [tx, ty] = pts[pts.length - 1]; b.set(tx, ty, PAL.furL);
}

function eyes(b, y, kind) {
  // two eyes, x=5..6 and x=9..10 (facing right: pupils on the right pixel)
  for (const x of [5, 9]) {
    if (kind === 'blink') { b.hline(x, y + 1, 2, PAL.eyeD); continue; }
    if (kind === 'x') { b.set(x, y, PAL.outline); b.set(x + 1, y + 1, PAL.outline); b.set(x + 1, y, PAL.outline); b.set(x, y + 1, PAL.outline); continue; }
    if (kind === 'dizzy') { b.rect(x, y, 2, 2, PAL.white); b.set(x, y, PAL.outline); b.set(x + 1, y + 1, PAL.outline); continue; }
    if (kind === 'wide') { b.rect(x, y - 1, 2, 3, PAL.eye); b.set(x + 1, y, PAL.eyeD); b.set(x + 1, y - 1, PAL.white); b.set(x, y - 1, PAL.eye); continue; }
    b.rect(x, y, 2, 2, PAL.eye); b.set(x + 1, y + 1, PAL.eyeD); b.set(x + 1, y, PAL.eyeD); b.set(x, y, PAL.white);
  }
}

/** Head + ears + SuperColby shirt (C shield) + belly. o: {dy, eyes, mouth}. Cape is drawn separately, behind. */
function bodyBase(b, o = {}) {
  const dy = o.dy || 0;
  // tall pointed ears (no hat any more)
  b.set(3, 1 + dy, PAL.furD); b.hline(3, 2 + dy, 2, PAL.fur); b.hline(3, 3 + dy, 3, PAL.fur); b.set(4, 3 + dy, PAL.nose);
  b.set(12, 1 + dy, PAL.furD); b.hline(11, 2 + dy, 2, PAL.fur); b.hline(10, 3 + dy, 3, PAL.fur); b.set(11, 3 + dy, PAL.nose);
  // head
  b.rect(3, 4 + dy, 10, 7, PAL.fur);
  b.hline(4, 11 + dy, 8, PAL.fur);
  b.hline(3, 4 + dy, 3, PAL.furL);
  // forehead + cheek stripes
  b.set(7, 4 + dy, PAL.stripe); b.set(8, 5 + dy, PAL.stripe); b.set(9, 4 + dy, PAL.stripe);
  b.set(3, 8 + dy, PAL.stripe); b.set(12, 8 + dy, PAL.stripe);
  // muzzle
  b.rect(7, 9 + dy, 6, 3, PAL.cream); b.hline(6, 10 + dy, 1, PAL.cream);
  b.set(11, 9 + dy, PAL.nose); b.set(10, 9 + dy, PAL.nose);
  if (o.mouth === 'open') { b.rect(9, 11 + dy, 3, 1, PAL.crocMouth); } else if (o.mouth === 'o') { b.set(10, 11 + dy, PAL.crocMouth); b.set(11, 11 + dy, PAL.outline); } else { b.set(10, 11 + dy, PAL.furD); }
  eyes(b, 6 + dy, o.eyes || 'open');
  // blue shirt with the red/yellow C shield
  b.rect(3, 12 + dy, 10, 5, PAL.shirt); b.hline(3, 12 + dy, 3, PAL.shirtL); b.hline(3, 16 + dy, 10, PAL.shirtD);
  b.hline(7, 13 + dy, 5, PAL.shieldR); b.hline(8, 13 + dy, 3, PAL.shieldY); // inverted-triangle shield
  b.hline(8, 14 + dy, 3, PAL.shieldR); b.set(9, 14 + dy, PAL.shieldY);
  b.set(9, 15 + dy, PAL.shieldR);
  // cape clasp on the shoulders
  b.set(3, 12 + dy, PAL.cape); b.set(12, 12 + dy, PAL.cape);
  // round tabby belly below the shirt
  b.rect(4, 17 + dy, 8, 2, PAL.fur);
  b.rect(6, 17 + dy, 5, 2, PAL.cream);
  b.set(4, 17 + dy, PAL.stripe); b.set(4, 18 + dy, PAL.stripe); b.set(11, 18 + dy, PAL.stripe);
  b.hline(4, 19 + dy, 8, PAL.furD);
}

/** orange cape hanging from the shoulders, behind the body (left = behind). */
function cape(dst, dy, kind) {
  const b = new PixBuf(dst.w, dst.h), y = 12 + dy;
  if (kind === 'long') { // streaming out behind (running)
    b.poly([[4, y], [0, y + 1], [0, y + 6], [4, y + 7]], PAL.cape);
    b.hline(0, y + 6, 3, PAL.capeD); b.hline(1, y + 2, 3, PAL.capeL);
  } else if (kind === 'up') { // billowing upward (jump / fall / cheer)
    b.poly([[4, y], [0, y - 4], [0, y - 1], [3, y + 5]], PAL.cape);
    b.set(0, y - 4, PAL.capeL); b.set(1, y - 3, PAL.capeL); b.hline(0, y - 1, 2, PAL.capeD);
  } else { // hanging down behind
    b.rect(2, y, 2, 9, PAL.cape); b.rect(12, y, 2, 8, PAL.cape);
    b.vline(2, y + 2, 7, PAL.capeD); b.vline(13, y + 2, 6, PAL.capeD);
  }
  // only fill empty pixels: the cape always sits behind body, tail and limbs already drawn
  for (let yy = 0; yy < dst.h; yy++) for (let xx = 0; xx < dst.w; xx++) if (b.has(xx, yy) && !dst.has(xx, yy)) dst.set(xx, yy, b.get(xx, yy));
}

function finish(b) { return b.outline(OUT); }
const mk = () => new PixBuf(16, 24);

function idle(f) {
  const b = mk();
  tail(b, f ? [[3, 18], [2, 17], [1, 15], [1, 13], [2, 11], [2, 10]] : [[3, 18], [2, 18], [1, 16], [1, 14], [1, 12], [0, 11]]);
  leg(b, 5, 19, 5, 22); leg(b, 9, 19, 9, 22);
  bodyBase(b, { eyes: f ? 'blink' : 'open' });
  arm(b, 3, 15, 3, 19); arm(b, 11, 15, 12, 19); // wait: arms drawn at sides
  cape(b, 0, f ? 'up' : 'down');
  return finish(b);
}

function run(f) {
  // 6 frames: contact A, down, pass, contact B, down, pass
  const b = mk();
  const bob = [0, 1, 0, 0, 1, 0][f];
  const phase = f / 6 * Math.PI * 2;
  const reach = Math.round(Math.sin(phase) * 3);
  const lift = (s) => Math.max(0, Math.round(-Math.cos(phase + s) * 2.0));
  // two legs in opposite phase
  const f1 = 8 + Math.round(Math.sin(phase) * 3), f2 = 8 - Math.round(Math.sin(phase) * 3);
  const y1 = 22 - Math.max(0, Math.round(Math.cos(phase) * 2)), y2 = 22 - Math.max(0, Math.round(-Math.cos(phase) * 2));
  tail(b, [[3, 17 + bob], [2, 16 + bob], [1, 14 + bob], [0, 12 + bob], [0, 10 + bob + (f % 2)]]);
  leg(b, 6, 19 + bob, f2 - 1, y2); // back leg
  bodyBase(b, { dy: bob });
  leg(b, 9, 19 + bob, f1, y1);   // front leg over body
  arm(b, 3, 15 + bob, 3 - Math.round(reach * 0.5) + 1, 18 + bob - (reach > 0 ? 1 : 0));
  arm(b, 11, 15 + bob, 12 + Math.round(reach * 0.5), 17 + bob);
  cape(b, bob, 'long');
  return finish(b);
}

function jump(f) {
  const b = mk();
  if (f === 0) { // rise: legs trailing, arms up
    tail(b, [[3, 20], [2, 20], [1, 18], [1, 16], [1, 14]]);
    leg(b, 5, 19, 4, 21); leg(b, 9, 19, 11, 21);
    bodyBase(b, { dy: -1, eyes: 'wide', mouth: 'open' });
    arm(b, 3, 14, 2, 10); arm(b, 11, 14, 13, 10);
    cape(b, -1, 'long');
  } else if (f === 1) { // peak: tucked
    tail(b, [[3, 18], [2, 18], [1, 17], [0, 15], [1, 13]]);
    leg(b, 5, 19, 3, 19); leg(b, 9, 19, 12, 19);
    boot(b, 4, 21); boot(b, 10, 21);
    bodyBase(b, { dy: 0, eyes: 'open', mouth: 'open' });
    arm(b, 3, 15, 2, 12); arm(b, 11, 15, 14, 13);
    cape(b, 0, 'up');
  } else { // fall: paws out
    tail(b, [[3, 17], [2, 15], [1, 13], [1, 11], [2, 10]]);
    leg(b, 5, 19, 4, 22); leg(b, 9, 19, 11, 22);
    bodyBase(b, { dy: 0, eyes: 'wide', mouth: 'o' });
    arm(b, 3, 14, 0, 13); arm(b, 11, 14, 14, 13);
    cape(b, 0, 'up');
  }
  return finish(b);
}

function climb(f) { // seen from behind: ears, cape down the back, tail below, paws alternate
  const b = mk();
  const up = f === 0;
  // tail hangs down below the cape
  b.rect(7, 19, 2, 4, PAL.fur); b.set(7, 21, PAL.furD); b.set(8, 22, PAL.furD);
  // legs
  leg(b, 5, 19, 5, up ? 22 : 20); leg(b, 9, 19, 10, up ? 20 : 22);
  // cape covers the back, with fold shading
  b.rect(3, 12, 10, 8, PAL.cape); b.hline(3, 12, 10, PAL.shirt);
  b.vline(5, 14, 6, PAL.capeD); b.vline(9, 14, 6, PAL.capeD); b.vline(7, 13, 5, PAL.capeL);
  b.hline(3, 19, 10, PAL.capeD);
  // head from behind with ears
  b.rect(3, 4, 10, 8, PAL.fur); b.hline(3, 4, 3, PAL.furL);
  b.set(3, 1, PAL.furD); b.hline(3, 2, 2, PAL.fur); b.hline(3, 3, 3, PAL.fur);
  b.set(12, 1, PAL.furD); b.hline(11, 2, 2, PAL.fur); b.hline(10, 3, 3, PAL.fur);
  b.hline(6, 5, 4, PAL.stripe); b.hline(5, 7, 6, PAL.stripe); b.hline(6, 9, 4, PAL.stripe);
  // arms reaching up on the ladder rails
  arm(b, 3, 13, up ? 2 : 3, up ? 7 : 11); arm(b, 11, 13, up ? 12 : 12, up ? 11 : 7);
  return finish(b);
}

function swing(f) { // both paws up top, hanging
  const b = mk();
  tail(b, f ? [[3, 20], [2, 21], [1, 20], [0, 18]] : [[3, 19], [2, 21], [2, 22], [3, 22]]);
  if (f === 0) { leg(b, 5, 19, 5, 22); leg(b, 9, 19, 9, 22); }
  else { leg(b, 5, 19, 3, 21); leg(b, 9, 19, 13, 20); }
  bodyBase(b, { dy: 1 });
  cape(b, 1, f ? 'long' : 'down');
  // arms up along the head sides, paws gripping the vine overhead
  const ax = f ? 1 : 0;
  b.line(3, 15, 2 - ax, 8, PAL.fur); b.line(2 - ax, 8, 2, 2, PAL.fur); b.line(12, 15, 13 + ax, 8, PAL.fur); b.line(13 + ax, 8, 13, 2, PAL.fur);
  b.rect(1, 1, 3, 2, PAL.cream); b.rect(12, 1, 3, 2, PAL.cream);
  return finish(b);
}

function hurt(f) {
  const b = mk();
  const t = f ? 1 : 0;
  tail(b, [[3, 18], [2, 17], [1, 16 - t], [0, 14], [1, 12 + t]]);
  leg(b, 5, 19, 4 + t, 22 - t); leg(b, 9, 19, 11 - t, 22);
  bodyBase(b, { dy: 0, eyes: 'dizzy', mouth: 'o' });
  arm(b, 3, 15, 1, 13 + t); arm(b, 11, 15, 14, 14 - t);
  cape(b, 0, 'up');
  // stars
  b.set(1, 2, PAL.gold); b.set(14, 1 + t, PAL.gold);
  return finish(b);
}

function sink(f) { // arms up, wide eyes, progressively lower
  const b = mk();
  const dy = [1, 4, 8][f];
  tail(b, [[3, 20 + dy], [2, 19 + dy], [1, 17 + dy]]);
  bodyBase(b, { dy, eyes: 'wide', mouth: 'o' });
  arm(b, 3, 14 + dy, 1, 8 + dy); arm(b, 11, 14 + dy, 14, 8 + dy);
  b.set(1, 7 + dy, PAL.cream); b.set(15 - 1, 7 + dy, PAL.cream);
  cape(b, dy, 'up');
  return finish(b);
}

function dead(f) { // KO: X eyes, cape limp on the floor; frame1 = halo
  const b = mk();
  tail(b, [[3, 20], [2, 21], [1, 20], [0, 18]]);
  leg(b, 5, 19, 5, 22); leg(b, 9, 19, 10, 22);
  bodyBase(b, { dy: 1, eyes: 'x', mouth: 'o' });
  arm(b, 3, 16, 3, 20); arm(b, 11, 16, 12, 20);
  if (f === 0) { b.hline(11, 22, 4, PAL.capeD); b.hline(12, 21, 3, PAL.cape); } // cape crumpled beside him
  else { b.hline(5, 0, 6, PAL.gold); b.set(4, 1, PAL.goldD); b.set(11, 1, PAL.goldD); }
  cape(b, 1, 'down');
  return finish(b);
}

function win(f) { // cheering, paws up, cape billowing
  const b = mk();
  const j = f === 1 ? 1 : 0;
  tail(b, [[3, 18 - j], [2, 17 - j], [1, 15 - j], [0, 13 - j], [1, 11 - j]]);
  leg(b, 5, 19 - j, f === 2 ? 3 : 5, 22 - j); leg(b, 9, 19 - j, f === 2 ? 12 : 9, 22 - j);
  bodyBase(b, { dy: 1 - j, eyes: f === 1 ? 'blink' : 'open', mouth: 'open' });
  const ay = 2 - j;
  arm(b, 3, 13 + ay, f === 2 ? 1 : 2, 4 + ay); arm(b, 11, 13 + ay, f === 2 ? 14 : 13, 4 + ay);
  cape(b, 1 - j, f === 2 ? 'long' : 'up');
  return finish(b);
}

function life() { // 8x8 head icon (6x6 art + outline): ears, face, blue collar
  const b = new PixBuf(8, 8);
  b.set(1, 1, PAL.fur); b.set(6, 1, PAL.fur);
  b.rect(1, 2, 6, 4, PAL.fur); b.hline(2, 2, 2, PAL.furL); b.set(1, 1, PAL.nose); b.set(6, 1, PAL.nose);
  b.set(2, 3, PAL.eye); b.set(5, 3, PAL.eye);
  b.set(3, 4, PAL.cream); b.set(4, 4, PAL.cream);
  b.hline(1, 6, 6, PAL.shirt); b.set(3, 6, PAL.shieldR); b.set(4, 6, PAL.shieldY);
  return b.outline(OUT);
}

// ------------------------------------------------------------------ Pete
// Perring Parkway Pete: feral dark sewer rat, red eyes, drooling fangs, scuffed tactical vest.
function ear(b, cx, cy, r) { b.circle(cx, cy, r, PAL.ratD); b.circle(cx, cy, Math.max(1, r - 1), PAL.ratSkin); if (r > 2) b.circle(cx, cy + 1, r - 3, PAL.ratSkinD); }

/** matted-fur texture: deterministic dark/light flecks on body-coloured pixels inside a box */
function matted(b, x0, y0, x1, y1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!same(b, x, y, PAL.rat) && !same(b, x, y, PAL.ratBelly)) continue;
    const h = (x * 7 + y * 13) % 11;
    if (h === 0) b.set(x, y, PAL.ratD); else if (h === 5 && (x + y) % 2) b.set(x, y, PAL.ratL);
  }
}

/** Pete's head. (x,y) = head centre, s = 'L' | 'M' | 'S'. open: jaws open (snarl/laugh). */
function peteHead(b, x, y, s, open) {
  const k = { L: { rx: 9, ry: 7, ear: 4, sl: 9 }, M: { rx: 6, ry: 5, ear: 3, sl: 6 }, S: { rx: 5, ry: 4, ear: 2, sl: 5 } }[s];
  ear(b, x - 3, y - k.ry, k.ear);
  b.ellipse(x, y, k.rx, k.ry, PAL.rat);
  // long pointed snout, slightly drooping
  const tipx = x + k.rx + k.sl - 3, my = y + Math.round(k.ry / 2);
  b.poly([[x + 1, y - k.ry + 2], [tipx, y + 1], [tipx, y + 2], [x + 2, y + k.ry]], PAL.rat);
  // rim light along the top of the skull and snout (light from upper-left)
  for (let xx = x - k.rx + 1; xx < tipx - 1; xx++) for (let yy = y - k.ry - 1; yy < y + 2; yy++) {
    if (same(b, xx, yy, PAL.rat)) { b.set(xx, yy, PAL.ratL); break; }
  }
  b.rect(tipx - 1, y, 2, 2, PAL.ratSkin); b.set(tipx, y, PAL.ratSkinD);           // nose
  // glowing red eye under an angry brow
  const ex = x + Math.round(k.rx / 2), ey = y - Math.round(k.ry / 3);
  if (s === 'S') { b.set(ex, ey, PAL.ratEye); b.set(ex + 1, ey, PAL.ratEye); }
  else { b.rect(ex, ey, 2, 2, PAL.ratEye); b.set(ex, ey, PAL.ratEyeL); }
  b.line(ex - 1, ey - 2, ex + 2, ey - 1, PAL.ratD);
  // jaws, fangs, drool
  const m0 = x + 1, mw = tipx - m0 - 1, fx = tipx - (s === 'L' ? 5 : s === 'M' ? 4 : 3);
  if (open) {
    const mh = s === 'L' ? 5 : s === 'M' ? 4 : 3;
    // jaw dropped open: a wedge, wide at the tip, hinged at the cheek
    b.poly([[m0, my], [tipx, my - 1], [tipx - 1, my + mh], [m0 + 1, my + 1]], PAL.crocMouth);
    b.line(m0, my, tipx, my - 1, PAL.outline);
    b.line(m0 + 1, my + 2, tipx - 1, my + mh + 1, PAL.rat); b.line(m0 + 2, my + 3, tipx - 2, my + mh + 2, PAL.rat); // lower jaw
    b.vline(fx, my, 2, PAL.fang); b.vline(fx - 3, my, 2, PAL.fang);                // upper fangs
    if (s === 'L') b.set(fx - 1, my, PAL.fang);
    b.set(fx - 1, my + mh - 1, PAL.fang); b.set(fx - 2, my + mh - 1, PAL.fang);      // lower teeth
    if (s !== 'S') { b.set(fx - 4, my + mh + 2, PAL.drool); b.set(fx - 4, my + mh + 3, PAL.drool); b.set(fx - 4, my + 2, PAL.drool); }
  } else {
    b.hline(m0, my, mw, PAL.outline);
    b.set(fx, my + 1, PAL.fang); if (s === 'L') b.set(fx, my + 2, PAL.fang);        // fang over the lip
    b.set(fx - 2, my + 1, PAL.drool); if (s !== 'S') b.set(fx - 2, my + 2, PAL.drool);
  }
  // whiskers
  if (s !== 'S') { b.line(tipx - 3, y + 1, tipx + 1, y - 2, PAL.ratL); b.line(tipx - 3, y + 2, tipx + 2, y + 3, PAL.ratL); }
  return { tipx, my, tx: fx };
}

/** clawed rat hand: pink fingers hanging from (x,y) */
function claw(b, x, y) {
  b.rect(x - 1, y, 3, 2, PAL.ratSkin);
  b.set(x - 1, y + 2, PAL.ratSkinD); b.set(x + 1, y + 2, PAL.ratSkinD); b.set(x, y + 3, PAL.ratSkinD);
}

function pete(f, laugh) {
  const b = new PixBuf(40, 48);
  const dy = laugh ? (f ? 1 : 0) : 0;      // body bounce
  const sh = laugh ? (f ? 1 : -1) : 0;     // shake
  const hb = laugh ? (f ? -1 : 0) : (f ? 1 : 0);      // head bob / breathing
  // long pink tail curling out the back
  b.line(10, 40, 4, 44, PAL.ratSkin); b.line(4, 44, 1, 40, PAL.ratSkin); b.line(1, 40, 2, 33, PAL.ratSkin); b.line(2, 33, 5, 29, PAL.ratSkin);
  b.line(10, 41, 5, 45, PAL.ratSkinD);
  // hunched legs + clawed pink feet
  b.rect(12, 40, 5, 5, PAL.rat); b.rect(24, 40, 5, 5, PAL.rat);
  b.rect(10, 45, 8, 2, PAL.ratSkin); b.rect(23, 45, 9, 2, PAL.ratSkin);
  b.set(10, 46, PAL.ratSkinD); b.set(17, 46, PAL.ratSkinD); b.set(31, 46, PAL.ratSkinD); b.set(28, 46, PAL.ratSkinD);
  // body: lean-but-hunched torso, lighter belly
  b.ellipse(20 + sh, 33 + dy, 12, 10, PAL.rat);
  b.ellipse(20 + sh, 25, 10, 7, PAL.rat);
  b.ellipse(20 + sh, 36 + dy, 7, 6, PAL.ratBelly);
  // tactical vest: two chest plates, straps, waist band
  b.rect(11 + sh, 21, 8, 9, PAL.vest); b.rect(21 + sh, 21, 8, 9, PAL.vest);
  b.hline(11 + sh, 21, 8, PAL.vestL); b.hline(21 + sh, 21, 8, PAL.vestL);
  b.vline(19 + sh, 21, 9, PAL.vestD); b.vline(20 + sh, 21, 9, PAL.vestD);
  b.rect(13 + sh, 24, 4, 2, PAL.vestD); b.rect(23 + sh, 24, 4, 2, PAL.vestD);      // pouches
  b.vline(13 + sh, 17, 4, PAL.vestD); b.vline(26 + sh, 17, 4, PAL.vestD);           // shoulder straps
  b.hline(10 + sh, 30, 20, PAL.vestD);
  b.set(15 + sh, 31, PAL.ratBelly); b.set(18 + sh, 31, PAL.ratBelly); b.set(23 + sh, 31, PAL.ratBelly); // torn fur under the vest
  // skinny arms hanging forward, claws out
  b.line(9 + sh, 22, 6 + sh, 32 + dy, PAL.rat); b.line(10 + sh, 22, 7 + sh, 32 + dy, PAL.ratD);
  claw(b, 7 + sh, 33 + dy);
  b.line(30 + sh, 22, 33 + sh, 32 + dy, PAL.rat); b.line(31 + sh, 22, 34 + sh, 32 + dy, PAL.ratD);
  claw(b, 34 + sh, 33 + dy);
  matted(b, 0, 16, 39, 45);
  // head
  peteHead(b, 18 + sh, 12 + hb, 'L', laugh);
  matted(b, 8, 4, 30, 18);
  return b.outline(OUT);
}

function peteBranch(f) { // 24x24, anchor bottom-centre: head + claws over a branch
  const b = new PixBuf(24, 24);
  // branch
  b.rect(0, 19, 24, 3, PAL.trunk); b.hline(0, 19, 24, PAL.trunkL); b.hline(0, 21, 24, PAL.trunkD);
  b.rect(1, 22, 3, 1, PAL.leaf); b.rect(18, 22, 4, 1, PAL.leaf);
  if (f === 0) { // peeking over the branch
    b.rect(7, 16, 8, 3, PAL.vest); b.hline(7, 16, 8, PAL.vestL);
    peteHead(b, 8, 11, 'M', false);
    b.rect(4, 17, 3, 2, PAL.ratSkin); b.set(4, 19, PAL.ratSkinD); b.rect(15, 17, 3, 2, PAL.ratSkin); b.set(17, 19, PAL.ratSkinD);
  } else { // snarling, throwing a cheese wheel
    b.rect(6, 16, 8, 3, PAL.vest); b.hline(6, 16, 8, PAL.vestL);
    peteHead(b, 8, 10, 'M', true);
    b.line(14, 15, 17, 7, PAL.rat); b.line(15, 15, 18, 7, PAL.ratD); b.rect(17, 5, 3, 2, PAL.ratSkin);
    b.circle(21, 3, 2, PAL.cheese); b.set(21, 3, PAL.cheeseHole);
    b.rect(4, 17, 3, 2, PAL.ratSkin); b.set(4, 19, PAL.ratSkinD);
  }
  return b.outline(OUT);
}

function peteIcon(f) { // 16x16 head for taunt banners (frame1 = snarl)
  const b = new PixBuf(16, 16);
  peteHead(b, 6, 9, 'S', !!f);
  return b.outline(OUT);
}

const seq = (n, fn) => Array.from({ length: n }, (_, i) => fn(i));

export function build() {
  return {
    colby_idle: seq(2, idle),
    colby_run: seq(6, run),
    colby_jump: seq(3, jump),
    colby_climb: seq(2, climb),
    colby_swing: seq(2, swing),
    colby_hurt: seq(2, hurt),
    colby_sink: seq(3, sink),
    colby_dead: seq(2, dead),
    colby_win: seq(3, win),
    colby_life: life(),
    pete_idle: seq(2, (f) => pete(f, false)),
    pete_laugh: seq(2, (f) => pete(f, true)),
    pete_branch: seq(2, peteBranch),
    pete_head: seq(2, peteIcon),
  };
}

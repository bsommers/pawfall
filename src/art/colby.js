// art module 'colby': the hero (Colby, orange tabby explorer) and the villain (Perring Parkway Pete).
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

/** Head + helmet + scarf + torso. o: {dy, eyes, hat, mouth, tilt} */
function bodyBase(b, o = {}) {
  const dy = o.dy || 0;
  // ears (pointy, poking out beside the helmet)
  for (const x of [3, 12]) { b.set(x, 3 + dy, PAL.furD); b.set(x, 4 + dy, PAL.fur); b.set(x, 5 + dy, PAL.nose); }
  // head
  b.rect(3, 5 + dy, 10, 6, PAL.fur);
  b.hline(4, 11 + dy, 8, PAL.fur);
  b.hline(3, 5 + dy, 3, PAL.furL);
  // forehead stripes
  b.set(7, 5 + dy, PAL.stripe); b.set(8, 5 + dy, PAL.stripe); b.set(9, 5 + dy, PAL.stripe);
  b.set(3, 8 + dy, PAL.stripe); b.set(12, 8 + dy, PAL.stripe);
  // muzzle
  b.rect(7, 9 + dy, 6, 3, PAL.cream); b.hline(6, 10 + dy, 1, PAL.cream);
  b.set(11, 9 + dy, PAL.nose); b.set(10, 9 + dy, PAL.nose);
  if (o.mouth === 'open') { b.rect(9, 11 + dy, 3, 1, PAL.crocMouth); } else if (o.mouth === 'o') { b.set(10, 11 + dy, PAL.crocMouth); b.set(11, 11 + dy, PAL.outline); } else { b.set(10, 11 + dy, PAL.furD); }
  eyes(b, 7 + dy, o.eyes || 'open');
  // helmet
  if (o.hat !== false) {
    b.rect(5, 1 + dy, 6, 2, PAL.hat); b.rect(4, 3 + dy, 8, 1, PAL.hat);
    b.set(5, 1 + dy, PAL.hat); b.hline(5, 1 + dy, 2, '#e8d68a');
    b.hline(3, 4 + dy, 10, PAL.hatBand);
    b.hline(2, 5 + dy, 12, PAL.hatD); b.set(14, 5 + dy, PAL.hatD);
    b.set(7, 2 + dy, '#e8d68a');
  }
  // scarf
  b.hline(3, 12 + dy, 10, PAL.scarf); b.hline(4, 13 + dy, 8, PAL.scarf);
  b.hline(3, 12 + dy, 3, '#ff6a58');
  // torso
  b.rect(4, 14 + dy, 8, 5, PAL.fur);
  b.rect(8, 14 + dy, 3, 4, PAL.cream);
  b.hline(4, 14 + dy, 3, PAL.furL);
  b.set(4, 16 + dy, PAL.stripe); b.set(5, 16 + dy, PAL.stripe); b.set(4, 18 + dy, PAL.stripe); b.set(5, 18 + dy, PAL.stripe);
  b.set(11, 17 + dy, PAL.stripe);
  b.hline(4, 19 + dy, 8, PAL.furD); // belt/shadow
}

function scarfTail(b, dy, kind) { // flutters behind (left)
  const y = 12 + dy;
  if (kind === 'long') { b.hline(0, y + 1, 3, PAL.scarf); b.hline(0, y + 2, 2, PAL.scarf); b.set(0, y, PAL.scarf); }
  else if (kind === 'up') { b.set(2, y - 1, PAL.scarf); b.set(1, y - 2, PAL.scarf); b.set(2, y, PAL.scarf); }
  else { b.set(2, y + 1, PAL.scarf); b.set(2, y + 2, PAL.scarf); b.set(3, y + 2, PAL.scarf); }
}

function finish(b) { return b.outline(OUT); }
const mk = () => new PixBuf(16, 24);

function idle(f) {
  const b = mk();
  tail(b, f ? [[3, 18], [2, 17], [1, 15], [1, 13], [2, 11], [2, 10]] : [[3, 18], [2, 18], [1, 16], [1, 14], [1, 12], [0, 11]]);
  leg(b, 5, 19, 5, 22); leg(b, 9, 19, 9, 22);
  bodyBase(b, { eyes: f ? 'blink' : 'open' });
  arm(b, 3, 15, 3, 19); arm(b, 11, 15, 12, 19); // wait: arms drawn at sides
  scarfTail(b, 0, f ? 'up' : 'down');
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
  scarfTail(b, bob, 'long');
  return finish(b);
}

function jump(f) {
  const b = mk();
  if (f === 0) { // rise: legs trailing, arms up
    tail(b, [[3, 20], [2, 20], [1, 18], [1, 16], [1, 14]]);
    leg(b, 5, 19, 4, 21); leg(b, 9, 19, 11, 21);
    bodyBase(b, { dy: -1, eyes: 'wide', mouth: 'open' });
    arm(b, 3, 14, 2, 10); arm(b, 11, 14, 13, 10);
    scarfTail(b, -1, 'long');
  } else if (f === 1) { // peak: tucked
    tail(b, [[3, 18], [2, 18], [1, 17], [0, 15], [1, 13]]);
    leg(b, 5, 19, 3, 19); leg(b, 9, 19, 12, 19);
    boot(b, 4, 21); boot(b, 10, 21);
    bodyBase(b, { dy: 0, eyes: 'open', mouth: 'open' });
    arm(b, 3, 15, 2, 12); arm(b, 11, 15, 14, 13);
    scarfTail(b, 0, 'up');
  } else { // fall: paws out
    tail(b, [[3, 17], [2, 15], [1, 13], [1, 11], [2, 10]]);
    leg(b, 5, 19, 4, 22); leg(b, 9, 19, 11, 22);
    bodyBase(b, { dy: 0, eyes: 'wide', mouth: 'o' });
    arm(b, 3, 14, 0, 13); arm(b, 11, 14, 14, 13);
    scarfTail(b, 0, 'up');
  }
  return finish(b);
}

function climb(f) { // seen from behind: back of helmet, tail down, paws alternate
  const b = mk();
  const up = f === 0;
  // tail hangs down the back
  b.rect(7, 19, 2, 4, PAL.fur); b.set(7, 21, PAL.furD); b.set(8, 22, PAL.furD);
  // legs
  leg(b, 5, 19, 5, up ? 22 : 20); leg(b, 9, 19, 10, up ? 20 : 22);
  // back torso
  b.rect(4, 12, 8, 7, PAL.fur); b.hline(4, 12, 8, PAL.scarf); b.hline(4, 13, 8, PAL.scarf);
  b.set(5, 15, PAL.stripe); b.set(6, 15, PAL.stripe); b.set(9, 15, PAL.stripe); b.set(10, 15, PAL.stripe); b.hline(5, 17, 6, PAL.stripe);
  b.hline(4, 14, 3, PAL.furL);
  // head from behind
  b.rect(3, 5, 10, 8, PAL.fur); b.hline(3, 5, 3, PAL.furL);
  for (const x of [3, 12]) { b.set(x, 3, PAL.furD); b.set(x, 4, PAL.fur); }
  b.rect(4, 1, 8, 4, PAL.hat); b.hline(5, 1, 3, '#e8d68a');
  b.hline(3, 4, 10, PAL.hatBand); b.hline(2, 5, 12, PAL.hatD);
  b.hline(6, 6, 4, PAL.hatD); // hat shadow on neck
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
  scarfTail(b, 1, f ? 'long' : 'down');
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
  scarfTail(b, 0, 'up');
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
  scarfTail(b, dy, 'up');
  return finish(b);
}

function dead(f) { // flat KO: lying on back? keep upright ghost-ish: X eyes, hat off, tongue out
  const b = mk();
  tail(b, [[3, 20], [2, 21], [1, 20], [0, 18]]);
  leg(b, 5, 19, 5, 22); leg(b, 9, 19, 10, 22);
  bodyBase(b, { dy: 1, hat: false, eyes: 'x', mouth: 'o' });
  arm(b, 3, 16, 3, 20); arm(b, 11, 16, 12, 20);
  // hat flopped on the floor beside (right)... small
  if (f === 0) { b.rect(12, 21, 3, 1, PAL.hatD); b.hline(12, 20, 3, PAL.hat); b.set(13, 20, PAL.hatBand); }
  else { // halo floating, hat gone
    b.hline(5, 0, 6, PAL.gold); b.set(4, 1, PAL.goldD); b.set(11, 1, PAL.goldD);
  }
  return finish(b);
}

function win(f) { // cheering, paws up, helmet tossed
  const b = mk();
  const j = f === 1 ? 1 : 0;
  tail(b, [[3, 18 - j], [2, 17 - j], [1, 15 - j], [0, 13 - j], [1, 11 - j]]);
  leg(b, 5, 19 - j, f === 2 ? 3 : 5, 22 - j); leg(b, 9, 19 - j, f === 2 ? 12 : 9, 22 - j);
  bodyBase(b, { dy: 2 - j - 1 + 0, hat: false, eyes: f === 1 ? 'blink' : 'open', mouth: 'open' });
  const ay = 2 - j;
  arm(b, 3, 15 + ay - 2, f === 2 ? 1 : 2, 4 + ay); arm(b, 11, 15 + ay - 2, f === 2 ? 14 : 13, 4 + ay);
  scarfTail(b, 1 - j, 'long');
  // tossed helmet above
  const hx = [5, 6, 7][f], hy = [1, 0, 1][f];
  b.hline(hx, hy, 5, PAL.hat); b.hline(hx - 1, hy + 1, 7 > 0 ? 7 : 0, PAL.hatD); b.hline(hx, hy + 1, 5, PAL.hatBand);
  return finish(b);
}

function life() { // 8x8 head icon (6x6 art + outline)
  const b = new PixBuf(8, 8);
  b.hline(2, 1, 4, PAL.hat); b.hline(1, 2, 6, PAL.hatD); b.set(4, 1, PAL.hatBand);
  b.rect(1, 3, 6, 3, PAL.fur); b.hline(2, 3, 2, PAL.furL);
  b.set(0, 2, PAL.fur); b.set(7, 2, PAL.fur);
  b.set(2, 4, PAL.eye); b.set(5, 4, PAL.eye);
  b.set(3, 5, PAL.cream); b.set(4, 5, PAL.cream);
  b.hline(2, 6, 4, PAL.scarf);
  return b.outline(OUT);
}

// ------------------------------------------------------------------ Pete
function ear(b, cx, cy, r) { b.circle(cx, cy, r, PAL.peteFurD); b.circle(cx + (r > 2 ? 0 : 0), cy, Math.max(1, r - 2), PAL.peteEar); }

/** Pete's head. (x,y) = head centre, s = 'L' | 'M' | 'S'. open: mouth open (laugh/grin). */
function peteHead(b, x, y, s, open) {
  const k = { L: { rx: 10, ry: 8, ear: 4, sl: 8 }, M: { rx: 7, ry: 6, ear: 3, sl: 5 }, S: { rx: 6, ry: 5, ear: 2, sl: 4 } }[s];
  ear(b, x - k.rx + 2, y - k.ry + 1, k.ear); ear(b, x + 1, y - k.ry + (s === 'L' ? 0 : 1), k.ear);
  b.ellipse(x, y, k.rx, k.ry, PAL.peteFur);
  b.ellipse(x - 2, y - 2, Math.max(2, k.rx - 4), Math.max(2, k.ry - 3), '#9a96a8'); // light from upper-left
  // pointed snout
  const tipx = x + k.rx + k.sl - 3, my = y + k.ry - 2;
  b.poly([[x + 2, y - 2], [tipx, y + 1], [tipx, y + 3], [x + 3, y + k.ry - 1]], PAL.peteFur);
  b.rect(tipx - 1, y, 2, 2, PAL.nose);
  // shades: wide wrap-around lens + glint
  const sw = Math.round(k.rx * 1.1), sh = s === 'S' ? 3 : 4;
  b.rect(x - 2, y - 3, sw, sh, PAL.peteShade); b.hline(x - 5, y - 3, 3, PAL.peteShade);
  b.set(x - 1, y - 3, '#4a4468'); b.set(x, y - 3, '#4a4468'); b.set(x + 3, y - 2, '#4a4468');
  // mouth + gold tooth
  const m0 = x + 2, tx = tipx - (s === 'L' ? 8 : s === 'M' ? 6 : 5);
  if (open) {
    b.rect(m0, my - 1, tipx - m0 - 1, s === 'L' ? 4 : 3, PAL.crocMouth); b.hline(m0, my - 1, tipx - m0 - 1, PAL.outline);
    b.rect(tx, my, 2, 2, PAL.peteTooth); b.set(tx, my, '#fff0a0');
  } else {
    b.hline(m0, my, tipx - m0 - 1, PAL.outline);
    b.rect(tx, my + 1, 2, s === 'L' ? 3 : 2, PAL.peteTooth); b.set(tx, my + 1, '#fff0a0');
  }
  return { tipx, my, tx };
}

function cheeseStick(b, x0, y0, x1, y1) {
  b.line(x0, y0, x1, y1, PAL.cheese); b.line(x0, y0 + 1, x1, y1 + 1, PAL.cheeseD);
  b.set(x1, y1, PAL.cheeseHole);
}

function pete(f, laugh) {
  const b = new PixBuf(40, 48);
  const dy = laugh ? (f ? 1 : 0) : 0;      // belly bounce
  const sh = laugh ? (f ? 1 : -1) : 0;     // shake
  const hb = laugh ? (f ? -1 : 0) : (f ? 1 : 0);      // head bob / breathing
  // tail (pink, curling out the back)
  b.line(8, 40, 3, 42, PAL.peteEar); b.line(3, 42, 2, 38, PAL.peteEar); b.line(2, 38, 5, 34, PAL.peteEar);
  // legs + shoes
  b.rect(11, 41, 6, 5, PAL.peteSuit); b.rect(23, 41, 6, 5, PAL.peteSuit);
  b.rect(10, 45, 8, 2, PAL.peteShade); b.rect(22, 45, 9, 2, PAL.peteShade);
  b.hline(10, 45, 3, '#3a3450');
  // body: big pear
  b.ellipse(20 + sh, 33 + dy, 15, 11, PAL.peteSuit);
  b.ellipse(20 + sh, 26, 11, 7, PAL.peteSuit);
  b.ellipse(15 + sh, 30 + dy, 7, 6, PAL.peteSuitL); // light, upper-left
  // pinstripes on suit
  for (let x = 4; x < 38; x += 3) for (let y = 20; y < 46; y++) { if (same(b, x, y, PAL.peteSuit) || same(b, x, y, PAL.peteSuitL)) b.set(x, y, same(b, x, y, PAL.peteSuit) ? PAL.peteSuitL : PAL.peteStripe); }
  // shirt + tie
  b.poly([[17 + sh, 21], [26 + sh, 21], [22 + sh, 30 + dy]], PAL.white);
  b.poly([[20 + sh, 22], [24 + sh, 22], [23 + sh, 24], [22 + sh, 33 + dy], [21 + sh, 24]], PAL.peteTie);
  b.line(16 + sh, 21, 20 + sh, 31 + dy, PAL.outline); b.line(27 + sh, 21, 23 + sh, 31 + dy, PAL.outline);
  // belt / gold buckle
  b.hline(8 + sh, 38 + dy, 25, PAL.peteShade); b.rect(19 + sh, 37 + dy, 4, 3, PAL.gold);
  // arms: far arm on belly, near arm up holding lapel / waving
  b.ellipse(31 + sh, 32 + dy, 4, 6, PAL.peteSuit); b.circle(30 + sh, 37 + dy, 2, PAL.peteFur);
  b.ellipse(9 + sh, 31 + dy, 3, 6, PAL.peteSuit); b.circle(10 + sh, 36 + dy, 2, PAL.peteFur);
  // head
  const h = peteHead(b, 20 + sh, 13 + hb, 'L', laugh);
  // cheese stick in mouth, jutting right and up
  cheeseStick(b, h.tx + 3, h.my + (laugh ? 1 : 0), h.tipx + 3, h.my - (laugh ? 3 + f : 2));
  b.set(h.tipx - 3, h.my - 5, PAL.outline); b.set(h.tipx - 4, h.my - 5, PAL.outline);
  // collar
  b.hline(14 + sh, 21, 13, PAL.white);
  return b.outline(OUT);
}

function peteBranch(f) { // 24x24, anchor bottom-centre: head + paws over a branch
  const b = new PixBuf(24, 24);
  // branch
  b.rect(0, 19, 24, 3, PAL.trunk); b.hline(0, 19, 24, PAL.trunkL); b.hline(0, 21, 24, PAL.trunkD);
  b.rect(1, 22, 3, 1, PAL.leaf); b.rect(18, 22, 4, 1, PAL.leaf);
  if (f === 0) { // peeking over the branch
    const h = peteHead(b, 9, 11, 'M', false);
    b.rect(5, 17, 3, 3, PAL.peteFur); b.rect(15, 17, 3, 3, PAL.peteFur);
    b.rect(8, 17, 7, 3, PAL.peteSuit);
    cheeseStick(b, h.tx + 3, h.my, h.tipx + 1, h.my - 1);
  } else { // hanging pose throwing a cheese wheel
    peteHead(b, 9, 10, 'M', true);
    b.rect(6, 16, 8, 4, PAL.peteSuit); b.hline(7, 16, 6, PAL.peteStripe);
    b.rect(14, 12, 3, 3, PAL.peteSuit); b.rect(16, 8, 3, 4, PAL.peteSuit); b.rect(17, 5, 3, 3, PAL.peteFur);
    b.circle(21, 3, 2, PAL.cheese); b.set(21, 3, PAL.cheeseHole);
    b.rect(5, 19, 3, 3, PAL.peteFur);
  }
  return b.outline(OUT);
}

function peteIcon(f) { // 16x16 head for taunt banners
  const b = new PixBuf(16, 16);
  const h = peteHead(b, 6, 8, 'S', !!f);
  if (!f) cheeseStick(b, h.tx + 3, h.my, h.tipx + 1, h.my - 1);
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

// art module 'critters': hazards (logs, Pete's cheese, fire, cobra, scorpion, croc heads) + treasures + thrown cheese.
// Pure + deterministic; PixBuf only; colours from defs.PAL. Everything is drawn inside a 1px margin and
// then given a 1px PAL.outline, so the bottom row of every frame is the feet / waterline row.
import { PixBuf } from './pixbuf.js';
import { PAL } from '../core/defs.js';

const O = PAL.outline;
const mk = (w, h) => new PixBuf(w, h);
const done = (b) => b.outline(O);

// ------------------------------------------------------------------ logs
function logBody(b, x0, x1) { // horizontal cylinder body between columns x0..x1, rows 1..8
  b.rect(x0, 1, x1 - x0 + 1, 8, PAL.log);
  b.hline(x0, 1, x1 - x0 + 1, PAL.logRing);            // light from upper-left: bright top edge
  b.hline(x0, 8, x1 - x0 + 1, PAL.logD);               // dark underside
  b.hline(x0, 7, x1 - x0 + 1, PAL.logD);
  for (const [x, y] of [[x0, 1], [x1, 1], [x0, 8], [x1, 8]]) b.erase(x, y); // rounded corners
}
function cap(b, cx, cy, spin) { // end-grain disc with rings; `spin` rotates the pith/crack
  b.ellipse(cx, cy, 2.2, 3.6, PAL.logRing);
  b.ring(cx, cy, 2.2, 3.6, PAL.logD, 1);
  b.set(cx, cy, PAL.logD);
  const off = [[0, -2], [1, -1], [0, 2], [-1, 1]][spin % 4];
  b.set(cx + off[0], cy + off[1], PAL.log);
  b.set(cx, cy - 1, PAL.log);
}
function rollingLog(f) {
  const b = mk(16, 10);
  logBody(b, 3, 14);
  for (let k = 0; k < 2; k++) { // bark grooves scroll vertically = rotation
    const y = 2 + ((f * 2 + k * 4) % 7);
    b.hline(5, y, 6 + (f % 2), PAL.logD);
    b.hline(10 + (k ? 0 : 1), y + 1 > 7 ? 2 : y + 1, 3, PAL.logD);
  }
  b.set(12 - (f % 3), 2 + ((f * 2) % 5), PAL.logRing);
  cap(b, 3, 4.5, f);
  return done(b);
}
function stillLog() {
  const b = mk(18, 10);
  logBody(b, 3, 14);
  b.hline(6, 4, 7, PAL.logD); b.hline(9, 6, 4, PAL.logD); b.set(5, 6, PAL.logD);
  cap(b, 3, 4.5, 0); cap(b, 14, 4.5, 2);
  b.set(15, 4, PAL.logRing); b.set(16, 4, PAL.logD); // knot-stub: little branch stump on the end
  b.rect(15, 3, 2, 3, PAL.log);
  b.set(16, 3, PAL.logRing);
  return done(b);
}

// ------------------------------------------------------------------ Pete's cheese wheel
function cheeseWheel(f) {
  const b = mk(14, 14);
  b.circle(7, 7, 6, PAL.cheeseD);
  b.circle(6.5, 6.5, 5.3, PAL.cheese);
  b.hline(4, 2, 5, '#ffe98a'); // glint (upper-left light)
  const a0 = f * (Math.PI / 4);
  for (const [r, a, rr] of [[3.4, 0, 1.2], [3.2, 2.2, 1.0], [3.5, 4.1, 1.1]]) {
    const x = 6.5 + Math.cos(a0 + a) * r, y = 6.5 + Math.sin(a0 + a) * r;
    b.ellipse(x, y, rr, rr, PAL.cheeseHole);
  }
  b.set(6, 6, PAL.cheeseHole); b.set(7, 7, PAL.cheeseD); // hub
  // wedge-cut seam rotating with the wheel
  const sx = 6.5 + Math.cos(a0 + 1) * 5, sy = 6.5 + Math.sin(a0 + 1) * 5;
  b.line(7, 7, Math.round(sx), Math.round(sy), PAL.cheeseD);
  return done(b);
}
function cheeseThrown(f) {
  const b = mk(10, 10);
  const pts = f === 0
    ? [[1, 7], [8, 2], [8, 7]]    // wedge, point left-down
    : [[1, 2], [8, 3], [3, 8]];   // tumbled
  b.poly(pts, PAL.cheese);
  if (f === 0) { b.hline(2, 7, 7, PAL.cheeseD); b.set(6, 5, PAL.cheeseHole); b.set(4, 6, PAL.cheeseHole); b.set(7, 3, PAL.cheeseD); }
  else { b.hline(1, 2, 7, '#ffe98a'); b.set(4, 5, PAL.cheeseHole); b.set(5, 4, PAL.cheeseHole); b.set(3, 7, PAL.cheeseD); b.set(6, 3, PAL.cheeseD); }
  return done(b);
}

// ------------------------------------------------------------------ fire
function fire(f) {
  const b = mk(12, 16);
  // crossed logs at the base
  b.rect(1, 12, 10, 3, PAL.log); b.hline(1, 12, 10, PAL.logRing); b.hline(1, 14, 10, PAL.logD);
  b.rect(3, 11, 6, 2, PAL.logD); b.set(1, 12, PAL.logRing);
  const sway = [0, 1, -1][f], tall = [0, 1, 0][f];
  // outer flame (red-orange)
  b.poly([[1, 12], [2, 8], [3 + sway, 5], [5 + sway, 1 - tall + 1], [6 + sway, 4], [8, 2 + tall], [9 - sway, 6], [10, 9], [10, 12]], PAL.fireD);
  // mid flame
  b.poly([[3, 12], [3, 8], [5 + sway, 4 - tall + 1], [7, 7], [8 - sway, 5], [9, 9], [9, 12]], PAL.fire);
  // hot core
  b.poly([[4, 12], [5, 8 + tall], [6 + sway, 7], [7, 9], [8, 12]], PAL.fireL);
  b.set(5 + sway, 6 - tall, PAL.fireL); // spark tip
  return done(b);
}

// ------------------------------------------------------------------ cobra
function cobra(f) {
  const b = mk(16, 16);
  const sx = [-1, 0, 1][f]; // sway
  // coiled body (3 stacked, alternating widths), belly stripes
  b.ellipse(8, 13, 6.5, 2.3, PAL.snakeD);
  b.ellipse(8, 13, 5.5, 1.6, PAL.snake);
  b.ellipse(8, 10.5, 5.2, 2, PAL.snakeD);
  b.ellipse(8, 10.5, 4.3, 1.3, PAL.snake);
  b.hline(4, 14, 8, PAL.snakeBelly); b.hline(5, 11, 6, PAL.snakeBelly);
  b.set(3, 12, PAL.snakeBelly); b.set(12, 12, PAL.snakeBelly);
  // neck rising
  b.rect(6 + sx, 6, 3, 5, PAL.snake);
  b.vline(6 + sx, 6, 5, PAL.snakeD);
  // hood: wide flared oval
  const hx = 7.5 + sx;
  b.ellipse(hx, 4.5, 5.2, 3.6, PAL.snakeD);
  b.ellipse(hx - 0.5, 4.2, 4.3, 2.8, PAL.snake);
  b.set(Math.round(hx) - 1, 3, PAL.snakeBelly); b.set(Math.round(hx) - 1, 5, PAL.snakeBelly); // hood eyespot markings
  b.set(Math.round(hx), 4, PAL.snakeBelly);
  // face + eye
  b.set(Math.round(hx) + 2, 3, PAL.fireL); b.set(Math.round(hx) + 2, 2, PAL.outline);
  // forked tongue flicks (frames 1 and 2)
  if (f > 0) { const tx = Math.round(hx) + 5; b.hline(tx - 1, 5, 2 + f, PAL.red); if (f === 2) { b.set(tx + 2, 4, PAL.red); b.set(tx + 2, 6, PAL.red); } }
  return done(b);
}

// ------------------------------------------------------------------ scorpion (tunnel, light grey so it reads on dark)
function scorpion(f) {
  const b = mk(16, 10);
  // body
  b.ellipse(6, 6.5, 3.6, 2, PAL.scorp);
  b.hline(4, 5, 4, '#ecece8'); // highlight
  b.hline(4, 8, 5, PAL.scorpD);
  // tail: curls up and over the back, stinger forward-down
  const t = [[2, 6], [1, 4], [1, 2], [2, 1], [4, 1], [5, 2]];
  for (let i = 0; i < t.length - 1; i++) b.line(t[i][0], t[i][1], t[i + 1][0], t[i + 1][1], PAL.scorp);
  b.set(5, 3, PAL.red); b.set(6, 3, PAL.fireD); // stinger tip
  // claws pointing right
  b.rect(10, 4 + f, 3, 2, PAL.scorp); b.set(13, 4 + f, PAL.scorp); b.set(13, 6 + f, PAL.scorp);
  b.rect(10, 7 - f, 3, 1, PAL.scorpD);
  b.set(11, 5 + f, PAL.scorpD);
  // legs alternate
  const lg = f ? [3, 6, 8] : [4, 7, 9];
  for (const x of lg) { b.vline(x, 8, 1, PAL.scorpD); }
  for (const x of f ? [4, 7] : [3, 6, 8]) b.set(x, 9 - 0, PAL.scorpD);
  b.set(8, 5, PAL.eyeD); b.set(8, 4, PAL.red); // eye
  return done(b);
}

// ------------------------------------------------------------------ crocodile head (anchor bottom-centre at water line)
function croc(open) {
  const b = mk(24, 12);
  if (!open) {
    // CLOSED: low, flat-topped, safe to stand on. Teeth interlock along a thin mouth line.
    b.rect(1, 4, 22, 7, PAL.croc);
    b.hline(1, 4, 22, PAL.crocD);                       // flat top edge
    b.hline(1, 5, 22, PAL.croc);
    b.hline(1, 10, 22, PAL.crocD);
    b.hline(4, 8, 19, PAL.outline);                      // sealed mouth line
    for (let x = 6; x < 22; x += 3) b.set(x, 9, PAL.tooth);
    b.rect(17, 5, 2, 1, PAL.crocD); b.set(21, 5, PAL.crocD); // nostril
    b.rect(5, 6, 3, 2, PAL.fireL); b.set(6, 7, PAL.outline);  // eye on the side
    for (let x = 2; x < 5; x++) b.set(x, 5, PAL.crocD);
    b.set(1, 4, PAL.crocD); b.erase(1, 4); b.erase(23, 4);
  } else {
    // OPEN: tall hinge at back, upper jaw raised, pink mouth, white teeth top and bottom.
    b.rect(1, 1, 7, 10, PAL.croc);                       // skull/hinge
    b.rect(1, 1, 7, 2, PAL.crocD);
    b.rect(5, 1, 18, 3, PAL.croc);                       // upper jaw
    b.hline(5, 1, 18, PAL.crocD);
    b.rect(6, 4, 17, 4, PAL.crocMouth);                  // open mouth
    b.rect(5, 8, 18, 3, PAL.croc);                       // lower jaw
    b.hline(5, 10, 18, PAL.crocD);
    b.rect(8, 6, 6, 2, '#b8425a');                       // throat shadow / tongue root
    for (let x = 7; x < 23; x += 3) { b.set(x, 4, PAL.tooth); b.set(x, 5, PAL.tooth); b.set(x + 1, 4, PAL.tooth); }
    for (let x = 8; x < 23; x += 3) { b.set(x, 7, PAL.tooth); b.set(x + 1, 7, PAL.tooth); b.set(x, 6, PAL.tooth); }
    b.set(21, 2, PAL.crocD);                             // nostril
    b.rect(3, 2, 3, 2, PAL.fireL); b.set(4, 3, PAL.outline); // glaring eye
  }
  return done(b);
}

// ------------------------------------------------------------------ treasures (distinct silhouettes) + shimmer
const SPARKLES = [null, [[2, 2], [9, 3]], [[8, 8], [3, 6]]];
function shimmer(b, f, pts = SPARKLES[f]) {
  if (!pts) return b;
  for (const [x, y] of pts) {
    b.set(x, y, PAL.white);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const p = b.get(x + dx, y + dy); if (p && p.a > 0) b.set(x + dx, y + dy, PAL.white); }
  }
  return b;
}
function tuna(f) { // upright round tin: tall squat cylinder with pink label
  const b = mk(12, 12);
  b.rect(2, 2, 8, 8, PAL.can);
  b.rect(2, 2, 8, 1, '#f4f8ff'); b.rect(2, 9, 8, 1, PAL.silverD);        // lid + base rim
  b.rect(2, 4, 8, 4, PAL.tuna); b.hline(2, 7, 8, PAL.fireD);               // label
  b.vline(2, 3, 6, '#ffa8b4');
  b.ellipse(6, 5.5, 1.5, 1, PAL.white); b.set(8, 5, PAL.white);            // fish-ish blob
  b.set(2, 2, [0, 0, 0, 0]); b.set(9, 2, [0, 0, 0, 0]);
  b.rect(5, 1, 2, 1, PAL.silverD);                                          // pull tab
  return shimmer(done(b), f);
}
function sardine(f) { // flat wide silver tin, rounded ends, key
  const b = mk(12, 12);
  b.rect(1, 4, 10, 6, PAL.silver);
  b.rect(1, 4, 10, 1, PAL.white); b.rect(1, 9, 10, 1, PAL.silverD);
  b.rect(2, 6, 7, 2, PAL.silverD);                                          // embossed fish
  b.poly([[9, 6], [11, 5], [11, 8], [9, 7]], PAL.silverD);                  // tail
  b.set(3, 6, PAL.white);
  b.rect(1, 2, 3, 2, PAL.silverD); b.set(0, 2, PAL.silverD);                // key ring
  b.set(2, 3, [0, 0, 0, 0]);
  return shimmer(done(b), f, SPARKLES[f] && SPARKLES[f].map(([x, y]) => [x, Math.max(3, y)]));
}
function gold(f) { // pyramid stack of ingots
  const b = mk(12, 12);
  const bar = (x, y, w) => { b.rect(x, y, w, 3, PAL.gold); b.hline(x, y, w, '#fff0a0'); b.hline(x, y + 2, w, PAL.goldD); b.set(x + w - 1, y + 1, PAL.goldD); };
  bar(1, 8, 5); bar(6, 8, 5); bar(3, 5, 6); bar(4, 2, 4);
  b.set(5, 3, PAL.white);
  return shimmer(done(b), f);
}
function collar(f) { // hollow ring with big gem on top
  const b = mk(12, 12);
  b.ring(6, 7, 5, 4, PAL.silver, 2);
  b.ring(6, 7, 5, 4, PAL.silverD, 1);
  b.set(3, 6, PAL.white); b.set(4, 5, PAL.white);
  b.poly([[4, 3], [6, 1], [8, 3], [6, 5]], PAL.gem);                        // diamond
  b.set(5, 3, PAL.white); b.set(6, 2, '#c8f4ff'); b.set(7, 3, PAL.gemD); b.set(6, 4, PAL.gemD);
  return shimmer(done(b), f, SPARKLES[f] && SPARKLES[f].map(([x, y]) => (f === 1 ? [x, y] : [x, y])));
}

// ------------------------------------------------------------------ build
export function build() {
  return {
    log: [0, 1, 2, 3].map(rollingLog),
    stilllog: [stillLog()],
    cheese: [0, 1, 2, 3].map(cheeseWheel),
    fire: [0, 1, 2].map(fire),
    snake: [0, 1, 2].map(cobra),
    scorpion: [0, 1].map(scorpion),
    croc: [croc(false), croc(true)],
    tr_tuna: [0, 1, 2].map(tuna),
    tr_sardine: [0, 1, 2].map(sardine),
    tr_gold: [0, 1, 2].map(gold),
    tr_collar: [0, 1, 2].map(collar),
    cheese_thrown: [0, 1].map(cheeseThrown),
  };
}

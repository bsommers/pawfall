// PawFall world generator (pure, deterministic, Node-safe). Produces the 120 ScreenDefs + treasure list.
// Layout rules live here as named constants so tools/validate-level.mjs can prove them from defs.TUNING.
import { WORLD_SCREENS as N, TREASURE_COUNT, TUNING, LAYOUT, START_SCREEN } from '../core/defs.js';
import { createRng } from '../core/rng.js';

export const RUN_JUMP = (TUNING.runSpeed * 2 * TUNING.jumpV) / TUNING.gravity;      // ~47.6 px
export const MAX_JUMP_PIT = Math.floor(RUN_JUMP - TUNING.hitW - 4) & ~1;             // widest pit a jump clears with margin (even)
export const HOLE_W = 28;                                                            // ladder hole width (jumpable)
export const CROC_W = 64;
export const EDGE_CLEAR = 36;      // static hazard / treasure keep this far from screen edges & pit edges
export const HAZ_GAP = 48;         // between two static hazards (centre to centre)
export const TREAS_CLEAR = 44;     // treasure to static hazard (centre to centre)
export const TREAS_PIT_CLEAR = 28; // treasure to pit edge
export const HAZ_W = { stilllog: 16, fire: 8, snake: 8 };
export const LETHAL_STATIC = ['fire', 'snake'];
const MOODS = ['bright', 'deep', 'swamp', 'ruins'];

export const distFromStart = (i) => { const d = Math.abs((((i - START_SCREEN) % N) + N) % N); return Math.min(d, N - d); };
const ramp = (i) => distFromStart(i) / (N / 2);   // 0 at screen 0 .. 1 opposite

function shuffle(arr, rng) { for (let i = arr.length - 1; i > 0; i--) { const j = rng.int(0, i); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
const evenRound = (v) => Math.round(v / 2) * 2;

function pickWeighted(rng, items) {
  const tot = items.reduce((a, [, w]) => a + w, 0);
  let r = rng.next() * tot;
  for (const [v, w] of items) { if ((r -= w) < 0) return v; }
  return items[items.length - 1][0];
}

// free x spans for a static hazard of kind on this screen (respecting pit, other statics, edges)
function freeXs(def, extra = []) {
  const out = [];
  for (let x = LAYOUT.edgeL + EDGE_CLEAR; x <= LAYOUT.edgeR - EDGE_CLEAR; x += 4) {
    if (def.pit && x > def.pit.x0 - EDGE_CLEAR && x < def.pit.x0 + def.pit.w + EDGE_CLEAR) continue;
    if (def.hazards.some((h) => h.x != null && Math.abs(h.x - x) < HAZ_GAP)) continue;
    if (extra.some((e) => Math.abs(e - x) < HAZ_GAP)) continue;
    out.push(x);
  }
  return out;
}

function addStatic(def, rng, kind) {
  const xs = freeXs(def);
  if (!xs.length) return false;
  def.hazards.push({ kind, x: rng.pick(xs) });
  return true;
}

function staticKind(t, rng) {
  return pickWeighted(rng, [['stilllog', 2], ...(t > 0.1 ? [['fire', 2 + 2 * t]] : []), ...(t > 0.25 ? [['snake', 2 + 2 * t]] : [])]);
}
function rollingKind(t, rng) {
  return pickWeighted(rng, [['log', 4], ...(t > 0.25 ? [['logs2', 2 + 3 * t]] : []), ...(t > 0.55 ? [['logs3', 3 * t]] : []), ...(t > 0.35 ? [['cheese', 1.5 * t]] : [])]);
}

function treeXs(rng, count) {
  const xs = [];
  for (let tries = 0; xs.length < count && tries < 60; tries++) {
    const x = rng.int(28, 292);
    if (xs.every((o) => Math.abs(o - x) >= 56)) xs.push(x);
  }
  return xs.sort((a, b) => a - b);
}

function moodRuns(rng) {
  const out = []; let prev = null;
  while (out.length < N) {
    let m; do { m = rng.pick(MOODS); } while (m === prev);
    const len = out.length === 0 ? rng.int(5, 8) : rng.int(3, 8);
    for (let k = 0; k < len && out.length < N; k++) out.push(m);
    prev = m;
  }
  out[0] = 'bright';
  return out;
}

function slotsForBlock(b) {
  const rng = createRng(7001 + b * 31);
  const deck = shuffle(['hole', 'hole', 'hole', 'pitA', 'pitB', 'pitC', 'plain', 'plain', 'plain', 'rest', 'rest'], rng);
  const pos = [0, 1, 2, 3, 4, 5, 7, 8, 9, 10, 11];
  const m = {};
  pos.forEach((p, k) => { m[p] = deck[k]; });
  m[6] = 'pete';
  if (b === 0 && m[0] !== 'rest') { const k = pos.find((p) => m[p] === 'rest'); [m[0], m[k]] = [m[k], m[0]]; }
  return m;
}

function narrowPit(i, t, rng) {
  const w = evenRound(24 + t * (MAX_JUMP_PIT - 24));
  const kind = rng.pick(['tar', 'quick', 'water']);
  const cx = 160 + rng.int(-12, 12) * 2;
  return { kind, x0: cx - w / 2, w, vine: false, ladder: false };
}
function vinePit(i, t, rng) {
  const w = rng.pick(t < 0.5 ? [72, 76] : [76, 80, 84]);
  const cx = 160 + rng.int(-4, 4) * 2;
  return { kind: rng.pick(['tar', 'quick', 'water']), x0: cx - w / 2, w, vine: true, ladder: false };
}
function crocPit(i, t, rng) {
  const cx = 160 + rng.int(-4, 4) * 2;
  return { kind: 'croc', x0: cx - CROC_W / 2, w: CROC_W, vine: true, ladder: false };
}
function holePit(i, t, rng) {
  const cx = 160 + rng.int(-10, 10) * 2;
  return { kind: 'hole', x0: cx - HOLE_W / 2, w: HOLE_W, vine: false, ladder: true };
}

export function generateWorld() {
  const moods = moodRuns(createRng(424242));
  const slotMaps = []; for (let b = 0; b < N / 12; b++) slotMaps.push(slotsForBlock(b));
  const screens = [];
  for (let i = 0; i < N; i++) {
    const rng = createRng(90001 + i * 7919);
    const t = ramp(i);
    const slot = slotMaps[Math.floor(i / 12)][i % 12];
    const def = { idx: i, trees: [], mood: moods[i], pit: null, hazards: [], treasure: null, under: { wall: [null, 'L', 'R'][i % 3], scorp: [], ladderX: null }, pete: false, tag: slot };
    if (slot === 'pete') {
      def.mood = 'pete'; def.pete = true;
      def.hazards.push({ kind: 'cheese' });
      if (t > 0.5) def.hazards.push({ kind: 'cheese', speed: 84 });
    } else if (slot === 'hole') {
      def.pit = holePit(i, t, rng); def.tag = 'hole';
      if (rng.chance(0.45 + 0.35 * t)) {
        if (rng.chance(0.5)) def.hazards.push({ kind: rollingKind(Math.min(t, 0.5), rng) });
        else addStatic(def, rng, staticKind(t, rng));
      }
    } else if (slot === 'pitA' || slot === 'pitB' || slot === 'pitC') {
      let pit;
      if (slot === 'pitC' && t >= 0.5) pit = crocPit(i, t, rng);
      else if ((slot === 'pitC' && t >= 0.3) || (slot === 'pitB' && t >= 0.2)) pit = vinePit(i, t, rng);
      else pit = narrowPit(i, t, rng);
      def.pit = pit; def.tag = pit.kind === 'croc' ? 'croc-vine' : pit.vine ? 'vine' : 'pit';
      if (!pit.vine && rng.chance(0.3 + 0.4 * t)) addStatic(def, rng, staticKind(t, rng));
    } else if (slot === 'plain') {
      if (rng.chance(0.5)) def.hazards.push({ kind: rollingKind(t, rng) });
      else {
        addStatic(def, rng, staticKind(t, rng));
        if (t > 0.4 && rng.chance(0.5)) addStatic(def, rng, staticKind(t, rng));
      }
    } // 'rest': nothing
    for (const h of def.hazards) if (h.kind === 'log' || h.kind === 'logs2' || h.kind === 'logs3') h.speed = 40 + ((i * 7) % 5) * 3 + Math.round(t * 10);
    // trees
    def.trees = treeXs(rng, def.mood === 'deep' ? 3 : rng.int(1, 2));
    // underground
    if (def.pit && def.pit.ladder) def.under.ladderX = def.pit.x0 + def.pit.w / 2;
    if (i % 3 === 2) {
      const lx = def.under.ladderX;
      let sx = rng.chance(0.5) ? 96 : 224;
      if (lx != null && Math.abs(sx - lx) < 60) sx = lx < 160 ? 240 : 80;
      def.under.scorp.push({ x: sx, dir: rng.chance(0.5) ? -1 : 1 });
    }
    screens.push(def);
  }
  const treasures = placeTreasures(screens);
  for (const s of screens) if (s.treasure && s.pit && s.pit.kind === 'hole') {   // vault set piece: tunnel guarded by a scorpion
    s.tag = 'vault';
    if (!s.under.wall) s.under.wall = s.idx % 2 ? 'L' : 'R';
    if (!s.under.scorp.length) s.under.scorp.push({ x: s.under.ladderX < 160 ? 236 : 84, dir: -1 });
  }
  return { screens, treasures };
}

function placeTreasures(screens) {
  const used = new Set([START_SCREEN]);
  const picks = [];
  const rng = createRng(555);
  for (let k = 0; k < TREASURE_COUNT; k++) {
    const target = Math.round(((k + 0.5) * N) / TREASURE_COUNT);
    const offs = [0, 1, -1, 2, -2].map((o) => (((target + o) % N) + N) % N);
    let cands = offs.filter((i) => !used.has(i) && screens[i].tag !== 'pete' && !screens[i].pete);
    if (k % 3 === 0) { const holes = cands.filter((i) => screens[i].pit && screens[i].pit.kind === 'hole'); if (holes.length) cands = holes; }
    const si = cands[0];
    if (si == null) throw new Error('treasure placement failed for ' + k);
    used.add(si);
    const s = screens[si];
    s.hazards = s.hazards.filter((h) => h.x != null);               // rolling hazards would sweep the treasure
    const xs = [];
    for (let x = 30; x <= 290; x += 10) {
      if (s.pit && x > s.pit.x0 - TREAS_PIT_CLEAR && x < s.pit.x0 + s.pit.w + TREAS_PIT_CLEAR) continue;
      if (s.hazards.some((h) => Math.abs(h.x - x) < TREAS_CLEAR)) continue;
      xs.push(x);
    }
    if (!xs.length) { s.hazards = []; for (let x = 30; x <= 290; x += 10) if (!s.pit || x < s.pit.x0 - TREAS_PIT_CLEAR || x > s.pit.x0 + s.pit.w + TREAS_PIT_CLEAR) xs.push(x); }
    const x = rng.pick(xs);
    picks.push({ screen: si, x });
  }
  picks.sort((a, b) => a.screen - b.screen);
  const order = picks.map((p, id) => ({ id, ...p, d: distFromStart(p.screen) })).sort((a, b) => a.d - b.d || a.screen - b.screen);
  const type = (rank) => (rank < 12 ? 'tuna' : rank < 22 ? 'sardine' : rank < 28 ? 'gold' : 'collar');
  const out = [];
  order.forEach((o, rank) => out.push({ id: o.id, type: type(rank), screen: o.screen, x: o.x }));
  out.sort((a, b) => a.id - b.id);
  for (const tr of out) screens[tr.screen].treasure = { id: tr.id, type: tr.type, x: tr.x };
  return out;
}

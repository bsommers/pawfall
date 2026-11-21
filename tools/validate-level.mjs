#!/usr/bin/env node
// Level validator: proves fairness of all 120 screens in both travel directions (ARCHITECTURE §6).
//   node tools/validate-level.mjs [--map] [--json] [--verbose]
import { WORLD_SCREENS as N, TREASURE_COUNT, TUNING, LAYOUT, TREASURES, TUNNEL_STRIDE, vineTip } from '../src/core/defs.js';
import { WORLD, screenAt } from '../src/levels/world.js';
import { generateWorld, RUN_JUMP, MAX_JUMP_PIT, EDGE_CLEAR, HAZ_GAP, TREAS_CLEAR, TREAS_PIT_CLEAR, HAZ_W, LETHAL_STATIC, distFromStart } from '../src/levels/gen.js';

const T = TUNING;
const MIN_VINE_SUCCESS = 0.2;      // fraction of vine phases from which a takeoff at the pit edge can be completed
const LAND_GAP = 24;               // landing + takeoff room between consecutive obstacles / screen edge

/** Kinematic proof that a vine pit is crossable in `dir` (+1 = left to right). Returns success fraction over vine phases. */
const vineCache = new Map();
export function vineCrossFraction(pit, dir) {
  const key = `${pit.x0}|${pit.w}|${dir}`;
  if (vineCache.has(key)) return vineCache.get(key);
  const cx = pit.x0 + pit.w / 2, dt = 1 / 120, V = T.vine;
  const tipV = (t) => { const a = V.amp * Math.sin((2 * Math.PI * t) / V.period); const ad = V.amp * ((2 * Math.PI) / V.period) * Math.cos((2 * Math.PI * t) / V.period);
    return { x: cx + Math.sin(a) * V.len, y: V.pivotY + Math.cos(a) * V.len, vx: V.len * ad * Math.cos(a), vy: -V.len * ad * Math.sin(a) }; };
  const nearEdge = dir > 0 ? pit.x0 : pit.x0 + pit.w;
  const farEdge = dir > 0 ? pit.x0 + pit.w : pit.x0;
  const landed = (fx) => (dir > 0 ? fx >= farEdge + 4 : fx <= farEdge - 4);
  const phases = 48; let ok = 0;
  for (let ph = 0; ph < phases; ph++) {
    const t0 = (ph / phases) * V.period;
    let success = false;
    // takeoff at the pit edge (a jump from anywhere in the last 12 px counts as "at the edge")
    for (const off of [0, 6, 12]) {
      let x = nearEdge - dir * off, y = LAYOUT.surfaceY, vy = -T.jumpV, t = t0, grabbed = false;
      for (let n = 0; n < 600 && !grabbed; n++) {   // flight
        t += dt; x += dir * T.airSpeed * dt; vy += T.gravity * dt; y += vy * dt;
        if (y >= LAYOUT.surfaceY) break;
        const hx = x, hy = y - T.hitH, tp = tipV(t);
        if (Math.hypot(hx - tp.x, hy - tp.y) <= T.grabR) grabbed = true;
      }
      if (!grabbed) continue;
      // swing: hands follow the tip; try releasing at every step within one period
      let ts = t;
      for (let k = 0; k < Math.round(V.period / dt) && !success; k++) {
        ts = t + k * dt;
        const tp = tipV(ts);
        let rx = tp.x, ry = tp.y + T.hitH, rvx = tp.vx, rvy = tp.vy;      // feet start hitH below the hands
        let hy2 = tp.y;
        for (let m = 0; m < 600; m++) {
          rvy += T.gravity * dt; rx += rvx * dt; ry += rvy * dt; hy2 += rvy * dt;
          if (ry >= LAYOUT.surfaceY) { if (landed(rx) && rvy > 0) success = true; break; }
        }
      }
      if (success) break;
    }
    if (success) ok++;
  }
  const f = ok / phases; vineCache.set(key, f); return f;
}

const mkErr = (list, i, msg) => list.push(`screen ${i}: ${msg}`);

export function validateWorld({ verbose = false } = {}) {
  const errs = [], warns = [];
  const maxPit = MAX_JUMP_PIT;
  // ---- per screen
  for (let i = 0; i < N; i++) {
    const s = screenAt(i);
    if (s.idx !== i) mkErr(errs, i, 'idx mismatch');
    if (!Array.isArray(s.trees) || s.trees.length < 1 || s.trees.length > 3) mkErr(errs, i, 'trees must hold 1..3 trunks');
    if (!['bright', 'deep', 'swamp', 'ruins', 'pete'].includes(s.mood)) mkErr(errs, i, 'bad mood ' + s.mood);
    if (s.pete !== (s.mood === 'pete')) mkErr(errs, i, 'pete flag and mood disagree');
    if (!s.under || !['L', 'R', null].includes(s.under.wall)) mkErr(errs, i, 'bad under.wall');
    const pit = s.pit;
    const statics = s.hazards.filter((h) => h.x != null);
    const rolling = s.hazards.filter((h) => h.x == null);
    if (pit) {
      if (!['hole', 'tar', 'quick', 'water', 'croc'].includes(pit.kind)) mkErr(errs, i, 'bad pit kind');
      if (pit.x0 < 80 || pit.x0 + pit.w > 240) mkErr(errs, i, 'pit leaves too little run-up');
      if (pit.kind === 'hole') {
        if (!pit.ladder) mkErr(errs, i, 'hole without ladder');
        if (s.under.ladderX !== pit.x0 + pit.w / 2) mkErr(errs, i, 'ladderX != pit centre');
        if (pit.w > maxPit) mkErr(errs, i, 'hole not jumpable');
      } else {
        if (pit.ladder) mkErr(errs, i, 'ladder on a deadly pit');
        if (s.under.ladderX != null) mkErr(errs, i, 'ladderX without a hole');
      }
      if (pit.kind === 'croc' && pit.w !== 64) mkErr(errs, i, 'croc pit width must be 64');
      if (pit.w > maxPit && !pit.vine) mkErr(errs, i, `pit w${pit.w} > jumpable ${maxPit} but no vine`);
      if (pit.w <= maxPit && pit.vine) mkErr(errs, i, 'needless vine on a jumpable pit');
      if (pit.vine) {
        for (const dir of [1, -1]) {
          const f = vineCrossFraction(pit, dir);
          if (f < MIN_VINE_SUCCESS) mkErr(errs, i, `vine pit not crossable dir ${dir} (success ${(f * 100).toFixed(0)}% of phases)`);
        }
        if (statics.length || rolling.length) mkErr(errs, i, 'hazard on a vine pit');
      }
    } else if (s.under.ladderX != null) mkErr(errs, i, 'ladderX but no pit');
    // obstacle chain on the surface (works for both directions: chain gaps are symmetric)
    const obs = statics.map((h) => ({ x0: h.x - (HAZ_W[h.kind] ?? 16) / 2, x1: h.x + (HAZ_W[h.kind] ?? 16) / 2, what: h.kind }));
    if (pit) obs.push({ x0: pit.x0, x1: pit.x0 + pit.w, what: 'pit', pit });
    obs.sort((a, b) => a.x0 - b.x0);
    let prev = LAYOUT.edgeL;
    for (const o of obs) {
      if (o.x0 - prev < LAND_GAP) mkErr(errs, i, `obstacle ${o.what} too close to previous obstacle/edge`);
      if (!o.pit && o.x1 - o.x0 + T.hitW + 4 > RUN_JUMP) mkErr(errs, i, 'hazard too wide to jump');
      prev = o.x1;
    }
    if (LAYOUT.edgeR - prev < LAND_GAP) mkErr(errs, i, 'last obstacle too close to right edge');
    for (let a = 0; a < statics.length; a++) for (let b = a + 1; b < statics.length; b++) if (Math.abs(statics[a].x - statics[b].x) < HAZ_GAP) mkErr(errs, i, 'static hazards too close');
    if (rolling.length && statics.some((h) => LETHAL_STATIC.includes(h.kind))) mkErr(errs, i, 'rolling hazard together with lethal static (knock-back into fire)');
    if (rolling.length && pit && pit.kind !== 'hole') mkErr(errs, i, 'rolling hazard on a deadly-pit screen');
    if (s.pete && (pit || !s.hazards.every((h) => h.kind === 'cheese'))) mkErr(errs, i, 'pete screen must be pit-free with cheese only');
    // treasure clearance
    if (s.treasure) {
      const tr = s.treasure;
      if (i === 0) mkErr(errs, i, 'treasure on screen 0');
      if (rolling.length) mkErr(errs, i, 'rolling hazard on a treasure screen');
      if (pit && tr.x > pit.x0 - TREAS_PIT_CLEAR && tr.x < pit.x0 + pit.w + TREAS_PIT_CLEAR) mkErr(errs, i, 'treasure near/in pit');
      if (statics.some((h) => Math.abs(h.x - tr.x) < TREAS_CLEAR)) mkErr(errs, i, 'treasure overlaps hazard');
      if (tr.x < 24 || tr.x > 296) mkErr(errs, i, 'treasure too close to edge');
      if (!TREASURES[tr.type]) mkErr(errs, i, 'bad treasure type');
    }
    // tunnel
    for (const sc of s.under.scorp) {
      if (sc.x < 48 || sc.x > 272) mkErr(errs, i, 'scorpion too close to tunnel edge/wall');
      if (s.under.ladderX != null && Math.abs(sc.x - s.under.ladderX) < 56) mkErr(errs, i, 'scorpion on top of the ladder');
    }
  }
  // ---- treasures
  const trs = WORLD.treasures;
  if (trs.length !== TREASURE_COUNT) errs.push(`expected ${TREASURE_COUNT} treasures, got ${trs.length}`);
  const ids = new Set(trs.map((t) => t.id)), scr = new Set(trs.map((t) => t.screen));
  if (ids.size !== TREASURE_COUNT || [...ids].some((v) => v < 0 || v >= TREASURE_COUNT)) errs.push('treasure ids not unique 0..31');
  if (scr.size !== trs.length) errs.push('two treasures share a screen');
  const counts = {}; trs.forEach((t) => { counts[t.type] = (counts[t.type] || 0) + 1; });
  const want = { tuna: 12, sardine: 10, gold: 6, collar: 4 };
  for (const k in want) if (counts[k] !== want[k]) errs.push(`treasure type ${k}: ${counts[k]} != ${want[k]}`);
  const sorted = [...scr].sort((a, b) => a - b); let maxGap = 0;
  sorted.forEach((v, k) => { maxGap = Math.max(maxGap, (sorted[(k + 1) % sorted.length] - v + N) % N || N); });
  if (maxGap > 8) errs.push(`treasures not spread around the circle (largest gap ${maxGap})`);
  for (const t of trs) { const sc = screenAt(t.screen).treasure; if (!sc || sc.id !== t.id) errs.push(`WORLD.treasures[${t.id}] mismatch with screen`); }
  // ---- surface graph: every step i -> i±1 crossable (checked per screen above); BFS from start reaches all screens and all treasures
  const seen = new Set([WORLD.start]), q = [WORLD.start];
  while (q.length) { const c = q.pop(); for (const d of [1, -1]) { const n = (((c + d) % N) + N) % N; if (!seen.has(n)) { seen.add(n); q.push(n); } } }
  if (seen.size !== N) errs.push('surface graph not connected');
  // ---- tunnel: shortcut moves 3 screens; reversal is always possible, ladder screens are the only exits; every hole is a ladder
  const holes = WORLD.screens.filter((s) => s.pit && s.pit.kind === 'hole');
  if (holes.length < N * 0.2 || holes.length > N * 0.35) errs.push(`hole share ${holes.length}/${N} outside 20..35%`);
  const tunnelStarts = holes.filter((h) => screenAt(h.idx + TUNNEL_STRIDE).pit?.kind === 'hole' || screenAt(h.idx - TUNNEL_STRIDE).pit?.kind === 'hole').length;
  if (tunnelStarts === 0) warns.push('no tunnel shortcut chains (hole 3 screens from a hole)');
  const scorpScreens = WORLD.screens.filter((s) => s.under.scorp.length).length;
  if (scorpScreens < N * 0.25 || scorpScreens > N * 0.45) errs.push(`scorpion share ${scorpScreens}/${N} outside 25..45%`);
  // ---- pete, mood runs, wall pattern
  const petes = WORLD.screens.filter((s) => s.pete).map((s) => s.idx);
  if (petes.length < 8 || petes.length > 12) errs.push(`pete screens ${petes.length}`);
  petes.forEach((p, k) => { const g = (petes[(k + 1) % petes.length] - p + N) % N; if (g < 10 || g > 14) errs.push(`pete gap ${g} after ${p}`); });
  // ---- difficulty ramp: mean difficulty score per distance quartile increases, and both halves of the circle agree
  const score = (s) => (s.pit ? (s.pit.kind === 'hole' ? 0.5 : s.pit.kind === 'croc' ? 4 : s.pit.vine ? 3 : 2 + s.pit.w / 36) : 0) +
    s.hazards.reduce((a, h) => a + ({ log: 1, logs2: 1.8, logs3: 2.6, stilllog: 1, cheese: 1.5, fire: 2, snake: 2 }[h.kind] ?? 1), 0);
  const band = [[], [], [], []]; const half = [0, 0, 0, 0, 0, 0, 0, 0];
  const halfN = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const s of WORLD.screens) { const d = distFromStart(s.idx); const b = Math.min(3, Math.floor(d / 15)); band[b].push(score(s)); const side = s.idx <= N / 2 ? 0 : 4; half[side + b] += score(s); halfN[side + b]++; }
  const means = band.map((a) => a.reduce((x, y) => x + y, 0) / a.length);
  for (let b = 1; b < 4; b++) if (means[b] < means[b - 1] - 0.05) errs.push(`difficulty not ramping: band means ${means.map((m) => m.toFixed(2)).join(' ')}`);
  if (means[3] < means[0] * 1.5) errs.push('difficulty ramp too flat');
  for (let b = 0; b < 4; b++) { const a = half[b] / halfN[b], c = half[4 + b] / halfN[4 + b]; if (Math.abs(a - c) > 1.2) errs.push(`difficulty asymmetric in band ${b}: ${a.toFixed(2)} vs ${c.toFixed(2)}`); }
  // ---- determinism
  const again = generateWorld();
  if (JSON.stringify(again.screens) !== JSON.stringify(WORLD.screens) || JSON.stringify(again.treasures) !== JSON.stringify(WORLD.treasures)) errs.push('generation not deterministic');
  if (screenAt(-1) !== screenAt(N - 1) || screenAt(N) !== screenAt(0)) errs.push('screenAt does not wrap');
  const s0 = screenAt(0); if (s0.pit || s0.hazards.length || s0.treasure) errs.push('screen 0 should be a calm start screen');
  return { errs, warns, stats: { holes: holes.length, petes: petes.length, scorpScreens, bandMeans: means, treasureCounts: counts, maxTreasureGap: maxGap, runJump: RUN_JUMP, maxJumpPit: maxPit, tunnelStarts } };
}

const PIT = { hole: 'O', tar: 'T', quick: 'Q', water: '~', croc: 'C' };
const HZ = { log: 'l', logs2: 'L', logs3: '3', stilllog: 's', cheese: 'c', fire: 'f', snake: 'k' };
const TR = { tuna: 't', sardine: 'S', gold: 'G', collar: 'D' };
export function asciiMap() {
  const out = ['PAWFALL WORLD MAP  (12 screens per row, row r starts at screen 12r; screen 0 = start)', 'cell = [pit][v if vine][hazards][*treasure type]   second line: tunnel [<|>|. wall][x scorpion][| ladder]',
    'pit: O hole(ladder) T tar Q quicksand ~ water C croc | hazards: l log L 2 logs 3 3 logs s still log c cheese f fire k snake | P pete ambush | $t tuna $S sardine $G gold $D collar', ''];
  for (let r = 0; r < N / 12; r++) {
    let a = String(r * 12).padStart(3) + ' ', b = '    ';
    for (let c = 0; c < 12; c++) {
      const s = screenAt(r * 12 + c);
      let cell = (s.pit ? PIT[s.pit.kind] + (s.pit.vine ? 'v' : '') : '') + (s.pete ? 'P' : '') + s.hazards.map((h) => HZ[h.kind]).join('') + (s.treasure ? '$' + TR[s.treasure.type] : '');
      a += (cell || '.').padEnd(9);
      let u = (s.under.wall === 'L' ? '<' : s.under.wall === 'R' ? '>' : '.') + (s.under.scorp.length ? 'x' : '') + (s.under.ladderX != null ? '|' : '');
      b += u.padEnd(9);
    }
    out.push(a, b);
  }
  return out.join('\n');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  if (args.includes('--map')) console.log(asciiMap());
  const res = validateWorld({ verbose: args.includes('--verbose') });
  if (args.includes('--json')) console.log(JSON.stringify(res, null, 1));
  else {
    console.log(`validate-level: ${N} screens, both directions; run-jump range ${RUN_JUMP.toFixed(1)} px, max jumpable pit ${MAX_JUMP_PIT} px`);
    console.log('stats:', JSON.stringify(res.stats));
    res.warns.forEach((w) => console.log('WARN', w));
    res.errs.slice(0, 60).forEach((e) => console.log('FAIL', e));
    console.log(res.errs.length ? `FAILED (${res.errs.length} problems)` : 'OK: all checks pass');
  }
  process.exit(res.errs.length ? 1 : 0);
}

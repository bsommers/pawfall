// PawFall autopilot (owner qa-bot). Pure, deterministic, Node-safe; uses its own tiny seeded generator.
//   const ap = createAutopilot(game, { skill: 1 });  const input = ap.input(game, dt);  game.update(dt, input);
// Strategy: look-ahead by simulation. Every tick the bot clones the hazards of the current screen, steps them forward
// with the real HAZARDS update functions, and scores short macro-plans ("run n ticks then jump", "wait n ticks then run"...)
// with a small mirror of player.js. Vine pits (incl. croc pits) get an exact grab/release plan. Holes are dropped through
// and left via the ladder. Route: one lap round the circular world, turning back only for a treasure it just missed.
import { TUNING as T, LAYOUT as L, WORLD_SCREENS as N, DT, vineTip } from '../core/defs.js';
import { overPit, ladderX, inLadderZone, crocUnder, crocCarrying, crocTop, wallClampX, hitsEntity, pitOf } from './physics.js';

const MAXK = 300, SPAN = 130;         // rollout: until the bot has advanced SPAN px (or MAXK ticks)
const HZ = MAXK;
const C_LIFE = 1000, C_HIT = 30, C_DROP = 20, C_MISS = 25;
const AIR_ACCEL = 160;                // mirrors player.js
const SWING_BLEND = 0.12;
const PETE_EVERY = 4, CHEESE_SPEED = 70;

const inp = (dx = 0, dy = 0, jp = false) => ({ dx, dy, jump: jp, jumpPressed: jp });
const snapE = (e) => ({ kind: e.kind, x: e.x, y: e.y, w: e.w, h: e.h, solidTop: e.solidTop, lethal: e.lethal, layer: e.layer, topY: e.topY });

/** Entity snapshots for ticks 0..n (index j = after j updates), stepped with the real hazard update functions. */
function trajectory(g, n) {
  const cur = g.ents.filter((e) => !e.dead).map((e) => ({ ...e, st: { ...e.st } }));
  const out = [cur.map(snapE)];
  const pete = g.screen?.pete;
  let timer = pete ? (g.peteSt?.[g.screen.idx]?.timer ?? PETE_EVERY) : 0;
  for (let j = 0; j < n; j++) {
    for (const e of cur) { try { g.HAZARDS[e.kind]?.update?.(e, DT, g); } catch { /* ignore */ } }
    if (pete) {
      timer -= DT;
      if (timer <= 0) {
        timer += PETE_EVERY;
        const e = { kind: 'cheese', x: 316, y: L.surfaceY, w: 12, h: 12, vx: 0, dir: -1, t: 0, frame: 0, layer: 'surface', solidTop: false, lethal: null, dead: false, st: {}, speed: CHEESE_SPEED };
        try { g.HAZARDS.cheese.init(e, g); cur.push(e); } catch { /* ignore */ }
      }
    }
    out.push(cur.map(snapE));
  }
  return out;
}

function support(s, E, scr) {
  if (s.layer === 'tunnel') return L.tunnelY;
  const e = crocCarrying(E, s.x, s.y);
  if (e) return crocTop(e);
  const pit = overPit(scr, s.x);
  if (pit && !(pit.kind === 'hole' && inLadderZone(scr, s.x))) return null;
  return L.surfaceY;
}

/** Mirror of player.js ballistic(). Returns 0, or a terminal cost (drop / sink). */
function ballistic(s, dx, E, scr) {
  const prevY = s.y;
  if (dx) {
    const target = dx * T.airSpeed, a = AIR_ACCEL * DT;
    s.vx = s.vx < target ? Math.min(target, s.vx + a) : Math.max(target, s.vx - a);
  }
  s.vy += T.gravity * DT; s.x += s.vx * DT; s.y += s.vy * DT;
  s.landed = false;
  if (s.layer === 'tunnel') {
    if (s.vy < 0 && s.y - T.hitH < L.tunnelTop) { s.y = L.tunnelTop + T.hitH; s.vy = 0; }
    s.x = wallClampX(scr, s.x).x;
  }
  if (s.vy >= 0 && s.layer === 'surface') {
    const e = crocUnder(E, s.x, s.y, prevY);
    if (e) { s.y = crocTop(e); s.vy = 0; s.vx *= 0.5; s.landed = true; return 0; }
  }
  const fy = s.layer === 'tunnel' ? L.tunnelY : L.surfaceY;
  if (s.vy >= 0 && s.y >= fy) {
    if (s.layer === 'surface') {
      const pit = overPit(scr, s.x);
      if (pit && !(pit.kind === 'hole' && inLadderZone(scr, s.x))) return pit.kind === 'hole' ? C_DROP : C_LIFE;
    }
    s.y = fy; s.vy = 0; s.landed = true;
  }
  return 0;
}

function contactCost(s, E1) {
  if (s.inv > 0) return 0;
  for (const e of E1) {
    if (!e.lethal || e.layer !== s.layer || !hitsEntity(s, e)) continue;
    return e.lethal === 'life' ? C_LIFE : C_HIT;
  }
  return 0;
}

/** One player tick. Returns 0 (ok), -1 (left the screen) or a terminal cost. */
function stepP(s, dx, jp, E, E1, ctx) {
  if (s.inv > 0) s.inv -= DT;
  if (s.mode === 'ground') {
    if (jp) { s.vy = -T.jumpV; s.vx = dx * T.airSpeed; s.mode = 'air'; }
    else {
      s.vx = dx * T.runSpeed; s.x += s.vx * DT;
      if (s.layer === 'tunnel') s.x = wallClampX(ctx.screen, s.x).x;
      const sy = support(s, E, ctx.screen);
      if (sy == null) { s.mode = 'air'; s.vy = 0; } else s.y = sy;
    }
  } else {
    const r = ballistic(s, dx, E, ctx.screen);
    if (r) return r;
    if (s.landed) s.mode = 'ground';
  }
  if (s.x < L.edgeL || s.x > L.edgeR) return -1;
  if (ctx.tr && s.layer === 'surface') {
    const ty = ctx.tr.y ?? L.surfaceY, hw = T.hitW / 2;
    if (s.x + hw > ctx.tr.x - 6 && s.x - hw < ctx.tr.x + 6 && s.y > ty - 12 && s.y - T.hitH < ty) ctx.got = true;
  }
  return contactCost(s, E1);
}

function policyDx(s, ctx) {
  if (ctx.stopX != null && ctx.dir * (s.x - ctx.stopX) >= 0) return 0;
  return ctx.dir;
}

/** Cheap reflex used after the first macro action: hop a pit edge or an obstacle that is about to be touched. */
function reflexJump(s, E, k, ctx) {
  if (s.mode !== 'ground') return false;
  const pit = ctx.pit;
  if (pit && s.layer === 'surface') {
    if (s.x > pit.x0 && s.x < pit.x1) return true;            // standing on a ladder top / head inside the pit
  }
  if (pit && s.layer === 'surface' && pit.w <= 40) {
    const dist = ctx.dir > 0 ? pit.x0 - s.x : s.x - pit.x1;
    if (dist >= -0.5 && dist <= Math.min(9, (47 - pit.w) * 0.5)) return true;
  }
  const hw = T.hitW / 2, step = ctx.dir * T.runSpeed * DT;
  for (let j = 3; j <= 9; j += 3) {
    const E1 = E[k + j + 1]; if (!E1) break;
    const x = s.x + step * j;
    for (const e of E1) {
      if (!e.lethal || e.layer !== s.layer) continue;
      if (x + hw > e.x - e.w / 2 && x - hw < e.x + e.w / 2 && s.y > e.y - e.h && s.y - T.hitH < e.y) return true;
    }
  }
  return false;
}
function policyAct(s, E, k, ctx) {
  const dx = policyDx(s, ctx);
  if (dx !== 0 && reflexJump(s, E, k, ctx)) return { dx, jp: true };
  return { dx, jp: false };
}

/** Score a macro: {n, pre, jump, jdx, airdx}. Lower is better. */
function rollout(s0, E, ctx, m) {
  const s = { ...s0 };
  ctx.got = false;
  let cost = 0, jumped = false, k = 0;
  for (; k < MAXK; k++) {
    if (s.mode === 'ground' && k >= m.n && (!m.jump || jumped) && (ctx.dir * (s.x - s0.x) >= SPAN || policyDx(s, ctx) === 0)) break;
    let dx, jp = false;
    if (s.mode === 'ground') {
      if (k < m.n) dx = m.pre;
      else if (m.jump && !jumped) { jp = true; jumped = true; dx = m.jdx; }
      else { const a = policyAct(s, E, k, ctx); dx = a.dx; jp = a.jp; }
    } else dx = m.airdx ?? ctx.dir;
    const r = stepP(s, dx, jp, E[k], E[k + 1], ctx);
    if (r === -1) break;
    if (r > 0) { cost += r; break; }
  }
  cost += 0.01 * k;
  if (ctx.tr && !ctx.got && ctx.dir * (s.x - ctx.tr.x) > 8 && ctx.dir * (s0.x - ctx.tr.x) <= 8 && s0.layer === 'surface') cost += C_MISS;
  return cost;
}

/** Exact grab/release plan for a vine pit. Returns { Tj, Tr, score } or null. */
function planVine(g, p, pit, dir, screen) {
  const v0 = g.vineT, D = 200, R = 170;
  const E = trajectory(g, D + R + 260);
  const ctx = { screen, dir };
  const ok = [];
  const cx = pit.cx, V = T.vine, TWO = 2 * Math.PI;
  const tipVel = (t) => { const w = V.amp * TWO / V.period * Math.cos(t * TWO / V.period), a = V.amp * Math.sin(t * TWO / V.period); return { x: V.len * w * Math.cos(a), y: -V.len * w * Math.sin(a) }; };
  const far = (x) => (dir > 0 ? x >= pit.x1 + 2 : x <= pit.x0 - 2);
  for (let d = 0; d < D; d++) {
    const row = new Array(R).fill(0); ok.push(row);
    const s = { x: p.x, y: L.surfaceY, vx: 0, vy: 0, mode: 'ground', layer: 'surface', inv: p.inv ?? 0, landed: false };
    let fail = false;
    for (let k = 0; k < d; k++) { if (s.inv > 0) s.inv -= DT; if (contactCost(s, E[k + 1]) > 0) { fail = true; break; } }
    if (fail) continue;
    // jump at update d
    s.vy = -T.jumpV; s.vx = dir * T.airSpeed; s.mode = 'air';
    if (s.inv > 0) s.inv -= DT;
    if (contactCost(s, E[d + 1]) > 0) continue;
    let k = d + 1, grab = null;
    for (; k < d + 100; k++) {
      if (s.inv > 0) s.inv -= DT;
      if (ballistic(s, dir, E[k], screen) > 0 || s.landed) break;
      const tip = vineTip(cx, v0 + (k + 1) * DT);
      const hx = s.x, hy = s.y - T.hitH;
      if (Math.hypot(tip.x - hx, tip.y - hy) <= T.grabR) { grab = { k, offX: hx - tip.x, offY: hy - tip.y }; break; }
      if (contactCost(s, E[k + 1]) > 0) break;
    }
    if (!grab) continue;
    for (let r = 0; r < R; r++) {
      // swing ticks grab.k+1 .. then release at tick kr = grab.k + 1 + r
      let sk = 1, kr = grab.k + 1 + r, good = false, q = null;
      // advance swing up to the release tick
      let x = 0, y = 0, vx = 0, vy = 0, bad = false;
      for (let u = grab.k + 1; u <= kr; u++) {
        const t = v0 + (u + 1) * DT, tp = vineTip(cx, t), tv = tipVel(t);
        sk = Math.max(0, sk - DT / SWING_BLEND);
        x = tp.x + grab.offX * sk; y = tp.y + T.hitH + grab.offY * sk; vx = tv.x; vy = tv.y;
        if (u < kr && (x <= pit.x0 || x >= pit.x1) && y >= L.surfaceY - 2) { if (far(x)) { good = true; } else bad = true; break; }
      }
      if (bad) continue;
      q = { x, y, vx, vy, mode: 'air', layer: 'surface', inv: 0, landed: false };
      if (!good) for (let u = kr + 1; u < kr + 90; u++) {
        const rr = ballistic(q, dir, E[u], screen);
        if (rr > 0) break;
        if (q.landed) { good = far(q.x); break; }
        if (contactCost(q, E[u + 1]) > 0) break;
      }
      row[r] = good ? kr + 1 : 0;
    }
  }
  // choose the (d, r) with the best 3x3 neighbourhood of successes; earlier is better
  let best = null;
  for (let d = 0; d < D; d++) for (let r = 0; r < R; r++) {
    if (!(ok[d][r] > 0)) continue;
    let sc = 0;
    for (let dd = -2; dd <= 2; dd++) for (let rr = -2; rr <= 2; rr++) if (ok[d + dd]?.[r + rr] > 0) sc++;
    sc -= d * 0.01;
    if (!best || sc > best.score) best = { d, r, score: sc, kr: ok[d][r] - 1 };
  }
  if (!best || best.score < 6) return null;
  return { Tj: v0 + (best.d + 1) * DT, Tr: v0 + (best.kr + 1) * DT, score: best.score, d: best.d, r: best.r, dir, jumped: false };
}

export function createAutopilot(game, { skill = 1 } = {}) {
  const stats = { plans: 0, planFails: 0, searches: 0, stuck: 0, drops: 0 };
  let wdKey = '', wdT = 0, panic = 0;
  let vp = null, vpKey = '', pending = 0, vineAct = false, seedR = 0x9e3779b9;
  const rnd = () => { seedR = (seedR + 0x6d2b79f5) | 0; let t = Math.imul(seedR ^ (seedR >>> 15), 1 | seedR); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  function routeDir(g) {
    const p = g.player, scr = g.screen, cur = g.screenIdx;
    // treasure on this screen that we are already past -> go back for it (no pit in between)
    const tr = scr.treasure;
    if (tr && !g.collected.has(tr.id) && p.x > tr.x + 10 && p.x - tr.x < 90) {
      const pit = pitOf(scr);
      if (!pit || pit.x1 < tr.x || pit.x0 > p.x) return -1;
    }
    // treasure on the screen just behind us -> turn round (only if cheap)
    return 1;
  }

  function ctxFor(g, dir, extra = {}) {
    const scr = g.screen, tr = scr.treasure && !g.collected.has(scr.treasure.id) ? scr.treasure : null;
    return { screen: scr, dir, tr, got: false, pit: pitOf(scr), ...extra };
  }
  function stateOf(p) {
    return { x: p.x, y: p.y, vx: p.vx, vy: p.vy, mode: p.mode === 'ground' ? 'ground' : 'air', layer: p.layer, inv: p.inv ?? 0, landed: false };
  }

  function searchGround(g, ctx) {
    const p = g.player, s0 = stateOf(p);
    const E = trajectory(g, MAXK + 2);
    const A = rollout(s0, E, ctx, { n: 0, pre: ctx.dir, jump: false });
    if (A < 5) { const a = policyAct(s0, E, 0, ctx); return inp(a.dx, 0, a.jp); }
    stats.searches++;
    const fam = [];      // {bias, costs[], act(n)}
    const NN = 30;
    const mk = (bias, f) => { const costs = []; for (let i = 0; i < NN; i++) costs.push(rollout(s0, E, ctx, f(i * 3))); fam.push({ bias, costs, f }); };
    mk(0.0, (n) => ({ n, pre: 0, jump: false }));                              // wait n then policy
    mk(0.6, (n) => ({ n, pre: ctx.dir, jump: true, jdx: ctx.dir }));           // run n then jump
    mk(0.6, (n) => ({ n, pre: 0, jump: true, jdx: ctx.dir }));                 // wait n then jump
    mk(0.9, (n) => ({ n, pre: 0, jump: true, jdx: 0 }));                       // wait n then jump straight up
    let best = null;
    for (const smooth of [true, false]) {
      for (let fi = 0; fi < fam.length; fi++) {
        const { bias, costs } = fam[fi];
        for (let i = 0; i < NN; i++) {
          const sm = (smooth ? Math.max(costs[i], costs[i - 1] ?? costs[i], costs[i + 1] ?? costs[i]) : costs[i]) + bias + i * 0.004;
          if (!best || sm < best.c) best = { c: sm, fi, n: i * 3 };
        }
      }
      if (best.c < C_HIT * 0.8) break;      // a robust plan exists
      best = null;
    }
    if (!best) {
      for (let fi = 0; fi < fam.length; fi++) for (let i = 0; i < NN; i++) {
        const c = fam[fi].costs[i] + fam[fi].bias + i * 0.004;
        if (!best || c < best.c) best = { c, fi, n: i * 3 };
      }
    }
    const act = { 0: (n) => inp(n === 0 ? policyDx(s0, ctx) : 0), 1: (n) => (n === 0 ? inp(ctx.dir, 0, true) : inp(policyDx(s0, ctx))),
      2: (n) => (n === 0 ? inp(ctx.dir, 0, true) : inp(0)), 3: (n) => (n === 0 ? inp(0, 0, true) : inp(0)) }[best.fi];
    return act(best.n);
  }

  function searchAir(g, ctx) {
    const s0 = stateOf(g.player), E = trajectory(g, MAXK + 2);
    let best = null;
    for (const [i, dx] of [ctx.dir, 0, -ctx.dir].entries()) {
      const c = rollout(s0, E, ctx, { n: 0, pre: 0, jump: false, airdx: dx }) + i * 0.3;
      if (!best || c < best.c) best = { c, dx };
    }
    return inp(best.dx);
  }

  function vineStage(g, dir, pit) {
    const p = g.player;
    const nearEdge = dir > 0 ? pit.x0 : pit.x1, stopX = nearEdge - dir * 2.5;
    const key = `${g.screenIdx}|${g.stats.deaths}`;
    if (vpKey !== key) { vp = null; vpKey = key; }
    const ctx = ctxFor(g, dir, { stopX });
    if (dir * (p.x - stopX) < -1.3) return searchGround(g, ctx);
    if (!vp) {
      vp = planVine(g, p, pit, dir, g.screen); stats.plans++;
      if (!vp) { stats.planFails++; return inp(0); }
      if (skill < 1) { const late = Math.round((1 - skill) * 14); vp.Tj += Math.floor(rnd() * (late + 1)) * DT; vp.Tr += 0; }
    }
    if (vp.jumped) { vp = null; return inp(0); }
    vineAct = true;   // back on the ground without a swing: replan next tick
    if (g.vineT + DT >= vp.Tj - 1e-4) { vp.jumped = true; return inp(dir, 0, true); }
    return inp(0);
  }

  function decide(g) {
    const p = g.player;
    if (g.state !== 'play') return inp();
    const dir = routeDir(g);
    switch (p.mode) {
      case 'climb': return inp(0, -1);
      case 'swing': {
        if (vp && vp.Tr != null) { if (g.vineT + DT >= vp.Tr - 1e-4) { const d = vp.dir; vp = null; return inp(d, 0, true); } return inp(); }
        const pit = pitOf(g.screen);       // accidental grab (no plan): release once beyond the far edge
        if (pit && p.x >= pit.x1 + 6 && p.vx > 0) return inp(1, 0, true);
        if (pit && p.x <= pit.x0 - 6 && p.vx < 0 && dir < 0) return inp(-1, 0, true);
        return inp();
      }
      case 'air': return searchAir(g, ctxFor(g, dir));
      case 'ground': break;
      default: return inp();
    }
    if (p.layer === 'tunnel') {
      const lx = ladderX(g.screen);
      if (lx == null) return inp(dir);
      if (Math.abs(p.x - lx) <= 3) return inp(0, -1);
      const d2 = lx > p.x ? 1 : -1;
      return searchGround(g, ctxFor(g, d2, { stopX: lx }));
    }
    const pit = pitOf(g.screen);
    if (pit && pit.vine && (pit.w >= 44 || pit.kind === 'croc') && (dir > 0 ? p.x < pit.x0 + 0.5 : p.x > pit.x1 - 0.5)) return vineStage(g, dir, pit);
    return searchGround(g, ctxFor(g, dir));
  }

  // The vine release plan is stored on the same object; remember which side we are crossing to.
  return {
    stats,
    input(g = game, dt = DT) {
      game = g;
      let r; vineAct = false;
      const key = `${g.screenIdx}|${g.player.layer}|${g.treasureCount}|${g.lives}`;     // watchdog: no progress for 40 s -> flail
      if (key !== wdKey) { wdKey = key; wdT = g.t; panic = 0; }
      if (g.state === 'play' && g.t - wdT > 40) { stats.stuck++; panic = 90; wdT = g.t; }
      if (panic > 0 && g.state === 'play' && g.player.mode === 'ground') { panic--; return inp(panic % 120 < 60 ? 1 : -1, 0, panic % 40 === 0); }
      try { r = decide(g); } catch (e) { r = inp(1); stats.errors = (stats.errors ?? 0) + 1; stats.lastError = String(e && e.stack || e); }
      if (skill < 1 && g.player.mode === 'ground' && !vineAct) {          // human-ish: late take-offs (deterministic, own rng)
        if (pending > 0) { pending--; r = pending === 0 ? { ...r, jump: true, jumpPressed: true } : inp(r.dx, 0, false); }
        else if (r.jumpPressed) {
          const late = Math.round((1 - skill) * 14);
          pending = late + Math.floor(rnd() * (late + 1));
          if (pending > 0) r = inp(r.dx, 0, false);
        }
      }
      return r;
    },
  };
}

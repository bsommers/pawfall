// Per-screen scene drawing (owner: render): static layer (cacheable), animated layer, vine, entities, Colby, foreground.
// All functions take (ctx, art, ...) where art is the registry (get/size/frames/tint) and ctx any 2D-context-like
// (real canvas or the PixBuf shim in test/). Missing sprites are placeholders inside the registry, so nothing here throws.
import { W, H, LAYOUT as L, PAL, TUNING, vineTip } from '../core/defs.js';
import { hash2 } from '../art/pixbuf.js';
import { drawBackdrop, drawMood, drawNight } from './background.js';

const SY = L.surfaceY;
const mod = (a, n) => ((a % n) + n) % n;
const hs = (a, b, c = 0) => hash2(a | 0, b | 0, c);

/** Draw tile `name` (variant picker) across x in [xa,xb) at row y, clipping partial tiles; phase aligned to x=0. */
function strip(ctx, art, pick, y, xa, xb, h, rows = 1) {
  for (let r = 0; r < rows; r++) {
    const yy = y + r * h;
    for (let tx = Math.floor(xa / 16) * 16; tx < xb; tx += 16) {
      const img = pick(tx / 16 + r * 7), a = Math.max(tx, xa), b = Math.min(tx + 16, xb);
      if (b > a) ctx.drawImage(img, a - tx, 0, b - a, Math.min(h, img.height ?? img.h ?? h), a, yy, b - a, h);
    }
  }
}
const dim = (img) => ({ w: img.width ?? img.w, h: img.height ?? img.h });

function pitOf(screen) { return screen && screen.pit ? screen.pit : null; }
export function pitExtent(screen) { const p = pitOf(screen); return p ? [p.x0, p.x0 + p.w] : null; }
function ladderX(screen) {
  const u = screen.under || {};
  if (u.ladderX != null) return u.ladderX;
  const p = pitOf(screen);
  return p && p.ladder ? p.x0 + p.w / 2 : null;
}
function spans(ext) { return ext ? [[0, ext[0]], [ext[1], W]] : [[0, W]]; }
function seg(ctx, art, pick, y, h, ext, rows = 1) { for (const [a, b] of spans(ext)) strip(ctx, art, pick, y, a, b, h, rows); }

// ------------------------------------------------------------------ static layer (no animation, cacheable per screen)
const DECOR = { bright: ['bush', 'bush', 'mushroom', 'rock'], deep: ['bush', 'mushroom', 'mushroom', 'rock'], swamp: ['mushroom', 'mushroom', 'bush', 'rock'], ruins: ['rock', 'rock', 'bush', 'mushroom'], pete: ['bush', 'rock', 'bush', 'mushroom'] };

export function paintStatic(ctx, art, screen) {
  const idx = screen.idx | 0, ext = pitExtent(screen), pit = pitOf(screen), under = screen.under || {};
  // trunks behind canopy
  (screen.trees || []).forEach((x, i) => {
    const img = art.get('trunk', Math.floor(hs(idx, i, 3) * 3)), d = dim(img);
    ctx.drawImage(img, Math.round(x - d.w / 2), SY + 4 - d.h);
  });
  // main canopy across the top (variants hashed from idx so neighbours differ but each screen is stable)
  const cw = dim(art.get('canopy', 0)).w;
  for (let x = -8, i = 0; x < W; x += cw - 4, i++) ctx.drawImage(art.get('canopy', Math.floor(hs(idx, i, 5) * 3)), x, L.hudH);
  // decor (bushes, rocks, mushrooms) standing on the path line, away from the pit and ladder
  const kinds = DECOR[screen.mood] || DECOR.bright, lx = ladderX(screen);
  for (let i = 0; i < 5; i++) {
    const x = 14 + Math.floor(hs(idx, i, 21) * (W - 28)), name = kinds[Math.floor(hs(idx, i, 22) * kinds.length)];
    const sz = dim(art.get(name, 0));
    if (ext && x + sz.w / 2 > ext[0] - 4 && x - sz.w / 2 < ext[1] + 4) continue;
    if (lx != null && Math.abs(x - lx) < 14) continue;
    ctx.drawImage(art.get(name, Math.floor(hs(idx, i, 23) * 3)), Math.round(x - sz.w / 2), SY - sz.h + 2);
  }
  // path strip + pit gap
  seg(ctx, art, (n) => art.get('tile_path', mod(n + idx, 2)), SY, L.pathH, ext);
  // tunnel: ceiling band, interior, floor
  const hole = pit && pit.kind === 'hole';
  seg(ctx, art, (n) => art.get('tile_ceil', mod(n + idx, 2)), L.ceilY, 10, ext);
  strip(ctx, art, () => art.get('tile_tunnel', 0), L.tunnelTop, 0, W, 16, 3);
  strip(ctx, art, (n) => art.get('tile_dirt', mod(n, 2)), L.tunnelY, 0, W, 16, 2);
  // clean the overdraw below the screen bottom (rows are drawn 16px tall)
  // pit interior below the surface strip
  if (ext) {
    const depthRows = (x0, x1) => { strip(ctx, art, () => art.get('pit_depth', 0), SY, x0, x1, 16, 1); };
    if (hole) { depthRows(ext[0], ext[1]); strip(ctx, art, () => art.get('pit_depth', 0), SY + 16, ext[0], ext[1], L.tunnelTop - SY - 16, 1); }
    else {
      strip(ctx, art, () => art.get('pit_depth', 0), L.ceilY, ext[0], ext[1], 10, 1);
      const wash = { water: 'rgba(42,111,214,0.62)', croc: 'rgba(42,111,214,0.62)', tar: 'rgba(26,20,32,0.75)', quick: 'rgba(224,192,96,0.45)' }[pit.kind];
      if (wash) { ctx.fillStyle = wash; ctx.fillRect(ext[0], L.ceilY, ext[1] - ext[0], 10); }
    }
    // pit rims: dark lips where the path ends
    ctx.fillStyle = PAL.pathD; ctx.fillRect(ext[0] - 1, SY + 1, 1, L.pathH - 1); ctx.fillRect(ext[1], SY + 1, 1, L.pathH - 1);
    ctx.fillStyle = PAL.outline; ctx.fillRect(ext[0] - 1, L.ceilY, 1, 10); ctx.fillRect(ext[1], L.ceilY, 1, 10);
  }
  // brick wall in the tunnel
  if (under.wall) {
    const x = under.wall === 'L' ? L.wallL : L.wallR, bw = dim(art.get('tile_brick', 0));
    for (let y = L.tunnelTop; y < L.tunnelY; y += 8) {
      const hh = Math.min(8, L.tunnelY - y), off = (((y - L.tunnelTop) / 8) & 1) ? 8 : 0;
      for (let k = -1; k < Math.ceil(L.wallW / bw.w) + 1; k++) {
        const xa = Math.max(x, x + k * bw.w - off), xb = Math.min(x + L.wallW, x + k * bw.w - off + bw.w);
        if (xb > xa) ctx.drawImage(art.get('tile_brick', 0), xa - (x + k * bw.w - off), 0, xb - xa, hh, xa, y, xb - xa, hh);
      }
    }
    ctx.fillStyle = PAL.outline; ctx.fillRect(x - 1, L.tunnelTop, 1, L.tunnelY - L.tunnelTop); ctx.fillRect(x + L.wallW, L.tunnelTop, 1, L.tunnelY - L.tunnelTop);
  }
}

// ------------------------------------------------------------------ cache of static layers
export function createStaticCache(art, mk, max = 8) {
  const map = new Map();
  let ver = art.version;
  return {
    get(screen) {
      if (!mk) return null;
      if (ver !== art.version) { map.clear(); ver = art.version; }
      const key = screen.idx;
      let c = map.get(key);
      if (c) { map.delete(key); map.set(key, c); return c; }
      c = mk(W, H);
      const cx = c.getContext('2d'); cx.clearRect(0, 0, W, H);
      paintStatic(cx, art, screen);
      map.set(key, c);
      if (map.size > max) map.delete(map.keys().next().value);
      return c;
    },
    clear() { map.clear(); },
    get size() { return map.size; },
  };
}

// ------------------------------------------------------------------ animated layer: liquid, ladder, sign, bats, treasure
function drawLiquid(ctx, art, screen, t) {
  const pit = pitOf(screen);
  if (!pit || pit.kind === 'hole') return;
  const name = { tar: 'tile_tar', quick: 'tile_quick' }[pit.kind] || 'tile_water', f = Math.floor(t * 4) % 3;
  strip(ctx, art, () => art.get(name, f), SY, pit.x0, pit.x0 + pit.w, 10, 1);
}
function drawLadder(ctx, art, screen) {
  const lx = ladderX(screen);
  if (lx == null) return;
  const x = Math.round(lx - L.ladderW / 2);
  for (let y = SY + 6; y < L.tunnelY; y += 8) ctx.drawImage(art.get('ladder', 0), x, y);
  ctx.drawImage(art.get('ladder_top', 0), x, SY - 2);
}
function drawBats(ctx, art, screen, t) {
  const idx = screen.idx | 0, n = Math.floor(hs(idx, 1, 41) * 3);   // 0..2
  for (let i = 0; i < n; i++) {
    const ph = hs(idx, i, 42) * 6.28, x = mod(hs(idx, i, 43) * W + t * (9 + i * 5), W + 24) - 12, y = L.tunnelTop + 8 + hs(idx, i, 44) * 20 + Math.sin(t * 2 + ph) * 4;
    ctx.drawImage(art.get('bat', Math.floor(t * 8 + i) & 1), Math.round(x), Math.round(y));
  }
}
function drawSign(ctx, art, screen, t) {
  if (!(screen.pete || screen.mood === 'pete')) return;
  const sz = dim(art.get('sign_pete', 0));
  ctx.drawImage(art.get('sign_pete', Math.floor(t * 2) & 1), 52 - sz.w / 2, SY + 2 - sz.h);
}
export function drawTreasure(ctx, art, screen, t, collected) {
  const tr = screen.treasure;
  if (!tr || (collected && collected.has(tr.id))) return;
  const name = 'tr_' + tr.type, f = Math.floor(t * 6) % 3, bob = Math.round(Math.sin(t * 4 + tr.id) * 1.2), sz = dim(art.get(name, 0));
  ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(Math.round(tr.x - 4), SY, 8, 1);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.16 + 0.08 * Math.sin(t * 5);
  ctx.fillStyle = PAL.gold; ctx.fillRect(Math.round(tr.x - 8), SY - 14 + bob, 16, 12); ctx.restore();
  ctx.drawImage(art.get(name, f), Math.round(tr.x - sz.w / 2), SY - sz.h - 1 + bob);
}
export function drawPeteBranch(ctx, art, screen, throwing) {
  if (!screen.pete) return;
  const sz = dim(art.get('pete_branch', 0));
  ctx.drawImage(art.get('pete_branch', throwing ? 1 : 0), 270 - sz.w / 2, L.canopyBottom + 8 - sz.h + 12);
}

// ------------------------------------------------------------------ vine
export function drawVine(ctx, art, screen, vineT, hand) {
  const pit = pitOf(screen);
  if (!pit || !pit.vine) return;
  const cx = pit.x0 + pit.w / 2, tip = vineTip(cx, vineT), end = hand || tip;
  const px = cx, py = TUNING.vine.pivotY;
  const pv = dim(art.get('vine_pivot', 0));
  // rope: dark outline line, mid line, highlight offset
  const line = (x0, y0, x1, y1, col) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
    ctx.fillStyle = col;
    for (let i = 0; i <= n; i++) { const u = n ? i / n : 0; ctx.fillRect(Math.round(x0 + (x1 - x0) * u), Math.round(y0 + (y1 - y0) * u), 1, 1); }
  };
  line(px - 1, py, end.x - 1, end.y, PAL.leafDark2); line(px + 1, py, end.x + 1, end.y, PAL.leafDark2);
  line(px, py, end.x, end.y, PAL.leafM);
  ctx.drawImage(art.get('vine_pivot', 0), Math.round(px - pv.w / 2), Math.round(py - 4));
  if (!hand) { const k = dim(art.get('vine_knot', 0)); ctx.drawImage(art.get('vine_knot', 0), Math.round(tip.x - k.w / 2), Math.round(tip.y - k.h / 2)); }
}

// ------------------------------------------------------------------ entities
const ENT_SPRITE = { log: 'log', stilllog: 'stilllog', cheese: 'cheese', fire: 'fire', snake: 'snake', croc: 'croc', scorpion: 'scorpion', cheese_thrown: 'cheese_thrown' };
export function drawEntities(ctx, art, ents, t) {
  for (const e of ents || []) {
    if (!e || e.dead) continue;
    const name = ENT_SPRITE[e.kind] || e.kind, sz = dim(art.get(name, 0)), f = e.frame | 0;
    const x = Math.round(e.x - sz.w / 2);
    if (e.kind === 'croc') { ctx.drawImage(art.get(name, f), x, Math.round(e.y - (e.h ?? 10))); continue; }
    const y = Math.round(e.y - sz.h);
    if (e.layer !== 'tunnel') {   // contact shadow on the path, shrinking as the entity hops
      const lift = Math.max(0, SY - e.y), w = Math.max(3, Math.round((e.w ?? sz.w) * (0.9 - Math.min(0.5, lift / 40))));
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(Math.round(e.x - w / 2), SY, w, 1);
    }
    if (e.kind === 'fire') {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.13 + 0.05 * Math.sin(t * 23 + e.id);
      ctx.fillStyle = PAL.fire; ctx.fillRect(Math.round(e.x - 12), Math.round(e.y - 20), 24, 20); ctx.fillRect(Math.round(e.x - 8), Math.round(e.y - 24), 16, 28); ctx.restore();
    }
    ctx.drawImage(art.get(name, f), x, y);
  }
}

// ------------------------------------------------------------------ Colby
export function drawPlayer(ctx, art, g, t) {
  const p = g.player;
  if (!p) return;
  if (p.inv > 0 && Math.floor(t * 18) % 2 === 0 && g.state === 'play') return;   // blink while invulnerable
  let name = 'colby_' + (p.pose || 'idle');
  if (art.frames(name) < 1) name = 'colby_idle';
  const sz = dim(art.get(name, 0)), f = (p.frame | 0), img = art.get(name, f);
  const x = Math.round(p.x), y = Math.round(p.y), face = p.face < 0 ? -1 : 1;
  const pit = pitOf(g.screen), over = pit && x > pit.x0 && x < pit.x0 + pit.w;
  // shadow on whatever he stands over
  const floor = p.layer === 'tunnel' ? L.tunnelY : SY, lift = Math.max(0, floor - p.y);
  if (p.layer === 'tunnel' || !(over && pit.kind !== 'croc') || p.y <= SY) {
    const sw = Math.max(4, 10 - Math.round(lift / 6));
    ctx.fillStyle = 'rgba(0,0,0,0.33)'; ctx.fillRect(x - (sw >> 1), floor, sw, 1);
  }
  ctx.save();
  const sinking = p.layer !== 'tunnel' && pit && pit.kind !== 'hole' && over && p.y > SY + 0.5;
  if (sinking) { ctx.beginPath(); ctx.rect(0, 0, W, SY + 2); ctx.clip(); }
  if (face < 0) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(img, -sz.w / 2, y - sz.h); }
  else ctx.drawImage(img, Math.round(x - sz.w / 2), y - sz.h);
  ctx.restore();
}

// ------------------------------------------------------------------ foreground leaves (2.xD): after Colby, before night
export function drawForeground(ctx, art, screen, t) {
  const idx = screen.idx | 0, sz = dim(art.get('fg_leaf', 0)), strips = 6, sh = Math.ceil(sz.h / strips);
  for (const side of [-1, 1]) {
    const vi = Math.floor(hs(idx, side + 3, 61) * 3), img = art.get('fg_leaf', vi), ph = hs(idx, side + 9, 62) * 6.28;
    const baseY = side < 0 ? L.hudH + 2 : L.hudH + 14, inset = 14;
    for (let s = 0; s < strips; s++) {
      const sway = Math.round(Math.sin(t * 1.3 + ph + s * 0.55) * (0.6 + s * 0.45));
      const sy = s * sh, hh = Math.min(sh, sz.h - sy);
      if (hh <= 0) continue;
      if (side < 0) ctx.drawImage(img, 0, sy, sz.w, hh, -inset + sway, baseY + sy, sz.w, hh);
      else {
        ctx.save(); ctx.translate(W + inset + sway, 0); ctx.scale(-1, 1);
        ctx.drawImage(img, 0, sy, sz.w, hh, 0, baseY + sy, sz.w, hh); ctx.restore();
      }
    }
  }
}

// ------------------------------------------------------------------ composed helpers
/** Everything in a screen except entities/Colby/foreground: static (cached if cache given) + animation + vine. */
export function drawScreenLayers(ctx, art, screen, t, o = {}) {
  const c = o.cache && o.cache.get(screen);
  if (c) ctx.drawImage(c, 0, 0); else paintStatic(ctx, art, screen);
  drawLiquid(ctx, art, screen, t);
  drawLadder(ctx, art, screen);
  drawBats(ctx, art, screen, t);
  drawSign(ctx, art, screen, t);
  drawPeteBranch(ctx, art, screen, o.throwing);
  if (!o.frozen) drawTreasure(ctx, art, screen, t, o.collected);
}

/**
 * One whole static frame of a screen (title/attract/shot use): sky, parallax, scene, vine, treasure, foreground, night.
 * @param {{t01?:number, scroll?:number, cache?:any, collected?:Set<number>, vineT?:number, foreground?:boolean, night?:boolean}} [o]
 */
export function drawScreenStatic(ctx, art, screen, t, o = {}) {
  const t01 = o.t01 ?? 1;
  drawBackdrop(ctx, art, { t01, t, scroll: o.scroll ?? screen.idx });
  drawScreenLayers(ctx, art, screen, t, o);
  drawMood(ctx, screen.mood);
  drawVine(ctx, art, screen, o.vineT ?? t);
  if (o.foreground !== false) drawForeground(ctx, art, screen, t);
  if (o.night !== false) drawNight(ctx, art, { t01, t, idx: screen.idx });
}

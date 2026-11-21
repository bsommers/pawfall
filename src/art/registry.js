// Art registry (owner: render). Builds every art module once and hands out drawables.
//
//   const art = buildAll();        // returns IMMEDIATELY: coloured placeholders for every ART row, then real art
//   await art.ready;               // resolves (to the registry) once every present module is built
//   art.get('colby_run', 3)        // canvas (browser) or PixBuf (Node / forcePix) -- drawImage-able by renderer
//   art.size(name) art.frames(name) art.names() art.pix(name, f) art.has(name) art.tint(name, f, '#rrggbb')
//
// Missing / throwing / half-written modules keep their placeholders (never throws). Canvas identity is STABLE:
// real pixels are painted INTO the canvas get() already returned. `art.version` bumps on every change so derived
// caches (static screen layers) can invalidate. Node-safe: no DOM access at import time.
import { ART, PAL } from '../core/defs.js';
import { PixBuf, hash2, shade, ink } from './pixbuf.js';

export const ART_MODULES = Object.freeze(['colby', 'critters', 'world', 'fx']);

export function canvasFactory() {
  if (typeof document !== 'undefined' && document.createElement) {
    return (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  }
  if (typeof OffscreenCanvas !== 'undefined') return (w, h) => new OffscreenCanvas(w, h);
  return null;
}

/** Paint a PixBuf into a canvas created by mk (or a fresh one). */
export function pixToCanvas(p, mk, into = null) {
  const c = into || mk(p.w, p.h);
  if (c.width !== p.w || c.height !== p.h) { c.width = p.w; c.height = p.h; }
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, p.w, p.h);
  ctx.putImageData(new ImageData(new Uint8ClampedArray(p.rgba), p.w, p.h), 0, 0);
  return c;
}

// ---------------------------------------------------------------- placeholders (flat coloured shapes)
const NAME_COL = [
  [/^colby_life$/, PAL.fur], [/^colby_/, PAL.fur], [/^pete_/, PAL.peteFur], [/^log|^stilllog/, PAL.log], [/^cheese/, PAL.cheese],
  [/^fire$/, PAL.fire], [/^snake$/, PAL.snake], [/^scorpion$/, PAL.scorp], [/^croc$/, PAL.croc],
  [/^tr_tuna/, PAL.tuna], [/^tr_sardine/, PAL.silver], [/^tr_gold/, PAL.gold], [/^tr_collar/, PAL.gem],
  [/^tile_path$/, PAL.path], [/^tile_dirt$/, PAL.dirt], [/^tile_ceil$/, PAL.dirtL], [/^tile_brick$/, PAL.brick],
  [/^tile_tunnel$/, PAL.tunnelMid], [/^tile_water$/, PAL.water], [/^tile_tar$/, PAL.tar], [/^tile_quick$/, PAL.quick],
  [/^pit_depth$/, PAL.dirtD], [/^ladder/, PAL.trunkL], [/^trunk$/, PAL.trunk], [/^canopy_far$/, PAL.leafD], [/^canopy$/, PAL.leaf],
  [/^bg_mountains$/, '#5a5a9a'], [/^bg_trees$/, '#3a7a5a'], [/^cloud$/, '#ffffff'], [/^fg_leaf$/, PAL.leafDark2],
  [/^bush$/, PAL.leafM], [/^rock$/, PAL.scorpD], [/^mushroom$/, PAL.red], [/^vine_/, PAL.leafL], [/^sign_pete/, PAL.peteSuit],
  [/^bat$/, PAL.tarL], [/^firefly$/, PAL.fireL], [/^star$/, PAL.white], [/^sun$/, PAL.white],
  [/^fx_splash|^fx_bubble/, PAL.waterL], [/^fx_tarsplat/, PAL.tar], [/^fx_dust|^fx_poof/, PAL.white], [/^fx_sparkle|^fx_stars/, PAL.fireL],
  [/^fx_leaf/, PAL.leafHL], [/^logo/, PAL.gold], [/^title_scene/, PAL.leafD], [/^cursor_paw|^touch_btn/, PAL.fur],
];
const ROUNDISH = /^(sun|log|cheese|firefly|star|cloud|fx_|croc|colby_life|pete_head|cursor_paw|touch_btn|tr_collar)/;

function placeholder(row) {
  const col = (NAME_COL.find(([re]) => re.test(row.name)) || [0, '#ff40c0'])[1];
  const out = [];
  for (let f = 0; f < row.frames; f++) {
    const p = new PixBuf(row.w, row.h);
    if (row.kind === 'tile') {
      for (let y = 0; y < row.h; y++) for (let x = 0; x < row.w; x++) p.set(x, y, shade(col, 0.92 + 0.16 * hash2(x + f * 3, y, 11)));
    } else if (/^bg_|^canopy|^fg_leaf|^title_scene|^trunk/.test(row.name)) {
      // wide silhouette bands: a bumpy top edge so layers stay readable
      for (let x = 0; x < row.w; x++) {
        const top = Math.floor(row.h * 0.25 * (1 + Math.sin(x * 0.21 + f * 2)) * 0.5);
        p.rect(x, top, 1, row.h - top, shade(col, 0.9 + 0.2 * hash2(x >> 2, f, 5)));
      }
    } else if (ROUNDISH.test(row.name)) {
      p.ellipse(row.w / 2, row.h / 2, Math.max(1, row.w / 2 - 0.5), Math.max(1, row.h / 2 - 0.5), shade(col, 0.8 + 0.1 * (f % 3)));
      if (row.w > 5) p.ellipse(row.w / 2 - 0.5, row.h / 2 - 0.5, Math.max(1, row.w / 3), Math.max(1, row.h / 3), col);
    } else {
      p.rect(0, 0, row.w, row.h, shade(col, 0.85 + 0.05 * (f % 4)));
      if (row.w > 3 && row.h > 3) p.rect(1, 1, row.w - 2, row.h - 2, col);
    }
    if (row.kind !== 'tile' && row.w > 3) p.outline(PAL.outline);
    out.push(p);
  }
  return out;
}
const isPix = (p) => p && p.rgba && p.w > 0 && p.h > 0 && p.rgba.length === p.w * p.h * 4;

function bboxOf(frames) {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (const p of frames) for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
    if (p.rgba[(y * p.w + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  return x1 < 0 ? { x0: 0, y0: 0, x1: frames[0].w - 1, y1: frames[0].h - 1 } : { x0, y0, x1, y1 };
}

/**
 * @param {{ modules?: string[], importer?: (m:string)=>Promise<any>, onProgress?: Function, forcePix?: boolean,
 *           createCanvas?: (w:number,h:number)=>any }} [opts]
 */
export function buildAll(opts = {}) {
  const modules = opts.modules || ART_MODULES;
  const importer = opts.importer || ((m) => import(`./${m}.js`));
  const mk = opts.forcePix ? null : (opts.createCanvas || canvasFactory());
  const entries = new Map(), warned = new Set(), tints = new Map();
  const reg = {
    version: 1, done: false, progress: 0, missing: [], errors: [], loaded: [], canvasMode: !!mk, mk,
    get, size, frames, has, pix, bbox, tint, names: () => [...entries.keys()], ready: null,
  };

  function paint(e, i) {
    const p = e.pix[i];
    if (!mk) { e.out[i] = p; return; }
    e.out[i] = pixToCanvas(p, mk, e.out[i] || null);
  }
  function install(name, frs, real) {
    let e = entries.get(name);
    if (!e) { e = { name, pix: [], out: [], real: false, bbox: null }; entries.set(name, e); }
    if (!mk) e.out.length = 0;
    e.pix = frs; e.real = real; e.bbox = bboxOf(frs);
    e.out.length = Math.min(e.out.length, frs.length);
    for (let i = 0; i < frs.length; i++) paint(e, i);
    tints.clear();
    reg.version++;
  }
  function entry(name) {
    let e = entries.get(name);
    if (!e) {
      if (!warned.has(name)) { warned.add(name); if (typeof console !== 'undefined') console.warn(`[art] unknown sprite "${name}" (placeholder)`); }
      install(name, placeholder({ name, w: 16, h: 16, frames: 1, kind: 'sprite' }), false);
      e = entries.get(name);
    }
    return e;
  }
  function get(name, frame = 0) { const e = entry(name), n = e.out.length; return e.out[((frame | 0) % n + n) % n]; }
  function pix(name, frame = 0) { const e = entry(name), n = e.pix.length; return e.pix[((frame | 0) % n + n) % n]; }
  function size(name) { const p = entry(name).pix[0]; return { w: p.w, h: p.h }; }
  function frames(name) { return entry(name).pix.length; }
  function has(name) { const e = entries.get(name); return !!(e && e.real); }
  function bbox(name) { return entry(name).bbox; }
  /** Recoloured copy keeping the sprite's luminance ramp (used for the sun/moon disc). Cached per (name, frame, colour). */
  function tint(name, frame, color) {
    const key = `${name}|${frame | 0}|${color}`;
    let t = tints.get(key);
    if (t) return t;
    const p = pix(name, frame), [tr, tg, tb] = ink(color) && [ink(color).r, ink(color).g, ink(color).b];
    const q = new PixBuf(p.w, p.h);
    let mx = 1;
    for (let i = 0; i < p.rgba.length; i += 4) if (p.rgba[i + 3] > 0) mx = Math.max(mx, 0.3 * p.rgba[i] + 0.59 * p.rgba[i + 1] + 0.11 * p.rgba[i + 2]);
    for (let i = 0; i < p.rgba.length; i += 4) {
      if (!p.rgba[i + 3]) continue;
      const l = Math.min(1.15, (0.3 * p.rgba[i] + 0.59 * p.rgba[i + 1] + 0.11 * p.rgba[i + 2]) / mx);
      q.rgba[i] = Math.min(255, tr * l); q.rgba[i + 1] = Math.min(255, tg * l); q.rgba[i + 2] = Math.min(255, tb * l); q.rgba[i + 3] = p.rgba[i + 3];
    }
    t = mk ? pixToCanvas(q, mk) : q;
    tints.set(key, t);
    return t;
  }

  for (const row of ART) install(row.name, placeholder(row), false);

  const tick = () => new Promise((r) => (typeof setTimeout === 'function' ? setTimeout(r, 0) : r()));
  reg.ready = (async () => {
    let n = 0;
    for (const m of modules) {
      try {
        const mod = await importer(m);
        if (typeof mod.build !== 'function') throw new Error('no build() export');
        const built = mod.build() || {};
        for (const row of ART) {
          if (row.module !== m) continue;
          const v = built[row.name];
          const fr = (Array.isArray(v) ? v : [v]).filter(isPix);
          if (!fr.length) { reg.errors.push(`${m}: missing sprite ${row.name}`); continue; }
          if (fr[0].w !== row.w || fr[0].h !== row.h || fr.length !== row.frames) {
            reg.errors.push(`${m}: ${row.name} is ${fr[0].w}x${fr[0].h} f${fr.length}, manifest says ${row.w}x${row.h} f${row.frames}`);
          }
          install(row.name, fr, true);
        }
        reg.loaded.push(m);
      } catch (err) {
        const msg = String((err && err.message) || err);
        if (/Cannot find module|ERR_MODULE_NOT_FOUND|Failed to fetch|error loading dynamically imported|404|Importing a module script failed/i.test(msg)) reg.missing.push(m);
        else reg.errors.push(`${m}: ${msg}`);
      }
      reg.progress = ++n / modules.length;
      if (opts.onProgress) try { opts.onProgress(n, modules.length, m); } catch { /* ignore */ }
      await tick();
    }
    reg.done = true;
    return reg;
  })();
  return reg;
}

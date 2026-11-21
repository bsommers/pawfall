// Renderer (owner: render). createRenderer(canvas, { bus, art, settings, createCanvas?, size?, now? })
//   -> { draw(game, alpha), resize(), setCRT(on), shot(), hud, overlay, buffer, viewport, particles, dispose() }
// Draws the 320x192 logical frame into an offscreen buffer, then integer-scales it (nearest) into `canvas`, letterboxed.
// Pure function of game state + time: it reads game.t (sim seconds) as its clock and never mutates the sim.
import { W, H, LAYOUT as L, TIME_LIMIT, WORLD_SCREENS } from '../core/defs.js';
import { canvasFactory } from '../art/registry.js';
import { drawBackdrop, drawMood, drawNight } from './background.js';
import { createStaticCache, drawScreenLayers, drawVine, drawEntities, drawPlayer, drawForeground } from './scene.js';
import { createParticles } from './particles.js';
import { createCRT } from './crt.js';

const SLIDE = 0.25;
const ease = (u) => 1 - Math.pow(1 - u, 3);
const wrapDelta = (d) => { const n = WORLD_SCREENS; d = ((d % n) + n) % n; return d > n / 2 ? d - n : d; };

export function createRenderer(canvas, opts = {}) {
  const art = opts.art, bus = opts.bus || null, settings = opts.settings || {};
  if (!art) throw new Error('createRenderer: opts.art (registry) is required');
  const mk = opts.createCanvas || art.mk || canvasFactory();
  if (!mk) throw new Error('createRenderer: no canvas factory (pass opts.createCanvas)');
  const now = opts.now || (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
  const out = canvas.getContext('2d');
  const buf = mk(W, H), bctx = buf.getContext('2d');
  const cache = createStaticCache(art, mk), particles = createParticles(bus, art), crt = createCRT(mk);
  let crtOn = settings.crt ?? true;
  const view = { ox: 0, oy: 0, s: 1, w: W, h: H, cw: W, ch: H };

  // --- state tracked across frames
  let lastIdx = null, lastScreen = null, lastGT = null, clock = 0, scroll = 0, trans = null, throwUntil = -1;
  const shakes = [];
  const offs = [];
  if (bus) {
    offs.push(bus.on('shake', (e) => { if (e) shakes.push({ mag: e.mag ?? 2, dur: Math.max(0.05, e.dur ?? 0.25), t0: clock }); }));
    offs.push(bus.on('taunt', () => { throwUntil = clock + 0.9; }));
  }

  function resize() {
    const dpr = opts.size?.dpr ?? (typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1) ?? 1;
    const cssW = opts.size?.w ?? (typeof innerWidth !== 'undefined' ? innerWidth : W * 3), cssH = opts.size?.h ?? (typeof innerHeight !== 'undefined' ? innerHeight : H * 3);
    const cw = Math.max(W, Math.floor(cssW * dpr)), ch = Math.max(H, Math.floor(cssH * dpr));
    const s = Math.max(1, Math.floor(Math.min(cw / W, ch / H)));
    canvas.width = cw; canvas.height = ch;
    if (canvas.style && !opts.size) { canvas.style.width = cw / dpr + 'px'; canvas.style.height = ch / dpr + 'px'; }
    Object.assign(view, { s, w: W * s, h: H * s, ox: Math.floor((cw - W * s) / 2), oy: Math.floor((ch - H * s) / 2), cw, ch });
    out.imageSmoothingEnabled = false;
    return view;
  }
  resize();
  if (typeof addEventListener === 'function' && !opts.size) addEventListener('resize', resize);

  function shakeOffset() {
    let mag = 0;
    for (let i = shakes.length - 1; i >= 0; i--) {
      const s = shakes[i], u = (clock - s.t0) / s.dur;
      if (u >= 1 || u < 0) { shakes.splice(i, 1); continue; }
      mag = Math.max(mag, s.mag * (1 - u));
    }
    if (mag <= 0.05) return [0, 0];
    const k = Math.floor(clock * 60), h1 = Math.sin(k * 12.9898) * 43758.5453, h2 = Math.sin(k * 78.233) * 12345.6789;
    return [Math.round(((h1 - Math.floor(h1)) * 2 - 1) * mag), Math.round(((h2 - Math.floor(h2)) * 2 - 1) * mag)];
  }

  function advance(g) {
    const wall = now();
    if (lastGT == null) { lastGT = g.t ?? 0; }
    const dt = (g.t ?? 0) - lastGT;
    lastGT = g.t ?? 0;
    const step = dt > 0 && dt < 0.5 ? dt : 0;
    clock += step;
    return { dt: step, wall };
  }

  function draw(game, alpha = 1) {
    if (!game) return;
    const { dt, wall } = advance(game);
    const t = game.t ?? 0, scr = game.screen, idx = game.screenIdx ?? scr?.idx ?? 0;
    if (!scr) { bctx.fillStyle = '#000'; bctx.fillRect(0, 0, W, H); present(t); return; }
    // screen change -> slide transition
    if (lastIdx == null) { scroll = idx; }
    else if (idx !== lastIdx && lastScreen) {
      const d = wrapDelta(idx - lastIdx);
      if (d !== 0) { trans = { from: lastScreen, dir: d > 0 ? 1 : -1, delta: d, c0: clock, w0: wall }; scroll += d; }
    }
    lastIdx = idx; lastScreen = scr;
    let e = 1, sc = scroll;
    if (trans) {
      const u = Math.min(1, Math.max((clock - trans.c0) / SLIDE, (wall - trans.w0) / (SLIDE * 3000)));
      if (u >= 1) trans = null; else { e = ease(u); sc = scroll - trans.delta * (1 - e); }
    }
    particles.update(dt, game);

    const t01 = Math.max(0, Math.min(1, (game.timeLeft ?? TIME_LIMIT) / TIME_LIMIT));
    const [sx, sy] = shakeOffset();
    bctx.setTransform?.(1, 0, 0, 1, 0, 0); bctx.globalAlpha = 1;
    bctx.fillStyle = '#000'; bctx.fillRect(0, 0, W, H);
    bctx.save(); bctx.translate(sx, sy);
    drawBackdrop(bctx, art, { t01, t, scroll: sc });
    const throwing = clock < throwUntil, collected = game.collected;
    const place = (ox, fn) => { bctx.save(); bctx.translate(Math.round(ox), 0); fn(); bctx.restore(); };
    if (trans) {
      const ox = -trans.dir * e * W;
      place(ox, () => { drawScreenLayers(bctx, art, trans.from, t, { cache, frozen: true }); drawMood(bctx, trans.from.mood); drawForeground(bctx, art, trans.from, t); });
    }
    const oxn = trans ? trans.dir * (1 - e) * W : 0;
    place(oxn, () => {
      drawScreenLayers(bctx, art, scr, t, { cache, throwing, collected });
      drawMood(bctx, scr.mood);
      const hand = game.player && game.player.mode === 'swing' ? { x: game.player.x, y: game.player.y - 18 } : null;
      drawVine(bctx, art, scr, game.vineT ?? t, hand);
      drawEntities(bctx, art, game.ents, t);
      drawPlayer(bctx, art, game, t);
      particles.draw(bctx, t);
      drawForeground(bctx, art, scr, t);
    });
    drawNight(bctx, art, { t01, t, idx });
    bctx.restore();
    bctx.fillStyle = '#0a0710'; bctx.fillRect(0, 0, W, L.hudH);   // HUD strip is always black (hud callback draws on top)
    if (typeof renderer.hud === 'function') renderer.hud(bctx, game);
    if (typeof renderer.overlay === 'function') renderer.overlay(bctx);
    present(t);
  }

  function present(t) {
    out.setTransform?.(1, 0, 0, 1, 0, 0);
    out.imageSmoothingEnabled = false;
    out.globalAlpha = 1;
    out.fillStyle = '#000'; out.fillRect(0, 0, view.cw, view.ch);
    out.drawImage(buf, 0, 0, W, H, view.ox, view.oy, view.w, view.h);
    if (crtOn) crt.apply(out, view, t);
  }

  const renderer = {
    draw, resize,
    setCRT(on) { crtOn = !!on; },
    get crt() { return crtOn; },
    /** PNG data URL of the output canvas when available (browser), else the logical buffer. */
    shot() { return canvas.toDataURL ? canvas.toDataURL('image/png') : buf; },
    hud: null, overlay: null,
    buffer: buf, viewport: view, particles, cache, art,
    dispose() { for (const o of offs) o(); offs.length = 0; particles.dispose(); if (typeof removeEventListener === 'function') removeEventListener('resize', resize); },
  };
  return renderer;
}
export { drawScreenStatic } from './scene.js';

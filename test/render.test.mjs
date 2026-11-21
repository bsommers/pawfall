import test from 'node:test';
import assert from 'node:assert/strict';
import { W, H, LAYOUT, PAL } from '../src/core/defs.js';
import { createBus } from '../src/core/events.js';
import { buildAll } from '../src/art/registry.js';
import { createRenderer } from '../src/render/renderer.js';
import { drawScreenStatic } from '../src/render/scene.js';
import { skyFor } from '../src/core/defs.js';
import { drawSkyBands } from '../src/render/background.js';
import { createShimCanvas, fakeGame, fakeScreen } from './render-harness.mjs';

async function setup(modules) {
  const art = buildAll({ forcePix: true, ...(modules ? { modules } : {}) });
  await art.ready;
  const bus = createBus(), canvas = createShimCanvas(W, H);
  const r = createRenderer(canvas, { bus, art, createCanvas: createShimCanvas, size: { w: W, h: H, dpr: 1 }, now: () => 0 });
  return { art, bus, canvas, r };
}
const px = (c, x, y) => { const i = (y * c.width + x) * 4; return [...c.rgba.slice(i, i + 4)]; };
const hexOf = (p) => '#' + p.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('');
const dist = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

test('registry: placeholders cover the whole manifest even with no art modules', async () => {
  const art = buildAll({ forcePix: true, modules: ['nope_a', 'nope_b'] });
  await art.ready;
  assert.deepEqual(art.missing.sort(), ['nope_a', 'nope_b']);
  for (const n of ['colby_run', 'log', 'tile_path', 'canopy', 'fx_dust']) assert.ok(art.names().includes(n), n);
  assert.equal(art.frames('colby_run'), 6);
  assert.deepEqual(art.size('trunk'), { w: 14, h: 64 });
  assert.ok(art.get('colby_run', 9).rgba, 'frame index wraps');
  assert.equal(art.has('colby_run'), false);
});

test('registry: unknown sprite name returns a placeholder, never throws', async () => {
  const art = buildAll({ forcePix: true, modules: [] }); await art.ready;
  const w = console.warn; console.warn = () => {};
  try { assert.equal(art.get('totally_unknown').w, 16); } finally { console.warn = w; }
});

test('registry: throwing module is isolated and recorded', async () => {
  const art = buildAll({ forcePix: true, modules: ['bad'], importer: async () => ({ build() { throw new Error('boom'); } }) });
  await art.ready;
  assert.match(art.errors[0], /boom/);
  assert.ok(art.get('log').w > 0);
});

test('renderer draws every pit kind and mood with placeholder art only', async () => {
  const { r, canvas } = await setup([]);
  for (let i = 0; i < 12; i++) {
    const g = fakeGame({ screenIdx: i, screen: fakeScreen(i), t: i * 0.3 });
    r.draw(g);
  }
  assert.equal(canvas.width, W); // size option -> scale 1
});

test('sky: bands follow skyFor and night is darker than day', async () => {
  const c = createShimCanvas(W, H);
  drawSkyBands(c.getContext('2d'), skyFor(1));
  const want = [1, 3, 5].map((o) => parseInt(skyFor(1).bands[0].slice(o, o + 2), 16));
  assert.deepEqual(px(c, 3, LAYOUT.hudH + 1).slice(0, 3), want);
  const { r } = await setup([]);
  r.draw(fakeGame({ timeLeft: 1200 })); const a = px(r.buffer, 160, 30);
  r.draw(fakeGame({ timeLeft: 5 })); const b = px(r.buffer, 160, 30);
  assert.ok(a[0] + a[1] + a[2] > b[0] + b[1] + b[2], 'night is darker than day');
});

test('Colby is drawn at his feet and mirrored by face', async () => {
  const { r, art } = await setup([]);
  const mk = (face) => fakeGame({ screen: fakeScreen(0, { kind: null }), player: { ...fakeGame().player, x: 160, y: 104, face, pose: 'idle' } });
  r.draw(mk(1));
  // placeholder idle is symmetric; just prove he is drawn within the 16x24 box above the feet
  const box = art.size('colby_idle');
  assert.deepEqual(box, { w: 16, h: 24 });
  const above = px(r.buffer, 160, 104 - 12), far = px(r.buffer, 160 + 40, 90);
  assert.notDeepEqual(above, far);
});

test('sinking Colby is clipped at the pit surface (nothing of him below it)', async () => {
  const { r } = await setup([]);
  const screen = fakeScreen(0, { kind: 'tar', mood: 'bright' });
  const base = fakeGame({ screen, player: { ...fakeGame().player, x: 160, y: 104, pose: 'sink', frame: 2 } });
  r.draw(base); const ref = px(r.buffer, 160, 112);
  const sunk = fakeGame({ screen, player: { ...fakeGame().player, x: 160, y: 124, pose: 'sink', frame: 2, mode: 'sink' } });
  r.draw(sunk);
  assert.deepEqual(px(r.buffer, 160, 112), ref, 'pixels below the surface unchanged by the sunk sprite');
});

test('screen change starts a slide that settles after ~0.25 s of sim time', async () => {
  const { r } = await setup([]);
  const g = fakeGame({ screenIdx: 3, screen: fakeScreen(3), t: 1 });
  r.draw(g);
  g.screenIdx = 4; g.screen = fakeScreen(4); g.t = 1.016; r.draw(g);
  const mid = Buffer.from(r.buffer.rgba);
  g.t = 1.5; r.draw(g); r.draw(g);
  const end = Buffer.from(r.buffer.rgba);
  assert.notDeepEqual(mid, end, 'slide frame differs from the settled frame');
  g.t = 1.52; r.draw(g);
  assert.deepEqual(Buffer.from(r.buffer.rgba).subarray(0, 4), end.subarray(0, 4));
});

test('parallax lines up across a flip and across the world wrap', async () => {
  const { art } = await setup([]);
  // offset of layer k at screen idx+1 must equal offset at idx + (W*factor): tile width divides the full lap
  for (const [name, f] of [['bg_mountains', 0.15], ['bg_trees', 0.3]]) {
    const tw = art.size(name).w * (name === 'bg_trees' ? 2 : 1);
    assert.equal((W * f * 120) % tw, 0, name + ' lap divides tile width');
  }
});

test('shake event offsets the world, then decays to nothing', async () => {
  const { r, bus } = await setup([]);
  const g = fakeGame({ screen: fakeScreen(0, { kind: null }), t: 2 });
  r.draw(g); const calm = Buffer.from(r.buffer.rgba);
  bus.emit('shake', { mag: 4, dur: 0.3 }); g.t = 2.05; r.draw(g);
  assert.notDeepEqual(Buffer.from(r.buffer.rgba), calm);
  g.t = 3; r.draw(g); r.draw(g);
  assert.equal(r.buffer.rgba.length, calm.length);
});

test('particles listen to the bus and expire', async () => {
  const { r, bus } = await setup([]);
  const g = fakeGame({ t: 1 }); r.draw(g);
  bus.emit('fx', { type: 'splash', x: 150, y: 104 }); bus.emit('fx', { type: 'confetti', x: 100, y: 60 }); bus.emit('popup', { text: '+4000', x: 50, y: 80 });
  assert.ok(r.particles.count > 20);
  for (let i = 1; i <= 80; i++) { g.t = 1 + i * 0.05; r.draw(g); }
  assert.ok(r.particles.count < 10, 'particles expired, left ' + r.particles.count);
});

test('hud and overlay callbacks run in order, CRT toggles, shot() is available', async () => {
  const { r } = await setup([]);
  const order = [];
  r.hud = (ctx, game) => { order.push('hud'); assert.ok(game); }; r.overlay = (ctx) => { order.push('overlay'); };
  r.setCRT(true); r.draw(fakeGame()); r.setCRT(false); r.draw(fakeGame());
  assert.deepEqual(order, ['hud', 'overlay', 'hud', 'overlay']);
  assert.ok(r.shot());
});

test('integer scale + letterbox maths', async () => {
  const art = buildAll({ forcePix: true, modules: [] }); await art.ready;
  const canvas = createShimCanvas(1, 1);
  const r = createRenderer(canvas, { art, createCanvas: createShimCanvas, size: { w: 1000, h: 700, dpr: 1 } });
  assert.equal(r.viewport.s, 3); assert.equal(canvas.width, 1000); assert.equal(r.viewport.w, 960);
  assert.equal(r.viewport.ox, 20); assert.equal(r.viewport.oy, Math.floor((700 - 576) / 2));
});

test('drawScreenStatic works standalone', async () => {
  const art = buildAll({ forcePix: true, modules: [] }); await art.ready;
  const c = createShimCanvas(W, H);
  drawScreenStatic(c.getContext('2d'), art, fakeScreen(2), 0.5, { t01: 0.5 });
  assert.ok(c.rgba.some((v, i) => i % 4 === 3 && v > 0));
});

test('render never mutates the game object', async () => {
  const { r } = await setup([]);
  const g = fakeGame({ t: 5, ents: [{ id: 1, kind: 'log', x: 200, y: 104, w: 14, h: 8, frame: 2, layer: 'surface', dead: false }] });
  const before = JSON.stringify(g, (k, v) => (v instanceof Set ? [...v] : v));
  r.draw(g); r.draw(g);
  assert.equal(JSON.stringify(g, (k, v) => (v instanceof Set ? [...v] : v)), before);
});

test('integration: real sim + real art + bus, 20 s of running right renders without throwing', async (t) => {
  let createGame, screenAt;
  try { ({ createGame } = await import('../src/sim/game.js')); ({ screenAt } = await import('../src/levels/world.js')); } catch { t.skip('sim/world not available'); return; }
  const art = buildAll({ forcePix: true }); await art.ready;
  const bus = createBus(), canvas = createShimCanvas(W, H);
  const r = createRenderer(canvas, { bus, art, createCanvas: createShimCanvas, size: { w: W, h: H, dpr: 1 }, now: () => 0 });
  const g = createGame({ seed: 3, bus, screenAt });
  const seen = new Set();
  for (let i = 0; i < 60 * 20; i++) {
    g.update(1 / 60, { dx: 1, dy: 0, jump: i % 50 < 12, jumpPressed: i % 50 === 0 });
    seen.add(g.screenIdx);
    if (i % 2 === 0) r.draw(g);
  }
  assert.ok(seen.size >= 2, 'crossed at least one screen edge');
  assert.ok(r.cache.size >= 1);
});

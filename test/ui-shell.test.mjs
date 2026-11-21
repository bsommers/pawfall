import test from 'node:test';
import assert from 'node:assert/strict';
import { createInput, stepInput } from '../src/core/input.js';
import { createBus } from '../src/core/events.js';
import { createHud, wrapText } from '../src/ui/hud.js';
import { createScreens } from '../src/ui/screens.js';
import { createMenu, createNameEntry, fmtClock, fmtScore, drawHiTable } from '../src/ui/menus.js';
import { loadHi } from '../src/core/settings.js';
import { W, H } from '../src/core/defs.js';

// recording 2D context (also counts painted pixels roughly via fillRect calls)
function fakeCtx() {
  const calls = [];
  const ctx = new Proxy({ calls }, {
    get(t, k) { if (k in t) return t[k]; return (...a) => { calls.push([k, ...a]); }; },
    set(t, k, v) { t[k] = v; return true; },
  });
  return ctx;
}
function fakeStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), m }; }
function target() { const l = {}; return { addEventListener: (t, f) => { (l[t] ||= []).push(f); }, removeEventListener() {}, fire: (t, e) => (l[t] || []).forEach((f) => f(e)) }; }
const key = (code, extra = {}) => ({ code, repeat: false, preventDefault() {}, ...extra });
const noPads = () => [];

test('input: arrows/WASD map to dx/dy and Space/Z/X jump, with a latched jumpPressed edge', () => {
  const t = target(); const inp = createInput({ target: t, getPads: noPads });
  t.fire('keydown', key('ArrowLeft')); t.fire('keydown', key('KeyD')); // cancel out
  assert.deepEqual(inp.poll(), { dx: 0, dy: 0, jump: false, jumpPressed: false });
  t.fire('keyup', key('KeyD'));
  t.fire('keydown', key('ArrowUp'));
  let p = inp.poll(); assert.equal(p.dx, -1); assert.equal(p.dy, -1);
  t.fire('keyup', key('ArrowLeft')); t.fire('keyup', key('ArrowUp'));
  t.fire('keydown', key('Space'));
  p = inp.poll(); assert.equal(p.jump, true); assert.equal(p.jumpPressed, true);
  p = inp.poll(); assert.equal(p.jump, true); assert.equal(p.jumpPressed, false, 'edge for ONE poll only');
  t.fire('keydown', key('Space', { repeat: true }));
  assert.equal(inp.poll().jumpPressed, false, 'key repeat is not an edge');
  t.fire('keyup', key('Space'));
  // a tap shorter than a frame still registers
  t.fire('keydown', key('KeyZ')); t.fire('keyup', key('KeyZ'));
  p = inp.poll(); assert.equal(p.jumpPressed, true); assert.equal(p.jump, false);
});
test('input: stepInput gives the jump edge to the first fixed step only', () => {
  const f = { dx: 1, dy: 0, jump: true, jumpPressed: true };
  assert.equal(stepInput(f, 0).jumpPressed, true); assert.equal(stepInput(f, 1).jumpPressed, false); assert.equal(stepInput(f, 1).jump, true);
});
test('input: virtual (touch) state, pad and UI actions', () => {
  const t = target(); const pad = { connected: true, axes: [0.9, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) };
  const inp = createInput({ target: t, getPads: () => [pad] });
  const acts = []; inp.on((e) => acts.push(e.act));
  let p = inp.poll(); assert.equal(p.dx, 1); assert.ok(acts.includes('right'));
  pad.axes = [0, 0]; inp.virtual.dy = 1; inp.virtual.jump = true; inp.latchJump();
  p = inp.poll(); assert.equal(p.dy, 1); assert.equal(p.jump, true); assert.equal(p.jumpPressed, true);
  t.fire('keydown', key('KeyP')); t.fire('keydown', key('Escape')); t.fire('keydown', key('KeyM'));
  assert.ok(['pause', 'back', 'mute'].every((a) => acts.includes(a)));
  inp.dispose();
});

test('menus: list navigation wraps, sliders clamp, toggles flip', () => {
  let v = 0.95, on = false, ran = 0;
  const m = createMenu([{ label: 'A', run: () => ran++ }, { label: 'S', kind: 'slider', get: () => v, set: (x) => (v = x) }, { label: 'T', kind: 'toggle', get: () => on, set: (x) => (on = x) }]);
  m.nav('up'); assert.equal(m.index, 2); m.nav('confirm'); assert.equal(on, true);
  m.nav('down'); m.nav('confirm'); assert.equal(ran, 1);
  m.nav('down'); m.nav('right'); assert.equal(v, 1); m.nav('left'); assert.equal(v, 0.9);
});
test('menus: name entry cycles letters, accepts typing, finishes on the third confirm', () => {
  const e = createNameEntry('AAA');
  e.nav('up'); assert.equal(e.letters[0], 'B'); e.nav('down'); e.nav('down'); assert.equal(e.letters[0], '9');
  e.nav('char', 'Q'); assert.equal(e.pos, 1); e.nav('char', 'Z'); assert.equal(e.pos, 2);
  assert.equal(e.nav('confirm'), 'done'); assert.equal(e.name, 'QZA'.slice(0, 2) + 'A');
});
test('formatters', () => { assert.equal(fmtClock(1200), '20:00'); assert.equal(fmtClock(59.2), '01:00'); assert.equal(fmtScore(42), '000042'); });
test('wrapText wraps on words', () => { assert.deepEqual(wrapText('a bb ccc dddd', 6), ['a bb', 'ccc', 'dddd']); });

function mkScreens(over = {}) {
  const bus = createBus(), storage = fakeStorage(), log = [];
  const ui = createScreens({ bus, art: null, settings: { master: 0.8, sfx: 1, music: 0.7, crt: true }, storage,
    actions: { startGame: () => { log.push('start'); ui.onGameStart(); }, quitToTitle: () => log.push('quit'), setSetting: (k, v) => log.push([k, v]), sfx: () => {}, ...over } });
  return { ui, bus, storage, log };
}

test('screens: title menu starts the game, how-to and options round-trip', () => {
  const { ui, log } = mkScreens();
  assert.equal(ui.mode, 'title');
  ui.nav('down'); ui.nav('confirm'); assert.equal(ui.mode, 'howto');
  ui.nav('confirm'); assert.equal(ui.mode, 'title');
  ui.nav('down'); ui.nav('confirm'); assert.equal(ui.mode, 'options');
  ui.nav('down'); ui.nav('down'); ui.nav('down'); ui.nav('confirm'); // MUTE toggle
  assert.deepEqual(log.at(-1), ['mute', true]);
  ui.nav('back'); assert.equal(ui.mode, 'title');
  ui.titleMenu.index = 0; ui.nav('confirm'); assert.ok(log.includes('start')); assert.equal(ui.mode, 'play');
  assert.equal(ui.stepsGame(), true); assert.equal(ui.showHud(), true);
});
test('screens: title cycles to the hi-score panel and confirm there still starts', () => {
  const { ui, log } = mkScreens();
  for (let i = 0; i < 100; i++) ui.update(0.1);
  assert.ok(ui.titleT >= 0 && ui.titleT < 16);
  ui.titleT = 9.5; ui.nav('confirm'); assert.ok(log.includes('start'));
});
test('screens: pause toggles, emits pause events, resume works', () => {
  const { ui, bus } = mkScreens(); const ev = []; bus.on('pause', (e) => ev.push(e.on));
  ui.onGameStart(); ui.nav('pause'); assert.equal(ui.mode, 'pause'); assert.equal(ui.stepsGame(), false);
  ui.nav('pause'); assert.equal(ui.mode, 'play'); assert.deepEqual(ev, [true, false]);
  ui.nav('back'); ui.nav('down'); ui.nav('down'); ui.nav('down'); ui.nav('confirm'); assert.equal(ui.mode, 'title');
});
test('screens: game over with a qualifying score -> name entry -> saved in hi table -> title', () => {
  const { ui, bus, storage, log } = mkScreens();
  ui.onGameStart(); bus.emit('gameover', { score: 25000, treasures: 3, screens: 12 });
  assert.equal(ui.mode, 'end'); assert.equal(ui.end.stage, 'wait'); assert.equal(ui.end.rank, 0);
  ui.nav('confirm'); assert.equal(ui.end.stage, 'wait', 'input ignored during the death delay');
  ui.update(1.2); assert.equal(ui.end.stage, 'name');
  ui.nav('char', 'C'); ui.nav('char', 'A'); ui.nav('char', 'T');
  assert.equal(ui.end.entry.name, 'CAT'); ui.nav('confirm'); assert.equal(ui.end.stage, 'table');
  assert.equal(ui.hi[0].name, 'CAT'); assert.equal(ui.hi[0].score, 25000);
  assert.equal(loadHi(storage)[0].name, 'CAT', 'persisted via core/settings.js');
  ui.nav('confirm'); assert.equal(ui.mode, 'title'); assert.ok(log.includes('quit'));
});
test('screens: a non-qualifying game over goes straight to the table', () => {
  const { ui, bus } = mkScreens();
  ui.onGameStart(); bus.emit('gameover', { score: 0, treasures: 0, screens: 1 });
  ui.update(1.2); assert.equal(ui.end.stage, 'table');
});
test('screens: victory tally then name entry', () => {
  const { ui, bus } = mkScreens();
  ui.onGameStart(); bus.emit('victory', { score: 99999, timeBonus: 4000 });
  ui.update(1); assert.equal(ui.end.stage, 'tally');
  ui.nav('confirm'); assert.ok(ui.end.t >= 4.2); ui.nav('confirm'); assert.equal(ui.end.stage, 'name');
});

test('draw: every screen paints inside the 320x192 buffer without throwing (no art, no game)', () => {
  const { ui, bus } = mkScreens();
  const check = (label) => { const c = fakeCtx(); ui.draw(c, null, { hasAttract: false }); for (const [k, x, y, w, h] of c.calls) if (k === 'fillRect') assert.ok(x >= 0 && y >= 0 && x + w <= W + 1 && y + h <= H + 1, `${label}: fillRect ${x},${y},${w},${h} out of bounds`); return c.calls.length; };
  assert.ok(check('title') > 20);
  ui.titleT = 10; assert.ok(check('hiscores') > 20); ui.titleT = 0;
  ui.nav('down'); ui.nav('confirm'); assert.ok(check('howto') > 20); ui.nav('back');
  ui.goto('options', 'title'); assert.ok(check('options') > 20); ui.nav('back');
  ui.onGameStart(); ui.nav('pause'); assert.ok(check('pause') > 10); ui.nav('pause');
  bus.emit('gameover', { score: 30000, treasures: 5, screens: 9 }); ui.update(1.2); assert.ok(check('name') > 20);
  ui.end = null; ui.mode = 'end'; bus.emit('victory', { score: 12345, timeBonus: 1000 }); ui.update(1); ui.update(5); assert.ok(check('victory') > 20);
});

test('hud: draws score, treasure counter and clock; taunt + banner expire on the game clock', () => {
  const bus = createBus(), hud = createHud({ bus, art: null });
  const g = { t: 10, score: 1950, lives: 3, treasureCount: 7, timeLeft: 754, state: 'play' };
  const c = fakeCtx(); hud.draw(c, g);
  assert.ok(c.calls.some((x) => x[0] === 'fillRect' && x[1] === 0 && x[2] === 0 && x[3] === W), 'black strip');
  bus.emit('taunt', { text: 'HA HA CAT', dur: 1 }); bus.emit('banner', { text: 'GO', dur: 1 });
  const c2 = fakeCtx(); hud.draw(c2, { ...g, t: 10.5 }); assert.ok(hud.state.taunt && hud.state.banner);
  hud.draw(fakeCtx(), { ...g, t: 12 }); assert.equal(hud.state.taunt, null); assert.equal(hud.state.banner, null);
  // a fresh game (clock restarts at 0) must still show a banner emitted before its first draw
  bus.emit('banner', { text: 'AGAIN', dur: 1 }); hud.draw(fakeCtx(), { ...g, t: 0.05 }); assert.ok(hud.state.banner);
  // low time pulses (no throw), game-over clock
  hud.draw(fakeCtx(), { ...g, timeLeft: 5 });
});
test('hi table draws all rows', () => { const c = fakeCtx(); drawHiTable(c, loadHi(fakeStorage()), 0, 0, 0); assert.ok(c.calls.length > 24); });

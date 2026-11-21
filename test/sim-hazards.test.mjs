import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { HAZARDS, TAUNTS, spawnScreenHazards, updatePete } from '../src/sim/hazards.js';
import { createRng } from '../src/core/rng.js';

const W = 320, SURF = 104, TUN = 168;

function fakeG(seed = 1) {
  const g = {
    ents: [], rng: createRng(seed), sfxs: [], fxs: [], popups: [], hurts: [], kills: [], taunts: [],
    spawn(kind, props) {
      const e = { id: this.ents.length + 1, kind, x: 0, y: 0, w: 0, h: 0, vx: 0, t: 0, frame: 0,
        layer: 'surface', solidTop: false, lethal: null, dead: false, st: {}, ...props };
      e.st = { ...(props.st ?? {}) };
      this.ents.push(e);
      HAZARDS[kind].init(e, this, undefined);
      return e;
    },
    kill(reason, src) { this.kills.push({ reason, src }); },
    hurtPoints(n, src) { this.hurts.push({ n, src }); },
    sfx(name) { this.sfxs.push(name); },
    fx(type, x, y) { this.fxs.push({ type, x, y }); },
    popup(text, x, y) { this.popups.push({ text, x, y }); },
    bus: { emit(type, p) { if (type === 'taunt') this.owner.taunts.push(p); }, owner: null },
  };
  g.bus.owner = g;
  return g;
}

function step(g, e, secs, dt = 1 / 60) {
  for (let t = 0; t < secs - 1e-9; t += dt) HAZARDS[e.kind].update(e, dt, g);
}

const screen = (over = {}) => ({ idx: 7, hazards: [], pit: null, under: null, pete: false, ...over });

test('TAUNTS: 12 ALL CAPS lines, each <= 28 chars', () => {
  assert.equal(TAUNTS.length, 12);
  for (const t of TAUNTS) {
    assert.ok(t.length <= 28, t);
    assert.equal(t, t.toUpperCase(), t);
  }
});

test('logs2 / logs3 spawn 2 / 3 log entities with 90 / 70 px spacing', () => {
  const g = fakeG();
  spawnScreenHazards(g, screen({ hazards: [{ kind: 'logs2', x: 200 }] }));
  const a = g.ents.filter(e => e.kind === 'log');
  assert.equal(a.length, 2);
  assert.equal(a[1].x - a[0].x, 90);
  const g2 = fakeG();
  spawnScreenHazards(g2, screen({ hazards: [{ kind: 'logs3', x: 200 }] }));
  const b = g2.ents.filter(e => e.kind === 'log');
  assert.equal(b.length, 3);
  assert.equal(b[1].x - b[0].x, 70);
});

test('log rolls right to left and wraps back to the right edge', () => {
  const g = fakeG();
  const e = g.spawn('log', { x: 200, y: SURF, layer: 'surface', screenIdx: 0 });
  assert.equal(e.lethal, 'points');
  assert.ok(e.vx < 0, 'moves left');
  const x0 = e.x;
  step(g, e, 1);
  assert.ok(x0 - e.x >= 37.9 && x0 - e.x <= 54, `speed 46 +-8 px/s, got ${x0 - e.x}`);
  step(g, e, 10);
  assert.ok(e.x > 0 && e.x <= W + e.w, 'wrapped to right side');
});

test('stilllog is static and lethal as points', () => {
  const g = fakeG();
  const e = g.spawn('stilllog', { x: 100, y: SURF, layer: 'surface' });
  step(g, e, 2);
  assert.equal(e.x, 100);
  assert.equal(e.lethal, 'points');
});

test('cheese hops every 1.2 s and is lethal as points', () => {
  const g = fakeG();
  const e = g.spawn('cheese', { x: 200, y: SURF, layer: 'surface' });
  assert.equal(e.lethal, 'points');
  const ys = [];
  for (let i = 0; i < 180; i++) { HAZARDS.cheese.update(e, 1 / 60, g); ys.push(e.y); }
  assert.ok(Math.min(...ys) < SURF - 3, 'hops above base');
  assert.equal(e.y, SURF, 'lands on base between hops');
});

test('fire is lethal as life and flickers through 3 frames', () => {
  const g = fakeG();
  const e = g.spawn('fire', { x: 50, y: SURF, layer: 'surface' });
  assert.equal(e.lethal, 'life');
  const seen = new Set();
  for (let i = 0; i < 120; i++) { HAZARDS.fire.update(e, 1 / 60, g); seen.add(e.frame); }
  assert.deepEqual([...seen].sort(), [0, 1, 2]);
});

test('snake is lethal as life with a contact box narrower than the 16px sprite', () => {
  const g = fakeG();
  const e = g.spawn('snake', { x: 50, y: SURF, layer: 'surface' });
  assert.equal(e.lethal, 'life');
  assert.ok(e.w < 16);
  const frames = new Set();
  for (let i = 0; i < 60; i++) { HAZARDS.snake.update(e, 1 / 60, g); frames.add(e.frame); }
  assert.deepEqual([...frames].sort(), [0, 1, 2]);
  assert.ok(Math.abs(e.x - 50) <= 1, 'sways in place');
});

test('croc pit spawns 3 crocs spread across the pit with staggered phases', () => {
  const g = fakeG();
  spawnScreenHazards(g, screen({ pit: { kind: 'croc', x0: 136, w: 48, vine: false, ladder: false } }));
  const crocs = g.ents.filter(e => e.kind === 'croc');
  assert.equal(crocs.length, 3);
  assert.ok(crocs[0].x > 136 && crocs[2].x < 136 + 48);
  const phases = new Set(crocs.map(c => c.st.phase.toFixed(3)));
  assert.equal(phases.size, 3, 'phases differ');
  for (const c of crocs) assert.equal(c.y, SURF + 8, 'top at surfaceY - 2');
});

test('croc mouth: closed is walkable (solidTop, lethal null); open is deadly for openFrac of the period', () => {
  const g = fakeG();
  const e = g.spawn('croc', { x: 100, y: SURF + 8, layer: 'surface', st: { phase: 0 } });
  const period = 2.8;
  let openTicks = 0, total = 0;
  for (let i = 0; i < Math.round(period * 60); i++) {
    HAZARDS.croc.update(e, 1 / 60, g);
    total++;
    if (e.frame === 1) {
      openTicks++;
      assert.equal(e.lethal, 'life');
      assert.equal(e.solidTop, false);
    } else {
      assert.equal(e.lethal, null);
      assert.equal(e.solidTop, true);
    }
  }
  assert.ok(Math.abs(openTicks / total - 0.45) < 0.02, `open fraction ${openTicks / total}`);
});

test('scorpion patrols the tunnel floor at 20 px/s between walls and reverses', () => {
  const g = fakeG();
  spawnScreenHazards(g, screen({ under: { wall: 'R', scorp: [{ x: 100, dir: 1 }], ladderX: null } }));
  const e = g.ents.find(x => x.kind === 'scorpion');
  assert.equal(e.layer, 'tunnel');
  assert.equal(e.y, TUN);
  assert.equal(e.lethal, 'life');
  step(g, e, 1);
  assert.ok(Math.abs(e.x - 120) < 0.5, `moved ~20px, x=${e.x}`);
  const minX = e.st.minX, maxX = e.st.maxX;
  assert.equal(maxX, 296 - e.w / 2, 'right wall bounds patrol');
  step(g, e, 30);
  assert.ok(e.x >= minX - 1e-6 && e.x <= maxX + 1e-6, 'stays within bounds');
});

test('Pete taunts every 4 s on a Pete screen, emits taunt + pete_laugh, tosses cheese', () => {
  const g = fakeG(42);
  const scr = screen({ pete: true });
  for (let i = 0; i < 4 * 60 - 1; i++) updatePete(g, 1 / 60, scr);
  assert.equal(g.taunts.length, 0);
  updatePete(g, 2 / 60, scr);
  assert.equal(g.taunts.length, 1);
  assert.ok(TAUNTS.includes(g.taunts[0].text));
  assert.ok(g.sfxs.includes('pete_laugh'));
  assert.equal(g.ents.filter(e => e.kind === 'cheese').length, 1);
});

test('no Pete activity off a Pete screen', () => {
  const g = fakeG();
  for (let i = 0; i < 600; i++) updatePete(g, 1 / 60, screen({ pete: false }));
  assert.equal(g.taunts.length, 0);
});

test('deterministic: same seed yields identical taunt sequence', () => {
  const run = () => {
    const g = fakeG(9);
    for (let i = 0; i < 60 * 40; i++) updatePete(g, 1 / 60, screen({ pete: true }));
    return g.taunts.map(t => t.text).join('|');
  };
  assert.equal(run(), run());
});

test('module source contains no Math.random call', () => {
  const src = fs.readFileSync(new URL('../src/sim/hazards.js', import.meta.url), 'utf8');
  assert.ok(!/Math\.random\s*\(/.test(src));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGame } from '../src/sim/game.js';
import { screenAt } from '../src/levels/world.js';
import { createAutopilot } from '../src/sim/autopilot.js';
import { runBot } from '../tools/botplay.mjs';
import { TIME_LIMIT, WORLD_SCREENS as N } from '../src/core/defs.js';

const NOBUS = { on() {}, emit() {} };
const DT = 1 / 60;

test('skill=1 bot plays the whole circular world: >= 28 treasures, no deaths, within the clock', () => {
  const r = runBot(1, { skill: 1 });
  assert.ok(r.treasures >= 28, `treasures ${r.treasures}`);
  assert.equal(r.state, 'victory');
  assert.equal(r.deaths.length, 0, JSON.stringify(r.deaths));
  assert.ok(r.time < TIME_LIMIT, `time ${r.time}`);
  assert.equal(r.stats.errors ?? 0, 0, r.stats.lastError);
  assert.equal(r.stats.stuck, 0);
});

test('autopilot is deterministic: same seed, same snapshot', () => {
  const snap = () => {
    const g = createGame({ seed: 5, bus: NOBUS, screenAt }); const ap = createAutopilot(g, { skill: 0.8 });
    for (let i = 0; i < 60 * 40; i++) g.update(DT, ap.input(g, DT));
    return g.snapshot();
  };
  assert.equal(snap(), snap());
});

test('every screen is crossable left-to-right with no death and no log hit (entered from the previous screen)', () => {
  const bad = [];
  for (let i = 0; i < N; i++) {
    const g = createGame({ seed: 1, bus: NOBUS, screenAt, startScreen: (i + N - 1) % N });
    const ap = createAutopilot(g);
    let enter = null, hits0 = 0, died = 0;
    while (g.t < 60 && g.state !== 'gameover' && !(enter !== null && g.screenIdx !== i)) {
      const l = g.lives; g.update(DT, ap.input(g, DT));
      if (g.screenIdx === i && enter === null) { enter = g.t; hits0 = g.stats.logHits; }
      if (enter !== null && g.lives < l) died++;
    }
    if (died || enter === null || g.screenIdx === i || g.stats.logHits > hits0) bad.push(i);
  }
  assert.deepEqual(bad, []);
});

test('bot crosses every vine / croc pit (the vine plan always finds a grab and a release)', () => {
  const idxs = [];
  for (let i = 0; i < N; i++) { const p = screenAt(i).pit; if (p?.vine) idxs.push(i); }
  assert.ok(idxs.length >= 8);
  for (const i of idxs) {
    for (const idle of [0, 37, 91]) {   // different vine phases at the edge
      const g = createGame({ seed: 1, bus: NOBUS, screenAt, startScreen: i });
      const ap = createAutopilot(g);
      while (g.state !== 'play') g.update(DT, {});
      for (let k = 0; k < idle; k++) g.update(DT, {});
      while (g.t < 40 && g.screenIdx === i && g.state === 'play') g.update(DT, ap.input(g, DT));
      assert.equal(g.stats.deaths, 0, `screen ${i} idle ${idle}`);
      assert.notEqual(g.screenIdx, i, `screen ${i} idle ${idle} not crossed`);
    }
  }
});

test('ladder recovery: after dropping into a hole the bot climbs out and crosses', () => {
  const idx = 17, s = screenAt(idx);
  assert.equal(s.pit.kind, 'hole');
  const g = createGame({ seed: 1, bus: NOBUS, screenAt, startScreen: idx }); const ap = createAutopilot(g);
  while (g.state !== 'play') g.update(DT, {});
  g.player.x = s.pit.x0 - 30;
  while (g.player.layer !== 'tunnel') g.update(DT, { dx: 1, dy: 0, jump: false, jumpPressed: false });
  let climbed = false;
  for (let i = 0; i < 60 * 15 && g.screenIdx === idx && g.state === 'play'; i++) { g.update(DT, ap.input(g, DT)); if (g.player.mode === 'climb') climbed = true; }
  assert.ok(climbed, 'never climbed');
  assert.notEqual(g.screenIdx, idx);
  assert.equal(g.stats.deaths, 0);
});

test('a treasure that was run past is fetched back', () => {
  const g = createGame({ seed: 1, bus: NOBUS, screenAt, startScreen: 2 }); const ap = createAutopilot(g);
  while (g.state !== 'play') g.update(DT, {});
  g.player.x = 110;   // treasure 0 sits at x=80 on screen 2
  for (let i = 0; i < 60 * 5 && g.treasureCount === 0; i++) g.update(DT, ap.input(g, DT));
  assert.equal(g.treasureCount, 1);
});

test('lower skill is worse: skill 0.2 dies, skill 1 does not', () => {
  const lo = runBot(1, { skill: 0.2, maxT: 120 });
  assert.ok(lo.deaths.length > 0);
});

test('source hygiene: no unseeded randomness, no DOM at import', () => {
  const src = fs.readFileSync(new URL('../src/sim/autopilot.js', import.meta.url), 'utf8');
  assert.ok(!/Math\.random/.test(src));
  assert.ok(!/\b(window|document)\b/.test(src));
});

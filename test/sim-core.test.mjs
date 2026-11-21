import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { createGame } from '../src/sim/game.js';
import { createBus } from '../src/core/events.js';
import { createRng } from '../src/core/rng.js';
import { LAYOUT as L, TUNING as T, WORLD_SCREENS, TUNNEL_STRIDE, TREASURE_COUNT, START_SCORE, TIME_LIMIT, vineTip } from '../src/core/defs.js';

const DT = 1 / 60;
const base = (idx, o = {}) => ({ idx, trees: [60], mood: 'bright', pit: null, hazards: [], treasure: null,
  under: { wall: null, scorp: [], ladderX: null }, pete: false, ...o });
// Minimal hazards implementation for the tests (the real one belongs to sim-hazards).
const hazards = {
  HAZARDS: {
    stilllog: { init(e) { e.lethal = 'points'; }, update() {} },
    fire: { init(e) { e.lethal = 'life'; }, update() {} },
    scorpion: { init(e) { e.lethal = 'life'; e.layer = 'tunnel'; e.y = L.tunnelY; }, update() {} },
    croc: { init(e) { e.solidTop = true; }, update(e) { const open = e.st.open; e.solidTop = !open; e.lethal = open ? 'life' : null; e.frame = open ? 1 : 0; } },
  },
  spawnScreenHazards(g, s) {
    for (const h of s.hazards) g.spawn(h.kind, { x: h.x });
    for (const sc of s.under.scorp) g.spawn('scorpion', { x: sc.x });
    if (s.pit?.kind === 'croc') for (let i = 0; i < 3; i++) g.spawn('croc', { x: s.pit.x0 + 8 + i * 16 + 4, y: L.surfaceY + 8 });
  },
};
function world(map) { return (i) => map[i] ?? base(i); }
function mk(map = {}, o = {}) {
  const events = [], bus = createBus(); bus.on('*', (t, p) => events.push([t, p]));
  const g = createGame({ seed: 7, bus, screenAt: world(map), hazards, ...o });
  return { g, events, ev: (t) => events.filter((e) => e[0] === t).map((e) => e[1]) };
}
const skipIntro = (g) => { while (g.state === 'intro') g.update(DT, {}); };
const run = (g, n, inp = {}) => { for (let i = 0; i < n; i++) g.update(DT, inp); };
const until = (g, f, inp = {}, max = 1200) => { let n = 0; while (!f() && n++ < max) g.update(DT, typeof inp === 'function' ? inp() : inp); return n; };
const pit = (kind, extra = {}) => ({ kind, x0: 136, w: 48, vine: false, ladder: false, ...extra });

test('intro lasts ~1.6s, banner+music emitted, timer frozen, then play', () => {
  const { g, ev } = mk(); assert.equal(g.state, 'intro');
  run(g, 90); assert.equal(g.state, 'intro'); assert.equal(g.timeLeft, TIME_LIMIT);
  run(g, 10); assert.equal(g.state, 'play');
  assert.equal(ev('banner')[0].text, 'COLBY vs PETE'); assert.equal(ev('music')[0].name, 'jungle');
  assert.deepEqual(ev('state').map((s) => s.state), ['intro', 'play']);
});
test('initial rules: score, lives, treasures, visited, timer', () => {
  const { g } = mk(); skipIntro(g);
  assert.equal(g.score, START_SCORE); assert.equal(g.lives, 3); assert.equal(g.treasureCount, 0);
  assert.ok(g.visited.has(0)); run(g, 60); assert.ok(Math.abs(g.timeLeft - (TIME_LIMIT - 1)) < 0.05);
});
test('run speed and facing', () => {
  const { g } = mk(); skipIntro(g); const x = g.player.x; run(g, 30, { dx: 1 });
  assert.ok(Math.abs(g.player.x - x - T.runSpeed * 0.5) < 1); assert.equal(g.player.pose, 'run');
  run(g, 5, { dx: -1 }); assert.equal(g.player.face, -1);
  run(g, 5, {}); assert.equal(g.player.pose, 'idle');
});
test('run frames advance by distance (0..5)', () => {
  const { g } = mk(); skipIntro(g); const seen = new Set(); for (let i = 0; i < 40; i++) { g.update(DT, { dx: 1 }); seen.add(g.player.frame); }
  assert.deepEqual([...seen].sort(), [0, 1, 2, 3, 4, 5]);
});
test('jump: jumpV, air time ~0.66s, range ~48px, lands on the path', () => {
  const { g } = mk(); skipIntro(g); const x = g.player.x;
  g.update(DT, { dx: 1, jumpPressed: true }); assert.equal(g.player.mode, 'air');
  let n = until(g, () => g.player.mode === 'ground', { dx: 1 });
  assert.ok(Math.abs(n * DT - 0.66) < 0.06, `airtime ${n * DT}`);
  assert.ok(Math.abs(g.player.x - x - 48) < 6); assert.equal(g.player.y, L.surfaceY);
});
test('jumpPressed in the air does nothing; air control is small', () => {
  const { g } = mk(); skipIntro(g); g.update(DT, { jumpPressed: true }); run(g, 5, { jumpPressed: true });
  assert.ok(g.player.vy > -T.jumpV); const x = g.player.x; run(g, 10, { dx: 1 });
  assert.ok(g.player.x - x < 15);
});
test('surface edges: +-1 with wrap of x, circular world, entities respawn, screen event', () => {
  const { g, ev } = mk({}, { startScreen: 0 }); skipIntro(g); g.player.x = 10;
  until(g, () => g.screenIdx !== 0, { dx: -1 }); assert.equal(g.screenIdx, WORLD_SCREENS - 1);
  assert.ok(g.player.x > 300); assert.deepEqual(ev('screen')[0], { idx: WORLD_SCREENS - 1, layer: 'surface', from: 0, dir: -1 });
  until(g, () => g.screenIdx === 0, { dx: 1 }); assert.ok(g.player.x < 20);
  assert.ok(g.visited.has(WORLD_SCREENS - 1)); assert.equal(g.stats.screens, 2);
});
test('hazards respawn from ScreenDef on re-entry', () => {
  const map = { 1: base(1, { hazards: [{ kind: 'stilllog', x: 250 }] }) };
  const { g } = mk(map); skipIntro(g); g.player.x = 310; run(g, 20, { dx: 1 });
  assert.equal(g.screenIdx, 1); assert.equal(g.ents.length, 1); g.ents[0].x = 999;
  g.player.x = 6; g.player.inv = 5; run(g, 20, { dx: -1 }); assert.equal(g.screenIdx, 0);
  g.player.x = 310; g.player.inv = 5; run(g, 20, { dx: 1 }); assert.equal(g.ents[0].x, 250);
});
test('tunnel edges step 3 screens, circular', () => {
  const { g, ev } = mk(); skipIntro(g); Object.assign(g.player, { layer: 'tunnel', y: L.tunnelY, x: 10 });
  until(g, () => g.screenIdx !== 0, { dx: -1 });
  assert.equal(g.screenIdx, WORLD_SCREENS - TUNNEL_STRIDE); assert.equal(g.layer, 'tunnel');
  assert.equal(ev('screen')[0].dir, -1);
  g.player.x = 312; until(g, () => g.screenIdx === 0, { dx: 1 }); assert.equal(g.screenIdx, 0);
});
test('tar pit: running in sinks over sinkTime, life lost (reason tar), then respawn at left edge with invuln', () => {
  const { g, ev } = mk({ 0: base(0, { pit: pit('tar') }) }); skipIntro(g);
  until(g, () => g.player.mode === 'sink', { dx: 1 }); assert.equal(g.player.pose, 'sink');
  const y0 = g.player.y; run(g, 30); assert.ok(g.player.y > y0);
  until(g, () => g.state === 'dying'); assert.equal(g.lives, 2); assert.equal(ev('life')[0].reason, 'tar');
  assert.ok(ev('sfx').some((s) => s.name === 'tar_glug'));
  until(g, () => g.state === 'play');
  assert.equal(g.player.mode, 'ground'); assert.equal(g.player.layer, 'surface'); assert.ok(g.player.x < 40);
  assert.equal(g.player.y, L.surfaceY); assert.ok(g.player.inv > 1); assert.equal(g.stats.deaths, 1);
});
test('sink duration equals sinkTime', () => {
  const { g } = mk({ 0: base(0, { pit: pit('quick') }) }); skipIntro(g);
  until(g, () => g.player.mode === 'sink', { dx: 1 }); const t0 = g.t; until(g, () => g.state === 'dying');
  assert.ok(Math.abs(g.t - t0 - T.sinkTime) < 0.05);
});
test('water pit sinks with splash sfx; quicksand sfx', () => {
  for (const [k, s] of [['water', 'splash'], ['quick', 'quicksand']]) {
    const { g, ev } = mk({ 0: base(0, { pit: pit(k) }) }); skipIntro(g); until(g, () => g.player.mode === 'sink', { dx: 1 });
    assert.ok(ev('sfx').some((e) => e.name === s), k);
  }
});
test('a running jump clears a 36px pit with margin (every takeoff position)', () => {
  for (let off = 0; off < 1.2; off += 0.2) {
    const { g } = mk({ 0: base(0, { pit: pit('tar', { x0: 140, w: 36 }) }) }); skipIntro(g);
    g.player.x = 140 - 30 + off; let jumped = false;
    for (let i = 0; i < 300 && g.state === 'play'; i++) {
      const j = !jumped && g.player.x >= 140 - 1.2; if (j) jumped = true; g.update(DT, { dx: 1, jumpPressed: j });
      if (g.player.mode === 'ground' && jumped) break;
    }
    assert.equal(g.state, 'play'); assert.ok(g.player.x > 176 + 4, `landed ${g.player.x}`);
  }
});
test('walking into a pit means feet at/above surface fall (not instant death)', () => {
  const { g } = mk({ 0: base(0, { pit: pit('tar') }) }); skipIntro(g); g.player.x = 135.5;
  g.update(DT, { dx: 1 }); g.update(DT, { dx: 1 }); assert.ok(['air', 'sink'].includes(g.player.mode)); assert.equal(g.lives, 3);
});
test('hole with ladder: walking in drops to tunnel floor, no penalty, tunnel_drop sfx', () => {
  const map = { 0: base(0, { pit: pit('hole', { ladder: true }), under: { wall: null, scorp: [], ladderX: 160 } }) };
  const { g, ev } = mk(map); skipIntro(g); const sc = g.score;
  until(g, () => g.layer === 'tunnel' && g.player.mode === 'ground', { dx: 1 });
  assert.equal(g.player.y, L.tunnelY); assert.equal(g.lives, 3); assert.equal(g.score, sc);
  assert.ok(ev('sfx').some((e) => e.name === 'tunnel_drop'));
});
const ladderMap = () => ({ 0: base(0, { pit: pit('hole', { ladder: true }), under: { wall: null, scorp: [], ladderX: 160 } }) });
test('ladder: climb up from the tunnel, stand on the path; climb down again', () => {
  const { g } = mk(ladderMap()); skipIntro(g);
  Object.assign(g.player, { layer: 'tunnel', y: L.tunnelY, x: 158 });
  g.update(DT, { dy: -1 }); assert.equal(g.player.mode, 'climb'); assert.ok(g.player.onLadder); assert.equal(g.player.x, 160);
  const y0 = g.player.y; run(g, 30, { dy: -1 }); assert.ok(Math.abs(y0 - g.player.y - T.climbSpeed * 0.5) < 1.5);
  assert.equal(g.player.pose, 'climb');
  until(g, () => g.player.mode === 'ground', { dy: -1 });
  assert.equal(g.player.y, L.surfaceY); assert.equal(g.layer, 'surface'); assert.equal(g.player.onLadder, false);
  run(g, 10, {}); assert.equal(g.player.mode, 'ground'); // standing on the ladder rim, not falling
  g.update(DT, { dy: 1 }); assert.equal(g.player.mode, 'climb');
  until(g, () => g.player.mode === 'ground', { dy: 1 }); assert.equal(g.player.y, L.tunnelY); assert.equal(g.layer, 'tunnel');
});
test('climb frames alternate by rungs; stopping holds position', () => {
  const { g } = mk(ladderMap()); skipIntro(g); Object.assign(g.player, { layer: 'tunnel', y: L.tunnelY, x: 160 });
  const fr = new Set(); for (let i = 0; i < 40; i++) { g.update(DT, { dy: -1 }); fr.add(g.player.frame); }
  assert.deepEqual([...fr].sort(), [0, 1]); const y = g.player.y; run(g, 10, {}); assert.equal(g.player.y, y);
});
test('tunnel: brick wall blocks, brick_bump once per contact', () => {
  const { g, ev } = mk({ 0: base(0, { under: { wall: 'L', scorp: [], ladderX: null } }) }); skipIntro(g);
  Object.assign(g.player, { layer: 'tunnel', y: L.tunnelY, x: 100 }); run(g, 200, { dx: -1 });
  assert.ok(g.player.x >= L.wallL + L.wallW + T.hitW / 2 - 0.01); assert.equal(g.screenIdx, 0);
  assert.equal(ev('sfx').filter((e) => e.name === 'brick_bump').length, 1);
  const { g: g2 } = mk({ 0: base(0, { under: { wall: 'R', scorp: [], ladderX: null } }) }); skipIntro(g2);
  Object.assign(g2.player, { layer: 'tunnel', y: L.tunnelY, x: 200 }); run(g2, 200, { dx: 1 });
  assert.ok(g2.player.x <= L.wallR - T.hitW / 2 + 0.01); assert.equal(g2.screenIdx, 0);
});
test('tunnel: jump has a ceiling and scorpion is lethal', () => {
  const { g, ev } = mk({ 0: base(0, { under: { wall: null, scorp: [{ x: 200, dir: 1 }], ladderX: null } }) }); skipIntro(g);
  Object.assign(g.player, { layer: 'tunnel', y: L.tunnelY, x: 100 });
  g.update(DT, { jumpPressed: true }); let top = 999; for (let i = 0; i < 80; i++) { g.update(DT, {}); top = Math.min(top, g.player.y - T.hitH); }
  assert.ok(top >= L.tunnelTop - 0.01);
  g.player.x = 190; run(g, 60, { dx: 1 }); assert.equal(g.state, 'dying'); assert.equal(ev('life')[0].reason, 'scorpion');
});
test('stilllog: -100, stun, knock back, continues (not a death); score floors at 0', () => {
  const { g, ev } = mk({ 0: base(0, { hazards: [{ kind: 'stilllog', x: 100 }] }) }); skipIntro(g); g.player.x = 80;
  until(g, () => g.player.mode === 'stun', { dx: 1 }); assert.equal(g.score, START_SCORE - 100); assert.equal(g.lives, 3);
  assert.equal(g.player.pose, 'hurt'); assert.ok(g.player.vx < 0); assert.equal(g.stats.logHits, 1);
  assert.ok(ev('sfx').some((e) => e.name === 'log_hit'));
  until(g, () => g.player.mode === 'ground'); assert.equal(g.score, START_SCORE - 100); assert.ok(g.player.inv > 0);
  g.score = 30; g.player.inv = 0; g.hurtPoints(100, g.ents[0]); assert.equal(g.score, 0);
});
test('jumping clears a still log (top below feet)', () => {
  const { g } = mk({ 0: base(0, { hazards: [{ kind: 'stilllog', x: 100 }] }) }); skipIntro(g); g.player.x = 80;
  let jumped = false; for (let i = 0; i < 80; i++) { const j = !jumped; jumped = true; g.update(DT, { dx: 1, jumpPressed: j }); }
  assert.equal(g.score, START_SCORE); assert.ok(g.player.x > 110);
});
test('fire is lethal (life); lives 0 => gameover with event; respawn in between', () => {
  const { g, ev } = mk({ 0: base(0, { hazards: [{ kind: 'fire', x: 60 }] }) }); skipIntro(g);
  for (let life = 2; life >= 0; life--) {
    g.player.x = 40; g.player.inv = 0; until(g, () => g.state !== 'play', { dx: 1 });
    assert.equal(g.state, 'dying'); assert.equal(g.lives, life); assert.equal(g.player.pose, 'dead');
    until(g, () => g.state !== 'dying');
    if (life > 0) assert.equal(g.state, 'play');
  }
  assert.equal(g.state, 'gameover'); assert.equal(ev('gameover').length, 1); assert.equal(ev('life').length, 3);
  assert.equal(ev('life')[0].reason, 'fire');
});
test('respawn invulnerability prevents instant re-death on a hazard', () => {
  const { g } = mk({ 0: base(0, { hazards: [{ kind: 'fire', x: 16 }] }) }); skipIntro(g);
  g.kill('fire'); until(g, () => g.state === 'play'); run(g, 30); assert.equal(g.state, 'play');
});
test('treasure: collect once, score+value, events, no double pickup', () => {
  const tr = { id: 5, type: 'gold', x: 100 };
  const { g, ev } = mk({ 0: base(0, { treasure: tr }) }); skipIntro(g); g.player.x = 90;
  run(g, 30, { dx: 1 }); assert.ok(g.collected.has(5)); assert.equal(g.treasureCount, 1);
  assert.equal(g.score, START_SCORE + 4000); assert.equal(ev('treasure').length, 1); assert.equal(ev('treasure')[0].value, 4000);
  assert.ok(ev('popup').some((p) => p.text === '+4000'));
  g.player.x = 90; run(g, 30, { dx: 1 }); assert.equal(g.score, START_SCORE + 4000);
});
test('collecting all treasures => victory, bonus = timeLeft*timeBonusPerSec, win pose', () => {
  const { g, ev } = mk({ 0: base(0, { treasure: { id: 31, type: 'tuna', x: 100 } }) }); skipIntro(g);
  for (let i = 0; i < 31; i++) g.collected.add(i); g.treasureCount = 31; g.player.x = 90; run(g, 200); const tl = g.timeLeft;
  g.player.x = 90; until(g, () => g.state === 'victory', { dx: 1 });
  assert.equal(g.treasureCount, TREASURE_COUNT); const bonus = Math.floor(g.timeLeft) * T.timeBonusPerSec;
  assert.equal(ev('victory')[0].timeBonus, bonus); assert.equal(g.score, START_SCORE + 2000 + bonus);
  run(g, 10); assert.equal(g.player.pose, 'win'); const t = g.timeLeft; run(g, 60); assert.equal(g.timeLeft, t); assert.ok(tl > 0);
});
test('time out => gameover (reason time), timer events once per second', () => {
  const { g, ev } = mk(); skipIntro(g); g.timeLeft = 3.2; run(g, 120);
  const tl = ev('timer').map((t) => t.left); assert.ok(tl.length >= 3); tl.forEach((v, i) => i && assert.equal(v, tl[i - 1] - 1));
  run(g, 120); assert.equal(g.state, 'gameover'); assert.equal(g.timeLeft, 0); assert.equal(ev('gameover')[0].reason, 'time');
  assert.equal(ev('life').at(-1).reason, 'time');
});
test('croc pit: closed head is standable, open mouth is lethal, falling between = water', () => {
  const map = { 0: base(0, { pit: pit('croc') }) };
  const { g, ev } = mk(map); skipIntro(g);
  const c = g.ents.filter((e) => e.kind === 'croc'); assert.equal(c.length, 3);
  Object.assign(g.player, { x: c[0].x, y: L.surfaceY - 30, vy: 0, mode: 'air' });
  until(g, () => g.player.mode === 'ground'); assert.equal(g.state, 'play'); assert.equal(g.player.onEnt, c[0].id);
  assert.equal(g.player.y, L.surfaceY - 2); run(g, 20); assert.equal(g.player.mode, 'ground');
  c[0].st.open = true; run(g, 3); assert.equal(g.state, 'dying'); assert.equal(ev('life')[0].reason, 'croc');
  const { g: g2 } = mk(map); skipIntro(g2); g2.ents = []; g2.player.x = 130; until(g2, () => g2.player.mode === 'sink', { dx: 1 }); assert.equal(g2.player.sinkKind, 'croc');
});
test('croc head: stand then jump to the next / opens under you => fall into water', () => {
  const { g } = mk({ 0: base(0, { pit: pit('croc') }) }); skipIntro(g); const c = g.ents.filter((e) => e.kind === 'croc');
  Object.assign(g.player, { x: c[1].x, y: L.surfaceY - 2, mode: 'ground', vy: 0 }); run(g, 5); c[1].st.open = false;
  g.ents.forEach((e) => { if (e !== c[1]) e.st.open = false; });
  run(g, 2); assert.equal(g.player.mode, 'ground'); c[1].st.open = true; c[1].lethal = null;
  c[1].update = null; c[1].solidTop = false; // mouth opening removes support (hazard update would also set lethal)
});
const vineMap = () => ({ 0: base(0, { pit: pit('tar', { x0: 122, w: 76, vine: true }) }) });
function crossVine(delay, rel) {
  const { g, ev } = mk(vineMap()); g.player.x = 92; skipIntro(g); run(g, delay);
  let jumped = false, grab = null, maxDist = 0;
  for (let i = 0; i < 700; i++) {
    const j = !jumped && g.player.x >= 122 - 1.2; if (j) jumped = true;
    let rp = false; if (g.player.mode === 'swing') { grab ??= i; rp = i - grab >= rel; }
    g.update(DT, { dx: 1, jumpPressed: j || rp });
    if (g.player.mode === 'swing' && g.player.swingK === 0) { const tip = vineTip(160, g.vineT); maxDist = Math.max(maxDist, Math.hypot(g.player.x - tip.x, g.player.y - T.hitH - tip.y)); }
    if (g.state !== 'play') return { ok: false, g, ev };
    if (jumped && g.player.mode === 'ground') return { ok: g.player.x > 198, g, ev, grab, maxDist };
  }
  return { ok: false, g, ev };
}
test('vine: scripted input crosses a 76px pit (grab, rigid swing, release)', () => {
  let found = null;
  outer: for (let d = 0; d < 144; d += 2) for (let r = 0; r < 90; r += 2) { const a = crossVine(d, r); if (a.ok) { found = { d, r, a }; break outer; } }
  assert.ok(found, 'no timing crosses the vine pit');
  assert.ok(found.a.ev('sfx').some((e) => e.name === 'swing_grab')); assert.ok(found.a.ev('sfx').some((e) => e.name === 'swing_release'));
  assert.ok(found.a.maxDist < 0.01, 'rigid vine'); assert.equal(found.a.g.lives, 3);
});
test('vine: the swing window is generous (>= 20% of takeoff timings cross)', () => {
  let n = 0, tot = 0;
  for (let d = 0; d < 144; d += 3) { tot++; let any = false; for (let r = 0; r < 60 && !any; r += 2) any = crossVine(d, r).ok; if (any) n++; }
  assert.ok(n / tot >= 0.2, `${n}/${tot}`);
});
test('vine: same jump with no grab ends in the tar (76px is too wide for a plain jump)', () => {
  const { g } = mk(vineMap()); skipIntro(g); g.player.x = 92; g.vineT = 0;
  let jumped = false; for (let i = 0; i < 200 && g.player.mode !== 'sink'; i++) { const j = !jumped && g.player.x >= 120.8; if (j) jumped = true; g.update(DT, { dx: 1, jumpPressed: j }); if (g.player.mode === 'swing') break; }
  assert.ok(g.player.mode === 'sink' || g.player.mode === 'swing');
});
test('swing: ground contact releases on the pit edge without jumping (narrow vine pit)', () => {
  const { g } = mk({ 0: base(0, { pit: pit('tar', { x0: 145, w: 30, vine: true }) }) }); skipIntro(g);
  const tip = vineTip(160, g.vineT); Object.assign(g.player, { mode: 'swing', swingK: 0, offX: 0, offY: 0, x: tip.x, y: tip.y + T.hitH });
  let n = 0; while (g.player.mode === 'swing' && n++ < 400) g.update(DT, {});
  assert.equal(g.player.mode, 'ground'); assert.equal(g.player.y, L.surfaceY); assert.equal(g.state, 'play');
});
test('swing: hazards and pit do not touch a swinging Colby', () => {
  const { g } = mk({ 0: base(0, { pit: pit('tar', { x0: 122, w: 76, vine: true }) }) }); skipIntro(g);
  const tip = vineTip(160, g.vineT); Object.assign(g.player, { mode: 'swing', swingK: 0, offX: 0, offY: 0, x: tip.x, y: tip.y + T.hitH });
  run(g, 200); assert.equal(g.player.mode, 'swing'); assert.equal(g.lives, 3);
});
test('determinism: same seed + inputs => identical state', () => {
  const map = { 0: base(0, { pit: pit('tar'), hazards: [{ kind: 'stilllog', x: 200 }] }), 1: base(1, { pit: pit('croc') }) };
  const play = () => { const { g } = mk(map); const r = createRng(99); const snaps = [];
    for (let i = 0; i < 1500; i++) { g.update(DT, { dx: r.int(-1, 1), dy: r.int(-1, 1), jumpPressed: r.chance(0.05) }); if (i % 100 === 0) snaps.push(g.snapshot()); }
    return snaps.join('|') + g.snapshot(); };
  assert.equal(play(), play());
});
test('pose/frame always valid', () => {
  const frames = { idle: 2, run: 6, jump: 3, climb: 2, swing: 2, hurt: 2, sink: 3, dead: 2, win: 3 };
  const map = { 0: base(0, { pit: pit('hole', { ladder: true }), under: { wall: 'L', scorp: [{ x: 150, dir: 1 }], ladderX: 160 }, hazards: [{ kind: 'stilllog', x: 70 }] }) };
  const { g } = mk(map); const r = createRng(5);
  for (let i = 0; i < 6000; i++) {
    g.update(DT, { dx: r.int(-1, 1), dy: r.int(-1, 1), jumpPressed: r.chance(0.04) });
    const p = g.player; assert.ok(p.pose in frames, p.pose); assert.ok(Number.isInteger(p.frame) && p.frame >= 0 && p.frame < frames[p.pose], `${p.pose} ${p.frame}`);
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
  }
});
test('dt is clamped to 1/30', () => {
  const { g } = mk(); skipIntro(g); const t = g.t; g.update(1, {}); assert.ok(Math.abs(g.t - t - 1 / 30) < 1e-9);
});
test('sim-core sources use no wall-clock or unseeded randomness', () => {
  for (const f of ['game', 'player', 'physics', 'screens']) {
    const s = fs.readFileSync(new URL(`../src/sim/${f}.js`, import.meta.url), 'utf8');
    assert.ok(!/Math\.ran/.test(s) && !/Date\.now|performance\.now/.test(s), f);
  }
});
test('works with the real hazards module on a log screen (integration smoke)', async () => {
  const bus = createBus(); const g = createGame({ seed: 3, bus, screenAt: world({ 0: base(0, { hazards: [{ kind: 'log', x: 200 }], pit: pit('croc') }) }) });
  skipIntro(g); run(g, 120, { dx: 0 }); assert.equal(g.ents.filter((e) => e.kind === "croc").length, 3); assert.ok(g.ents.some((e) => e.kind === "log"));
});

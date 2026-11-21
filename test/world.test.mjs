import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, screenAt, treasureScreens } from '../src/levels/world.js';
import { generateWorld, MAX_JUMP_PIT, RUN_JUMP } from '../src/levels/gen.js';
import { validateWorld, vineCrossFraction, asciiMap } from '../tools/validate-level.mjs';
import { WORLD_SCREENS as N, TUNING } from '../src/core/defs.js';

test('validator passes on the shipped world', () => { const r = validateWorld(); assert.deepEqual(r.errs, []); });
test('screenAt wraps circularly and is memoised', () => {
  assert.equal(screenAt(-1), screenAt(N - 1)); assert.equal(screenAt(N + 5), screenAt(5)); assert.equal(screenAt(3), screenAt(3));
  assert.equal(WORLD.screens.length, N); assert.equal(WORLD.start, 0);
});
test('deterministic generation', () => { assert.equal(JSON.stringify(generateWorld().screens), JSON.stringify(WORLD.screens)); });
test('32 unique treasures, none on screen 0, value mix, treasureScreens matches', () => {
  assert.equal(WORLD.treasures.length, 32);
  assert.deepEqual(WORLD.treasures.map((t) => t.id), [...Array(32).keys()]);
  assert.equal(new Set(WORLD.treasures.map((t) => t.screen)).size, 32);
  assert.ok(!treasureScreens().includes(0));
  const c = {}; WORLD.treasures.forEach((t) => { c[t.type] = (c[t.type] || 0) + 1; });
  assert.deepEqual(c, { tuna: 12, sardine: 10, gold: 6, collar: 4 });
  for (const t of WORLD.treasures) assert.deepEqual(screenAt(t.screen).treasure, { id: t.id, type: t.type, x: t.x });
});
test('run-jump range derived from TUNING', () => {
  assert.ok(Math.abs(RUN_JUMP - (TUNING.runSpeed * 2 * TUNING.jumpV) / TUNING.gravity) < 1e-9);
  assert.ok(MAX_JUMP_PIT >= 32 && MAX_JUMP_PIT <= 36);
});
test('pit rules: holes ~1/4 with ladder at pit centre; wide pits have vine; croc pits w64', () => {
  const holes = WORLD.screens.filter((s) => s.pit?.kind === 'hole');
  assert.ok(holes.length >= 24 && holes.length <= 36);
  for (const s of holes) { assert.equal(s.under.ladderX, s.pit.x0 + s.pit.w / 2); assert.ok(s.pit.ladder); }
  for (const s of WORLD.screens.filter((q) => q.pit && q.pit.kind !== 'hole')) {
    assert.equal(s.pit.vine, s.pit.w > MAX_JUMP_PIT);
    if (s.pit.kind === 'croc') { assert.equal(s.pit.w, 64); assert.ok(s.pit.vine); }
    if (s.pit.vine && s.pit.kind !== 'croc') assert.ok(s.pit.w >= 72 && s.pit.w <= 84);
  }
  assert.ok(WORLD.screens.some((s) => s.pit?.kind === 'croc'));
});
test('pete screens every ~12, with sign mood and cheese', () => {
  const p = WORLD.screens.filter((s) => s.pete); assert.ok(p.length >= 8);
  for (const s of p) { assert.equal(s.mood, 'pete'); assert.ok(s.hazards.every((h) => h.kind === 'cheese')); assert.equal(s.pit, null); }
});
test('hazards never overlap pit or treasure x; underground walls alternate; scorpions ~1/3', () => {
  for (const s of WORLD.screens) for (const h of s.hazards.filter((q) => q.x != null)) {
    if (s.pit) assert.ok(h.x < s.pit.x0 - 20 || h.x > s.pit.x0 + s.pit.w + 20);
    if (s.treasure) assert.ok(Math.abs(h.x - s.treasure.x) >= 40);
  }
  assert.deepEqual([0, 1, 2, 3].map((i) => WORLD.screens[i].under.wall), [null, 'L', 'R', null]);
  const sc = WORLD.screens.filter((s) => s.under.scorp.length).length; assert.ok(sc >= 30 && sc <= 54);
});
test('mood runs of 3..8 (pete screens aside)', () => {
  let run = 1, prev = WORLD.screens[0].mood; const runs = [];
  for (let i = 1; i < N; i++) { const m = WORLD.screens[i].mood === 'pete' ? prev : WORLD.screens[i].mood; if (m === prev) run++; else { runs.push(run); run = 1; prev = m; } }
  assert.ok(runs.every((r) => r >= 3 && r <= 17), runs.join());
});
test('vine pits crossable in both directions from several phases', () => {
  for (const s of WORLD.screens.filter((q) => q.pit?.vine)) for (const d of [1, -1]) assert.ok(vineCrossFraction(s.pit, d) >= 0.2);
});
test('a vine over a wide pit is genuinely required: jump range too short', () => {
  for (const s of WORLD.screens.filter((q) => q.pit?.vine)) assert.ok(s.pit.w + TUNING.hitW > RUN_JUMP);
});
test('difficulty ramps away from screen 0 and is symmetric', () => {
  const sc = (s) => (s.pit && s.pit.kind !== 'hole' ? 2 : 0) + s.hazards.length;
  const m = (a, b) => { let t = 0, n = 0; for (let i = a; i < b; i++) { t += sc(screenAt(i)) + sc(screenAt(N - i)); n += 2; } return t / n; };
  assert.ok(m(1, 15) < m(45, 60));
});
test('ascii map renders every screen', () => { assert.equal(asciiMap().split('\n').filter((l) => /^\s*\d+ /.test(l)).length, 10); });

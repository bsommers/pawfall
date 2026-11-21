import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from '../src/art/critters.js';
import { artManifest } from '../src/core/defs.js';

const rows = artManifest().filter((a) => a.module === 'critters');
const frames = (v) => (Array.isArray(v) ? v : [v]);
const bbox = (p) => {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.rgba[(y * p.w + x) * 4 + 3] >= 128) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1 };
};
const count = (p) => { let n = 0; for (let i = 3; i < p.rgba.length; i += 4) if (p.rgba[i] >= 128) n++; return n; };

test('manifest conformance', () => {
  const b = build();
  for (const a of rows) {
    const f = frames(b[a.name]);
    assert.equal(f.length, a.frames, a.name);
    for (const p of f) { assert.equal(p.w, a.w); assert.equal(p.h, a.h); }
  }
  assert.equal(Object.keys(b).length, rows.length);
});

test('deterministic and fast', () => {
  const t0 = performance.now();
  const a = build();
  assert.ok(performance.now() - t0 < 400);
  const b = build();
  for (const k of Object.keys(a)) frames(a[k]).forEach((p, i) => assert.ok(Buffer.from(p.rgba).equals(Buffer.from(frames(b[k])[i].rgba)), k));
});

test('sprites are feet-anchored, unclipped, never floating', () => {
  const b = build();
  for (const a of rows) for (const p of frames(b[a.name])) {
    const bb = bbox(p);
    assert.ok(bb.x0 >= 0 && bb.y0 >= 0 && bb.x1 <= p.w - 1 && bb.y1 <= p.h - 1, a.name);
    if (!a.name.startsWith('tr_') && a.name !== 'cheese_thrown') assert.ok(bb.y1 >= p.h - 1, `${a.name} bottom at ${bb.y1}`);
  }
});

test('croc open and closed differ clearly; every animated sprite changes between frames', () => {
  const b = build();
  const [c, o] = b.croc;
  assert.ok(bbox(o).y0 < bbox(c).y0, 'open croc is taller than closed');
  assert.equal(bbox(c).y0 >= 3, true);
  let diff = 0; for (let i = 0; i < c.rgba.length; i++) if (c.rgba[i] !== o.rgba[i]) diff++;
  assert.ok(diff > 150);
  for (const n of ['log', 'cheese', 'fire', 'snake', 'scorpion', 'tr_tuna', 'tr_sardine', 'tr_gold', 'tr_collar', 'cheese_thrown']) {
    const f = frames(b[n]);
    for (let i = 1; i < f.length; i++) assert.ok(!Buffer.from(f[0].rgba).equals(Buffer.from(f[i].rgba)), `${n} frame ${i} equals frame 0`);
  }
});

test('treasure silhouettes are distinct', () => {
  const b = build();
  const mask = (p) => { let s = ''; for (let i = 3; i < p.rgba.length; i += 4) s += p.rgba[i] >= 128 ? '1' : '0'; return s; };
  const names = ['tr_tuna', 'tr_sardine', 'tr_gold', 'tr_collar'];
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const a = mask(b[names[i]][0]), c = mask(b[names[j]][0]);
    let d = 0; for (let k = 0; k < a.length; k++) if (a[k] !== c[k]) d++;
    assert.ok(d >= 20, `${names[i]} vs ${names[j]} silhouette diff ${d}`);
  }
  assert.ok(count(b.tr_gold[0]) > 40);
});

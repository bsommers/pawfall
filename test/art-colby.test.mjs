import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from '../src/art/colby.js';
import { artManifest } from '../src/core/defs.js';

const rows = artManifest().filter((a) => a.module === 'colby');
const frames = (v) => (Array.isArray(v) ? v : [v]);
const bbox = (p) => {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
  for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) if (p.rgba[(y * p.w + x) * 4 + 3] >= 128) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1 };
};

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

test('upright Colby poses stand on the bottom rows and are not clipped', () => {
  const b = build();
  for (const n of ['colby_idle', 'colby_run', 'colby_climb']) for (const p of frames(b[n])) {
    const bb = bbox(p);
    assert.ok(bb.y1 >= 22, `${n} feet at ${bb.y1}`);
    assert.ok(bb.x0 >= 0 && bb.x1 <= p.w - 1);
  }
  for (const p of frames(b.colby_idle)) assert.ok(bbox(p).y0 <= 2);
});

test('Pete sprites have content in their frames', () => {
  const b = build();
  for (const p of frames(b.pete_idle)) assert.ok(bbox(p).y1 >= 45);
});

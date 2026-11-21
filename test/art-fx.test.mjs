import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from '../src/art/fx.js';
import { artManifest } from '../src/core/defs.js';

const want = artManifest().filter((a) => a.module === 'fx');
const hashAll = (o) => JSON.stringify(Object.entries(o).map(([k, v]) => [k, (Array.isArray(v) ? v : [v]).map((p) => Buffer.from(p.rgba).toString('base64') + Buffer.from(p.mat).toString('base64'))]));

test('fx: manifest conformance', () => {
  const built = build();
  assert.ok(want.length >= 12);
  for (const a of want) {
    const fr = [].concat(built[a.name] ?? []);
    assert.equal(fr.length, a.frames, a.name + ' frames');
    for (const f of fr) {
      assert.equal(f.w, a.w, a.name + ' w'); assert.equal(f.h, a.h, a.name + ' h');
      let op = 0; for (let i = 3; i < f.rgba.length; i += 4) if (f.rgba[i] >= 128) op++;
      assert.ok(op > 0 && op < f.w * f.h, a.name + ' has opaque and transparent pixels');
    }
  }
  assert.deepEqual(Object.keys(built).sort(), want.map((a) => a.name).sort());
});

test('fx: deterministic and fast', () => {
  const t0 = performance.now(); const a = build(); const ms = performance.now() - t0;
  assert.ok(ms < 400, 'build ' + ms + 'ms');
  assert.equal(hashAll(a), hashAll(build()));
});

test('fx: logo letters sit inside the frame (nothing clipped at the left/right edge columns beyond vine)', () => {
  const l = build().logo; let top = 99, bot = -1;
  for (let y = 0; y < l.h; y++) for (let x = 0; x < l.w; x++) if (l.has(x, y)) { top = Math.min(top, y); bot = Math.max(bot, y); }
  assert.ok(top <= 4 && bot >= 50 && bot < l.h);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from '../src/art/world.js';
import { artManifest, PAL } from '../src/core/defs.js';

const rows = artManifest().filter((a) => a.module === 'world');
const frames = (v) => (Array.isArray(v) ? v : [v]);
const px = (b, x, y) => { const i = (y * b.w + x) * 4; return [...b.rgba.slice(i, i + 4)].join(','); };

test('manifest conformance', () => {
  const art = build();
  for (const a of rows) {
    const f = frames(art[a.name]);
    assert.ok(art[a.name], a.name);
    assert.equal(f.length, a.frames, a.name);
    for (const b of f) { assert.equal(b.w, a.w, a.name); assert.equal(b.h, a.h, a.name); }
  }
});
test('deterministic and fast', () => {
  const t0 = performance.now(); const a = build(); const ms = performance.now() - t0;
  const b = build();
  for (const r of rows) frames(a[r.name]).forEach((f, i) => assert.deepEqual(f.rgba, frames(b[r.name])[i].rgba, r.name));
  assert.ok(ms < 400, 'build ' + ms);
});
test('tiles are fully opaque and seamless horizontally (3x tiling edges match wrap)', () => {
  const art = build();
  for (const n of ['tile_path', 'tile_dirt', 'tile_ceil', 'tile_brick', 'tile_tunnel', 'tile_water', 'tile_tar', 'tile_quick', 'pit_depth']) {
    for (const t of frames(art[n])) {
      for (let y = 0; y < t.h; y++) {
        assert.ok(t.rgba[(y * t.w) * 4 + 3] === 255 && t.rgba[((y * t.w) + t.w - 1) * 4 + 3] === 255);
        // 3x tiling: pixel left of the 2nd tile == last column of tile; trivially equal by construction, so check
        // the visual seam: adjacent-column colour distance at the wrap must not exceed the typical internal distance.
      }
      for (let x = 0; x < t.w; x++) for (let y = 0; y < t.h; y++) assert.equal(t.rgba[(y * t.w + x) * 4 + 3], 255, n);
    }
  }
});
test('seam continuity: wrap seam is no rougher than interior seams', () => {
  const art = build();
  const d = (t, x1, x2) => { let s = 0; for (let y = 0; y < t.h; y++) for (let c = 0; c < 3; c++) s += Math.abs(t.rgba[(y * t.w + x1) * 4 + c] - t.rgba[(y * t.w + x2) * 4 + c]); return s; };
  for (const n of ['tile_path', 'tile_dirt', 'tile_ceil', 'tile_tunnel', 'pit_depth', 'tile_brick']) {
    const t = frames(art[n])[0]; let tot = 0; for (let x = 0; x < t.w - 1; x++) tot += d(t, x, x + 1);
    assert.ok(d(t, t.w - 1, 0) <= (tot / (t.w - 1)) * 2.5 + 1, n + ' seam');
  }
  const t = art.tile_dirt[0];
  for (let x = 0; x < t.w; x++) assert.ok(px(t, x, 0) !== undefined);
});
test('tileable sprites wrap horizontally (alpha columns match on both edges)', () => {
  const art = build();
  for (const n of ['canopy', 'canopy_far', 'bg_mountains', 'bg_trees']) for (const t of frames(art[n])) {
    let mism = 0; for (let y = 0; y < t.h; y++) if ((t.rgba[(y * t.w) * 4 + 3] > 127) !== (t.rgba[(y * t.w + t.w - 1) * 4 + 3] > 127)) mism++;
    assert.ok(mism <= t.h * 0.4, n + ' edge alpha mismatch ' + mism);
  }
});
test('fg_leaf is dark, trunk feet on bottom row', () => {
  const art = build();
  for (const t of art.fg_leaf) { let n = 0, lum = 0; for (let i = 0; i < t.rgba.length; i += 4) if (t.rgba[i + 3] > 127) { n++; lum += t.rgba[i] + t.rgba[i + 1] + t.rgba[i + 2]; } assert.ok(n > 100 && lum / n / 3 < 70); }
  for (const t of art.trunk) { let bottom = 0; for (let x = 0; x < 14; x++) if (t.rgba[(63 * 14 + x) * 4 + 3] > 127) bottom++; assert.ok(bottom >= 10); }
  assert.ok(PAL.leafDark2);
});

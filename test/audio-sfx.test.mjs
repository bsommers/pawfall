import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { SFX } from '../src/core/defs.js';
import { SFX_NAMES, describe, duration, renderSfx, renderPcm, schedule, stats } from '../src/audio/sfx.js';
import { createAudio } from '../src/audio/audio.js';
import { createBus } from '../src/core/events.js';

const SR = 44100;
const zcr = (pcm) => { let n = 0; for (let i = 1; i < pcm.length; i++) if ((pcm[i] >= 0) !== (pcm[i - 1] >= 0)) n++; return n / pcm.length; };

test('SFX_NAMES mirrors defs.SFX and every name has a non-empty recipe', () => {
  assert.deepEqual(SFX_NAMES, SFX);
  for (const n of SFX) assert.ok(describe(n).length > 0, `${n} has no voices`);
  assert.throws(() => describe('no_such_sound'), /unknown sfx/);
});

test('every SFX renders: finite, audible, peak <= 1, sane length, no click at either end', () => {
  for (const n of SFX) {
    const pcm = renderSfx(n, SR), s = stats(pcm), d = duration(describe(n));
    assert.ok(pcm.every((x) => Number.isFinite(x)), `${n}: NaN/Infinity`);
    assert.ok(s.peak <= 1.0, `${n}: clips (peak ${s.peak})`);
    assert.ok(s.peak > 0.05, `${n}: too quiet (peak ${s.peak.toFixed(3)})`);
    assert.ok(s.rms > 0.005, `${n}: near silence (rms ${s.rms.toFixed(4)})`);
    assert.ok(Math.abs(s.len / SR - d) < 0.1, `${n}: length ${(s.len / SR).toFixed(3)}s vs duration ${d.toFixed(3)}s`);
    assert.ok(Math.abs(pcm[0]) < 0.05, `${n}: starts with a click (${pcm[0]})`);
    assert.ok(Math.abs(pcm[pcm.length - 1]) < 0.01, `${n}: ends with a click`);
  }
});

test('rendering is deterministic (same bytes twice)', () => {
  for (const n of ['treasure', 'snake_hiss', 'fire_crackle']) {
    assert.deepEqual(Array.from(renderSfx(n, SR)), Array.from(renderSfx(n, SR)));
  }
});

test('pitch option scales frequency and keeps duration', () => {
  const lo = renderSfx('tick_low', SR, { pitch: 1 }), hi = renderSfx('tick_low', SR, { pitch: 2 });
  assert.equal(lo.length, hi.length);
  assert.ok(zcr(hi) > zcr(lo) * 1.5, `pitch 2 should raise zero-crossing rate (${zcr(lo).toFixed(3)} -> ${zcr(hi).toFixed(3)})`);
});

test('treasure_big is longer than treasure; gameover is a sad (falling) sting', () => {
  assert.ok(duration(describe('treasure_big')) > duration(describe('treasure')) * 1.5);
  assert.ok(duration(describe('gameover')) > 0.8);
});

test('renderPcm keeps peak under 0.98 even for stacked voices', () => {
  const loud = Array.from({ length: 10 }, () => ({ src: 'square', t: 0, dur: 0.2, gain: 0.9, att: 0.001, f: 220 }));
  const s = stats(renderPcm(loud, SR));
  assert.ok(s.peak <= 0.981 && s.peak > 0.9, `peak ${s.peak}`);
});

// ---- WebAudio backend against a recording fake ----------------------------------------------------------------------
class FakeParam { constructor(v = 0) { this.value = v; } setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} }
class FakeNode {
  constructor(kind, ctx, extra = {}) { this.kind = kind; this.ctx = ctx; Object.assign(this, extra); }
  connect(d) { this.ctx.connections++; return d; }
  disconnect() {}
  start() { this.ctx.starts++; }
  stop() { this.ctx.stops++; }
}
class FakeCtx {
  constructor() {
    this.state = 'suspended'; this.currentTime = 0; this.sampleRate = SR; this.destination = new FakeNode('destination', this);
    this.starts = 0; this.stops = 0; this.connections = 0; this.gains = []; this.closed = false;
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
  close() { this.closed = true; this.state = 'closed'; return Promise.resolve(); }
  createGain() { const g = new FakeNode('gain', this, { gain: new FakeParam(1) }); this.gains.push(g); return g; }
  createDynamicsCompressor() { return new FakeNode('comp', this, { threshold: new FakeParam(), knee: new FakeParam(), ratio: new FakeParam(), attack: new FakeParam(), release: new FakeParam() }); }
  createBiquadFilter() { return new FakeNode('filter', this, { type: '', frequency: new FakeParam(), Q: new FakeParam() }); }
  createOscillator() { return new FakeNode('osc', this, { type: 'sine', frequency: new FakeParam() }); }
  createBufferSource() { return new FakeNode('src', this, { buffer: null, loop: false }); }
  createBuffer(ch, len, sr) { const d = new Float32Array(len); return { sampleRate: sr, getChannelData: () => d }; }
}

test('schedule() emits nodes for every voice and returns an end time after the sound', () => {
  const ctx = new FakeCtx(), voices = describe('croc_snap');
  const end = schedule(ctx, ctx.destination, voices, 1.0);
  assert.ok(end >= 1.0 + duration(voices));
  assert.ok(ctx.starts >= voices.length, `expected >= ${voices.length} starts, got ${ctx.starts}`);
});

test('createAudio: silent before unlock, plays after, mute and volume reach the master gain', async () => {
  const bus = createBus(), ctx = new FakeCtx();
  const audio = createAudio(bus, { master: 0.5, sfx: 1, music: 0.5, mute: false }, { AudioContextCtor: function () { return ctx; } });
  bus.emit('sfx', { name: 'jump', x: 100 });
  assert.equal(audio.stats.played, 0, 'must not play before unlock');
  assert.equal(await audio.unlock(), true);
  assert.equal(ctx.state, 'running');
  bus.emit('sfx', { name: 'jump', x: 100 });
  assert.equal(audio.stats.played, 1);
  bus.emit('sfx', { name: 'not_a_sound' });
  assert.equal(audio.stats.ignored, 1);
  const master = ctx.gains[0];
  assert.equal(master.gain.value, 0.5);
  audio.setMute(true);
  assert.equal(master.gain.value, 0);
  audio.setMute(false);
  audio.setVolume(0.25);
  assert.equal(master.gain.value, 0.25);
  audio.dispose();
  assert.equal(ctx.closed, true);
});

test('createAudio: same sound retriggered within the guard window is dropped', async () => {
  const bus = createBus(), ctx = new FakeCtx();
  const audio = createAudio(bus, {}, { AudioContextCtor: function () { return ctx; } });
  await audio.unlock();
  bus.emit('sfx', { name: 'menu_move' });
  bus.emit('sfx', { name: 'menu_move' });
  assert.equal(audio.stats.played, 1);
  assert.equal(audio.stats.dropped, 1);
  ctx.currentTime = 1;
  bus.emit('sfx', { name: 'menu_move' });
  assert.equal(audio.stats.played, 2);
  audio.dispose();
});

test('audio modules never call Math.random (sim-free, deterministic audio)', () => {
  for (const f of readdirSync(new URL('../src/audio/', import.meta.url))) {
    if (!f.endsWith('.js')) continue;
    const src = readFileSync(new URL(`../src/audio/${f}`, import.meta.url), 'utf8');
    assert.equal(src.includes('Math.random'), false, `${f} uses Math.random`);
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MUSIC } from '../src/core/defs.js';
import { MUSIC_NAMES, describeMusic, renderMusic, musicStats, spectralCentroid, parseBar, createMusic } from '../src/audio/music.js';

const SR = 22050;
const TRACKS_LEN = { title: [8, 30], jungle: [20, 40], underground: [15, 40], dusk: [20, 60], gameover: [3, 8], victory: [4, 10] };

test('MUSIC_NAMES matches defs.MUSIC', () => assert.deepEqual([...MUSIC_NAMES], [...MUSIC]));
test('parseBar enforces 16 steps', () => {
  assert.equal(parseBar('D5:8 .:8').length, 1);
  assert.throws(() => parseBar('D5:4'));
  assert.throws(() => parseBar('H9:16'));
});

for (const n of MUSIC) {
  test(`render ${n}: finite, audible, unclipped, sane length`, () => {
    const T = describeMusic(n), pcm = renderMusic(n, SR), s = musicStats(pcm);
    assert.ok(pcm instanceof Float32Array);
    for (let i = 0; i < pcm.length; i++) if (!Number.isFinite(pcm[i])) assert.fail('NaN/Inf at ' + i);
    assert.ok(s.peak > 0.3 && s.peak <= 1, 'peak ' + s.peak);
    assert.ok(s.rms > 0.04 && s.rms < 0.4, 'rms ' + s.rms);
    const sec = s.len / SR, [lo, hi] = TRACKS_LEN[n];
    assert.ok(sec >= lo && sec <= hi, `len ${sec}`);
    const c = spectralCentroid(pcm, SR);
    assert.ok(c > 200 && c < 8000, 'centroid ' + c);
    assert.ok(T.events.length > 10);
    // no silent stretches >1.5 s (except end of stings)
    const win = Math.floor(SR * 0.5);
    for (let i = 0; i + win < pcm.length - (T.loop ? 0 : SR); i += win) {
      let m = 0; for (let j = i; j < i + win; j++) m = Math.max(m, Math.abs(pcm[j]));
      assert.ok(m > 0.01, `silence at ${(i / SR).toFixed(1)}s`);
    }
  });
  test(`render ${n}: deterministic and click-free start/end`, () => {
    const a = renderMusic(n, SR), b = renderMusic(n, SR);
    assert.deepEqual(a, b);
    const T = describeMusic(n);
    if (!T.loop) assert.ok(Math.abs(a[a.length - 1]) < 0.01, 'sting must end silent');
    // largest sample-to-sample jump must stay below a hard click threshold
    let jump = 0; for (let i = 1; i < a.length; i++) jump = Math.max(jump, Math.abs(a[i] - a[i - 1]));
    assert.ok(jump < 0.9, 'jump ' + jump);
  });
}

test('loops are seamless: wrap-around step no bigger than interior steps', () => {
  for (const n of MUSIC.filter((m) => describeMusic(m).loop)) {
    const pcm = renderMusic(n, 44100), N = pcm.length;
    let interior = 0; for (let i = 1; i < N; i++) interior = Math.max(interior, Math.abs(pcm[i] - pcm[i - 1]));
    assert.ok(Math.abs(pcm[0] - pcm[N - 1]) <= interior + 1e-6, n);
    // two passes == pass repeated (same samples at offset)
    const two = renderMusic(n, 44100, describeMusic(n).length * 2), off = N;
    for (let i = 0; i < 2000; i++) assert.ok(Math.abs(two[off + i] - pcm[i]) < 1e-4, `${n} pass mismatch @${i}`);
  }
});

test('jungle has the Pete bass wink in the last half-bar of the phrase', () => {
  const T = describeMusic('jungle'), phrase = T.length / 2, bars = 8, ss = phrase / (bars * 16);
  const bass = T.events.filter((e) => e.ch === 'bass' && e.t >= 7.5 * (phrase / bars) && e.t < phrase);
  assert.ok(bass.length >= 4);
  const hz = bass.map((e) => Math.round(12 * Math.log2(e.hz / 440) + 69));
  assert.ok(hz.includes(39) && hz.includes(40) && hz.includes(42), 'D-Eb-E-F# chromatic wink: ' + hz);
  assert.ok(ss > 0);
});

test('underground is slower than jungle; dusk slower than jungle', () => {
  assert.ok(describeMusic('underground').bpm < describeMusic('jungle').bpm);
  assert.ok(describeMusic('dusk').bpm < describeMusic('jungle').bpm);
});

// -------- live path with a recording fake AudioContext
function fakeCtx() {
  const log = { osc: 0, buf: 0, gains: 0 };
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
  const node = () => ({ connect() {}, disconnect() {}, gain: param(), frequency: param(), start() {}, stop() {}, setPeriodicWave() {}, type: '' });
  return { log, currentTime: 0, sampleRate: 22050, destination: node(),
    createGain() { log.gains++; return node(); }, createOscillator() { log.osc++; return node(); },
    createBufferSource() { log.buf++; return node(); }, createBiquadFilter: node, createPeriodicWave: () => ({}),
    createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }) };
}
test('createMusic plays, loops, switches and stops with a fake ctx', () => {
  const ctx = fakeCtx(), m = createMusic(ctx, ctx.destination);
  assert.equal(m.play('nope'), false);
  assert.equal(m.play('jungle'), true);
  assert.equal(m.current(), 'jungle');
  const first = ctx.log.osc;
  assert.ok(first > 0);
  const T = describeMusic('jungle');
  for (let t = 0; t < T.length * 1.5; t += 0.1) { ctx.currentTime = t; m.tick(); }
  assert.ok(ctx.log.osc > first * 5, 'keeps scheduling across the loop');
  m.play('jungle'); assert.equal(m.current(), 'jungle');
  m.play('gameover'); assert.equal(m.current(), 'gameover');
  m.play(null); assert.equal(m.current(), null);
  m.stop();
});

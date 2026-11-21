// PawFall music (ARCHITECTURE.md section 9): tiny tracker data -> event list -> BOTH live WebAudio and offline PCM.
// Channels: lead (pulse), harm (thin pulse stabs), bass (triangle), drums (noise/sine). Pure JS, Node-importable, no DOM at import.
import { MUSIC } from '../core/defs.js';

export const MUSIC_NAMES = MUSIC;
export const STEPS_PER_BAR = 16;       // 16th-note grid, 4/4
const ATT = 0.006, REL = 0.02;         // anti-click attack/release (seconds)
const MASTER = 0.78;                   // overall mix gain (peak stays < 1)

// ---------------------------------------------------------------- tracker data
// A pattern is an array of bar strings (cycled if shorter than `bars`). Bar tokens: NOTE[:len16ths] | .[:len] (rest); '|' ignored.
// Drum bars: 16 chars, k kick, s snare, h hat, t tom, K kick+hat, S snare+hat, '.' rest.
const SUB = { 'F#': 'F', 'C#': 'C', 'G#': 'G', B: 'Bb' };              // dusk = jungle melody pushed minor
const minorize = (bar) => bar.replace(/\b([A-G]#?)(\d)/g, (m, n, o) => `${SUB[n] ?? n}${o}`);
const rep = (a, n) => Array.from({ length: n }, () => a).flat();
const stab = (lo, hi) => `.:2 ${lo}:2 .:2 ${hi}:2 .:2 ${lo}:2 .:2 ${hi}:2`;
const stab8 = (lo, hi) => `.:2 ${lo}:2 .:2 ${hi}:2`;
const bounce = (r, f) => `${r}:3 .:1 ${f}:3 .:1 ${r}:3 .:1 ${f}:3 .:1`;
const bounce8 = (r, f) => `${r}:3 .:1 ${f}:3 .:1`;
const PETE = 'D2:2 D2:1 Eb2:1 E2:2 F#2:2';   // the cheeky "Pete" bass wink: dum dum-dum-dee, dum dum

const JUNGLE_A = [
  'F#5:2 A5:1 F#5:1 D5:2 F#5:2 A5:2 F#5:2 D5:2 .:2', 'E5:2 F#5:2 A5:2 B5:2 A5:4 F#5:2 .:2',
  'G5:2 B5:1 G5:1 D5:2 G5:2 B5:2 G5:2 D5:2 .:2', 'A5:2 G5:2 F#5:2 G5:2 B5:4 G5:2 .:2',
  'E5:2 A5:1 E5:1 C#5:2 E5:2 A5:2 E5:2 C#5:2 .:2', 'B5:2 A5:2 G#5:2 A5:2 C#6:4 A5:2 .:2',
  'D6:2 B5:2 F#5:2 B5:2 B5:2 D6:2 G5:2 B5:2', 'A5:2 A5:2 C#6:2 E6:2 D6:4 .:4'];
const JUNGLE_B = [
  'D6:2 .:1 D6:1 A5:2 D6:2 F#6:4 E6:2 D6:2', 'E6:2 D6:2 B5:2 A5:2 B5:2 D6:2 A5:4',
  'G5:2 B5:2 D6:2 G6:2 F#6:2 D6:2 B5:2 D6:2', 'E6:2 D6:2 B5:2 G5:2 A5:4 .:4',
  'E6:2 A5:1 E6:1 C#6:2 E6:2 A6:4 E6:2 C#6:2', 'C#6:2 B5:2 A5:2 B5:2 C#6:2 E6:2 A5:2 .:2',
  'B5:2 D6:2 F#6:2 D6:2 G6:2 F#6:2 E6:2 D6:2', JUNGLE_A[7]];
const jBass = () => [bounce('D2', 'A2'), bounce('D2', 'A2'), bounce('G2', 'D3'), bounce('G2', 'D3'),
  bounce('A2', 'E3'), bounce('A2', 'E3'), `${bounce8('B2', 'F#3')} ${bounce8('G2', 'D3')}`, `${bounce8('A2', 'E3')} ${PETE}`];
const jHarm = [stab('A4', 'F#4'), stab('A4', 'F#4'), stab('B4', 'D5'), stab('B4', 'D5'),
  stab('E4', 'C#5'), stab('E4', 'C#5'), `${stab8('F#4', 'D5')} ${stab8('B4', 'D5')}`, `${stab8('E4', 'C#5')} .:8`];
const DR_J = ['K.h.S.hhK.h.S.h.'], FILL = 'K.h.S.h.K.ttSsss';
const drums8 = [...rep(DR_J, 7), FILL];

const TRACKS = {
  jungle: { bpm: 132, bars: 16, loop: true,
    lead: { wave: 'pulse', duty: 0.25, vel: 0.30, gate: 0.7, sus: 0.3, pat: [...JUNGLE_A, ...JUNGLE_B] },
    harm: { wave: 'pulse', duty: 0.125, vel: 0.12, gate: 0.5, sus: 0.2, pat: jHarm },
    bass: { wave: 'tri', vel: 0.40, gate: 0.85, sus: 0.8, pat: jBass() },
    drums: { vel: 1, pat: [...drums8, ...drums8] } },
  title: { bpm: 126, bars: 8, loop: true,
    lead: { wave: 'pulse', duty: 0.5, vel: 0.28, gate: 0.85, sus: 0.5, pat: [
      'D5:2 D5:2 D5:2 F#5:2 A5:8', 'G5:2 G5:2 G5:2 B5:2 D6:8', 'E5:2 E5:2 E5:2 A5:2 C#6:4 B5:2 A5:2', 'F#5:4 A5:4 D6:8',
      'D6:2 .:2 D6:2 B5:2 F#5:4 B5:4', 'B5:2 G5:2 B5:2 D6:2 G6:8', 'E6:2 .:2 C#6:2 A5:2 E5:2 A5:2 C#6:4', 'D6:4 A5:2 F#5:2 D5:4 .:4'] },
    harm: { wave: 'pulse', duty: 0.125, vel: 0.12, gate: 0.5, sus: 0.2, pat: jHarm },
    bass: { wave: 'tri', vel: 0.42, gate: 0.85, sus: 0.8, pat: [...jBass().slice(0, 7), `${bounce8('D2', 'A2')} ${PETE}`] },
    drums: { vel: 1, pat: ['K...S...K...S...', 'K...S...K...S...', 'K...S...K...S...', 'K...S...K..tSsss',
      'K...S...K...S...', 'K...S...K...S...', 'K...S...K...S...', 'K.h.S.h.K.ttSsss'] } },
  underground: { bpm: 84, bars: 8, loop: true,
    lead: { wave: 'pulse', duty: 0.125, vel: 0.22, gate: 0.6, sus: 0.3, pat: [
      '.:4 A5:1 .:3 C6:1 .:3 E6:1 .:3', '.:8 D6:1 .:3 C6:1 .:3', '.:4 A5:1 .:3 C6:1 .:3 F6:1 .:3', '.:4 G#5:1 .:3 B5:1 .:3 E6:2 .:2',
      '.:4 A5:1 .:3 C6:1 .:3 E6:1 .:3', '.:4 F5:1 .:3 A5:1 .:3 D6:1 .:3', '.:2 E6:1 D#6:1 E6:1 .:3 B5:2 .:2 G#5:4', 'G#5:6 .:10'] },
    harm: { wave: 'pulse', duty: 0.25, vel: 0.07, gate: 0.97, sus: 0.6, pat: ['E4:16', 'E4:16', 'C4:16', 'B3:16', 'E4:16', 'D4:16', 'B3:16', 'B3:16'] },
    bass: { wave: 'tri', vel: 0.40, gate: 0.9, sus: 0.7, pat: [
      'A2:4 .:4 A2:2 .:2 E2:4', 'A2:4 .:4 A2:2 .:2 E2:4', 'F2:4 .:4 F2:2 .:2 C3:4', 'E2:4 .:4 E2:2 .:2 B2:4',
      'A2:4 .:4 A2:2 .:2 E2:4', 'D2:4 .:4 D2:2 .:2 A2:4', 'E2:4 .:4 E2:2 .:2 B2:4', 'E2:8 .:8'] },
    drums: { vel: 0.9, pat: ['K.......k.......', '................', 'K.......k...h...', '................',
      'K.......k.......', '................', 'K.......k.h.h.h.', 't.......t.......'] } },
  dusk: { bpm: 88, bars: 16, loop: true,
    lead: { wave: 'pulse', duty: 0.5, vel: 0.26, gate: 0.8, sus: 0.35, pat: [...JUNGLE_A, ...JUNGLE_B].map(minorize) },
    harm: { wave: 'pulse', duty: 0.25, vel: 0.10, gate: 0.6, sus: 0.25, pat: [
      stab('A4', 'F4'), stab('A4', 'F4'), stab('Bb4', 'D5'), stab('Bb4', 'D5'), stab('E4', 'C5'), stab('E4', 'C5'),
      `${stab8('F4', 'D5')} ${stab8('Bb4', 'D5')}`, `${stab8('E4', 'C5')} .:8`] },
    bass: { wave: 'tri', vel: 0.40, gate: 0.9, sus: 0.8, pat: [bounce('D2', 'A2'), bounce('D2', 'A2'), bounce('G2', 'D3'), bounce('G2', 'D3'),
      bounce('A2', 'E3'), bounce('A2', 'E3'), `${bounce8('Bb2', 'F3')} ${bounce8('G2', 'D3')}`, `${bounce8('A2', 'E3')} ${PETE}`] },
    drums: { vel: 0.8, pat: rep(['K.......S...h...', 'K...h...S...h...', 'K.......S...h...', 'K...h...S..ts...'], 4) } },
  gameover: { bpm: 100, bars: 2, loop: false,
    lead: { wave: 'pulse', duty: 0.5, vel: 0.30, gate: 0.9, sus: 0.5, pat: ['A5:4 G5:4 F5:4 E5:4', 'F5:3 .:1 E5:3 .:1 D5:8'] },
    harm: { wave: 'pulse', duty: 0.25, vel: 0.10, gate: 0.9, sus: 0.5, pat: ['F4:8 D4:8', 'A3:8 F3:8'] },
    bass: { wave: 'tri', vel: 0.42, gate: 0.95, sus: 0.8, pat: ['D3:8 A2:8', 'D2:16'] },
    drums: { vel: 0.9, pat: ['t...............', 't.......t...K...'] } },
  victory: { bpm: 144, bars: 4, loop: false,
    lead: { wave: 'pulse', duty: 0.25, vel: 0.30, gate: 0.85, sus: 0.5, pat: [
      'D5:2 D5:2 D5:2 D5:2 F#5:4 A5:4', 'G5:2 G5:2 G5:2 G5:2 B5:4 D6:4', 'A5:2 A5:2 A5:2 A5:2 C#6:4 E6:4', 'D6:10 .:6'] },
    harm: { wave: 'pulse', duty: 0.125, vel: 0.13, gate: 0.6, sus: 0.3, pat: [stab('A4', 'F#4'), stab('B4', 'D5'), stab('E4', 'C#5'), 'F#5:10 .:6'] },
    bass: { wave: 'tri', vel: 0.42, gate: 0.85, sus: 0.8, pat: [bounce('D2', 'A2'), bounce('G2', 'D3'), bounce('A2', 'E3'), 'D2:10 .:6'] },
    drums: { vel: 1, pat: ['K.h.S.h.K.h.S.hh', 'K.h.S.h.K.h.S.hh', 'K.h.S.h.K.ttSsss', 'K...............'] } },
};

// ---------------------------------------------------------------- parsing / event building
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export const midiHz = (m) => 440 * 2 ** ((m - 69) / 12);
export function noteMidi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error('bad note ' + name);
  return 12 * (+m[3] + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}
/** Parse one bar string into [{step, midi|null, len}]; throws unless it fills exactly 16 steps. */
export function parseBar(str) {
  const out = []; let step = 0;
  for (const tok of str.replace(/\|/g, ' ').trim().split(/\s+/)) {
    const m = /^([A-G][#b]?-?\d|\.)(?::(\d+))?$/.exec(tok);
    if (!m) throw new Error(`bad token "${tok}" in "${str}"`);
    const len = m[2] ? +m[2] : 1;
    if (m[1] !== '.') out.push({ step, midi: noteMidi(m[1]), len });
    step += len;
  }
  if (step !== STEPS_PER_BAR) throw new Error(`bar "${str}" is ${step} steps, need ${STEPS_PER_BAR}`);
  return out;
}

const DRUM = {   // shared by live + offline: sweep [f0,f1,sec] sine and/or noise highpassed at hp, exponential decay
  k: { sweep: [150, 45, 0.12], decay: 0.2, gain: 0.60 },
  s: { hp: 1400, decay: 0.13, gain: 0.26, tone: [185, 0.07, 0.18] },
  h: { hp: 6500, decay: 0.045, gain: 0.10 },
  t: { sweep: [230, 110, 0.15], decay: 0.24, gain: 0.40 },
};
const DRUM_CHARS = { k: ['k'], s: ['s'], h: ['h'], t: ['t'], K: ['k', 'h'], S: ['s', 'h'] };

const cache = new Map();
/** -> { name, bpm, bars, loop, length (s per pass), events: [{t, kind:'tone'|'drum', ...}] } sorted by t. Deterministic. */
export function describeMusic(name) {
  if (cache.has(name)) return cache.get(name);
  const T = TRACKS[name];
  if (!T) throw new Error('unknown music track: ' + name);
  const ss = 60 / T.bpm / 4, events = [];
  for (const ch of ['lead', 'harm', 'bass']) {
    const C = T[ch];
    for (let b = 0; b < T.bars; b++) {
      for (const n of parseBar(C.pat[b % C.pat.length])) {
        events.push({ t: (b * STEPS_PER_BAR + n.step) * ss, kind: 'tone', ch, wave: C.wave, duty: C.duty ?? 0.5, hz: midiHz(n.midi),
          vel: C.vel, dur: Math.max(0.04, n.len * ss * C.gate), sus: C.sus });
      }
    }
  }
  let ni = 0;
  for (let b = 0; b < T.bars; b++) {
    const bar = T.drums.pat[b % T.drums.pat.length];
    if (bar.length !== STEPS_PER_BAR) throw new Error('drum bar must be 16 chars: ' + bar);
    for (let s = 0; s < bar.length; s++) for (const d of DRUM_CHARS[bar[s]] ?? []) {
      events.push({ t: (b * STEPS_PER_BAR + s) * ss, kind: 'drum', ch: 'drums', d, vel: T.drums.vel, noiseOff: (ni++ * 0.0731) % 0.9 });
    }
  }
  events.sort((a, b) => a.t - b.t);
  const d = { name, bpm: T.bpm, bars: T.bars, loop: T.loop, length: T.bars * STEPS_PER_BAR * ss, events: Object.freeze(events) };
  cache.set(name, d);
  return d;
}

// ---------------------------------------------------------------- shared noise (live buffer and offline use the same table)
export function noiseTable(sr) {
  const n = Math.round(sr), a = new Float32Array(n);
  let s = 12345;
  for (let i = 0; i < n; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; a[i] = (s / 4294967296) * 2 - 1; }
  return a;
}
// tone envelope: linear attack, exponential decay 1 -> sus across the note, linear release to 0
export const toneEnvTail = (ev) => ev.dur + REL;
function toneAmp(ev, t) {
  if (t < 0) return 0;
  if (t < ATT) return t / ATT;
  if (t < ev.dur) return ev.sus ** ((t - ATT) / Math.max(1e-4, ev.dur - ATT));
  const r = 1 - (t - ev.dur) / REL;
  return r > 0 ? ev.sus * r : 0;
}
const drumTail = (ev) => DRUM[ev.d].decay + 0.01;

// ---------------------------------------------------------------- offline renderer
function polyblep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
function addTone(out, sr, i0, ev) {
  const n = Math.ceil(toneEnvTail(ev) * sr), dt = ev.hz / sr, N = out.length;
  let ph = 0;
  for (let i = 0; i < n; i++, ph += dt) {
    if (ph >= 1) ph -= 1;
    const idx = i0 + i;
    if (idx >= N) break;
    let v;
    if (ev.wave === 'tri') v = 4 * Math.abs(ph - 0.5) - 1;
    else { v = ph < ev.duty ? 1 : -1; v += polyblep(ph, dt) - polyblep((ph + 1 - ev.duty) % 1, dt); }
    if (idx >= 0) out[idx] += v * ev.vel * toneAmp(ev, i / sr) * MASTER;
  }
}
function addDrum(out, sr, i0, ev, noise) {
  const D = DRUM[ev.d], n = Math.ceil(drumTail(ev) * sr), N = out.length;
  const a = D.hp ? 1 - Math.exp((-2 * Math.PI * D.hp) / sr) : 0;
  let lp = 0, ph = 0, nIdx = Math.floor(ev.noiseOff * sr);
  // pre-roll the highpass state only when the event begins before the buffer (never an issue: lp starts at 0)
  for (let i = 0; i < n; i++) {
    const t = i / sr, idx = i0 + i;
    const env = (t < 0.002 ? t / 0.002 : 0.001 ** (t / D.decay)) * ev.vel * D.gain * MASTER;
    let v = 0;
    if (D.sweep) {
      const [f0, f1, T] = D.sweep, f = f0 * (f1 / f0) ** Math.min(1, t / T);
      ph += f / sr; v += Math.sin(2 * Math.PI * ph);
    }
    if (D.hp) {
      const x = noise[(nIdx++) % noise.length]; lp += a * (x - lp); v += x - lp;
    }
    if (D.tone) v += Math.sin(2 * Math.PI * D.tone[0] * t) * D.tone[2] / D.gain * 0.6 * 0.001 ** (t / D.tone[1]);
    if (idx >= N) break;
    if (idx >= 0) out[idx] += v * env;
  }
}
/** Offline render. Loops wrap seamlessly (tails of the previous pass spill into the start). Default length: one pass (+0.6 s tail for stings). */
export function renderMusic(name, sr = 44100, seconds) {
  const T = describeMusic(name), secs = seconds ?? (T.loop ? T.length : T.length + 0.6);
  const N = Math.max(1, Math.round(secs * sr)), out = new Float32Array(N), noise = noiseTable(sr);
  const kFrom = T.loop ? -1 : 0, kTo = T.loop ? Math.ceil(secs / T.length) : 0;
  for (let k = kFrom; k <= kTo; k++) {
    for (const ev of T.events) {
      const t0 = ev.t + k * T.length;
      if (t0 >= secs) break;
      const tail = ev.kind === 'tone' ? toneEnvTail(ev) : drumTail(ev);
      if (t0 + tail <= 0) continue;
      const i0 = Math.round(t0 * sr);
      if (ev.kind === 'tone') addTone(out, sr, i0, ev); else addDrum(out, sr, i0, ev, noise);
    }
  }
  for (let i = 0; i < N; i++) { const v = out[i]; out[i] = v > 1 ? 1 : v < -1 ? -1 : v; }
  return out;
}

// ---------------------------------------------------------------- analysis helpers
export function musicStats(pcm) {
  let peak = 0, sq = 0;
  for (let i = 0; i < pcm.length; i++) { const a = Math.abs(pcm[i]); if (a > peak) peak = a; sq += pcm[i] * pcm[i]; }
  return { peak, rms: Math.sqrt(sq / Math.max(1, pcm.length)), len: pcm.length };
}
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
      }
    }
  }
}
/** Average spectral centroid (Hz) over up to 24 Hann windows of 4096 samples. */
export function spectralCentroid(pcm, sr = 44100) {
  const W = 4096, hops = Math.max(1, Math.min(24, Math.floor(pcm.length / W)));
  let num = 0, den = 0;
  for (let h = 0; h < hops; h++) {
    const off = Math.floor((h * (pcm.length - W)) / Math.max(1, hops - 1)) || 0, re = new Float64Array(W), im = new Float64Array(W);
    for (let i = 0; i < W; i++) re[i] = (pcm[off + i] ?? 0) * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / W));
    fft(re, im);
    for (let k = 1; k < W / 2; k++) { const m = Math.hypot(re[k], im[k]); num += m * k; den += m; }
  }
  return den ? (num / den) * (sr / W) : 0;
}

// ---------------------------------------------------------------- live WebAudio
const LOOKAHEAD = 0.6, TICK_MS = 120, FADE = 0.15;
/** createMusic(ctx, dest) -> { play(name|null), stop(), tick(), current() }. Looping is exact (absolute event times, no drift). */
export function createMusic(ctx, dest) {
  const out = dest ?? ctx.destination;
  const waves = new Map();
  let noiseBuf = null, cur = null, timer = null;
  const wave = (duty) => {
    if (!ctx.createPeriodicWave) return null;
    if (!waves.has(duty)) {
      const re = new Float32Array(41), im = new Float32Array(41);
      for (let n = 1; n < 41; n++) im[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
      waves.set(duty, ctx.createPeriodicWave(re, im));
    }
    return waves.get(duty);
  };
  const noise = () => {
    if (!noiseBuf) { const sr = ctx.sampleRate || 44100; noiseBuf = ctx.createBuffer(1, Math.round(sr), sr); noiseBuf.getChannelData(0).set(noiseTable(sr)); }
    return noiseBuf;
  };
  function tone(ev, t, bus) {
    const o = ctx.createOscillator(), g = ctx.createGain(), v = ev.vel * MASTER;
    if (ev.wave === 'tri') o.type = 'triangle';
    else { const pw = wave(ev.duty); if (pw) o.setPeriodicWave(pw); else o.type = 'square'; }
    o.frequency.value = ev.hz;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + ATT);
    g.gain.exponentialRampToValueAtTime(Math.max(1e-4, v * ev.sus), t + ev.dur);
    g.gain.linearRampToValueAtTime(0, t + ev.dur + REL);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + ev.dur + REL + 0.02);
  }
  function drum(ev, t, bus) {
    const D = DRUM[ev.d], g = ctx.createGain(), v = ev.vel * D.gain * MASTER;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + 0.002);
    g.gain.exponentialRampToValueAtTime(v * 0.001, t + D.decay);
    g.connect(bus);
    const stopAt = t + D.decay + 0.02;
    if (D.sweep) {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(D.sweep[0], t); o.frequency.exponentialRampToValueAtTime(D.sweep[1], t + D.sweep[2]);
      o.connect(g); o.start(t); o.stop(stopAt);
    }
    if (D.hp) {
      const src = ctx.createBufferSource(), f = ctx.createBiquadFilter();
      src.buffer = noise(); src.loop = true; f.type = 'highpass'; f.frequency.value = D.hp;
      src.connect(f); f.connect(g); src.start(t, ev.noiseOff); src.stop(stopAt);
    }
    if (D.tone) {
      const o = ctx.createOscillator(), tg = ctx.createGain();
      o.frequency.value = D.tone[0];
      tg.gain.setValueAtTime(D.tone[2] / D.gain * 0.6, t); tg.gain.exponentialRampToValueAtTime(0.0006, t + D.tone[1]);
      o.connect(tg); tg.connect(g); o.start(t); o.stop(t + D.tone[1] + 0.02);
    }
  }
  function pump(st, until) {
    const evs = st.track.events;
    while (!st.done) {
      const ev = evs[st.i], t = st.start + st.k * st.track.length + ev.t;
      if (t > until) break;
      if (t >= ctx.currentTime - 0.02) (ev.kind === 'tone' ? tone : drum)(ev, Math.max(t, ctx.currentTime), st.bus);
      if (++st.i >= evs.length) { st.i = 0; st.k++; if (!st.track.loop) st.done = true; }
    }
    if (st.done && !st.endAt) st.endAt = st.start + st.track.length + 1;
  }
  function kill(st, fade = FADE) {
    const now = ctx.currentTime;
    try {
      st.bus.gain.cancelScheduledValues?.(now);
      st.bus.gain.setValueAtTime(st.bus.gain.value ?? 1, now);
      st.bus.gain.linearRampToValueAtTime(0, now + fade);
    } catch { /* ignore */ }
    st.dead = now + fade + 0.05;
    dying.push(st);
  }
  const dying = [];
  function tick() {
    const now = ctx.currentTime;
    for (let i = dying.length - 1; i >= 0; i--) if (now >= dying[i].dead) { try { dying[i].bus.disconnect(); } catch { /* ignore */ } dying.splice(i, 1); }
    if (cur) {
      pump(cur, now + LOOKAHEAD);
      if (cur.endAt && now > cur.endAt) { try { cur.bus.disconnect(); } catch { /* ignore */ } cur.ended = true; }
    }
    if (!cur && !dying.length && timer) { clearInterval(timer); timer = null; }
  }
  function stop() { if (cur) { kill(cur); cur = null; } }
  function play(name) {
    if (name == null) { stop(); return true; }
    if (!MUSIC.includes(name)) return false;
    if (cur && cur.name === name && !cur.ended) return true;     // already playing
    stop();
    const bus = ctx.createGain();
    bus.gain.value = 1; bus.connect(out);
    cur = { name, track: describeMusic(name), bus, start: ctx.currentTime + 0.06, i: 0, k: 0, done: false };
    pump(cur, ctx.currentTime + LOOKAHEAD);
    if (!timer && typeof setInterval === 'function') { timer = setInterval(tick, TICK_MS); timer.unref?.(); }
    return true;
  }
  return { play, stop, tick, current: () => (cur && !cur.ended ? cur.name : null) };
}

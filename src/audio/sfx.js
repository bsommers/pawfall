// PawFall sound effects (ARCHITECTURE.md §9). Every name in defs.SFX is a pure recipe -> list of "voices" (plain data).
// The same voices drive WebAudio (schedule) and the pure-JS offline path (renderPcm, used by Node tests and tools/sfx-wav.mjs).
//
// voice: { src: 'sine'|'square'|'saw'|'triangle'|'noise', t, dur, gain, att, f: number|number[] (Hz, exp-interpolated over dur),
//          fm?: {ratio, depth}, filters?: [{type:'lp'|'hp'|'bp', f: number|number[], q, g?}], parallel?: bool }
import { SFX } from '../core/defs.js';

export const SFX_NAMES = SFX;

// ---- helpers -------------------------------------------------------------------------------------------------------
/** number, or array of values spread evenly over u in [0,1]; exponential between positive points. */
export function curve(c, u) {
  if (typeof c === 'number') return c;
  const n = c.length - 1;
  if (n === 0) return c[0];
  const x = Math.min(Math.max(u, 0), 1) * n, i = Math.min(Math.floor(x), n - 1), k = x - i;
  const a = c[i], b = c[i + 1];
  return a > 0 && b > 0 ? a * Math.pow(b / a, k) : a + (b - a) * k;
}
const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);
const scaleF = (f, p) => (typeof f === 'number' ? f * p : f.map((x) => x * p));

// recipe helpers: v(voiceSpec) appends a voice; arp() plays notes (MIDI numbers) one after another
const arp = (v, notes, step, o = {}) => notes.forEach((n, i) => v({
  src: o.src || 'square', t: (o.t0 || 0) + i * step, dur: o.dur ?? step * 1.6, gain: o.gain ?? 0.2, att: 0.004, f: NOTE(n),
  filters: o.lp ? [{ type: 'lp', f: o.lp, q: 0.7 }] : undefined,
}));

const RECIPES = {
  step: (v) => {                                   // soft footfall: a little wood knock and dust
    v({ src: 'triangle', dur: 0.05, gain: 0.18, f: [190, 120] });
    v({ src: 'noise', dur: 0.03, gain: 0.12, f: 1, filters: [{ type: 'lp', f: 900, q: 0.7 }] });
  },
  jump: (v) => {                                   // bouncy blip, pitch rises
    v({ src: 'square', dur: 0.16, gain: 0.16, f: [260, 640], filters: [{ type: 'lp', f: 3000, q: 0.7 }] });
    v({ src: 'triangle', dur: 0.16, gain: 0.12, f: [130, 300] });
  },
  land: (v) => {                                   // padded thud
    v({ src: 'sine', dur: 0.14, gain: 0.35, f: [110, 48] });
    v({ src: 'noise', dur: 0.06, gain: 0.12, f: 1, filters: [{ type: 'lp', f: 700, q: 0.7 }] });
  },
  swing_grab: (v) => {                             // vine twang
    v({ src: 'triangle', dur: 0.2, gain: 0.3, f: [300, 520, 380] });
    v({ src: 'noise', dur: 0.04, gain: 0.08, f: 1, filters: [{ type: 'bp', f: 2000, q: 2 }] });
  },
  swing_release: (v) => {                          // whoosh off the vine
    v({ src: 'noise', dur: 0.25, gain: 0.18, att: 0.05, f: 1, filters: [{ type: 'bp', f: [400, 2500], q: 1.2 }] });
    v({ src: 'square', t: 0.02, dur: 0.1, gain: 0.1, f: [520, 260] });
  },
  ladder: (v) => {                                 // three rungs of climbing
    for (let i = 0; i < 3; i++) v({ src: 'triangle', t: i * 0.07, dur: 0.05, gain: 0.16, f: [330, 420] });
  },
  treasure: (v) => {                               // sparkly ascending arpeggio
    arp(v, [76, 79, 83, 88], 0.05, { dur: 0.14, gain: 0.18 });
    v({ src: 'sine', t: 0.2, dur: 0.3, gain: 0.12, f: [NOTE(96), NOTE(100)] });
  },
  treasure_big: (v) => {                           // longer fanfare with a shimmering chord
    arp(v, [72, 76, 79, 84, 88, 91], 0.06, { dur: 0.16, gain: 0.17 });
    [84, 88, 91].forEach((n) => v({ src: 'triangle', t: 0.4, dur: 0.7, gain: 0.12, att: 0.01, f: NOTE(n) }));
    v({ src: 'sine', t: 0.45, dur: 0.5, gain: 0.08, f: [NOTE(100), NOTE(106)] });
  },
  log_hit: (v) => {                                // woody thud
    v({ src: 'sine', dur: 0.18, gain: 0.45, f: [160, 80] });
    v({ src: 'noise', dur: 0.1, gain: 0.4, f: 1, filters: [{ type: 'bp', f: 500, q: 3 }] });
    v({ src: 'square', dur: 0.08, gain: 0.1, f: [240, 120], filters: [{ type: 'lp', f: 800, q: 0.8 }] });
  },
  splash: (v) => {                                 // water whoosh with bubbles
    v({ src: 'noise', dur: 0.45, gain: 0.35, att: 0.02, f: 1, filters: [{ type: 'bp', f: [1200, 300], q: 0.9 }] });
    for (let i = 0; i < 5; i++) v({ src: 'sine', t: 0.05 + i * 0.07, dur: 0.08, gain: 0.08, f: [600 + i * 120, 900 + i * 160] });
  },
  tar_glug: (v) => {                               // bubbling tar
    v({ src: 'sine', dur: 0.35, gain: 0.3, f: [140, 70], fm: { ratio: 3, depth: 25 } });
    v({ src: 'noise', dur: 0.3, gain: 0.15, att: 0.01, f: 1, filters: [{ type: 'lp', f: [400, 200], q: 1 }] });
  },
  quicksand: (v) => {                              // slow sinking drone
    v({ src: 'triangle', dur: 0.6, gain: 0.25, att: 0.02, f: [220, 60], filters: [{ type: 'lp', f: [1200, 200], q: 1 }] });
    v({ src: 'noise', dur: 0.6, gain: 0.08, att: 0.05, f: 1, filters: [{ type: 'bp', f: 300, q: 1.5 }] });
  },
  croc_snap: (v) => {                              // double chomp
    for (const t of [0, 0.075]) {
      v({ src: 'square', t, dur: 0.06, gain: 0.28, f: [400, 110] });
      v({ src: 'noise', t, dur: 0.05, gain: 0.2, f: 1, filters: [{ type: 'hp', f: 1500, q: 0.7 }] });
    }
  },
  snake_hiss: (v) => {                             // sibilant hiss
    v({ src: 'noise', dur: 0.6, gain: 0.22, att: 0.08, f: 1, filters: [{ type: 'bp', f: [3500, 6000], q: 2 }] });
    v({ src: 'sine', dur: 0.6, gain: 0.04, att: 0.1, f: [1800, 2400], fm: { ratio: 1.5, depth: 200 } });
  },
  scorpion: (v) => {                               // sharp sting
    v({ src: 'square', dur: 0.22, gain: 0.2, f: [900, 1600, 500], filters: [{ type: 'lp', f: 3000, q: 0.7 }] });
    v({ src: 'sine', dur: 0.22, gain: 0.2, f: [1200, 300] });
    v({ src: 'noise', dur: 0.03, gain: 0.15, f: 1, filters: [{ type: 'hp', f: 3000, q: 0.7 }] });
  },
  fire_crackle: (v) => {                           // popping flames over a low roar
    for (let i = 0; i < 10; i++) v({ src: 'noise', t: i * 0.05 + (i % 3) * 0.012, dur: 0.03, gain: 0.2 + 0.05 * (i % 2), f: 1,
      filters: [{ type: 'hp', f: 1200 + ((i * 397) % 1500), q: 1 }] });
    v({ src: 'noise', dur: 0.55, gain: 0.12, att: 0.05, f: 1, filters: [{ type: 'lp', f: 500, q: 0.7 }] });
  },
  die: (v) => {                                    // falling wobble
    v({ src: 'square', dur: 0.8, gain: 0.18, att: 0.01, f: [520, 130], fm: { ratio: 0.5, depth: 30 }, filters: [{ type: 'lp', f: 2000, q: 0.7 }] });
    v({ src: 'triangle', dur: 0.8, gain: 0.22, att: 0.01, f: [220, 55] });
  },
  respawn: (v) => {                                // rising bloop and a sparkle
    v({ src: 'triangle', dur: 0.25, gain: 0.3, f: [200, 800] });
    arp(v, [84, 88], 0.08, { t0: 0.1, dur: 0.1, gain: 0.1 });
  },
  screen_flip: (v) => {                            // swish between screens
    v({ src: 'noise', dur: 0.3, gain: 0.2, att: 0.05, f: 1, filters: [{ type: 'bp', f: [300, 3000, 800], q: 1.2 }] });
    v({ src: 'triangle', dur: 0.15, gain: 0.08, f: [600, 200] });
  },
  tunnel_drop: (v) => {                            // drop down a shaft
    v({ src: 'sine', dur: 0.5, gain: 0.3, att: 0.005, f: [400, 60] });
    v({ src: 'noise', dur: 0.5, gain: 0.1, att: 0.01, f: 1, filters: [{ type: 'lp', f: [2000, 200], q: 0.8 }] });
  },
  brick_bump: (v) => {                             // bonk
    v({ src: 'sine', dur: 0.1, gain: 0.4, f: [180, 120] });
    v({ src: 'noise', dur: 0.05, gain: 0.25, f: 1, filters: [{ type: 'bp', f: 900, q: 2 }] });
  },
  tick_low: (v) => {                               // clock tick when time is short
    v({ src: 'square', dur: 0.025, gain: 0.16, f: 1800 });
    v({ src: 'noise', dur: 0.012, gain: 0.1, f: 1, filters: [{ type: 'hp', f: 3000, q: 0.7 }] });
  },
  pete_laugh: (v) => {                             // Pete: descending "heh heh heh" square-wave sequence
    const heh = (t, a, b, d) => {
      v({ src: 'square', t, dur: d, gain: 0.2, att: 0.005, f: [a, b], filters: [{ type: 'lp', f: 2500, q: 0.7 }] });
      v({ src: 'noise', t, dur: 0.04, gain: 0.06, f: 1, filters: [{ type: 'hp', f: 2000, q: 0.7 }] });
    };
    heh(0, 330, 250, 0.12); heh(0.16, 300, 220, 0.12); heh(0.32, 270, 190, 0.12); heh(0.5, 240, 140, 0.3);
  },
  menu_move: (v) => { v({ src: 'square', dur: 0.04, gain: 0.12, f: 660 }); },
  menu_select: (v) => {
    v({ src: 'square', dur: 0.07, gain: 0.14, f: 660 });
    v({ src: 'square', t: 0.07, dur: 0.12, gain: 0.15, f: 990 });
  },
  gameover: (v) => {                               // sad descending phrase over a bass drone
    arp(v, [67, 64, 60, 55], 0.22, { dur: 0.4, gain: 0.2 });
    v({ src: 'triangle', dur: 1.1, gain: 0.2, att: 0.02, f: [NOTE(43), NOTE(36)] });
  },
  victory: (v) => {                                // jaunty fanfare, ends on a chord
    [[72, 0, 0.12], [76, 0.12, 0.12], [79, 0.24, 0.12], [84, 0.36, 0.3], [79, 0.7, 0.12], [84, 0.82, 0.5]]
      .forEach(([n, t, d]) => v({ src: 'square', t, dur: d + 0.05, gain: 0.18, att: 0.004, f: NOTE(n), filters: [{ type: 'lp', f: 3500, q: 0.7 }] }));
    [72, 76, 79, 84].forEach((n) => v({ src: 'triangle', t: 0.82, dur: 1.0, gain: 0.1, att: 0.01, f: NOTE(n) }));
    v({ src: 'triangle', t: 0.82, dur: 1.2, gain: 0.14, att: 0.01, f: NOTE(48) });
  },
  oneup: (v) => {                                  // rapid bright arpeggio with a sparkle
    arp(v, [76, 79, 84, 88, 91, 96], 0.06, { dur: 0.1, gain: 0.17 });
    v({ src: 'triangle', t: 0.36, dur: 0.3, gain: 0.12, f: [NOTE(96), NOTE(103)] });
  },
};

/** Voices for one sound. opts.pitch scales every oscillator and filter frequency (default 1). */
export function describe(name, { pitch = 1 } = {}) {
  if (!Object.hasOwn(RECIPES, name)) throw new Error(`unknown sfx: ${name}`);
  const list = [];
  RECIPES[name]((spec) => list.push({ src: 'sine', t: 0, dur: 0.1, gain: 0.3, att: 0.003, f: 440, ...spec }));
  if (pitch !== 1) for (const o of list) {
    if (o.src !== 'noise') o.f = scaleF(o.f, pitch);
    if (o.filters) o.filters = o.filters.map((fs) => ({ ...fs, f: scaleF(fs.f, pitch) }));
  }
  return list;
}
export function duration(voices) {
  let d = 0;
  for (const o of voices) d = Math.max(d, o.t + o.dur);
  return d;
}

// ---- WebAudio backend ------------------------------------------------------------------------------------------------
let noiseBuf = null;
function getNoise(ctx) {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const len = ctx.sampleRate | 0, b = ctx.createBuffer(1, len, ctx.sampleRate), d = b.getChannelData(0);
  let s = 12345;
  for (let i = 0; i < len; i++) { s = (s * 1664525 + 1013904223) >>> 0; d[i] = s / 2147483648 - 1; }
  return (noiseBuf = b);
}
function ramp(param, c, t0, dur) {                 // exponential curve through array points
  const arr = typeof c === 'number' ? [c, c] : c, n = arr.length - 1;
  param.setValueAtTime(arr[0], t0);
  for (let i = 1; i <= n; i++) param.exponentialRampToValueAtTime(Math.max(arr[i], 1e-3), t0 + dur * (i / n));
}
/** Schedule voices into `dest` at ctx time t0 (live WebAudio). Returns the end time. */
export function schedule(ctx, dest, voices, t0, { pan = 0, gain = 1 } = {}) {
  let end = t0;
  const out = ctx.createGain();
  out.gain.value = gain;
  let tail = out;
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; out.connect(p); tail = p; }
  tail.connect(dest);
  for (const o of voices) {
    const t = t0 + o.t, e = t + o.dur + 0.01;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.gain, t + Math.min(o.att, o.dur / 2));
    g.gain.exponentialRampToValueAtTime(0.0008, t + o.dur);
    g.gain.linearRampToValueAtTime(0, e);
    let src;
    if (o.src === 'noise') {
      src = ctx.createBufferSource(); src.buffer = getNoise(ctx); src.loop = true;
    } else {
      src = ctx.createOscillator(); src.type = o.src === 'saw' ? 'sawtooth' : o.src;
      ramp(src.frequency, o.f, t, o.dur);
      if (o.fm) {
        const m = ctx.createOscillator(), mg = ctx.createGain();
        ramp(m.frequency, typeof o.f === 'number' ? o.f * o.fm.ratio : o.f.map((x) => x * o.fm.ratio), t, o.dur);
        mg.gain.value = o.fm.depth; m.connect(mg); mg.connect(src.frequency); m.start(t); m.stop(e);
      }
    }
    const nodes = (o.filters || []).map((fs) => {
      const f = ctx.createBiquadFilter();
      f.type = fs.type === 'bp' ? 'bandpass' : fs.type === 'lp' ? 'lowpass' : 'highpass';
      f.Q.value = fs.q ?? 0.7; ramp(f.frequency, fs.f, t, o.dur);
      return { f, g: fs.g ?? 1 };
    });
    if (!nodes.length) src.connect(g);
    else if (o.parallel) for (const n of nodes) { const w = ctx.createGain(); w.gain.value = n.g; src.connect(n.f); n.f.connect(w); w.connect(g); }
    else { let prev = src; for (const n of nodes) { prev.connect(n.f); prev = n.f; } prev.connect(g); }
    g.connect(out);
    src.start(t, o.src === 'noise' ? (t * 0.37) % 0.8 : 0); src.stop(e);
    end = Math.max(end, e);
  }
  return end;
}

// ---- pure-JS offline backend -----------------------------------------------------------------------------------------
function biquad(type, fc, q, sr) {
  const w = 2 * Math.PI * Math.min(Math.max(fc, 20), sr * 0.45) / sr, c = Math.cos(w), al = Math.sin(w) / (2 * Math.max(q, 0.1));
  let b0, b1, b2;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
  else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
  else { b0 = al; b1 = 0; b2 = -al; }
  const a0 = 1 + al;
  return [b0 / a0, b1 / a0, b2 / a0, -2 * c / a0, (1 - al) / a0];
}
function renderVoice(o, sr, out, seed) {
  const start = Math.round(o.t * sr), n = Math.min(Math.round(o.dur * sr), out.length - start);
  if (n <= 0) return;
  const tau = Math.PI * 2, decayK = Math.log(0.0008 / Math.max(o.gain, 1e-4));
  const G = o.gain;
  let ph = 0, mph = 0, s = (seed * 2654435761) >>> 0 || 1;
  const fl = (o.filters || []).map((f) => ({ f, c: [0, 0, 0, 0, 0], x1: 0, x2: 0, y1: 0, y2: 0 }));
  const att = Math.min(o.att, o.dur / 2), fade = Math.min(0.01 * sr, n);
  for (let i = 0; i < n; i++) {
    const u = i / Math.max(n - 1, 1), tt = i / sr;
    let x;
    if (o.src === 'noise') { s = (s * 1664525 + 1013904223) >>> 0; x = s / 2147483648 - 1; }
    else {
      const f = curve(o.f, u);
      let inst = f;
      if (o.fm) { mph += tau * f * o.fm.ratio / sr; inst = f + o.fm.depth * Math.sin(mph); }
      ph += inst / sr; ph -= Math.floor(ph);
      x = o.src === 'sine' ? Math.sin(tau * ph) : o.src === 'square' ? (ph < 0.5 ? 1 : -1)
        : o.src === 'saw' ? 2 * ph - 1 : 4 * Math.abs(ph - 0.5) - 1;
    }
    if (fl.length) {
      const run = (st, v) => {
        if ((i & 15) === 0) st.c = biquad(st.f.type, curve(st.f.f, u), st.f.q ?? 0.7, sr);
        const c = st.c, y = c[0] * v + c[1] * st.x1 + c[2] * st.x2 - c[3] * st.y1 - c[4] * st.y2;
        st.x2 = st.x1; st.x1 = v; st.y2 = st.y1; st.y1 = y; return y;
      };
      if (o.parallel) { let sum = 0; for (const st of fl) sum += run(st, x) * (st.f.g ?? 1); x = sum; }
      else for (const st of fl) x = run(st, x);
    }
    const env = G * (tt < att ? tt / att : Math.exp(decayK * (tt - att) / Math.max(o.dur - att, 1e-4)));
    const fadeGain = i > n - fade ? (n - i) / fade : 1;
    out[start + i] += x * env * fadeGain;
  }
}
/** Render voices to a mono Float32Array. Peak is kept at or below 0.98 (no clipping). */
export function renderPcm(voices, sr = 44100, { tail = 0.02, seed = 1 } = {}) {
  const out = new Float32Array(Math.ceil((duration(voices) + tail) * sr));
  voices.forEach((o, i) => renderVoice(o, sr, out, seed + i * 7919));
  let peak = 0;
  for (const x of out) peak = Math.max(peak, Math.abs(x));
  if (peak > 0.98) for (let i = 0; i < out.length; i++) out[i] *= 0.98 / peak;
  return out;
}
/** Offline render of one SFX name. opts: { pitch, seed, tail }. */
export function renderSfx(name, sr = 44100, opts = {}) { return renderPcm(describe(name, opts), sr, opts); }
export function stats(pcm) {
  let peak = 0, sum = 0;
  for (const x of pcm) { const a = Math.abs(x); if (a > peak) peak = a; sum += x * x; }
  return { peak, rms: Math.sqrt(sum / Math.max(pcm.length, 1)), len: pcm.length };
}

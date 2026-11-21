// PawFall audio engine (ARCHITECTURE.md §9). WebAudio only; Node-importable (no DOM or AudioContext touched at import time).
// createAudio(bus, settings) -> { unlock(), setVolume(master, sfx, music), setMute(on), dispose() }
// The AudioContext is created lazily, on the first unlock() (call it from a user gesture). Events before that are dropped.
import { describe, schedule } from './sfx.js';
import { SFX, MUSIC, W } from '../core/defs.js';

const clamp01 = (x, d = 0) => (typeof x === 'number' && isFinite(x) ? Math.min(Math.max(x, 0), 1) : d);
export const LIMITS = Object.freeze({ perName: 4, total: 20, retrigger: 0.03 });   // anti-stacking guards (seconds / counts)

/**
 * @param bus       event bus from core/events.js (subscribed at construction)
 * @param settings  { master, sfx, music, mute } (values read at construction; later changes via setVolume/setMute)
 * @param opts      optional { AudioContextCtor } to inject a context class (tests, Node)
 */
export function createAudio(bus, settings = {}, { AudioContextCtor } = {}) {
  const Ctor = AudioContextCtor || (typeof globalThis !== 'undefined' && (globalThis.AudioContext || globalThis.webkitAudioContext)) || null;
  const vol = { master: clamp01(settings?.master, 0.8), sfx: clamp01(settings?.sfx, 1), music: clamp01(settings?.music, 0.7) };
  const state = { muted: !!settings?.mute, ctx: null, nodes: null, active: [], lastPlay: new Map(), musicApi: null, musicName: null, musicLoading: false };
  const stats = { played: 0, dropped: 0, ignored: 0, byName: {} };
  const unsubs = [];

  function applyVolumes() {
    const n = state.nodes;
    if (!n) return;
    n.master.gain.value = state.muted ? 0 : vol.master;
    n.sfx.gain.value = vol.sfx;
    n.music.gain.value = vol.music;
  }

  function build(ctx) {
    const master = ctx.createGain(), sfx = ctx.createGain(), music = ctx.createGain(), limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.12;
    sfx.connect(master); music.connect(master); master.connect(limiter); limiter.connect(ctx.destination);
    state.ctx = ctx; state.nodes = { master, sfx, music, limiter };
    applyVolumes();
    loadMusic();
  }

  // audio-music owns music.js: createMusic(ctx, dest) -> { play(name|null), stop() }. Optional: missing module is fine.
  async function loadMusic() {
    if (state.musicApi || state.musicLoading || !state.ctx) return;
    state.musicLoading = true;
    try {
      const mod = await import('./music.js');
      const make = mod.createMusic || mod.default;
      if (typeof make === 'function' && state.ctx) {
        state.musicApi = make(state.ctx, state.nodes.music);
        if (state.musicName) state.musicApi?.play?.(state.musicName);
      }
    } catch { /* music.js missing or failed: music events are remembered and ignored */ }
    state.musicLoading = false;
  }

  function playSfx(name, o = {}) {
    if (!SFX.includes(name)) { stats.ignored++; return false; }
    const ctx = state.ctx;
    if (!ctx || ctx.state === 'closed') { stats.dropped++; return false; }   // not unlocked yet
    const now = ctx.currentTime;
    state.active = state.active.filter((a) => a.end > now);
    const last = state.lastPlay.get(name), same = state.active.filter((a) => a.name === name).length;
    if ((last !== undefined && now - last < LIMITS.retrigger) || same >= LIMITS.perName || state.active.length >= LIMITS.total) {
      stats.dropped++; return false;
    }
    const pan = typeof o.x === 'number' ? Math.max(-0.7, Math.min(0.7, ((o.x - W / 2) / (W / 2)) * 0.7)) : 0;
    const voices = describe(name);
    const end = schedule(ctx, state.nodes.sfx, voices, now + 0.005, { pan });
    state.active.push({ name, end }); state.lastPlay.set(name, now);
    stats.played++; stats.byName[name] = (stats.byName[name] || 0) + 1;
    return true;
  }

  function playMusic(name) {
    if (name != null && !MUSIC.includes(name)) return false;
    state.musicName = name ?? null;
    if (!state.ctx) return true;   // remembered; applied once unlocked and music.js is loaded
    if (state.musicApi) state.musicApi[name == null ? 'stop' : 'play'](name ?? undefined);
    return true;
  }

  const api = {
    stats, limits: LIMITS,
    /** Create (once) and resume the AudioContext. Call from a user gesture (click, key, touch). */
    unlock() {
      if (!state.ctx && Ctor) {
        try { build(new Ctor()); } catch { return Promise.resolve(false); }
      }
      if (!state.ctx) return Promise.resolve(false);
      if (state.musicName && state.musicApi) state.musicApi.play?.(state.musicName);
      return Promise.resolve(state.ctx.resume ? state.ctx.resume() : undefined).then(() => true, () => false);
    },
    /** master, sfx and music levels in 0..1. Undefined arguments keep their current value. */
    setVolume(master, sfx, music) {
      if (master !== undefined) vol.master = clamp01(master, vol.master);
      if (sfx !== undefined) vol.sfx = clamp01(sfx, vol.sfx);
      if (music !== undefined) { vol.music = clamp01(music, vol.music); state.musicApi?.setVolume?.(vol.music); }
      applyVolumes();
    },
    setMute(on) { state.muted = !!on; applyVolumes(); },
    get muted() { return state.muted; },
    get volume() { return { ...vol }; },
    get ctx() { return state.ctx; },
    dispose() {
      unsubs.splice(0).forEach((u) => u && u());
      state.musicApi?.stop?.();
      if (state.ctx?.close) state.ctx.close().catch?.(() => {});
      state.ctx = null; state.nodes = null; state.musicApi = null;
    },
  };

  if (bus) {
    unsubs.push(bus.on('sfx', (e) => { if (e && typeof e.name === 'string') playSfx(e.name, e); }));
    unsubs.push(bus.on('music', (e) => playMusic(e ? e.name : null)));
  }
  return api;
}

# audio-sfx report

**Status:** done (04:50 UTC).

## What I built
- `src/audio/sfx.js`: `SFX_NAMES` (= `defs.SFX`, all 28 names), `describe(name, {pitch})` -> voices, `schedule(ctx, dest, voices, t0, {pan, gain})` (WebAudio), `renderPcm` / `renderSfx(name, sr, {pitch, seed, tail})` (pure JS, Node-safe, deterministic), `stats(pcm)`, `duration`, `curve`. Peak is capped at 0.98 by the offline renderer.
- `src/audio/audio.js`: `createAudio(bus, settings, opts?)` -> `{ unlock(), setVolume(master, sfx, music), setMute(on), dispose() }` plus `stats`, `muted`, `volume`, `ctx`. The AudioContext is created lazily in `unlock()`. Events before unlock are dropped. Subscribes to `sfx` and `music` at construction. Master, sfx and music buses feed a compressor/limiter. Retrigger guard 30 ms, max 4 of one name, max 20 total. Stereo pan from `x` (W=320). Optional `import('./music.js')` uses `createMusic(ctx, dest)`; a missing file is tolerated. `opts.AudioContextCtor` is an injection point for tests.
- `tools/sfx-wav.mjs`: unchanged, its API matched. It writes 28 WAVs to `out/sfx/`.
- `test/audio-sfx.test.mjs`: 10 tests, all passing.

## Verification evidence
- `node --test test/audio-sfx.test.mjs`: 10 pass, 0 fail.
- `node tools/sfx-wav.mjs`: all 28 render. Peaks range 0.08 to 0.52, RMS 0.014 to 0.087, lengths 0.05 s to 2.04 s, no CLIP flags. Example: `treasure` peak 0.21, rms 0.062, 0.52 s. `victory` peak 0.48, 2.04 s.
- `node tools/check-imports.mjs`: exit 0. Only warning is the optional `music.js` (audio-music's file, not yet present).
- Tests check: finite samples, peak <= 1, not silent, length matches duration, no click at start or end, deterministic output, pitch raises zero-crossing rate, WebAudio schedule emits nodes, unlock gating, mute and volume reach the master gain, retrigger guard, no `Math.random` in `src/audio/`.
- I did not listen to the audio or view images. Judgement rests on the numeric checks above.

## Deviations from the contract
- `createAudio` takes an optional third argument `{AudioContextCtor}` for tests. The contract's two-argument form still works.
- `renderSfx` returns peak-normalised output only when peak > 0.98. Otherwise levels are as authored.

## Mistakes I made and how I fixed them
- None outstanding. The test suite passed on the first run.

## Learnings for a future agent
- Keep recipes pure data. Pitch scaling is applied after the recipe, so one recipe serves live and offline paths.
- Dynamic import of an optional module needs try/catch so Node tests still pass.

## Requests for other modules
- audio-music: `src/audio/music.js` should export `createMusic(ctx, dest) -> {play(name|null), stop(), setVolume?(v)}`, as in ARCHITECTURE §9. `audio.js` picks it up automatically.
- sim/ui: emit `sfx` with `{name, x}` (x in logical pixels) for pan to work.

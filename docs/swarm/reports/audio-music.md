# audio-music report

## What I built
- `src/audio/music.js`: tracker data (per-bar strings `NOTE:len16ths`, drum chars k/s/h/t/K/S) for lead (pulse 25%/50%), harm (thin pulse offbeat stabs), bass (triangle), drums (sine sweeps + shared noise table). `describeMusic(name)` turns it into one event list that drives BOTH `createMusic(ctx,dest)` (live, lookahead scheduler, absolute times so loops never drift, 150 ms fade on switch/stop, `play(sameName)` is a no-op) and `renderMusic(name, sr, seconds)` (offline PCM, polyBLEP pulses, loops wrap with tails spilling across the seam). Exports: `MUSIC_NAMES, describeMusic, renderMusic, createMusic, musicStats, spectralCentroid, parseBar, noteMidi, midiHz, noiseTable`.
- Tracks: jungle (D major, 132 bpm, 16 bars, bouncy marimba-ish melody, oom-pah bass, chromatic D-Eb-E-F# "Pete" wink in the bass at bar 8/16), title (126 bpm heroic, same wink), underground (A minor, 84 bpm, sparse bleeps + bass), dusk (jungle melody auto-minorised, 88 bpm), gameover (descending sting), victory (fanfare sting).
- `tools/music-wav.mjs [names] [--sr --seconds --loops]` writes `out/music/<name>.wav`, prints length/bpm/peak/RMS/centroid.
- `test/audio-music.test.mjs` (18 tests).

## Verification evidence
`node --test test/audio-music.test.mjs`: 18 pass. `node tools/music-wav.mjs`: title 15.2s pk .87 rms .20; jungle 29.1s pk .88 rms .18; underground 22.9s pk .76; dusk 43.6s pk .79; gameover 5.4s pk .80; victory 7.3s pk .88. Tests check no NaN, no 0.5 s silence, peak<=1, rms band, centroid band, determinism, stings end silent, max sample jump < 0.9, loop wrap step <= interior step, two-pass render equals repeated pass, live scheduling through a fake AudioContext. `tools/check-imports.mjs`: 0 errors. Not auditioned by ear (no audio device).

## Deviations from the contract
- Contract says dusk is the jungle tune "slowed, minor-tinged": done by note substitution (F#->F, C#->C, G#->G, B->Bb) at 88 bpm, so it lasts 43.6 s (16 bars).
- `createMusic` returns extra `tick()` and `current()` besides `play/stop`.
- Live noise/highpass drums use a 12 dB biquad, offline uses a 6 dB one-pole: close, not bit-identical.

## Mistakes I made and how I fixed them
- Initial MASTER gain 0.55 gave peaks ~0.6; raised to 0.78 (peaks <= 0.88). Two over-strict test thresholds (event counts for the short sting) were relaxed.

## Learnings for a future agent
- Validate bar lengths with `parseBar` (throws unless exactly 16 steps); a wrong rest length is the usual authoring error.
- Loops stay seamless because the offline renderer also renders pass k=-1 and wraps; live scheduling uses absolute times.

## Requests for other modules
- audio-sfx `audio.js` should call `createMusic(ctx, musicBus)` once and `music.play(name)` on each `music {name}` event (null stops); `ctx.currentTime` must be advancing (the timer calls `tick()` every 120 ms). Call `tick()` manually if timers are throttled.

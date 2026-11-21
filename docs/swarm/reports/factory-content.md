# factory-content report

## What I built
Five zero-dep kits under `~/src/fun/game-factory/templates/web-project/src/kits/`: art-kit (PixBuf copy, palette lock, ASCII/draw-fn sprites, sheet packer + manifest validator, seamless tiles, scenery, PNG encoder), character-kit (spec to sprites, validator, animator), audio-kit (SFX recipe tables, tracker songs, offline renderers, WAV read/write, jingle, soundtrack map, WebAudio schedulers), fx-kit (particles, shake, flash, popups, sky ramp, parallax, silhouette strips), docs-kit (mustache-lite engine, README/HOW-TO-PLAY/HOW-IT-WAS-MADE/Pages generator, CLI that ingests swarm reports and screenshots). Examples in `src/kits/examples/` (Colby/Pete rigs, PawFall jungle theme, art+fx sheet, docs config). Docs: `docs/KITS.md`, rows in `docs/FACTORY-TOOLS.md` and `README.md`. `bin/factory`: `--web` now copies `src/kits` and `docs/KITS.md`.

## Verification evidence
`node --test test/kits/*.test.mjs`: 20 pass, 0 fail. Scaffolded a throwaway game with `factory new --web` (in /datanapps), ran kit + template tests there: 21 pass. All examples ran; viewed the Colby/Pete sheet PNG; docs CLI generated 4 files.

## Deviations from the contract
Did not read src/ui or src/main.js (per orchestrator); docs-kit is generic. `bin/factory` test copy changed to `cp -r` (needed because test/kits is a directory).

## Mistakes I made and how I fixed them
Template engine `{{.}}` returned the whole context for primitive list items; fixed. A parallax test expectation ignored Math.round(-2.5) = -2.

## Learnings for a future agent
Node here is v26; `process.getBuiltinModule('node:zlib')` keeps PNG encoding import-free for the browser. Seeded LCG everywhere keeps kit output deterministic.

## Requests for other modules
Template `package.json` `test` script only globs `test/*.test.mjs`; change to `node --test test/*.test.mjs test/kits/*.test.mjs` (not my file). Audio-kit live `scheduleSong` plays tones only (no drums); PawFall's music.js has the full live player. Docs-kit screenshots/reports should be regenerated once ui-shell/qa-bot finish.

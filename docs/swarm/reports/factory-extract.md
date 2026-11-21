# factory-extract report

## What I built
In `~/src/fun/game-factory/templates/web-project/`: `src/lib/platformer-physics.js`, `hazard-kit.js`, `world-gen.js` (with `validateWorld` fairness validator), `autopilot-kit.js`, `index.js`, `README.md`, `examples/` (jungle-rules.mjs, hazards-and-physics.mjs); `test/lib/*.test.mjs` (4 files, 42 tests); package.json test glob now includes `test/lib/*.test.mjs`; `bin/factory` copies `src/lib` for `--web` (one appended `cp`, re-read before editing). Docs: `docs/LEARNINGS-PAWFALL.md`, rows in `docs/FACTORY-TOOLS.md`, README table. PawFall itself untouched.

## Verification evidence
- `node --test test/lib/*.test.mjs`: 42 pass, 0 fail.
- `factory new /datanapps/claude-tmp/fnew T --web` then `npm test`: 63 pass (kits + lib + smoke), lib copied.
- Both examples run (world validates ok; croc pit death emitted).
- Mutation checks: flipped cycler open/closed, runSpeed, gap check, one-way landing condition, seed streams. Two initially survived (one-way platform from below; per-screen seed); I added tests, both now fail the mutation.

## Deviations from the contract
- autopilot-kit is a generic extraction (trajectory, robust macro search, watchdog, humaniser, glue), not a move of `src/sim/autopilot.js`: that file mirrors PawFall's player rules and qa-bot is still tuning it, so it was neither read as a dependency nor changed.
- world-gen does not build pits itself; games add pits/zones in a slot `build()` hook so pit kinds stay game specific.
- Multi-floor (surface/tunnel) is modelled by swapping the world object / `groundY` on the `climbEnd` event rather than a built-in layer system.

## Mistakes I made and how I fixed them
- Ladder test assumed the ladder top was floor; the engine snapped to `groundY`. Rewrote it with the floor swap on `climbEnd`.
- `lerpVal` produced wrong ramps for `{base, perT}`; fixed and tested.
- `generateWorld` returned the rules (functions) so `structuredClone` of a world threw; it now returns plain data.
- A comment containing `Math.random` tripped my own source-scan test; reworded.

## Learnings for a future agent
Fairness predicates should be built from `jumpRange(cfg)` so physics retuning can never desync from generation. A hazard cooldown (`st.hitT`) is needed for `lethal:'points'` or a roller re-hits every tick.

## Requests for other modules
None. (qa-bot: when autopilot.js settles, its state-mirror pieces could adopt `searchMacros`/`makeWatchdog`.)

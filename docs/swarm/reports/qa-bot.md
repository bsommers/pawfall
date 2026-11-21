# qa-bot report

## What I built
- `src/sim/autopilot.js`: `createAutopilot(game, {skill})` returns `{ input(g, dt), stats }`; `input` gives `{dx,dy,jump,jumpPressed}` per fixed step.
  - Look-ahead by simulation: each tick the current screen's entities are cloned and stepped with the real `HAZARDS[kind].update` (plus Pete's 4 s cheese timer), and a small mirror of `player.js` physics scores macros (run n then jump, wait n then jump/run, jump straight up). A cheap reflex policy (hop pit edge / obstacle about to be touched) keeps single-obstacle screens search-free; the full search only runs when that policy predicts a hit.
  - Exact vine planner for every vine/croc pit: brute-forces (jump tick, release tick) against the real `vineTip`, grab radius, swing blend and croc contacts, picks the most robust cell, and executes by vine-clock stamps.
  - Holes: jumps them (all world holes are w=28); if it ever falls into one it walks to `ladderX`, climbs, and jumps out from the ladder top.
  - Route: one lap in +x direction; turns back only for a treasure it ran past on the same screen (no pit between). Greedy collection is implicit (treasures lie on the path).
  - `skill<1`: deterministic late take-offs (own mulberry-style generator, never the game rng); watchdog flails if no progress for 40 s.
- `tools/botplay.mjs` rewritten: full headless 120-screen run per seed (`--seeds --skill --maxt --start --need --verbose`), prints treasures/deaths(+screen,x,cause)/time/score, hot spots; exports `runBot`. Exit 1 if a skill=1 bot gets < 28 treasures on more than half of the seeds.
- `test/qa-bot.test.mjs` (8 tests, ~10 s).

## Verification evidence
- `node tools/botplay.mjs --seeds 1..12`: all VICTORY, 32/32, 0 deaths, t=523.9 s of 1200 s, score 103385 (identical per seed: world and sim are seed-independent except Pete's taunt choice). ~1.4 s wall per run.
- Also victory from start screens 30/60/119; skill 0.9 wins, 0.7/0.5/0.2 die in tar/scorpions as intended.
- Per-screen audit (enter each of the 120 screens from the previous one, with idle offsets 0/0.5/1.3/2.9 s to shift vine/croc/cheese phases): 0 deaths, 0 log hits, max crossing 5.9 s. Vine/croc pits (11 in a lap): plan always found, 3 phases each in the tests.
- `node --test test/qa-bot.test.mjs` 8/8 pass; `tools/check-imports.mjs` clean.

## Deviations from the contract
- None to defs/ARCHITECTURE. `createAutopilot` returns an object with `.input()` (as the old botplay used) rather than a bare function. Gate rule is ">= 28 treasures on most seeds" (>50%).

## Mistakes I made and how I fixed them
- First search let "wait" macros hide a pit behind the horizon (idle looked free): switched to distance-based rollouts with a time cost.
- Truncating rollouts after landing made early jumps look safe: replaced with a reflex policy so later obstacles still count.
- Treasure-miss penalty applied equally to all candidates after the bot was past the treasure, making jump and run tie (bot ran off the ladder top into the hole in a loop): penalty now only applies if not yet past.
- Delayed take-offs (skill<1) fought the vine plan state machine (infinite replan): vine jumps are exempt, jitter is added to the plan stamp instead.

## Learnings for a future agent
- Re-using the real hazard `update` functions for prediction makes the bot exact; keep hazards pure (no `g` side effects in `update`) or this breaks.
- Test crossings by entering from the previous screen: starting a game on a Pete screen gives the cheeses a 1.6 s intro head start (not representative).
- All world pits are jumpable/vine; holes are all w=28 so the ladder route is only an emergency path.

## Balance observations (for the orchestrator)
- No impossible screen found. Pete screens with two cheeses (speeds 70/84 spawned together, screens 42/54/66/78) are the tightest: brute force over single-jump timings after a 1.6 s head start finds no clean jump (-100 each); on a normal entry the bot clears them untouched.
- Tunnel scorpions patrol the full tunnel width at 20 px/s and cross the ladder column; a forced drop beside one (screen 2 test) is unavoidable and lethal. Only matters if players use holes deliberately (the ladder route is the only way to use tunnels, and no tunnel shortcut gives value: tunnels skip 3 screens and treasures sit on the surface).
- Whole lap takes ~524 s of the 1200 s clock, so the clock is generous; time bonus ~3385 for a perfect run.

## Requests for other modules
- sim-core/ui: none blocking. If a demo/attract mode is wanted, `createAutopilot(g,{skill:1}).input(g, dt)` can drive `g.update` directly.
- world-gen: optional, stagger the two Pete-screen cheese spawns (different x offsets) if fairness at first contact is wanted.

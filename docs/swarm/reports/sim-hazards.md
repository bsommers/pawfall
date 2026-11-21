# sim-hazards report (2026-11-21T04:46:02Z)

## What I built
- src/sim/hazards.js: HAZARDS (log, stilllog, cheese, fire, snake, croc, scorpion) with init/update; spawnScreenHazards(g, screen); TAUNTS (12 ALL CAPS lines, max 28 chars); updatePete(g, dt, screen) for Pete's 4 s taunt + cheese toss.
- Croc: 3 crocs across the pit at 25/50/75%, phases staggered by crocPeriod/3, closed = solidTop + lethal null, open = lethal 'life' for crocOpenFrac of the period.
- Scorpion: patrols tunnel floor at 20 px/s between wall/edge bounds, reverses at bounds.
- Logs: logs2 = 2 logs 90 px apart, logs3 = 3 logs 70 px apart; roll right to left, wrap at the right edge, speed 46 +-8 by screen idx.
- test/sim-hazards.test.mjs: 14 node:test cases against a fake g.

## Verification evidence
- node --test test/sim-hazards.test.mjs: 14 pass, 0 fail.
- Mutation: croc openStart changed to use 2*openFrac, 1 test failed (red). Restored, 14 pass.
- Taunt length and caps checked in tests; no Math.random in module (source-scan test).

## Deviations from the contract
- defs.js import replaced by local mirror constants (W, LAYOUT subset, TUNING croc values) because defs.js does not parse (see Requests).
- Pete's taunt timer is not an entity; it lives in updatePete (exported), which sim-core must call each tick. The HAZARDS table cannot host it.
- Croc y = surfaceY + 8 so the top sits at surfaceY - 2, per the contract's dims note.
- Scorpion wall: uses screen.under.wall via st.wall. 'L' blocks the left side (x from wallL+wallW), 'R' blocks the right (up to wallR).

## Mistakes I made and how I fixed them
- Test fake defaulted dir to 1, so logs moved right. Fixed the fake.
- A taunt was 29 chars. Shortened it and re-checked the max length (28).
- A log test started at x=10 and wrapped during measurement. Moved the start to x=200.

## Learnings for a future agent
- A "*/" inside a /** */ doc comment ends it early. Use // for inline notes in doc blocks.
- Croc phase: stagger by crocPeriod/3 so the three heads never open together.

## Requests for other modules
- defs.js (FROZEN, orchestrator): line 125 has `x, y /*feet*/` inside a /** */ block, which breaks parsing of the whole module. Change the inner comment to //, or write it without the inner slash-star. Once fixed, hazards.js can import W/LAYOUT/TUNING from defs again.
- sim-core (game.js): call updatePete(g, dt, g.screen) every tick, after the entity updates. Also needs g.rng with pick(), g.bus.emit, g.sfx, and g.spawn(kind, props) returning the entity and honouring props.st, layer, screenIdx, dir, speed.
- sim-core: call HAZARDS[kind].init(e, g) once after spawn (spawnScreenHazards only calls g.spawn).
- render: entity kind 'cheese' gets a thrown look from Pete at the right edge; no new kind added.

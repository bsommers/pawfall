# sim-core report

## What I built
- `src/sim/game.js`: `createGame({seed,bus,screenAt,startScreen,hazards?})` plus `g.update/spawn/hurtPoints/kill/sfx/fx/popup/addScore/snapshot`. States intro (1.6 s) / play / dying / gameover / victory, timer (`timer` event each second), score floor 0, lives, respawn (left edge, surface, `respawnInvuln`, hazards reload), treasure pickup + victory, hazard AABB contacts (`lethal` life/points, optional `HAZARDS[kind].onTouch(e,g,p)===true` to override), music switching (jungle / underground / dusk / gameover / victory), calls `updatePete(g,dt,screen)` from hazards.js each play tick.
- `src/sim/player.js`: modes ground/air/climb/swing/stun/sink/dying/win, pose+frame selection (run frames by distance, climb by rungs), vine grab/swing/release, ladders, tunnel walls + ceiling, pit sinking, ladder-hole drop, croc-head landing/carrying.
- `src/sim/physics.js` (pit/ladder/croc/wall/AABB helpers), `src/sim/screens.js` (wrap, loadScreen, changeScreen +-1 / +-3).
- `test/sim-core.test.mjs`: 38 tests.
- Tuning (defs.js TUNING): jump/run/gravity unchanged (jumpV 205, g 620: air 0.66 s, range 48 px clears 36 px pit with 12 px margin). Vine retuned `{pivotY:30,len:58,amp:0.85,period:2.4}`, `grabR:10` (was 34/62/0.95, grab 7: a 76 px pit was almost uncrossable, hands never meet the tip). Tip sweep +-43.7 px beyond a 76 px pit's +-38. About 20-25 percent of takeoff timings can be crossed with a suitable release.

## Verification evidence
- `node --test test/sim-core.test.mjs`: 38 pass. Full `node --test test/`: only an unrelated audio test (`render gameover: finite, audible...`) failed at my last run.
- Scripted bot crosses a 76 px vine pit (grab, rigid vine distance < 0.01, release, land, no life lost); window test asserts >= 20 percent of takeoffs work; determinism test (1500 random ticks) identical; pose/frame validity fuzz (6000 ticks).
- Mutation checks: sink duration x2 -> `sink duration equals sinkTime` red; disabling left-edge transition -> red; restored, green.
- Scan scripts: `out/vinescan.mjs`, `out/vinesweep.mjs` (parameter search).

## Deviations from the contract
- Hole (`pit.kind==='hole'`) is a safe drop whether or not `ladder` is true; ladder rim (+-6 px around `under.ladderX`) is standable, rest of the hole drops you. Walking in therefore drops before reaching the ladder; climb down needs standing on the rim (after a jump or after climbing up).
- Croc head top = `e.y - e.h` (hazards place crocs at y = surfaceY+8, h 10 => top surfaceY-2).
- Swinging Colby is immune to hazard contact (hands above crocs). Victory bonus is only `timeLeft*timeBonusPerSec` (SCORES.treasureBonusAll not added).
- Time-out: emits `life {lives:0, reason:'time'}` then game over immediately (no dying delay).
- Intro/banner/music events are emitted on the first `update`, not in `createGame`, so late subscribers still get them.
- The brick wall blocks from both sides; arriving next to a wall from the outside leaves a tiny pocket (world-gen should avoid walls where the entry edge is).
- Falling into a ladder hole sets `layer='tunnel'` immediately (while Colby is still at surface height); `p.y` falls to tunnelY.
- `e.t` is not advanced by sim-core: hazards.js advances it itself (the fallback stub does as well).

## Mistakes I made and how I fixed them
- First vine tuning gave zero successful crossings; I wrote a sweep (`out/vinesweep.mjs`) and retuned. My scan script also jumped too late (1.2 px/tick) which looked like a sim bug.
- `pose` was set a tick late after kill/hurt/sink: now set at the transition.
- Croc standing height assumed y-2; real hazards use y+8: fixed to `y - h`.
- Smoke test got hit by a real log while idling; it is legit behaviour.

## Learnings for a future agent
- Hands (top of hitbox) are ~86 px on the ground, so the vine tip must come down near y 80-90 close to the pit edge to be grabbable; check TUNING.vine against the hand geometry before changing it.
- Stamp the animation pose when switching modes, not on the next tick (tests and render read it right away).

## Requests for other modules
- hazards: keep `e.t` self-advanced; crocs at y=surfaceY+8 with h 10 is relied upon (top = y-h).
- world-gen: no tunnel wall on the side where you enter; vine pits up to 76 px wide with grabbable timing; walls 'L'/'R' block both ways.
- render: `g.player.layer==='tunnel'` is true while Colby is still falling through the hole at surface height; clip with y.

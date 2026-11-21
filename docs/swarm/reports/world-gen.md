# world-gen report

## What I built
- `src/levels/gen.js`: pure deterministic generator (createRng-seeded per block/screen). 12-screen blocks: slot deck shuffled per block (3 holes, 3 other pits, 3 plain, 2 rest, Pete at position 6). Difficulty `t = circular distance from 0 / 60` drives hazard kinds, pit widths, vine (t>=0.2) and croc (t>=0.5) pits, so the ramp is symmetric both ways round. Treasures placed after the plan (screens spread around the circle, never 0/Pete, hazards cleared); value by distance rank (12 tuna nearest, 4 collars farthest). Set pieces: croc pit + vine (`tag:'croc-vine'`), `vault` (ladder hole + guarded scorpion tunnel + surface treasure), Pete ambush screens (`pete`, cheese only).
- `src/levels/world.js`: `screenAt`, `WORLD`, `treasureScreens()` (sorted screen indices).
- `tools/validate-level.mjs` (`--map`, `--json`): schema + fairness proofs, vine kinematic simulation, treasure/ratio/ramp/determinism checks, ASCII map.
- `test/world.test.mjs`: 13 tests.

## Verification evidence
- `node tools/validate-level.mjs` -> OK all checks pass. run-jump 47.6 px, max jumpable pit 34; vine pits cross in both directions from 25-29% of vine phases (takeoff at pit edge).
- `node --test test/world.test.mjs`: 13 pass. Mutation: widening narrow pits by 20 px -> tests red and validator FAIL lines; restored -> green.
- `node tools/check-imports.mjs` run as sanity.

## Deviations from the contract
- ScreenDef has an extra `tag` field ('rest'|'hole'|'vault'|'pit'|'vine'|'croc-vine'|'plain'|'pete') for the map/art; ignore if unused.
- `treasureScreens()` returns sorted screen indices.
- Hole pits are 28 px wide (jumpable, so the surface route is always open); narrow pits 24-34; croc pits always carry a vine (crossing on croc heads is optional, not proven).
- Vine proof is my own kinematic model of the §4 rules (grab radius, rigid swing, tangential release); sim-core's exact swing may differ slightly.
- Scorpion screens ~42% (i%3==2 plus vaults) rather than exactly 1/3.

## Mistakes I made and how I fixed them
- First obstacle-gap check measured from the clearance zone instead of the screen edge, giving false FAILs; now measured from the edge with a 24 px landing gap.

## Learnings for a future agent
- Tunnel interior is 44 px high but a jump needs ~52 px (34 apex + 18 hitbox): a tunnel scorpion cannot be jumped unless sim caps the jump; hence tunnels are optional shortcuts and surfaces are always crossable on their own.
- Keep rolling hazards off deadly-pit screens and off lethal-static screens (knock-back into fire/pit).

## Requests for other modules
- sim-core: confirm vine grab/release matches the model in `vineCrossFraction`; tunnel player entering at an edge may face a wall on that side (can always reverse).
- sim-hazards: scorpion patrol should be constrained so tunnel screens stay passable (x >= 48 spawn; patrol between walls).
- render: use `tag`/`mood` freely; `pit.x0` may be odd (centre = x0 + w/2).

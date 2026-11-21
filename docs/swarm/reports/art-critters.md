# art-critters report

## What I built
`src/art/critters.js`: 12 sprites (log x4, stilllog, cheese x4, fire x3, snake x3, scorpion x2, croc x2, 4 treasures x3 shimmer, cheese_thrown x2). All PixBuf, PAL-only, 1px outline, art inside a 1px margin so the bottom row is the feet/waterline row.
- Croc closed: low, flat top, sealed mouth line, side eye. Open: tall hinge, raised upper jaw, pink mouth, white teeth.
- Treasures: tuna = upright round tin with pink label, sardine = flat wide silver tin with key, gold = ingot pyramid, collar = hollow ring with gem. Shimmer = white sparkle crosses on frames 1 and 2.

## Verification evidence
`node tools/sheet.mjs critters --scale 6` prints OK (build ~8 ms); previews viewed twice. `node --test test/art-critters.test.mjs`: 5 pass (manifest, determinism + <400 ms, bottom-row anchoring and no clipping, croc open taller than closed, frames differ, treasure silhouettes distinct).

## Deviations from the contract
None. Hazard sprite bottoms are the outline row (feet at frame bottom).

## Mistakes I made and how I fixed them
Gold first drawn as an I-beam shape (top bar wider than middle); reshaped into a pyramid. Collar ring enlarged for readability.

## Learnings for a future agent
PixBuf.outline only paints on transparent pixels, so keep art inside a 1px margin. Not yet seen in-game against PAL.path / tunnel; scorpion is the smallest/lowest-contrast sprite.

## Requests for other modules
Renderer: draw hazards anchored bottom-centre; croc frame 0 closed / 1 open. Wished-for palette colour: a lighter tunnel-visible scorpion/outline colour (e.g. a pale outline for dark backgrounds).

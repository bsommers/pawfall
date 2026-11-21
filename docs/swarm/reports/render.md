# render report

## What I built
- `src/art/registry.js`: `buildAll(opts) -> { get, size, frames, names, pix, has, bbox, tint, version, ready, missing, errors, loaded }`. Returns IMMEDIATELY with coloured placeholders for every ART row (plus any unknown name), then fills in real modules (colby, critters, world, fx) via dynamic import. Missing or throwing modules are recorded and keep their placeholders. Canvas identity is stable, so anything that cached a canvas early upgrades in place. `art.version` bumps on every install. `forcePix: true` or no DOM returns PixBufs. `art.tint(name, frame, hex)` makes a cached recoloured sprite, used for the sun/moon disc.
- `src/render/background.js`: 7-band sky from `skyFor`, sun that sets behind the mountains, moon that rises, twinkling stars, drifting clouds, mountains (0.15x), far trees (0.3x), far canopy (0.5x), mood washes, night/dusk overlay, fireflies. Parallax uses an unwrapped screen index, and tile widths divide the full 120-screen lap, so layers line up across flips and across the world wrap.
- `src/render/scene.js`: cached per-screen static layer (trunks, canopy, decor, path, pit gap and depth, tunnel ceiling/interior/floor, brick wall), animated liquid, ladder, bats, Pete sign, Pete on his branch, treasure shimmer, vine (rope, pivot stub, knot, with the hand attached while swinging), entities (shadows, fire glow, croc top-anchored to its solid top), Colby (blink, mirror, shadow, sink clip at the pit surface), foreground leaf strips that sway, and `drawScreenStatic(ctx, art, screen, t, opts)`.
- `src/render/particles.js`: bus-driven splash/tarsplat/dust/sparkle/stars/bubble/poof/confetti, popups (via font.js), treasure glints, ambient falling leaves. It uses a local LCG and expires on sim time.
- `src/render/crt.js`: scanlines, rolling band and cached vignette on the output canvas after the integer upscale.
- `src/render/renderer.js`: `createRenderer(canvas, { bus, art, settings, createCanvas?, size?, now? })` returns `{ draw, resize, setCRT, shot, hud, overlay, buffer, viewport, particles, cache, dispose }`. It does a 0.25 s eased slide on screen change (tunnel strides interpolate parallax smoothly), screen shake from the `shake` event, and Pete's throw pose on `taunt`. The HUD strip is cleared to black, then the hud callback, then the overlay callback.
- `test/render.test.mjs` (16 tests) and `test/render-harness.mjs` (PixBuf-backed 2D-context shim plus `fakeGame`/`fakeScreen`).

## Verification evidence
- `node --test test/render.test.mjs`: 16 pass, 0 fail. That includes an integration test with the real sim, world and art, running 20 s and rendering every other frame.
- `node tools/check-imports.mjs`: 0 errors.
- Looked at software-rendered PNGs (`out/render_a_*.png`, `out/render_b_*.png`: day, dusk, night, hole, tar, croc, vine, Pete screen) and headless-Chrome shots of `out/render-demo.html` (`out/shot_demo1.png` with CRT at 4x, `out/shot_demo2.png`). There were no console errors.
- Placeholder-only art (no modules) draws every pit kind and mood.

## Deviations from the contract
- `buildAll()` is synchronous and returns the registry with an `art.ready` promise. Real art arrives asynchronously, so main.js should `await art.ready` before starting the game.
- The CRT runs on the output canvas, so the HUD is scanlined too. The spec ordered it before the HUD callback.
- The renderer's clock is `game.t`, with a 0.75 s wall-clock cap on slides. `createRenderer` also accepts `createCanvas`, `size: {w,h,dpr}` and `now` for tests.
- `resize()` also sets the canvas inline style width/height. style.css has `aspect-ratio:16/9` and `width:100%`, which would otherwise stretch the picture.
- Added an exported `ART_MODULES` list in the registry, because defs.js has none.

## Mistakes I made and how I fixed them
- My preview script reused one renderer with a constant `game.t`, so the slide transition never finished and screens looked wrong. The script now steps time.
- The sun was hidden behind the canopy. I moved it into the visible sky band.
- `strip()` squashed partial-height tiles. It now crops the source rows instead.
- The hole pit left a 4 px gap in the ceiling band. Fixed.
- The far-canopy strip bled into the HUD area. Fixed with a black HUD fill.
- My first sky test sampled a pixel under the canopy. It now tests `drawSkyBands` directly.

## Learnings for a future agent
- Pixel-art layers tile seamlessly only when `W*factor*120` is a multiple of the tile width (times the variant count).
- A shim 2D context that supports only `translate`, `scale(+-1)`, rect clip and `lighter` is enough to render the whole game to PNG in Node.
- The `shot.mjs` static server serves the repo root, so a demo page in `out/` works for browser checks without main.js.

## Requests for other modules
- ui-shell: `await art.ready` before starting; set `renderer.hud = (ctx, game) => ...` and `renderer.overlay = (ctx) => ...`; call `renderer.resize()` on window resize (the renderer also listens itself). Sim passes `game.timeLeft` and `game.t`, which render uses for sky and clock.
- sim-core: emit `screen`, `shake` and `taunt` as in the contract. During `sink`, keep feet y increasing past `surfaceY` (render clips there).
- sim-hazards: croc entities need `e.h` (default 10). Render draws the croc sprite top at `e.y - e.h`.
- art fx module: not present when I tested, so splash/dust/sparkle/leaf sprites are placeholders.

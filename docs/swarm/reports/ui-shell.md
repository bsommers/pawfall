# ui-shell report

## What I built
- `src/core/input.js`: keyboard (arrows/WASD move+climb, Space/Z/X jump), gamepad, virtual touch state; latched `jumpPressed` edge; UI action stream (`input.on`).
- `src/main.js`: dynamic imports with fallbacks (page boots even if modules are missing; placeholder renderer + on-screen "missing" list), fixed 1/60 loop (max 5 steps), pause/mute/CRT/fullscreen, settings persistence, query params `autostart screen seed bot time nosound touch manual`, `window.__pawfall = {game, renderer, bus, step(n), setInput, start, ui, ...}`.
- `src/ui/hud.js`: Pitfall strip (score, lives icons, treasure n/32, MM:SS, red pulse < 60 s), Pete taunt banner, centre banners, score/treasure/life flashes.
- `src/ui/screens.js`: title (logo, attract game behind it, menu, hi-score phase cycling), how-to, options, pause, game over, victory (tally, confetti, Colby/Pete/treasure pile), 3-letter name entry, hi-score table via `core/settings.js`.
- `src/ui/menus.js` widgets, `src/ui/touch.js` DOM d-pad + jump + pause, `style.css`, `index.html`.

## Verification evidence
- `node --test test/ui-shell.test.mjs`: 16 pass, 0 fail. `tools/check-imports.mjs`: 0 errors.
- Headless Chrome (`tools/shot.mjs`): title, play HUD, name entry, victory screens viewed (out/shots/ui-*.png); real Space key starts a game; `?bot=1&time=45` and `p` pause work; no console errors (only the expected 404 for the absent autopilot).

## Deviations from the contract
- Up does not jump (classic: Up/Down climb only; jump = Space/Z/X).
- On the title the renderer's black HUD strip is reused for "HI score / 1 PLAYER".
- Attract game uses a filtered bus (visual events only) so it never plays sound or fires HUD banners.

## Mistakes I made and how I fixed them
- HUD events stamped with a stale game clock (clock restarts per game): events now stamp their start on the next draw.
- Layout overlapped the HUD strip; moved end/howto screens below y=18. Test-only misuse (menu index) fixed.

## Learnings for a future agent
- Poll input once per frame and carry the jump edge until a sim step consumes it (high-refresh displays may run zero steps in a frame).
- Autopilot hook is guessed: `createAutopilot(game)` / `createBot` / default export returning a function or an object with `input|think|step|decide(game, dt) -> {dx,dy,jump,jumpPressed}`.

## Requests for other modules
- render: option to skip the black HUD strip (e.g. `renderer.hudStrip = false`) on the title; `renderer.draw(null)` returns before calling `overlay`.
- qa-bot: export `createAutopilot(game)` per the hook above.

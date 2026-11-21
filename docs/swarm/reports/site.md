# site report

## What I built
- `docs/site/index.html`: single static page, inline CSS, pixel-jungle palette from `defs.PAL`. Sections: hero (title screenshot, Play now to `play/`, stats), screens gallery (figure blocks, GIF-ready), how to play (controls table, Pitfall rules), characters (Colby, Pete), swarm story (counts plus phase cards), tech notes, footer.
- Swarm counts are static in the HTML and are replaced at load from `../../.tracker/plan.json` when that file is reachable.
- `docs/site/favicon.svg`: 16x16 pixel cat face in the game palette.
- `docs/site/.nojekyll`: empty marker so Pages serves the files as-is.
- `docs/HOW-TO-PLAY.md`, `docs/HOW-IT-WAS-MADE.md`, `README.md` (rewritten).
- `test/site.test.mjs`: local asset links resolve inside `docs/site`, no absolute paths, `.nojekyll` present, static swarm counts match `.tracker/plan.json`.

## Verification evidence
- `node --test test/site.test.mjs`: 3 pass, 0 fail.
- Headless Chrome screenshots (desktop 1280 wide, mobile 390 wide) in `out/site/page-desktop.png` and `out/site/page-mobile.png`. Layout holds at phone width with no horizontal scroll. Press Start 2P loads from Google Fonts.
- Controls and rules were checked against ARCHITECTURE.md §10 and defs.js (START_SCORE 2000, START_LIVES 3, WORLD_SCREENS 120, TREASURE_COUNT 32, TUNNEL_STRIDE 3).

## Deviations from the contract
- Theme follows the game's pixel-jungle look, not the skill's default obsidian and neon grid. The user brief set the look.
- The skill suggests `assets/` and `diagrams/` paths. This site uses `img/` and `favicon.svg` next to `index.html`, as the brief asks.
- Repository links are `#repo-url` placeholders. The repo URL is not in the project (no remote readable without git), so it must be filled in.

## Mistakes I made and how I fixed them
- My first test regex picked up `img/gameplay-jump.gif` from an HTML comment that documents how to add GIFs. The test now strips comments before scanning.
- A sed attempt on the swarm link left awkward text. I removed that text.

## Learnings for a future agent
- Pages serves `docs/site/` only if the Pages source is set to that folder or it is copied to the deploy root. A relative `play/` link needs the game built into `docs/site/play/`. Nothing builds that yet.
- The `../../.tracker/plan.json` fetch only works when served from the repo root. It is a local-dev nicety; the static numbers are the real fallback.

## Requests for other modules
- Build step or deploy job: copy the game (`index.html`, `style.css`, `src/`) into `docs/site/play/` so the "Play now" button works on Pages. Owner: whoever owns deploy tooling.
- Repo URL: needed for the `#repo-url` links in `docs/site/index.html`.
- Gameplay GIFs: drop into `docs/site/img/` and add a `<figure>` at the gallery's marked comment.

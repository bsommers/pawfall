# Swarm manifest — PawFall

Single source of truth for the agent swarm. `node tools/swarm-tracker/bin/swarm-plan.mjs` turns this file into
`docs/swarm/prompts/<id>.md` (preamble + task + role appendix) and `.tracker/plan.json`.
Agent header: `## id | model | phase | role | Name`, then an `owns:` line, then the task.
Spawn each agent with: "Read {{root}}/docs/swarm/prompts/<id>.md and execute it exactly."

## @meta
project: PawFall
tagline: Colby the orange cat vs Perring Parkway Pete — a blocky Pitfall! parody, built by an agent swarm

## @preamble
You are subagent `{{id}}` ({{name}}) in a parallel swarm building **PawFall** (a Pitfall! parody starring Colby, an orange tabby jungle explorer, vs. villain Perring Parkway Pete the rat) in `{{root}}`. Model tier: {{model}}.

Rules:
1. `ARCHITECTURE.md` and `src/core/defs.js` are the binding contract. Read `ARCHITECTURE.md` §1, §2 and the sections your task needs (list headings with `grep -n '^## ' ARCHITECTURE.md`, Read with offset/limit), and grep `defs.js` instead of reading it whole (except for the parts you need: your ART rows, LAYOUT, PAL, TUNING).
2. You own ONLY: {{owns}}. Besides those you may write your tests under `test/<id>*.test.mjs`, your report, and scratch output under `out/`.
   Other agents are writing other modules **right now**: their files may be missing or half-written. Code against the contract, guard with fallbacks, never edit a file you do not own; list what you need under "Requests" in your report.
3. Progress reporting (drives a live dashboard): first `node tools/swarm-tracker/bin/track.mjs {{id}} start "<plan in a few words>"`; then `track.mjs {{id}} progress <pct> "<what just landed>"` at 4 or more milestones; finally `track.mjs {{id}} done "<one-line result>"` (or `blocked` / `failed` with the reason). Run from {{root}}.
4. Verify for real before claiming done: run it, test it, look at it. Report failures honestly.
5. If you must wait for another agent's file, poll (`for i in $(seq 90); do [ -f <path> ] && break; sleep 10; done`), then proceed with a fallback if it still is not there.
6. Finish by writing `docs/swarm/reports/{{id}}.md` with sections: **What I built** · **Verification evidence** · **Deviations from the contract** · **Mistakes I made and how I fixed them** · **Learnings for a future agent** · **Requests for other modules**. Report shared-library defects (pixbuf.js, font.js, defs.js...) here too, do not only work around them.
7. Keep chat output minimal (status lines only). Final reply: 8 lines max.
8. Save work to disk early and often; the swarm can be interrupted by usage limits. If your owned files already exist, you are RESUMING: inspect them and continue instead of starting over.
9. Install no new dependencies (Node 22+, zero deps). No git commands. Never kill processes you did not start. Never use `/tmp` — scratch goes to `out/` or `/datanapps/claude-tmp`.
10. Context budget — your whole context is re-sent on every tool call, so keep it small: read files with offset/limit or grep, never whole large files; pipe command output through `tail`/`grep` (40 lines max); look at an image only when you will act on it (about 6 in total; prefer numeric checks); never re-read a file you just wrote.
11. Checkpoints — keep `docs/swarm/progress/{{id}}.md` (30 lines max: **Done** · **Next steps, in order** · **Gotchas** · **Commands to verify**) and update it at every milestone. If it exists when you start, you are a fresh agent continuing the job: read it first, trust it, do not re-derive. After about 25 tool calls, or at a milestone with substantial work left, update the checkpoint and END your turn with a last line `CONTINUE: <next step>`. Only write the report and call `track.mjs ... done` when the whole task is finished.
12. Stamp times with `date -u`; never type a timestamp.
13. Reference implementations from sibling games live in `/home/bill/src/fun/catxzzon/` (same pixbuf/font/audio/sim patterns) — read-only, use as inspiration; the PawFall contract wins on any disagreement.
14. Quality bar: the user wants to be wowed. Charm, readable blocky pixel art, juicy feedback. But the contract comes first.

Your task:

## @role:art
Role appendix (art): PixBuf-only, deterministic, palette from `defs.PAL`. Characters get a 1px `PAL.outline`. Run `node tools/sheet.mjs <module> --scale 6`, then LOOK at `out/previews/<module>.png` (and again after fixing) and measure opaque bounding boxes numerically (feet at the bottom row of the frame, nothing clipped, nothing floating). The sheet tool must print `OK`. Add `test/<id>.test.mjs` asserting manifest conformance, determinism (build twice = same bytes) and build time < 400 ms. Add a short note to your report on any palette colour you wished existed.

## @role:sim
Role appendix (sim): pure Node-safe simulation, fixed step, deterministic. Never `Math.random` (use `createRng`). Write unit tests (node:test) for every rule in your section of ARCHITECTURE §4/§5 and mutation-check at least one (break the code, see red).

## @role:audio
Role appendix (audio): one pure-JS synthesis description drives BOTH live WebAudio and offline PCM rendering. No clicks (short attack/release), peak <= 1.0, RMS sensible, durations as listed. Provide the wav-render tool script. Judge the sound by numbers (peak/RMS/length/spectral centroid) and by listening-proxy sanity checks in tests (no NaN, no silence, no clipping).

## @role:tools
Role appendix (tools): general-purpose, reusable infrastructure that must also work for future games. Changes to `~/src/fun/game-factory` are allowed ONLY for the files named in your task; keep them backwards compatible.

## sim-core | sonnet | p1 | sim | Core simulation (player, physics, screens, rules)
owns: src/sim/game.js, src/sim/player.js, src/sim/physics.js, src/sim/screens.js, test/sim-core.test.mjs, (TUNING numbers in src/core/defs.js)
Implement ARCHITECTURE §4 completely: `createGame`, the player state machine (ground/air/climb/swing/stun/sink/dying/win), pose+frame selection, surface and tunnel physics, edge transitions (±1 surface, ±3 tunnel, circular world), pits (hole/tar/quick/water/croc), vine swinging with `vineTip`, ladders, brick walls, treasure pickup + victory, timer, score, lives, intro/dying/respawn/gameover states, events, determinism. Hazards come from `src/sim/hazards.js` (owned by sim-hazards, may not exist yet): import `{ HAZARDS, spawnScreenHazards }` dynamically-safe — write a tiny fallback stub in `game.js` if the import fails so you can test without it. `screenAt` is injected; for tests build your own tiny fake worlds (one pit, one vine pit, one ladder). Tune `TUNING` so that a straight run-jump clears a 36px pit with margin and the vine can carry Colby across a 76px pit; document your tuned numbers in the report. A real test: scripted input crosses a vine pit.

## sim-hazards | haiku | p1 | sim | Hazard behaviours
owns: src/sim/hazards.js, test/sim-hazards.test.mjs
Implement ARCHITECTURE §5: `HAZARDS` behaviours and `spawnScreenHazards(g, screen)`, the Pete ambush taunts (`TAUNTS`: 12 funny cat-vs-rat lines, ALL CAPS, <= 28 chars, e.g. "NICE TRY, FUR-BALL!", "THE PICKLES ARE MINE!" — original, no real brands), croc phase staggering, scorpion patrol. Test against a fake `g` object (spawn/kill/hurtPoints/sfx/fx/popup recorded) — no dependency on game.js.

## world-gen | sonnet | p1 | sim | World generator + level validator
owns: src/levels/world.js, src/levels/gen.js, tools/validate-level.mjs, test/world.test.mjs
Implement ARCHITECTURE §6 (`screenAt`, `WORLD`, `treasureScreens`) and `tools/validate-level.mjs` proving fairness (see §6) for all 120 screens in both travel directions, with the jump/vine/croc ranges taken from `defs.TUNING` (run-jump range = runSpeed * 2 * jumpV / gravity). Make the jungle feel varied and *designed*: a gentle difficulty ramp away from screen 0 (symmetrical), rest screens, set-piece screens (a vine over a croc pit; a ladder hole with a treasure underground side-path guarded by a scorpion -- keep treasures on the surface as the contract says), Pete's ambush screens every ~12. Print an ASCII map of the world (`node tools/validate-level.mjs --map`) with symbols per pit/hazard/treasure.

## art-colby | sonnet | p1 | art | Art: Colby + Pete
owns: src/art/colby.js, test/art-colby.test.mjs
Implement the `colby` module of the ART manifest (hero, all poses, life icon, Pete in three sizes). Colby must be adorable and instantly readable at 1x: this is the face of the game. Pete must read as a smug mob-boss rat (fat, shades, gold tooth, pinstripes, cheese stick). Build with a small helper that draws a base body once and varies limbs per frame so the animation is consistent. Iterate on the look at least twice by viewing the sheet.

## render | sonnet | p1 | gfx | Renderer, registry, parallax, particles, CRT
owns: src/render/renderer.js, src/render/scene.js, src/render/background.js, src/render/particles.js, src/render/crt.js, src/art/registry.js, test/render.test.mjs
Implement ARCHITECTURE §7.2/§7.3. Art modules (colby, critters, world, fx) are being written in parallel: `registry.js` must build whatever modules exist, and the renderer must fall back to simple coloured rectangles for any missing sprite name so the game is always drawable. Until sim-core exists, develop against a fake `game` object (write `tools/fakegame.mjs`-style helper inside your tests or `out/`). The sky/night/dusk cycle, parallax layers that line up across screen flips, screen slide transitions, foreground leaves, croc/vine/ladder drawing, sink clipping, particles (listening to the bus), and a CRT pass are the "wow". Provide `node tools/shot.mjs`-compatible hooks: expose `window.__pawfall` as in §10 only from main.js (ui-shell) — you just export clean functions. Use headless Chrome via tools/shot.mjs to look at your output a few times once main.js exists; before that, render to PNG in Node using PixBuf-based software fallback (`drawScreenStatic` can target a PixBuf-backed 2D context shim you write under test/).

## art-world | sonnet | p2 | art | Art: jungle scenery
owns: src/art/world.js, test/art-world.test.mjs
Implement the `world` module of the ART manifest. The trunks/canopy/mountains/tree-lines must look rich in just the `PAL` colours (dither between ramp tones; blocky leaf clusters; bark ridges). Tiles must be seamless (check by tiling 3x3 in a test and comparing edges). `fg_leaf` should be dark, silhouette-like. `sign_pete` is a comic roadside billboard with a pickle jar and Pete's grin (text via tiny pixel letters you draw yourself or `src/ui/font.js`).

## art-critters | sonnet | p2 | art | Art: hazards + treasures
owns: src/art/critters.js, test/art-critters.test.mjs
Implement the `critters` module: logs (with rings), cheese wheels (Pete's!), fire, cobra, scorpion, croc heads (closed vs open mouth must be unmistakable), shiny treasures with 3 shimmer frames each (distinct silhouettes so the 4 types are readable at 1x), thrown cheese. Hazards must be readable against the jungle path colour (`PAL.path`) and the dark tunnel.

## art-fx | sonnet | p2 | art | Art: FX, logo, UI sprites
owns: src/art/fx.js, test/art-fx.test.mjs
Implement the `fx` module: particle sprites, the PAWFALL logo (224x56: chunky 3D-extruded letters, orange->yellow with a dark outline and a paw-print counter in the A; vine/leaf trim), `title_scene` (320x110 jungle silhouette scene with a tiny Colby swinging on a vine in front of a big sun/moon and mountains), cursor paw, touch button base. You may draw the logo letters from your own chunky block-font data.

## audio-sfx | haiku | p2 | audio | Sound effects
owns: src/audio/sfx.js, src/audio/audio.js, tools/sfx-wav.mjs, test/audio-sfx.test.mjs
Implement ARCHITECTURE §9 for SFX: every name in `defs.SFX` as a recipe of voices (see `/home/bill/src/fun/catxzzon/src/audio/sfx.js` for the pattern: `describe/schedule/renderSfx/stats`); `createAudio(bus, settings)` live engine wired to the bus; keep `tools/sfx-wav.mjs` working (it is already in the repo; adjust only if the API differs). Make them charming: `jump` a bouncy blip, `treasure` a sparkly ascending arpeggio, `treasure_big` longer, `log_hit` a woody thud, `splash`, `tar_glug`, `croc_snap` a chomp, `pete_laugh` a descending "heh heh heh" square-wave sequence, `die` a falling wobble, `swing_grab`, `tick_low` clock tick, etc.

## audio-music | sonnet | p2 | audio | Music
owns: src/audio/music.js, tools/music-wav.mjs, test/audio-music.test.mjs
Implement ARCHITECTURE §9 for music: `createMusic`, `renderMusic`, `MUSIC_NAMES` with the six tracks (title, jungle, underground, dusk, gameover, victory), a tiny tracker/sequencer data format (patterns of notes per channel: lead square, harmony pulse, triangle bass, noise drums), looping with seamless loop points, tempo/key as in ARCHITECTURE. Write `tools/music-wav.mjs` (like sfx-wav) that writes `out/music/<name>.wav` and prints length/peak/RMS. Make the jungle theme *catchy*: bouncy, tropical, with a cheeky 'Pete' bass motif at the end of the phrase.

## ui-shell | sonnet | p2 | ui | Shell: main loop, input, HUD, screens, touch
owns: src/main.js, index.html, style.css, src/core/input.js, src/ui/hud.js, src/ui/screens.js, src/ui/menus.js, src/ui/touch.js, test/ui-shell.test.mjs
Implement ARCHITECTURE §10. Everything else may not exist yet: import modules with graceful fallbacks (try/catch around dynamic imports in main.js so the page boots even when a module is missing, showing a placeholder). The HUD/title/gameover/victory screens must look great in the pixel font. Include a hi-score table with 3-letter name entry persisted in localStorage via `core/settings.js`, and an attract mode on the title screen (the autopilot, `src/sim/autopilot.js`, is written later by qa-bot — import it optionally; until then the title scene art only). `?autostart=1`, `?screen=N`, `?time=S`, `?bot=1`, `?nosound=1` params and `window.__pawfall`.

## tracker-media | sonnet | p2 | tools | Tracker: media panel + factory sync
owns: tools/swarm-tracker/dashboard/index.html, tools/swarm-tracker/dashboard/server.mjs, ~/src/fun/game-factory/swarm/dashboard/index.html, ~/src/fun/game-factory/swarm/dashboard/server.mjs, ~/src/fun/game-factory/docs/FACTORY-TOOLS.md
Extend the existing swarm tracker (already has timeline/Gantt, agents, models, feed, gallery) with a **Media** section that shows everything being created: art sheets (existing gallery), a new **Audio** list (every `out/sfx/*.wav` and `out/music/*.wav` with an HTML audio player, duration, and a tiny waveform drawn from the wav file bytes server-side as a downsampled peak array via a new `/api/wav-peaks?f=` endpoint), and a **Media totals** strip (sprites built, frames, sfx count, music tracks, screenshots, GIFs). Also a phase-progress bar row (phases from plan.json with done/total agents). Follow the existing code style; the server must keep serving `out/` and `dist/`. Test with the live tracker on port 4780 (already running; reload the page via headless `tools/shot.mjs --url http://127.0.0.1:4780/ --out out/shots/tracker.png`). Then copy the finished dashboard files back into the factory paths above and add a FACTORY-TOOLS.md line. Never break `?poll`.

## qa-bot | sonnet | p3 | qa | Autopilot + botplay + soak tuning
owns: src/sim/autopilot.js, tools/botplay.mjs, test/qa-bot.test.mjs
Needs sim-core, sim-hazards, world-gen to exist (poll for `src/sim/game.js`, `src/sim/hazards.js` and `src/levels/world.js`). Write `createAutopilot(game, {skill})` returning `input` each step: runs, jumps logs/fire/snake with look-ahead, uses vines and ladders/tunnels as needed, hops croc heads when closed, collects treasures (a greedy route over the circular world), and plays the 120-screen world to the end. Rewrite `tools/botplay.mjs` (the copied one targets another game) to run the full game headless over seeds and report treasures/deaths/time/score; exit 1 if a skill=1 bot cannot collect >= 28 treasures in the time limit on most seeds. Report concrete balance problems (impossible screens, unfair hazards) to the orchestrator in your report and fix tuning only in files you own; list requests for other owners.

## site | haiku | p4 | docs | GitHub Pages site + docs
owns: docs/site/index.html, docs/site/favicon.svg, docs/HOW-TO-PLAY.md, docs/HOW-IT-WAS-MADE.md, README.md
Needs the final screenshots (`out/shots/*.png`, copied into `docs/site/img/`; list them first). Build a showcase page matching the game's pixel-jungle look (single static HTML + CSS, no build): hero with the logo/screenshots, "Play now" button to `play/`, how to play (controls, Pitfall rules), the characters (Colby vs Pete), the swarm story (agents, models, counts from `.tracker/plan.json` and `docs/swarm/reports`), tech notes, link to the repo. Follow the skill `building-github-pages-sites` conventions. README with badges-free clean sections, controls, dev commands.

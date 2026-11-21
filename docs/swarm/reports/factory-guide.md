# factory-guide report

## What I built
In `~/src/fun/game-factory`: `skills/` (15 skill files, generated `INDEX.json`, Claude Code layout under `skills/claude/.claude/skills/<name>/SKILL.md`), `factory-core/guide/{index,capabilities,cli}.mjs`, `test/guide/guide.test.mjs`, `docs/GUIDE.md`. Capabilities `guide.route/plan/check/explain/skills/show/install/index` in core format; `registerGuide(registry)` accepts array, Map or `{register}`. Router scores skills deterministically and also returns capabilities, kits, style presets (via `styles.recommend`) and assets (offline `registry.search`, optional `context.registryHome`), model tier per step (budget aware), commands, a text rendering, and an optional re-rank hook (`setReranker`).

## Verification evidence
`node --test test/guide/`: 43 pass; whole `test/` 107 pass. 20 golden routing cases, plan manifest fed to the real `swarm-plan.mjs`, check fixtures, install conflict safety, seed library (`pawfall-assets`) asset routing. Mutation check: zeroing keyword weight made golden tests fail; restored.

## Deviations from the contract
None to PawFall's contract. `kits` frontmatter is optional. `bin/factory` untouched.

## Mistakes I made and how I fixed them
Required `kits:` in every skill, which silently dropped 8 skills (loader reports errors, my tests caught it); made it optional. `explain` resolves unique prefixes, so a typo test needed a real non-match.

## Learnings for a future agent
Phrase triggers (2+ words) are the strongest routing signal; add one golden case per new skill. Always run `guide.index` after editing skills (a test checks freshness). `registry.search` asset results are under `data.results`.

## Requests for other modules
factory-surface: add `factory guide ...` (exec `node factory-core/guide/cli.mjs`), call `registerGuide(registry)` after `registerStyles`/`registerLibrary`; spec in `docs/GUIDE.md`. `guide.check` on PawFall flags no `config/style.json` (apply a style if desired).

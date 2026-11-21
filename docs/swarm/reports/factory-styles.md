# factory-styles report

## What I built
In `~/src/fun/game-factory`: `styles/style.schema.json`, `styles/theme.schema.json`; 11 presets in `styles/presets/<id>/{style.json,THEMING.md}`; 3 themes (`jungle`, `space`, `cheese-ratops`) in `styles/themes/`; `factory-core/styles/{schema,index,capabilities}.mjs` (mini JSON-Schema validator, list/show/recommend/apply/validate, 5 `styles.*` capabilities in registry format `{name,summary,inputSchema,outputSchema,handler}` returning `{ok,data,error,next}`, plus `registerStyles(registry)`); `test/styles/*.test.mjs`; `docs/STYLES.md` (comparison table, scoring, apply rules, `style:<id>` library tag convention).

## Verification evidence
`cd ~/src/fun/game-factory && node --test test/styles/` -> 38 pass, 0 fail (schema for all presets and themes, 14 golden recommendation cases, platform/device/budget/dimension rules, apply idempotent, non-destructive, dryRun, CONFLICT without yes, capability shapes).

## Deviations from the contract
factory-core did not exist yet, so the registry format was inferred from the factory-surface prompt (name, input/output JSON Schema, `{ok,data,error,next}`); factory-surface may need a thin adapter. I did not edit `bin/factory` or any file outside my ownership. Preset ids/tags allow a dot (`pixel-2.5d-parallax`).

## Mistakes I made and how I fixed them
Ran `track.mjs` from the game-factory dir first, which created `game-factory/.tracker`; moved the events to pawfall's tracker and removed the stray dir. Presets first lacked `version`; the validator caught it.

## Learnings for a future agent
Presets were generated once from `pawfall/out/gen-presets.mjs`; the JSON files are now the source of truth, edit them directly. Raytraced/GPU presets cannot be verified headless: only CPU twins and schema are tested.

## Requests for other modules
factory-library: adopt the `style:<id>` / `style:*` / `theme:<id>` tags (STYLES.md). factory-surface: register `capabilities` from `factory-core/styles/capabilities.mjs`; `styles.apply` takes `yes`/`dryRun` (CLI `--yes`). factory-guide: route by `styles.recommend`. Orchestrator: game-factory has uncommitted files under styles/, factory-core/, test/styles/, docs/STYLES.md.

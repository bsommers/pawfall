# factory-library report

## What I built
In `~/src/fun/game-factory`:
- `factory-core/library/`: `format.mjs` (load/validate/hash/INDEX.json+INDEX.md), `safe.mjs` (path/symlink/size caps), `schema-lite.mjs`, `png.mjs`, `ops.mjs` (new/add/validate/index/publish/install/verify), `registry.mjs` (add/remove/list/refresh/search/show, cache, offline, conflicts), `capabilities.mjs` (13 capabilities in the core registry format + `registerLibrary`), `index.mjs`, `cli.mjs` (thin CLI), `validate-cli.mjs` (standalone, copied into scaffolds), `adapters/pixbuf-web.mjs`, `schemas/{library,asset,index,registry,lock}.schema.json`.
- `templates/asset-library/` (library.json.tmpl, README, .gitignore, CI workflow validate.yml); `library.new` also copies the standalone validator to `tools/library/`.
- `test/library/` (26 tests), `docs/LIBRARIES.md` (human, agent, API, MCP).
- Seed: `/home/bill/src/fun/pawfall-assets` (not a git repo, not pushed): 100 assets (17 character, 28 sprite, 9 tileset, 12 fx, 28 sfx, 6 song), 7.6 MB, tagged `style:retro-8bit-sidescroller`, CC0-1.0. Publish command: `node ~/src/fun/game-factory/factory-core/library/cli.mjs library publish ~/src/fun/pawfall-assets --repo <owner>/pawfall-assets --visibility public --yes`.

## Verification evidence
- `node --test test/library/` -> 26 pass, 0 fail (schema, index determinism incl. identical bytes across dirs, tamper, traversal, symlink, oversize, `__proto__`, dependency cycles/ranges, install idempotence + lock, hostile lock, code-kit not executed, publish confirm-first + secret refusal via injected runner, registry merge/filters/conflicts/offline, hostile remote libs via injected git, capability shapes).
- Seeded library: `library validate` OK, re-add is all `unchanged` (idempotent), `index --check` current, standalone `node tools/library/validate-cli.mjs validate .` OK. CLI install from a registered library into a scratch project plus `library verify` OK. One preview image checked visually (colby_run strip).
- Not exercised for real: `gh repo create` and real network `git clone` (no pushes allowed; tested via injected runner only).

## Deviations from the contract
- Task listed `factory library new <name>` in bin/factory: not wired (bin/factory is not mine and factory-extract may edit it); `cli.mjs` provides identical commands, factory-surface should dispatch to it.
- Seed library lives at `~/src/fun/pawfall-assets` (outside both repos) since `examples/` is not an owned path.
- `library.add` and its adapter import the source project's own modules (documented); `library.add` handler is async, others sync.
- Preview is not hashed (only payload `files`); `asset.json` is copied on install but not in the lock file list.

## Mistakes I made and how I fixed them
- Tests for dependency errors built invalid libraries through `addItems`, which rightly rejected them; added a pre-write dependency check and a `setDeps` test helper.
- `parseSource` first treated any odd string (e.g. `me/lib@../../x`) as a local path; now only explicit paths (`/`, `./`, `../`, `~`, `path:`) are local.
- `installAssets` threw on a symlinked destination; now wrapped to return `UNSAFE`.

## Learnings for a future agent
- Treat INDEX as generated and compare bytes with `--check` in CI; sort keys everywhere for determinism.
- Test remote fetch by injecting `exec` (registry refresh takes `exec` in input only in-process, not over MCP).
- pawfall `ART` rows have kind `tile` for tilesets; critters mix hazards and items, mapping is a heuristic in the adapter.

## Requests for other modules
- factory-surface: dispatch `factory library ...` / `factory registry ...` to `factory-core/library/cli.mjs` (or `registerLibrary(registry)` for HTTP/MCP); map `yes` to `--yes`; await handlers (library.add returns a Promise); never default `yes` for `library.publish`.
- factory-surface/orchestrator: decide where `pawfall-assets` is published; `registry.add` accepts `owner/repo@ref`.
- No shared-library defects found (pixbuf.js, sfx.js, music.js worked unchanged).

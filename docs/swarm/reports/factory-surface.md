# factory-surface report

## What I built
In `~/src/fun/game-factory`: `factory-core/{index,registry,schema}.mjs` + `factory-core/capabilities/core.mjs` (project.new/sync/run, kits.list/show, swarm.plan/next/track/status, docs.learnings). `buildRegistry()` registers styles, library(+registry), guide, core in that order (36 capabilities). `bin/factory` (sh launcher) -> `bin/factory.mjs` (CLI: --json, exit codes 0/1/2/3/4, help, capabilities, call, serve, mcp, TTY overwrite prompt, colour); the original script lives on as `bin/factory-scaffold.sh` and backs project.new/sync. `guide` and `library|registry` delegate to their own cli.mjs. `api/server.mjs` (127.0.0.1 REST, OpenAPI 3, SSE, Host/content-type checks), `mcp/server.mjs` (stdio JSON-RPC, tools + resources), `AGENTS.md`, `docs/SURFACES.md`, README rows, `test/factory-surface.test.mjs`.

## Verification evidence
`node --test test/` in game-factory: 114 pass, 0 fail (7 new surface tests: schema conformance, identical envelopes for `kits.list` and `project.new` across lib/CLI/HTTP/MCP, scaffolded `--web` project's own 63 tests via project.run, SSE, MCP init/list/call/resources, exit codes). Manual curl on /api, /openapi.json; MCP via piped stdin.

## Deviations from the contract
None against PawFall's. `bin/factory` is now a launcher for a Node CLI instead of a pure sh script (Node was already required).

## Mistakes I made and how I fixed them
Extensionless ESM entry failed to load (fixed with the .mjs split). Alias `test <dir>` mis-assigned the positional (fixed by seeding preset input before positional mapping). Test compared `next` strings containing per-run dirs (normalised).

## Learnings for a future agent
library's schema-lite ignores `anyOf`, so factory-core has its own validator. library.add is async; registry.call awaits every handler. Do not put `swarm.*` shell calls through a shell: use execFile arrays.

## Requests for other modules
styles and library each ship their own validator copy; a shared one would be tidier. `registerGuide` keeps a module-global `live` registry (last registered wins).

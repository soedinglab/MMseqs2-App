# `foldseek-server-mcp` — contributing

Everything a **user** needs is in [README.md](README.md), which is the page npm publishes and the only
documentation the package ships. This file is repo-only: layout, tests, packaging, and the invariants a
change has to preserve. If you find yourself documenting behaviour here, it belongs in README.md instead.

## Why the surface looks like this

The README says what the tools are. These are the decisions behind them, which is what a reviewer or a
contributor needs and an npm reader does not.

**Results are files, not text.** A nine-database Foldseek result is megabytes. `get_result_summary` is
bounded — about 1.7 KB on real data — and `export_result` writes everything to disk and returns a
descriptor under 2 KB. Reading one real row file as an MCP resource would cost on the order of a million
tokens, which is why `resources/read` is capped at 16 KB and refuses with a pointer to the path instead.

**The artifact handshake.** `export_result` returns `artifactRoot`, `localPath` and
`localPathVerified: false` — the server cannot know whether the caller shares its filesystem, so it says
so rather than implying it. A client that does: read `manifest.json` at `localPath` once, check its
`artifactId` equals the handle, then compose `artifactRoot` + manifest paths freely. If that fails, the
host cannot do the local-file workflow; fall back to resource reads and treat the summary as the product.
Artifacts are content-addressed on `sha256(namespace, ticket, entry, schema)`, so a repeat export is a hit.

**A motif is derived, never dictated.** A free-text override let the recorded columns and the executed
search disagree, and everything downstream then recorded a lie. Substitutions are addressed by column
instead, which works because `checkMotif` resolves only the part of a token before the `:` — so an
annotation never changes which residue a token names. The invariant: `msa/residue-map.jsonl` plus
`derivedFrom.{columns,residueAa}` must reproduce the submitted motif with no server involved.

Case is never normalised because four group codes collide with a real amino acid when it flips — `a`/`A`
aromatic vs alanine, `n`/`N` negative vs asparagine, `h`/`H` hydrophilic vs histidine, `p`/`P` positive vs
proline. Upper-casing would silently turn *aromatic* into *alanine*: a search that runs, returns hits, and
answers a different question.

**Getting bytes to the server.** MCP has no upload channel — client capabilities are `sampling`,
`elicitation` (primitives only) and `roots` (directory URIs, deprecated), and tool arguments are JSON the
model produces. So `queryPath` (the server opens a local file) and `queryUrl` (the server downloads one)
exist because there is no protocol answer. `queryPath` is refused when `--http` binds a non-loopback
address: a remote caller's path names a file on the *server's* disk. For `queryUrl` the host allowlist is
the boundary; https-only, private-address refusal, two re-checked redirects and a counted body are defence
against a mistyped entry, not against someone controlling DNS for a listed host. Neither is recorded — a
URL can carry a presigned signature.

**Selections** are named, durable, and copy-on-write. The convention is to edit `draft` and copy it to
`to-<destination>__NNN` per forwarding job, because that name is what `derivedFrom.selection` points at
and revising it in place would falsify a completed job's provenance.

**Two clocks.** Derived data expires fast, fetched data slowly: an artifact rebuild re-reads the cached
parse in milliseconds, so 30 minutes costs nothing, while the parse itself was a round trip and a
multi-megabyte parse. `readResult` touches the file, so the result TTL runs from last use and an active
ticket cannot expire mid-workflow.

## Layout

| | |
|---|---|
| `src/tools.js` | the eleven tools: name, schema, handler. **No MCP SDK** — so they can be driven against a stubbed client with no transport, which is what most of the suite does |
| `src/resources.js` | artifact files as MCP resources, and the read cap |
| `src/server.js` | SDK wiring, env parsing, transports, `--gc`. Moves JSON between the SDK and the handlers and nothing else |
| `bin/foldseek-server-mcp.js` | entry point. Imports `src/` when it exists, `dist/server.mjs` otherwise |
| `build.mjs` | esbuild → `dist/server.mjs`, everything inlined but the SDK |
| `pack-mcpb.mjs` | the Claude Desktop bundle, which needs its own `node_modules` |
| `manifest.json` | `.mcpb` manifest: `user_config`, tool list, platform compatibility |

The work happens in [`foldseek-server-lib`](../core/README.md), which is private and unpublishable — it
imports `frontend/lib` by relative path, so it cannot stand alone. Bundling is what makes the graph
shippable.

## Tests

```bash
npm test                                                              # no network
FOLDSEEK_SERVER_LIVE_TESTS=1 FOLDSEEK_SERVER_BASE_URL=… npm test      # + read-only live checks
FOLDSEEK_SERVER_PACK_TEST=1 node --test test/pack.test.js             # build, pack, install, drive it
```

Live tests are read-only and opt-in. Run them with `--test-concurrency=1`: several files fetch from RCSB
and Q-BioLiP, which throttle under the runner's default parallelism, and a throttled fetch looks like a
test failure.

| file | what it covers |
|---|---|
| `surface.test.js` | every tool is declared, described briefly, and cannot be asked to block |
| `sendto-tools.test.js` | selections and forwarding, against a stubbed client |
| `resources.test.js` | which reads work, which must not, the size cap, `resource_link` blocks |
| `inputs.test.js` | the `queryPath` allowlist and everything it refuses |
| `transport.test.js` | the `--http` flag, the rebinding guard, the loopback rule |
| `e2e.test.js` | a real stdio transport against the built bin; env parsing |
| `pack.test.js` | build, pack, install outside the repo, and the README/manifest drift guards |

## Invariants a change must not break

- **stdout is the protocol in stdio mode.** No `console.log` anywhere in `src/`; diagnostics go to
  stderr. A stray write desynchronises framing, which surfaces to a user as an unexplained disconnect.
- **No tool blocks.** Polling lives in `get_ticket_status`; no tool takes a timeout. `surface.test.js`
  asserts this.
- **Bounded replies.** A summary stays a couple of kilobytes on real data, a descriptor under 2 KB, a
  write confirmation around a hundred bytes. Adding a field that grows with result size is the mistake to
  avoid — put it in the artifact.
- **A motif is derived, never dictated.** `msa/residue-map.jsonl` plus `derivedFrom.{columns,residueAa}`
  must reproduce the submitted motif with no server involved. Anything that lets the two diverge is a
  regression, whatever it enables.
- **`queryPath` reads the server's disk.** Safe over stdio and loopback HTTP, and refused otherwise.
  Adding another path-taking argument means the same guard.
- **`queryUrl` makes the server fetch.** The host allowlist is the boundary; the scheme, address, redirect
  and size checks are defence against a mistyped entry. Adding another URL-taking argument means going
  through `resolveInputUrl`, never a bare `fetch`.
- **The GC deletes derived data only.** `ticket.json` and `selections.json` are not candidates at any age,
  and no directory is ever unlinked. The tests assert both by asserting what stayed.
- **Eleven tools.** New capability goes into an existing tool's arguments or into the artifact, not into a
  twelfth entry — a surface an agent has to read is a cost paid on every request.

## Packaging

```bash
npm run build        # dist/server.mjs, ~256 KB; gitignored, built by prepublishOnly
npm pack             # 5 files, ~82 KB: dist/server.mjs, bin/, README.md, LICENSE, package.json
npm run build:mcpb   # dist/foldseek-server.mcpb, ~3.3 MB
```

Two things that have bitten and are now tested:

- **`files` names `dist/server.mjs`, not `dist/`.** `build:mcpb` writes into the same directory, and
  `dist/` swept a 3.3 MB bundle into the npm tarball.
- **`type: "module"` is load-bearing.** Without it the server dies at startup and most hosts report only
  "Connection closed". The pack test strips it from an installed copy and asserts the real cause reaches
  stderr.

`.mcpb` archives carry their own `node_modules` — Desktop ships Node, not a registry client — so
`pack-mcpb.mjs` stages a production-only tree rather than relying on the workspace's hoisted one.

Publishing: `../../claude-plan/distribute-mcp/publishing.md`.
Manual host checks that cannot be automated: `../../claude-plan/distribute-mcp/manual-testing.md`.

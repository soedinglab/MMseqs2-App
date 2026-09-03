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
model produces. So `accession` (the server fetches a known id) and `queryRef` (the server opens a file
the caller placed) exist because there is no protocol answer. A `POST /input` route was built and
removed: no agent on any host could reach it, and the hosts that could had the filesystem already. A
URL argument existed too, and went with its host allowlist — `accession` needs no configuration and
covers the same ground. `queryRef` is refused when `--http` binds a non-loopback address: a remote
caller's path names a file on the *server's* disk.

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
| `inputs.test.js` | the `queryRef` allowlist and everything it refuses |
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
- **`queryIdx` is refused, never normalised.** FoldMason calls its alignment rows "entries", so a
  caller passing `entry: 3` to a FoldMason ticket means something real; collapsing it to 0 returned a
  valid-looking summary of a different unit. A non-zero index on FoldMason/FoldDisco is refused, and so
  is one past the last query of a search — the backend answers an out-of-range index with an
  empty-but-`COMPLETE` result, which reads as "this query found nothing". The query list is fetched
  only when `queryIdx > 0`, so the default path costs nothing. The name `entry` now means exactly one
  thing on the tool surface: an alignment row in `select_msa_columns`.
- **A selection reports its own index under its own name.** A hit selection belongs to a query and
  carries `queryIdx`; a column selection belongs to an alignment row and carries `entry`. One field
  serving both, which is what `entry` used to do, made the summary's selection list ambiguous by kind.
- **`ranking.field` names the order the rows are in.** It is the server's sort, not the frontend
  table's default — those differ under `tmalign`/`lolalign`, where the server orders by `eval` (a
  TM/LoL score) while `ResultView.vue` defaults to `score` whatever the mode. Borrowing the display
  default described a sort the file did not have, and made row 0 not the best hit. One definition,
  `defaultSortKey`, is shared by the manifest, `getTable` and `getTableSummary` so they cannot drift; a
  live test asserts the declared field really orders the exported rows, per mode.
- **Every tool failure carries a `code`.** It used to be conditional on the thrown error having one, so
  a plain `new Error` produced `{isError, error}`. `validateOnly` is a *separate channel*: a dry run
  that finds problems is a successful call and returns `{ok: false, problems[]}` with no `isError`.
- **`taxonomyTree` is about the result, not the database.** `parseResults` sets its `hasTaxonomy` from
  key presence — `"taxId" in item` — so `afdb-swissprot`, whose rows carry `taxId: 0` and
  `taxName: "unclassified"`, declared taxonomy it does not have. The flag now reports whether a report
  came back, which is exactly what decides `db-N.taxonomy.json`.
- **An option the destination does not have is refused, not dropped.** `FoldDiscoJob` carries no
  `TaxFilter` or `Mode`, and a complex search has no iterative mode. Accepting those arguments and
  discarding them would leave a caller believing they had filtered. The same list is enforced on
  `send_to`, per destination.
- **A malformed filter reaches the validator intact.** Name resolution must not normalise a syntax
  error away: `"9606,"` stays `"9606,"` and is refused, because repairing `"9606,!"` to `"9606"` would
  silently drop an exclusion the caller was writing.
- **A taxon name is resolved, never guessed.** `taxFilter` accepts scientific names, looked up against
  NCBI Datasets `taxon_suggest` with `tax_rank_filter=higher_taxon` — which is load-bearing, not
  cosmetic: without it "Bacteria" returns *Exercitatus varius* and never taxid 2. An exact `sci_name`
  match wins; anything else with more than one candidate is refused and lists them, because the
  dropdown a person picked from does not exist here. Numeric tokens never reach the network, so a
  caller passing ids is unaffected.
- **`queryRef` reads the server's disk.** Safe over stdio and loopback HTTP. A configured `INPUT_DIRS`
  plus a non-loopback bind is refused at startup; `imports/` is dropped from the read roots instead,
  because nobody configured it and refusing would break a deployment that only wanted exports. Adding
  another path-taking argument means the same two rules.
- **`imports/` is swept only because it is claimed.** Its files are named by whoever wrote them, so the
  `.foldseek-drop` marker is the only guard — a directory without it is refused, examined and audited
  nothing. The marker is therefore never written into a directory that already had contents:
  `SHARED_DIR` pointed at a folder with an `imports/` of its own would otherwise put those files on the
  input TTL. `exports/` needs no such rule, because the artifact-id pattern filters it as well. `INPUT_DIRS` is never swept, and may not nest with the shared folder in either direction: one
  way puts a curated library on a 1 h timer, the other hides drops behind a root that outlives them.
- **The artifact sweep only touches roots it created.** `FOLDSEEK_SERVER_SHARED_DIR` can name any
  folder, so a typo would otherwise aim it at one we have never written to — and the name allowlist alone
  would still delete a 64-hex directory belonging to something else. A build writes
  `.foldseek-artifacts` into the root, and `collectArtifacts` refuses any root without it, examining
  nothing and auditing nothing. The refusal heals on the next export.
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

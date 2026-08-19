# `headless/` — Foldseek, FoldMason and FoldDisco without a browser

Two packages that let a script or an agent submit jobs to this repo's Go backend, poll them, decode
the results, and forward a hit or an alignment region into the next search — all without a page
being mounted anywhere.

| package | what it is |
|---|---|
| [`core`](core/) | the library: an HTTP client plus the result objects (`ResultTable`, `Selection`, `MsaColumnSelection`, …) |
| [`mcp-server`](mcp-server/) | an MCP server exposing 11 tools plus result artifacts as resources, for agents that speak the protocol |

Both are npm workspaces of the repo root; `npm install` there installs them.

## The one design decision worth knowing

Nothing here reimplements the frontend's logic. `core` imports `frontend/lib/*.js` **by relative
path** — the same `parseResults`, `resultSort`, `msaTracks`, `taxonomyFilter`, `pdbAssembly` and
`structureText` modules the mounted page uses. `frontend/lib/resultSort.js` says why in its own
header: the page's table and its API import from one file *because* they must not drift into sorting
differently. A second copy for headless use would recreate exactly that.

Two consequences:

- These packages only run from inside a clone of this repo. Publishing to npm needs a bundling step
  first, which is deliberately not done yet.
- A change to `frontend/lib` changes both. `core/test/lib-loadable.test.js` fails if any module there
  stops loading under Node, which is the invariant that makes the arrangement work.

## Quick start

```bash
npm install                                   # from the repo root
cd headless/core && npm test                  # no network, nothing submitted
```

```js
import { createClient } from 'foldseek-server-lib';

const client = createClient({ baseUrl: 'https://search.foldseek.com' });
const ticket = await client.submitFoldseekSearch({
    query: await fs.readFile('1stp.cif', 'utf8'),
    databases: ['pdb100'],
});
await ticket.wait();

console.log(await client.getResultSummary(ticket.id));   // bounded: what came back
const artifact = await client.exportResult(ticket.id);   // complete: every row, as files
console.log(artifact.files);
```

Two operations carry the reading side. The **summary** is small, fixed-shape and always safe to ask
for. The **artifact** is the complete factual export, written to files and addressed by URI — so
analysis happens locally, as many times as wanted, without another round trip. Nothing large is ever
inlined into a tool result.

For the MCP server: [`mcp-server/README.md`](mcp-server/README.md) is the full user documentation and
the page npm publishes; [`mcp-server/REFERENCE.md`](mcp-server/REFERENCE.md) is for contributors.

## Examples

Two runnable scripts in [`examples/`](examples/), both of which submit real jobs:

```bash
node headless/examples/binding-site-search.mjs     # one job
node headless/examples/streptavidin-chain.mjs      # three jobs, ~20s end to end
```

`binding-site-search.mjs` searches the PDB for streptavidin's biotin-binding site in a single call —
the accession is fetched, Q-BioLiP is asked for the site, its residues are resolved against the
receptor assembly, and the assembly's chain names are rewritten so the motif can address them.

`streptavidin-chain.mjs` is the whole layer: search → survey → select → align → find the
best-superposing region → search again for that region as a motif. Worth reading for how little
crosses between steps — a ticket id, a few row ids, a column range, and no structure text at all.

## Tests

```bash
npm test                                      # in either package; no network, nothing submitted

FOLDSEEK_SERVER_LIVE_TESTS=1 \
FOLDSEEK_SERVER_BASE_URL=https://search.foldseek.com npm test     # + read-only live checks

FOLDSEEK_SERVER_LIVE_TESTS=1 FOLDSEEK_SERVER_LIVE_SUBMIT=1 \
FOLDSEEK_SERVER_BASE_URL=http://localhost:3000 npm test           # + a real submitted job
```

The submit flag is separate from the read flag on purpose: reading a completed ticket costs a
request, submitting occupies a queue slot and a worker.
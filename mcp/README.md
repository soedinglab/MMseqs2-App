# `mcp/` — Foldseek, FoldMason and FoldDisco without a browser

Two packages that let a script or an agent submit jobs to this repo's Go backend, poll them, decode
the results, and forward a hit or an alignment region into the next search — all without a page
being mounted anywhere.

| package | what it is |
|---|---|
| [`core`](core/) | the library: an HTTP client plus the result objects (`ResultTable`, `Selection`, `MsaColumnSelection`, …) |
| [`server`](server/) | an MCP server exposing 11 tools plus result artifacts as resources, for agents that speak the protocol |

The server owns the MCP dependency lock; the core library has no external npm dependencies.

## Quick start

```bash
npm ci --prefix mcp/server                    # from the repo root
npm test --prefix mcp/core                    # no network, nothing submitted
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

## Tests

```bash
npm test --prefix mcp/core                    # no network, nothing submitted
npm test --prefix mcp/server

FOLDSEEK_SERVER_LIVE_TESTS=1 \
FOLDSEEK_SERVER_BASE_URL=https://search.foldseek.com \
  npm test --prefix mcp/server                # + read-only live checks

FOLDSEEK_SERVER_LIVE_TESTS=1 FOLDSEEK_SERVER_LIVE_SUBMIT=1 \
FOLDSEEK_SERVER_BASE_URL=http://localhost:3000 \
  npm test --prefix mcp/server                # + a real submitted job
```

The submit flag is separate from the read flag on purpose: reading a completed ticket costs a
request, submitting occupies a queue slot and a worker.

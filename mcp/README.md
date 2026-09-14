# `mcp/` — Foldseek, FoldMason and FoldDisco without a browser

Two packages let an MCP client submit jobs to server backend, inspect or export results, and forward a hit or alignment region into the next search.

| package | role |
|---|---|
| [`core`](core/) | private implementation library used by the server |
| [`server`](server/) | an MCP server exposing 12 tools and shared-folder result artifacts |

## Quick start

```bash
npm ci --prefix frontend/lib                  # from the repo root
npm ci --prefix mcp/core
npm ci --prefix mcp/server
```

Run or install the server using [`server/README.md`](server/README.md). 
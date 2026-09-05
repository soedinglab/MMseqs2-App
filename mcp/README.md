# `mcp/` — Foldseek, FoldMason and FoldDisco without a browser

Two packages let an MCP client submit jobs to this repo's Go backend, inspect or export results, and
forward a hit or alignment region into the next search without mounting the web application.

| package | what it is |
|---|---|
| [`core`](core/) | private implementation library used by the server |
| [`server`](server/) | an MCP server exposing 11 tools plus result artifacts as resources, for agents that speak the protocol |

The server owns the complete distribution dependency graph; the core package is not installed alone.

## Quick start

```bash
npm ci --prefix mcp/server                    # from the repo root
npm test --prefix mcp/core                    # no network, nothing submitted
```

Run or install the server using [`server/README.md`](server/README.md). Its **summary** is small and
fixed-shape; its **artifact** is the complete result written to files and addressed by URI. Nothing
large is inlined into a tool result.

## Tests

```bash
npm test --prefix mcp/core                    # no network, nothing submitted
npm test --prefix mcp/server
```

Both suites are offline. Verify a real deployment separately when changing its network contract.

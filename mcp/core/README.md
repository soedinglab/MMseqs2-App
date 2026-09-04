# `foldseek-server-lib`

Private implementation library for the Foldseek MCP server. It connects to the Go backend, parses
results with shared frontend helpers, persists ticket state, creates bounded summaries and file
artifacts, and forwards selected rows or alignment columns into follow-up jobs.

This package is not published and its JavaScript surface is not a separate compatibility contract.
Use the tools documented in [`../server/README.md`](../server/README.md) instead of importing it from
another project.

## Responsibilities

- Validate and submit Foldseek, Multimer, FoldMason and FoldDisco requests.
- Poll tickets once per `get_ticket_status` call; never wait internally for completion.
- Cache terminal results and retain compact ticket lineage.
- Return a fixed-shape summary and export the complete result as files.
- Persist explicit row and MSA-column selections used by `send_to`.
- Validate input paths and collect expired inputs, results and artifacts safely.

`FOLDSEEK_SERVER_BASE_URL` has no library default: choosing one implicitly could send a structure to
the wrong deployment. Raw query text is not retained in ticket metadata; only its byte length and a
short hash are stored.

## Layout

| module | responsibility |
|---|---|
| `client.js` | backend requests, ticket state, summaries and exports |
| `results.js` | explicit row lookup, saved hit selections and forwarding |
| `msa.js` | FoldMason parsing and saved column selections |
| `submit.js`, `structures.js`, `motif.js` | destination-specific forwarding and validation |
| `artifacts.js`, `facts.js`, `schemas.js` | complete exports and their contracts |
| `store.js`, `inputs.js`, `gc.js` | local state, path safety and bounded cleanup |

## Testing

From the repository root:

```bash
npm test --prefix mcp/core
npm test --prefix mcp/server
```

The offline suites stub backend requests. Verify a live deployment separately when changing its
network contract.

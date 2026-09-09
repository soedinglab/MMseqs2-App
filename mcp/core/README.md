# `foldseek-server-lib`

Private implementation library for the Foldseek MCP server. 
It connects to the Go backend, parses results with shared frontend helpers, persists ticket state, creates bounded summaries and file artifacts, and forwards selected rows or alignment columns into follow-up jobs.

Use the tools documented in [`../server/README.md`](../server/README.md).

## Responsibilities

- Validate and submit Foldseek, Multimer, FoldMason and FoldDisco requests.
- Poll tickets once per `get_ticket_status` call.
- Cache terminal results and retain compact ticket lineage.
- Return a fixed-shape summary and export the complete result as files.
- Export FoldDisco query and target motif Cα coordinates with explicit gap positions and per-hit transforms.
- Persist explicit row and MSA-column selections used by `send_to`.
- Report the verified shared-directory layout.
- Validate input paths and collect expired inputs, results and artifacts safely.

`FOLDSEEK_SERVER_BASE_URL` has no library default: choosing one implicitly could send a structure to the wrong deployment.

## Layout

| module | responsibility |
|---|---|
| `operations.js` | compose the public operations facade from the focused services below |
| `backendClient.js` | raw Foldseek Server HTTP requests |
| `results.js`, `table.js` | ticket/result access and tabular result objects |
| `selections.js`, `msa.js` | saved hit and MSA-column selections |
| `submits.js`, `structures.js`, `motif.js` | request validation, construction and submission |
| `exports.js`, `artifacts.js` | result export orchestration and artifact storage |
| `facts.js`, `schemas.js` | result interpretation and persisted contracts |
| `store.js`, `inputs.js`, `gc.js` | local state, shared paths and bounded cleanup |

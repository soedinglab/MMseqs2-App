# `mmseqs2-agent-mcp`

An MCP server that exposes Foldseek, FoldMason and FoldDisco to an agent: submit a search, read the
hits, pick some, forward them into the next tool. Seventeen tools over
[`mmseqs2-agent-core`](../core/README.md), which does the actual work.

## Configuration

Environment only, no config file. Startup errors go to stderr — stdout is the protocol stream.

| variable | |
|---|---|
| `MMSEQS2_AGENT_BASE_URL` | **required**, the site origin, e.g. `https://search.foldseek.com` |
| `MMSEQS2_AGENT_APP` | `foldseek` (default), `mmseqs`, `foldmason` |
| `MMSEQS2_AGENT_STATE_DIR` | ticket cache; default `~/.mmseqs2-agent` |
| `MMSEQS2_AGENT_API_PATH` | `/api` by default |
| `MMSEQS2_AGENT_BASIC_AUTH_USER` / `_PASS` | for a protected deployment |

There is no default base URL: one would send structures to whichever server was compiled in.

## Registering it

```bash
claude mcp add mmseqs2-agent \
  --env MMSEQS2_AGENT_BASE_URL=https://search.foldseek.com \
  -- node /path/to/MMseqs2-App/headless/mcp-server/bin/mmseqs2-agent-mcp.js
```

Any MCP host works the same way — the server speaks stdio. For a JSON config:

```json
{
  "mcpServers": {
    "mmseqs2-agent": {
      "command": "node",
      "args": ["/path/to/MMseqs2-App/headless/mcp-server/bin/mmseqs2-agent-mcp.js"],
      "env": { "MMSEQS2_AGENT_BASE_URL": "https://search.foldseek.com" }
    }
  }
}
```

## The tools

**Finding out what is available**

- `list_databases` — every database with the capability flags that decide which tool can use it. A
  name valid for one tool is often invalid for another, so call this before searching.

**Submitting**

- `foldseek_search` — structure search; `multimer: true` for a complex search
- `foldmason_msa` — multiple structure alignment, two or more files
- `folddisco_search` — structural motif search
- `submit_ticket` — any of the above without waiting; `validateOnly: true` runs every check and shows
  what *would* be sent, queueing nothing

The three search tools take either `query` (structure text) or `accession` — an id, or
`{id, source: 'PDB'|'AlphaFoldDB'|'BFVD'}` — which is loaded for you. For a PDB id, `folddisco_search`
also takes the Q-BioLiP binding site as the motif when you give none, so a binding-site search is one
call.

**Reading**

- `get_ticket_status` — status, job type, the page URL a human would open, and `derivedFrom` if this
  job was forwarded out of another
- `get_result_table` — `view: 'summary'` surveys every database without transporting rows; `'rows'`
  returns hits, with `db`, `sortKey`, `offset`/`limit`, `fields`, `taxonFilter`, `motifFilter`
- `get_taxonomy` — the taxa in one database's hits, with clade read counts
- `get_queries` — the queries inside a ticket and the entry index each is reached by
- `get_foldmason_result` — `include: ['statistics','entries','fasta','coordinates','tree']`
- `get_foldmason_column_summary` — where to look in an alignment: metric spreads, notable columns as
  ranges, and the best-scoring regions
- `get_foldmason_columns` — per-column LDDT, quality, conservation, consensus, occupancy, entropy
- `list_cached_tickets` — what this agent has seen before, from the local cache;
  `derivedFromTicket` filters to the jobs one ticket produced

**Selecting and forwarding**

- `select_hits` — mark rows selected by the ids `get_result_table` prints, saved against the ticket
  under a name so later calls can adjust it
- `select_msa_columns` — pick alignment columns and see the motif the residues they cover make;
  takes `ranges: ["12-28"]`, the form the column summary prints
- `send_to` — forward a row, a saved selection, or a saved column selection into a new job
- `load_accession` — look up a structure without submitting anything

## A worked sequence

Nothing but ids passes between calls; no structure text ever enters the conversation.

```
foldseek_search  { accession: "1STP", databases: ["pdb100", "afdb50"] }   -> ticketId
get_ticket_status { ticketId }                                            -> COMPLETE
get_result_table { ticketId, view: "summary", merged: true }              -> which database has the signal
get_result_table { ticketId, db: "afdb50", limit: 10 }                    -> rows, each with an id
select_hits      { ticketId, ids: ["1#0","1#3","1#7"], name: "core" }     -> saved
send_to          { from: {type:"selection", ticketId, name:"core"},
                   tool: "foldmason" }                                    -> a new ticketId
get_foldmason_column_summary { ticketId: msaTicket }                      -> regions, e.g. "12-28"
select_msa_columns { ticketId: msaTicket, ranges: ["12-28"] }             -> motif "A31, A32, …"
send_to          { from: {type:"msaColumns", ticketId: msaTicket},
                   tool: "folddisco", databases: ["pdb_folddisco"] }      -> a third ticketId
```

Selections and column selections are stored on disk against the ticket, so this survives a restart,
a new conversation, or a different process — every call is stateless.

## What a result looks like

Every tool returns JSON as a text block. Two kinds of failure, reported two different ways:

- **`isError: true` with an `error` string** — the tool ran and failed for a reason worth acting on:
  a database this deployment cannot use for that job type, a motif residue absent from the query, a
  selection that was never saved. Read it and try something else.
- **A protocol error** — the tool does not exist. Nothing ran, and no change of arguments helps.

## Testing

```bash
npm test    # 42 tests, no network, nothing submitted
```

The tools are defined in `src/tools.js` with no MCP SDK involved, so they can be exercised against a
real backend without a client process or a stdio pipe; `src/server.js` only moves JSON between the
SDK and those handlers.

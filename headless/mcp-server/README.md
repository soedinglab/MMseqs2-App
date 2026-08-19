# `mmseqs2-agent-mcp`

An MCP server exposing Foldseek, FoldMason and FoldDisco to an agent: submit a search, see what came
back, export the whole thing to files, pick some hits, forward them. Eleven tools over
[`mmseqs2-agent-core`](../core/README.md), which does the work.

## Configuration

Environment only, no config file. Startup errors go to stderr — stdout is the protocol stream.

| variable | default | notes |
|---|---|---|
| `MMSEQS2_AGENT_BASE_URL` | **required** | the site origin. e.g. `https://search.foldseek.com` |
| `MMSEQS2_AGENT_APP` | `foldseek` | affects cross-reference links in parsed results |
| `MMSEQS2_AGENT_STATE_DIR` | `~/.mmseqs2-agent` | ticket cache, selections, artifacts |
| `MMSEQS2_AGENT_API_PATH` | `/api` | for a deployment using `config.Server.PathPrefix` |
| `MMSEQS2_AGENT_BASIC_AUTH_USER` / `_PASS` | — | |
| `MMSEQS2_AGENT_ARTIFACT_TTL_SECONDS` | `7200` | 300 … 604800 |
| `MMSEQS2_AGENT_ARTIFACT_STALE_BUILD_SECONDS` | `3600` | 60 … 86400 |
| `MMSEQS2_AGENT_ARTIFACT_GC_MAX_DELETIONS` | `200` | 1 … 10000 |
| `MMSEQS2_AGENT_ARTIFACT_GC_MIN_INTERVAL_SECONDS` | `600` | 0 … 86400; 0 sweeps on every export |
| `MMSEQS2_AGENT_ARTIFACT_LOCAL_PATHS` | `1` | `0` withholds local paths from descriptors |
| `MMSEQS2_AGENT_RESULT_ROW_CAP` | unset | 1 … 1000000; overrides the search saturation cap |

Out-of-range values fail at startup naming the variable and its range, rather than being clamped.

```bash
claude mcp add mmseqs2-agent -- node /path/to/headless/mcp-server/bin/mmseqs2-agent-mcp.js
```

## The flow

```text
list_databases     { jobType: "foldseek_search" }                     -> what this server can search
foldseek_search    { accession: "1STP", databases: ["pdb100"] }       -> ticketId
get_ticket_status  { ticketId }                                        -> COMPLETE
get_result_summary { ticketId }                                        -> counts, ranking, a top hit per db
export_result      { ticketId }                                        -> file URIs; read them as resources
select_hits        { ticketId, ids: ["1#0","1#3"], name: "draft" }     -> saved against the ticket
select_hits        { ticketId, action: "copy",
                     fromName: "draft", name: "to-foldmason__001" }    -> the name this job will use
send_to            { from: {type:"selection", ticketId,
                            name:"to-foldmason__001"},
                     tool: "foldmason" }                               -> a new ticketId
select_msa_columns { ticketId: msaTicket, ranges: ["12-28"] }          -> motif "A31, A32, …"
send_to            { from: {type:"msaColumns", ticketId: msaTicket},
                     tool: "folddisco",
                     databases: ["pdb_folddisco"] }                    -> a third ticketId
```

`get_result_summary` first, always: it is bounded (about 1.7 KB on a nine-database search) and says what
exists. `export_result` when the whole result is wanted — it writes files and returns their URIs.

## The eleven tools

**Submitting** — `foldseek_search` (monomer), `multimer_search` (complex), `foldmason_msa` (two or more
structures), `folddisco_search` (a motif). Each takes `query` text or an `accession`, returns a ticket
immediately, and accepts `validateOnly` to run every check without queueing anything. None of them can
be asked to wait; polling lives in `get_ticket_status` alone.

**Reading** — `list_databases`, `get_ticket_status`, `get_result_summary`, `export_result`.

**Moving on** — `select_hits`, `select_msa_columns`, `send_to`.

Not advertised, deliberately: paginated table readers, taxonomy and column readers, a generic
`submit_ticket`, `load_accession` (it is the `accession` argument on the submit tools), and
`list_cached_tickets`. Everything they returned is in the export, complete rather than projected.
Artifact deletion is not a tool either — see `--gc` below.

## Result artifacts as resources

`export_result` returns a descriptor: an artifact id, the file list with roles, byte and row counts,
and URIs. No file contents.

```text
mmseqs2-artifact://<artifactId>/manifest.json
mmseqs2-artifact://<artifactId>/search/db-4.rows.jsonl
mmseqs2-artifact://<artifactId>/msa/residue-map.jsonl
```

A read resolves through the artifact's own manifest: the id must be a full sha256 hex digest and the
path must appear verbatim in the manifest's file table, so a file sitting in the directory but absent
from the manifest is not readable and traversal has nothing to work on. JSON, JSONL and FASTA come back
as text; `coordinates.json.gz` comes back as a blob.

`localManifestPath` is included when the client shares the filesystem — an optimisation, not the
contract. The URI is authoritative.

## Selections

Named, saved against the ticket, and durable across restarts. The convention:

- edit `draft` (or `default`) freely;
- `action: "copy"` it to `to-<destination>__NNN` for each forwarding job;
- leave that name alone afterwards — it is what the job's `derivedFrom.selection` points at.

Copying never overwrites, and the copy is independent in both directions. Revise by copying again.

## Errors

Two kinds, reported two ways.

- **`isError: true` with a `code`** — the tool ran and failed for a reason worth acting on:
  `RESULT_NOT_READY`, `RESULT_FAILED`, `INVALID_ENTRY`, `UNKNOWN_TICKET`, `INVALID_INPUT`,
  `SELECTION_NOT_FOUND`, `SELECTION_COLLISION`, `SELECTION_NAME_INVALID`, `EXPORT_FAILED`,
  `UNSUPPORTED_ON_DEPLOYMENT`.
- **A protocol error** — the tool or resource does not exist, or a resource URI is not readable
  (`ARTIFACT_NOT_FOUND`, `INVALID_ARTIFACT_PATH`). Nothing ran and no argument change helps.

## Operator maintenance

```bash
mmseqs2-agent-mcp --gc --dry-run     # what would be collected, and why
mmseqs2-agent-mcp --gc               # collect it
```

Both print a report to stderr and exit without starting a server. Artifacts expire two hours after
last access; the sweep is bounded, audited to `<stateDir>/artifact-gc-audit.jsonl` (rotated at 4 MB),
and cannot reach the ticket cache or selections, which live outside the directory it walks.

## Tests

```bash
npm test                                                        # no network
MMSEQS2_AGENT_LIVE_TESTS=1 MMSEQS2_AGENT_BASE_URL=… npm test    # + read-only live checks
```

The tools are defined in `src/tools.js` with no MCP SDK involved, so they can be exercised against a
stubbed client without a transport — which is what most of the suite does.

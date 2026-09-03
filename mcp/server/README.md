# foldseek-server-mcp

Node.js server implementing Model Context Protocol (MCP) for protein structure search — Foldseek,
FoldMason and FoldDisco — against a [Foldseek Server](https://github.com/soedinglab/MMseqs2-App)
deployment such as [search.foldseek.com](https://search.foldseek.com).

## Features

- Structure search: monomer, complex, and structural-motif queries
- Multiple structure alignment with FoldMason
- Queries by PDB / AlphaFold DB / BFVD accession, or by a file the server can read — no need to paste
  a structure
- Taxon filtering by scientific name as well as id: `taxFilter: "Bacteria,!Escherichia coli"`
- Complete results written to local files, so alignments and taxonomy stay out of the conversation
- Named hit and alignment-column selections, forwardable into follow-up jobs
- Every derived job records the ticket it came from
- Bounded replies: nothing echoes an argument back, and no tool returns a row

## Installation

```bash
npx -y foldseek-server-mcp
```

Requires Node.js 18+. `FOLDSEEK_SERVER_BASE_URL` is required and has no default.

### Claude Code

```bash
claude mcp add foldseek -e FOLDSEEK_SERVER_BASE_URL=https://search.foldseek.com \
  -- npx -y foldseek-server-mcp
```

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "foldseek": {
      "command": "npx",
      "args": ["-y", "foldseek-server-mcp"],
      "env": { "FOLDSEEK_SERVER_BASE_URL": "https://search.foldseek.com" }
    }
  }
}
```

`~/Library/Application Support/Claude/` on macOS, `%APPDATA%\Claude\` on Windows. Cowork uses Desktop's
servers, so this configures both.

### Over HTTP

For clients that connect to a running server rather than starting one:

```bash
FOLDSEEK_SERVER_BASE_URL=https://search.foldseek.com \
  npx foldseek-server-mcp --http --host 127.0.0.1 --port 8080
```

Streamable HTTP, bound to the address given. If the client does not share the server's filesystem, add
`FOLDSEEK_SERVER_LOCAL_PATHS=0` so exported files are referenced by URI only. Put TLS and authentication in
front of anything not on loopback.

## API

### Tools

| tool | |
|---|---|
| `list_databases` | what this deployment can search |
| `foldseek_search` | search one monomer structure |
| `multimer_search` | search a complex |
| `folddisco_search` | search for a structural motif |
| `foldmason_msa` | align two or more structures |
| `get_ticket_status` | status of a submitted job |
| `get_result_summary` | what a finished result holds, without the rows |
| `export_result` | write the complete result to files |
| `select_hits` | name a set of hits |
| `select_msa_columns` | name alignment columns and get their motif |
| `send_to` | forward a hit or selection into a new job |

- **list_databases**
  - Databases this deployment offers
  - Inputs:
    - `tool` (string, optional): `foldseek` | `multimer` | `folddisco` — only the databases that tool
      accepts

- **foldseek_search**
  - Search one monomer structure against structure databases
  - Inputs:
    - `databases` (string[]): paths from `list_databases`
    - `query` (string, optional): PDB or mmCIF text
    - `accession` (string | object, optional): an id, or `{ id, source, autoMotif }`
    - `queryRef` (string, optional): a name the **server** resolves — see [Paths](#paths)
    - `mode` (string, optional): `3diaa` (default) | `tmalign` | `lolalign`
    - `iterativeSearch` (boolean, optional)
    - `taxFilter` (string, optional): taxon ids **or scientific names**, comma separated; `!` negates
      — e.g. `"Bacteria,!Escherichia coli"`. A name is resolved against NCBI Datasets; an ambiguous one
      is refused with its candidates, and the ids used come back on the ticket
    - `email` (string, optional), `validateOnly` (boolean, optional)
  - Exactly one of `query`, `accession`, `queryRef`
  - Returns a ticket immediately; nothing blocks

- **multimer_search**
  - Search a complex against complex-capable databases
  - Same inputs, minus `iterativeSearch`, which does not apply. `taxFilter` does — a complex search
    can be restricted by taxon, though its *result* carries no taxonomy report

- **folddisco_search**
  - Search for a structural motif — a residue list like `A123, A156, W201`
  - Inputs:
    - `databases` (string[]): motif-capable paths from `list_databases`
    - `motif` (string, optional): required unless an accession supplies one
    - the same structure inputs as above, plus `email` and `validateOnly`
  - No `mode` and no `taxFilter`: `FoldDiscoJob` has neither field, so both are refused rather than
    silently dropped
  - A token may carry a substitution: `A123:W`
  - Every residue must exist in the query, checked before submission

- **foldmason_msa**
  - Align two or more structures; each file name becomes an entry name
  - Inputs:
    - `files` (object[], optional): `[{ name, content }]`
    - `fileRefs` (string[], optional): local files the server reads
    - `accessions` (string[] | object[], optional): ids the server fetches, e.g. `["1abc",
      { "id": "P0DTC2", "source": "AlphaFoldDB" }]`
    - `email` (string, optional), `validateOnly` (boolean, optional)
  - The three combine, in that order; at least two structures in total

- **get_ticket_status**
  - Status of a submitted job
  - Inputs:
    - `ticketId` (string)
  - `PENDING` | `RUNNING` | `COMPLETE` | `ERROR` | `UNKNOWN`, the tool, and its source ticket if any

- **get_result_summary**
  - What a finished result holds, without the rows
  - Inputs:
    - `ticketId` (string)
    - `queryIdx` (number, optional): which query of a multi-query ticket, default 0. Foldseek and
      multimer only — FoldMason and FoldDisco serve one result per ticket, and passing a non-zero
      value is **refused** rather than collapsed. An index past the last query is refused too
  - Per database: hit counts, the top hit, `taxonomyTree`. Plus the ranking metric, whether results
    were truncated, and any saved selections. One `tool` field, not a job type and a result kind
  - `ranking.field` is the field **the server sorted the rows by**, so it is also the order
    `export_result` writes them in — `eval` under `tmalign`/`lolalign`, where that column holds a
    TM/LoL score. Read `metricSemantics` per ticket: the same `eval` is an E-value under `3diaa`
  - `taxonomyTree` says whether a taxonomy report came back for that database, so it predicts
    `db-N.taxonomy.json` exactly. It is not a database capability: `afdb-swissprot` rows carry
    `taxId: 0` / `"unclassified"` and produce no tree
  - A couple of kilobytes even on a nine-database search — start here

- **export_result**
  - Write the complete result to files and return their locations
  - Inputs:
    - `ticketId` (string)
    - `queryIdx` (number, optional)
  - Every hit row, taxonomy node and alignment column, as JSONL / JSON / FASTA. Returns a directory
    path, a manifest, and one resource link per file — no file contents
  - Repeat calls return the same artifact without rebuilding

- **select_hits**
  - Name a set of hits so `send_to` can forward them
  - Inputs:
    - `ticketId` (string)
    - `action` (string, optional): `set` (default) | `add` | `remove` | `clear` | `copy` | `describe` |
      `list` | `delete`
    - `ids` (string[], optional): `"dbIndex#rowIndex"`, e.g. `["8#0", "8#5"]`
    - `name` (string, optional): default `"default"`
    - `queryIdx` (number, optional), `fromName` (string, optional): for `copy`
    - `maxEntries` (number, optional): entries listed by `describe`, default 25
  - Saved against the ticket and durable across restarts. The reply carries the name and the new
    size; `action: "describe"` is how you read a selection back. In the summary's `selections[]`, a hit
    selection carries `queryIdx` and a column selection carries `entry`

- **select_msa_columns**
  - Name alignment columns in a FoldMason result and get the motif they map to
  - Inputs:
    - `ticketId` (string)
    - `action` (string, optional): the same eight as `select_hits`
    - `columns` (number[], optional) or `ranges` (string[], optional): e.g. `["12-28"]`
    - `entry` (number, optional): which **alignment row** the residues are read off, default 0 — this
      is the one place `entry` keeps its FoldMason meaning; everywhere else the ticket-level index is
      `queryIdx`
    - `residues` (object[], optional): `[{ column, aa }]` — ask for a different amino acid at a column;
      `aa: null` clears
    - `name` (string, optional), `fromName` (string, optional)
  - Returns the derived motif plus `residueMapping`, e.g. `20->A17, 23->A20(F):b, 24->gap:Y`
  - `aa` is an amino-acid letter, `X` for any, or `p` `n` `h` `b` `a` for positively charged, negatively
    charged, hydrophilic, hydrophobic, aromatic. **Case matters** — `a` is aromatic, `A` alanine

- **send_to**
  - Forward a hit, a saved selection, or saved alignment columns into a new job
  - Inputs:
    - `from` (object): `{ type, ticketId, queryIdx?, rowId?, name? }`, `type` being `row` | `selection` |
      `msaColumns`
    - `tool` (string): `foldseek` | `multimer` | `foldmason` | `folddisco`
    - `databases` (string[], optional), `mode`, `taxFilter`, `iterativeSearch`, `email` as above —
      each refused when the destination has no such field, rather than dropped: FoldDisco takes no
      `taxFilter` or `mode`, multimer no `iterativeSearch`
    - `motif` (string, optional): FoldDisco, when the source carries none
    - `includeQuery` (boolean, optional): FoldMason from a selection also sends the original query,
      default true
  - The structure is reassembled for the destination, and the new ticket records its source

### Responses

Every reply is one JSON object. **There are two failure channels, and `isError` is not the only one:**

- a call that failed → `{ isError: true, code, error }`. `code` is always present
- a `validateOnly` dry run that *succeeded* and found problems → `{ ok: false, problems[] }`, with no
  `isError`. Branch on `isError` first, then on `ok`; a caller checking only `isError` reads an
  unusable database as a passing validation

| call | comes back |
|---|---|
| a submit | `ticketId`, `status`, and only what you could not know: `loaded` for a fetched structure, `motif` when one was derived, `taxFilter` + `taxonomy` when a name was resolved |
| `validateOnly: true` | `ok`, `problems[]`, `would` — the request that would have been sent |
| `get_ticket_status` | `ticketId`, `status`, `tool`, `resultUrl`, `derivedFrom` if forwarded |
| `get_result_summary` | a bounded orientation payload, ~1–2.5 KB (§Tools) |
| `export_result` | a descriptor and one resource link per file, never file contents |
| `select_hits` | `name` and the new `size`, plus `rejected` when ids did not resolve |
| `select_msa_columns` | the derived `motif`, `residueMapping`, and the column counts |

Arguments are not echoed: the ticket, entry and name you passed do not come back, and
`action: "describe"` is how you read state you did not just set.

### The shared folder

`FOLDSEEK_SERVER_SHARED_DIR` names one directory both sides use, and derives two:

```
<shared>/exports    the server writes, you read     30 min
<shared>/imports    you write, the server reads      1 h
```

Files are exchanged there, so a sandboxed client needs one grant rather than one per direction. Everything
in `imports/` expires on a timer, so the directory is claimed by a `.foldseek-drop` marker: one without it
is left alone, and one that already held files is never claimed. Anything curated belongs in
`FOLDSEEK_SERVER_INPUT_DIRS`, which is never swept, and may not nest with the shared folder either way.

### Paths

`queryRef` and `fileRefs` are opened by the server. A name relative to `imports/` or to an
`FOLDSEEK_SERVER_INPUT_DIRS` entry needs no path of the server's at all; an absolute path must be inside
one of them. Resolution tries `imports/` first and says which root answered.

### Resources

Exported files are readable as `foldseek-artifact://<artifactId>/<path>`. Small files — manifest, database
map, tree — read directly; anything over `FOLDSEEK_SERVER_RESOURCE_MAX_BYTES` (16 KB) is refused, naming
the path to open instead.

Without a shared folder they sit in the state directory, which the client usually cannot read. A sandboxed
client sees the shared folder at a mount of its own, so the descriptor carries `mountName`, `pathFromMount`
and `ifUnreadable` to rebuild the path — join them to the mount. Grants are per session, and
`localPathVerified` is always `false`.

## Configuration

Environment variables only.

| variable | default | |
|---|---|---|
| `FOLDSEEK_SERVER_BASE_URL` | **required** | deployment origin, e.g. `https://search.foldseek.com` |
| `FOLDSEEK_SERVER_STATE_DIR` | `~/.foldseek-server` | cached results and selections |
| `FOLDSEEK_SERVER_SHARED_DIR` | empty | one folder shared with the client: `exports/` out, `imports/` in |
| `FOLDSEEK_SERVER_INPUT_DIRS` | empty | further directories `queryRef` may read, never swept (`:` separated, `;` on Windows) |
| `FOLDSEEK_SERVER_INPUT_TTL` | `1h` | how long a file in `imports/` is kept after last use |
| `FOLDSEEK_SERVER_RESOURCE_MAX_BYTES` | `16k` | cap on one resource read |
| `FOLDSEEK_SERVER_ARTIFACT_TTL` | `30m` | how long exported files are kept after last use |
| `FOLDSEEK_SERVER_RESULT_TTL` | `24h` | how long cached results are kept after last use |
| `FOLDSEEK_SERVER_LOCAL_PATHS` | `1` | `0` withholds local paths, for remote deployments |
| `FOLDSEEK_SERVER_APP` | `foldseek` | which app's cross-reference links results carry |
| `FOLDSEEK_SERVER_API_PATH` | `/api` | for a deployment behind a path prefix |
| `FOLDSEEK_SERVER_BASIC_AUTH_USER` | — | HTTP basic auth, if the deployment wants it |
| `FOLDSEEK_SERVER_BASIC_AUTH_PASS` | — | |
| `FOLDSEEK_SERVER_RESULT_ROW_CAP` | unset | overrides the assumed per-database hit cap |

Durations take `90s`, `30m`, `24h`, `7d`; sizes take `16k`, `2m`, `1g`. A bad value fails at startup naming the
variable and its range.

### Command line

| | |
|---|---|
| *(none)* | serve over stdio |
| `--http --host H --port N` | serve Streamable HTTP; both required |
| `--gc` | delete expired files and cached results, print a report, exit |
| `--gc --dry-run` | report only |

## License

GPL-3.0-or-later. Source, issues and
[soedinglab/MMseqs2-App](https://github.com/soedinglab/MMseqs2-App)

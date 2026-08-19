# foldseek-server-mcp

Node.js server implementing Model Context Protocol (MCP) for protein structure search — Foldseek,
FoldMason and FoldDisco — against a [Foldseek Server](https://github.com/soedinglab/MMseqs2-App)
deployment such as [search.foldseek.com](https://search.foldseek.com).

## Features

- Structure search: monomer, complex, and structural-motif queries
- Multiple structure alignment with FoldMason
- Queries by PDB / AlphaFold DB accession, local file, or URL — no need to paste a structure
- Complete results written to local files, so alignments and taxonomy stay out of the conversation
- Named hit and alignment-column selections, forwardable into follow-up jobs
- Every derived job records the ticket it came from

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
    - `jobType` (string, optional): `foldseek_search` | `multimer_search` | `folddisco_search` — only
      the databases that tool accepts

- **foldseek_search**
  - Search one monomer structure against structure databases
  - Inputs:
    - `databases` (string[]): paths from `list_databases`
    - `query` (string, optional): PDB or mmCIF text
    - `accession` (string | object, optional): an id, or `{ id, source, autoMotif }`
    - `queryPath` (string, optional): local file the server reads
    - `queryUrl` (string, optional): https URL the server downloads
    - `mode` (string, optional): `3diaa` (default) | `3di` | `tmalign` | `lolalign`
    - `iterativeSearch` (boolean, optional)
    - `taxFilter` (string, optional): taxon ids, comma separated; `!` negates
    - `email` (string, optional), `validateOnly` (boolean, optional)
  - Exactly one of `query`, `accession`, `queryPath`, `queryUrl`
  - Returns a ticket immediately; nothing blocks

- **multimer_search**
  - Search a complex against complex-capable databases
  - Same inputs, minus `iterativeSearch` and `taxFilter`, which do not apply

- **folddisco_search**
  - Search for a structural motif — a residue list like `A123, A156, W201`
  - Inputs:
    - `databases` (string[]): motif-capable paths from `list_databases`
    - `motif` (string, optional): required unless an accession supplies one
    - the same structure inputs as above, plus `email` and `validateOnly`
  - A token may carry a substitution: `A123:W`
  - Every residue must exist in the query, checked before submission

- **foldmason_msa**
  - Align two or more structures; each file name becomes an entry name
  - Inputs:
    - `files` (object[], optional): `[{ name, content }]`
    - `filePaths` (string[], optional): local files the server reads
    - `fileUrls` (string[], optional): https URLs the server downloads
    - `email` (string, optional), `validateOnly` (boolean, optional)
  - Exactly one of the three, at least two structures

- **get_ticket_status**
  - Status of a submitted job
  - Inputs:
    - `ticketId` (string)
  - `PENDING` | `RUNNING` | `COMPLETE` | `ERROR` | `UNKNOWN`, the job type, and its source ticket if any

- **get_result_summary**
  - What a finished result holds, without the rows
  - Inputs:
    - `ticketId` (string)
    - `entry` (number, optional): query index, default 0
  - Per database: hit counts, the top hit, taxonomy availability. Plus the ranking metric, whether
    results were truncated, and any saved selections
  - A couple of kilobytes even on a nine-database search — start here

- **export_result**
  - Write the complete result to files and return their locations
  - Inputs:
    - `ticketId` (string)
    - `entry` (number, optional)
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
    - `entry` (number, optional), `fromName` (string, optional): for `copy`
    - `maxEntries` (number, optional): entries listed by `describe`, default 25
  - Saved against the ticket and durable across restarts

- **select_msa_columns**
  - Name alignment columns in a FoldMason result and get the motif they map to
  - Inputs:
    - `ticketId` (string)
    - `action` (string, optional): the same eight as `select_hits`
    - `columns` (number[], optional) or `ranges` (string[], optional): e.g. `["12-28"]`
    - `entry` (number, optional): which alignment entry the residues are read off, default 0
    - `residues` (object[], optional): `[{ column, aa }]` — ask for a different amino acid at a column;
      `aa: null` clears
    - `name` (string, optional), `fromName` (string, optional)
  - Returns the derived motif plus `residueMapping`, e.g. `20->A17, 23->A20(F):b, 24->gap:Y`
  - `aa` is an amino-acid letter, `X` for any, or `p` `n` `h` `b` `a` for positively charged, negatively
    charged, hydrophilic, hydrophobic, aromatic. **Case matters** — `a` is aromatic, `A` alanine

- **send_to**
  - Forward a hit, a saved selection, or saved alignment columns into a new job
  - Inputs:
    - `from` (object): `{ type, ticketId, entry?, rowId?, name? }`, `type` being `row` | `selection` |
      `msaColumns`
    - `tool` (string): `foldseek` | `multimer` | `foldmason` | `folddisco`
    - `databases` (string[], optional), `mode`, `taxFilter`, `iterativeSearch`, `email` as above
    - `motif` (string, optional): FoldDisco, when the source carries none
    - `includeQuery` (boolean, optional): FoldMason from a selection also sends the original query,
      default true
  - The structure is reassembled for the destination, and the new ticket records its source

### Resources

Exported files are readable as `foldseek-artifact://<artifactId>/<path>`. Small files — the manifest, the
database map, the tree — read directly. Anything over `FOLDSEEK_SERVER_RESOURCE_MAX_BYTES` (16 KB) is
refused; open it from the path `export_result` returned instead.

## Configuration

Environment variables only.

| variable | default | |
|---|---|---|
| `FOLDSEEK_SERVER_BASE_URL` | **required** | deployment origin, e.g. `https://search.foldseek.com` |
| `FOLDSEEK_SERVER_STATE_DIR` | `~/.foldseek-server` | cached results, selections, exported files |
| `FOLDSEEK_SERVER_INPUT_DIRS` | empty | directories `queryPath` may read (`:` separated, `;` on Windows) |
| `FOLDSEEK_SERVER_URL_HOSTS` | empty | hostnames `queryUrl` may download from (comma separated) |
| `FOLDSEEK_SERVER_RESOURCE_MAX_BYTES` | `16k` | cap on one resource read |
| `FOLDSEEK_SERVER_ARTIFACT_TTL` | `30m` | how long exported files are kept after last use |
| `FOLDSEEK_SERVER_RESULT_TTL` | `24h` | how long cached results are kept after last use |
| `FOLDSEEK_SERVER_LOCAL_PATHS` | `1` | `0` withholds local paths, for remote deployments |
| `FOLDSEEK_SERVER_APP` | `foldseek` | which app's cross-reference links results carry |
| `FOLDSEEK_SERVER_API_PATH` | `/api` | for a deployment behind a path prefix |
| `FOLDSEEK_SERVER_BASIC_AUTH_USER` | — | HTTP basic auth, if the deployment wants it |
| `FOLDSEEK_SERVER_BASIC_AUTH_PASS` | — | |
| `FOLDSEEK_SERVER_RESULT_ROW_CAP` | unset | overrides the assumed per-database hit cap |

Durations take `90s`, `30m`, `24h`, `7d`; sizes take `16k`, `2m`. A bad value fails at startup naming the
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
[design notes](https://github.com/soedinglab/MMseqs2-App/blob/master/headless/mcp-server/REFERENCE.md):
[soedinglab/MMseqs2-App](https://github.com/soedinglab/MMseqs2-App)

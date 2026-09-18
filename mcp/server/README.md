# marv-mcp

Use Foldseek for monomer and complex structure search, FoldMason for multiple-structure alignment, and FoldDisco for 3D motif search through one Model Context Protocol (MCP) server.
Results can be inspected as bounded summaries or exported as reproducible files for local analysis.
It connects to a [Foldseek Search Server](https://github.com/soedinglab/MMseqs2-App) deployment such as
[search.foldseek.com](https://search.foldseek.com).

## Features

- Structure search: monomer, complex, and structural-motif queries
- Multiple structure alignment with FoldMason
- Queries by PDB / AlphaFold DB / BFVD accession, or by a file the server can read
- Taxon filtering by scientific name as well as id: `taxFilter: "Bacteria,!Escherichia coli"`
- Complete results written to local files, so alignments and taxonomy persist
- Named hit and alignment-column selections, forwardable into follow-up jobs
- Every derived job records the ticket it came from

## Installation

The server is distributed as a Claude Desktop bundle and may also be bundled by a Claude plugin.
Requires Node.js 18+ when run from source.
`frontend/lib` is installed as well because the shared structure reader it holds is built on molstar.

### Claude Desktop and Cowork

Install the versioned `marv-api-v<version>.mcpb` as a Desktop extension.
The public Foldseek Search Server and a `marv-shared` folder under your home directory are the defaults; either can be changed during installation.

For Claude Code, use either its plugin-bundled runtime or a manually registered checkout, not both in the same client.
Cowork does not execute the runtime bundled by that plugin, so it needs the MCPB.

### Claude Code

Clone this repository, install the server dependencies, then register the checkout's entry point:

```bash
git clone https://github.com/soedinglab/MMseqs2-App.git
cd MMseqs2-App
npm ci --prefix frontend/lib
npm ci --prefix mcp/core
npm ci --prefix mcp/server

claude mcp add marv -e MARV_BASE_URL=https://search.foldseek.com \
  -- node /absolute/path/to/MMseqs2-App/mcp/server/bin/marv-mcp.js
```

`MARV_BASE_URL` is required when running from source and has no default.
Replace the absolute path with the checkout's real path.
If a Claude plugin already bundles this server, use the plugin's installation instructions instead of registering the checkout separately.

### Build the Desktop bundle from source

From the repository root:

```bash
npm ci --prefix frontend/lib
npm ci --prefix mcp/core
npm ci --prefix mcp/server
npm run build:mcpb --prefix mcp/server
```

The bundle is written to `mcp/server/dist/marv-api-v<version>.mcpb`.
Building uses npm as the repository's dependency and task runner; it does not publish either package.

### Over HTTP

For clients that connect to a running checkout rather than starting a local stdio server, run from the
repository root:

```bash
MARV_BASE_URL=https://search.foldseek.com \
  node mcp/server/bin/marv-mcp.js --http --host 127.0.0.1 --port 8080
```

Streamable HTTP, bound to the address given.
Non-loopback clients cannot use local input paths or ask for the server's shared-directory path.
Put TLS and authentication in front of anything not on loopback.

## API

### Tools

| tool | description |
|---|---|
| `get_shared_dir` | verified device-local paths for the shared imports and exports folders |
| `list_databases` | what this deployment can search |
| `foldseek_search` | search one monomer structure |
| `multimer_search` | search a complex |
| `folddisco_search` | search for a structural motif |
| `foldmason_msa` | align two or more structures |
| `get_ticket_status` | status of a submitted job |
| `get_result_summary` | reports what a finished result holds |
| `export_result` | write the complete result to files |
| `select_hits` | name a set of hits |
| `select_msa_columns` | name alignment columns |
| `send_to` | forward a hit or selection into a new job |

- **get_shared_dir**
  - Report the shared directory and its `imports/` and `exports/` paths after the server has verified that all three exist
  - No inputs

- **list_databases**
  - Databases this deployment offers
  - Inputs:
    - `tool` (string, optional): `foldseek` | `multimer` | `folddisco` — only the databases that tool accepts

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
      — e.g. `"Bacteria,!Escherichia coli"`. A name is resolved against NCBI Datasets; an ambiguous one is refused with its candidates, and the ids used come back on the ticket
    - `email` (string, optional), `validateOnly` (boolean, optional)
  - Exactly one of `query`, `accession`, `queryRef`
  - Returns a ticket immediately; nothing blocks

- **multimer_search**
  - Search a complex against complex-capable databases
  - Same inputs, minus `iterativeSearch`, which does not apply.

- **folddisco_search**
  - Search for a structural motif — a residue list like `A123, A156, W201`
  - Inputs:
    - `databases` (string[]): motif-capable paths from `list_databases`
    - `motif` (string, optional): required unless an accession supplies one
    - the same structure inputs as above, plus `email` and `validateOnly`
  - A token may carry a substitution: `A123:W`

- **foldmason_msa**
  - Align two or more structures; each file name becomes an entry name
  - Inputs:
    - `files` (object[], optional): `[{ name, content }]`
    - `fileRefs` (string[], optional): local files the server reads
    - `accessions` (string[] | object[], optional): ids the server fetches, e.g. `["1abc", { "id": "P0DTC2", "source": "AlphaFoldDB" }]`
    - `email` (string, optional), `validateOnly` (boolean, optional)

- **get_ticket_status**
  - Status of a submitted job
  - Inputs:
    - `ticketId` (string)
  - `PENDING` | `RUNNING` | `COMPLETE` | `ERROR` | `UNKNOWN`, the tool, and its source ticket if any

- **get_result_summary**
  - What a finished result holds, without the rows
  - Inputs:
    - `ticketId` (string)
    - `queryIdx` (number, optional): which query of a multi-query ticket, default 0. Foldseek and multimer only.

- **export_result**
  - Write the complete result to files and return an artifact descriptor
  - Inputs:
    - `ticketId` (string)
    - `queryIdx` (number, optional)

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
  - Saved against the ticket and durable across restarts.
  The reply carries the name and the new size; `action: "describe"` is how you read a selection back.
  In the summary's `selections[]`, a hit selection carries `queryIdx` and a column selection carries `entry`

- **select_msa_columns**
  - Name alignment columns in a FoldMason result and get the motif they map to
  - Inputs:
    - `ticketId` (string)
    - `action` (string, optional): the same eight as `select_hits`
    - `columns` (number[], optional) or `ranges` (string[], optional): e.g. `["12-28"]`
    - `entry` (number, optional): which **alignment row** the residues are read off, default 0.
    - `residues` (object[], optional): `[{ column, aa }]`. `aa: null` clears
    - `name` (string, optional), `fromName` (string, optional)
  - Returns the derived motif plus `residueMapping`, e.g. `20->A17, 23->A20(F):b, 24->gap:Y`

- **send_to**
  - Forward a hit, a saved selection, or saved alignment columns into a new job
  - Inputs:
    - `from` (object): `{ type, ticketId, queryIdx?, rowId?, name? }`, `type` being `row` | `selection` | `msaColumns`
    - `tool` (string): `foldseek` | `multimer` | `foldmason` | `folddisco`
    - `databases` (string[], optional), `mode`, `taxFilter`, `iterativeSearch`, `email` as above, each refused when the destination has no such field, rather than dropped: FoldDisco takes no `taxFilter` or `mode`, multimer no `iterativeSearch`
    - `motif` (string, optional): FoldDisco, when the source carries none
    - `includeQuery` (boolean, optional): FoldMason from a selection also sends the original query,
      default true
  - The structure is reassembled for the destination, and the new ticket records its source

### Responses

Every reply is one JSON object.

- a call that failed → `{ isError: true, code, error }`. `code` is always present
- a `validateOnly` dry run that *succeeded* and found problems → `{ ok: false, problems[] }`, with no `isError`. Branch on `isError` first, then on `ok`; a caller checking only `isError` reads an unusable database as a passing validation

| call | comes back |
|---|---|
| a submit | `ticketId`, `status`, and only what you could not know: `loaded` for a fetched structure, `motif` when one was derived, `taxFilter` + `taxonomy` when a name was resolved |
| `validateOnly: true` | `ok`, `problems[]`, `would` — the request that would have been sent |
| `get_ticket_status` | `ticketId`, `status`, `tool`, `resultUrl`, `derivedFrom` if forwarded |
| `get_result_summary` | a bounded orientation payload, ~1–2.5 KB |
| `get_shared_dir` | verified device-local shared, imports and exports paths |
| `export_result` | an artifact id, mount-relative path and file list |
| `select_hits` | `name` and the new `size`, plus `rejected` when ids did not resolve |
| `select_msa_columns` | the derived `motif`, `residueMapping`, and the column counts |

### The shared folder

`MARV_SHARED_DIR` names one directory both sides use. When unset it is `marv-shared` under the current user's home directory. It derives two:

```
<shared>/exports    the server writes, client read     30 min
<shared>/imports    client write, the server reads      1 h
```

### Paths

`queryRef` and `fileRefs` are opened by the server. 
A relative name resolves under `imports/`; an absolute path must also remain inside it after symlinks are resolved.

## Configuration

Environment variables only.

| variable | default | |
|---|---|---|
| `MARV_BASE_URL` | **required** | deployment origin, e.g. `https://search.foldseek.com` |
| `MARV_STATE_DIR` | `~/.marv` | cached results and selections |
| `MARV_SHARED_DIR` | home directory + `marv-shared` | one folder shared with the client: `exports/` out, `imports/` in |
| `MARV_INPUT_TTL` | `1h` | how long a file in `imports/` is kept after last use |
| `MARV_ARTIFACT_TTL` | `30m` | how long exported files are kept after last use |
| `MARV_RESULT_TTL` | `24h` | how long cached results are kept after last use |
| `MARV_LOCAL_PATHS` | `1` | `0` withholds local paths, for remote deployments |
| `MARV_API_PATH` | `/api` | for a deployment behind a path prefix |
| `MARV_BASIC_AUTH_USER` | — | HTTP basic auth, if the deployment wants it |
| `MARV_BASIC_AUTH_PASS` | — | |
| `MARV_RESULT_ROW_CAP` | unset | overrides the assumed per-database hit cap |

### Command line

| | |
|---|---|
| *(none)* | serve over stdio |
| `--http --host H --port N` | serve Streamable HTTP; both required |
| `--gc` | delete expired files and cached results, print a report, exit |
| `--gc --dry-run` | report only |

## License

GPL-3.0-or-later. Source, issues and [soedinglab/MMseqs2-App](https://github.com/soedinglab/MMseqs2-App)
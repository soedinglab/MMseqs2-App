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
| `MMSEQS2_AGENT_ARTIFACT_TTL` | `30m` | how long an exported artifact survives after last access; `1m` … `7d` |
| `MMSEQS2_AGENT_RESULT_TTL` | `24h` | how long a cached result payload survives after last use; `1m` … `30d` |
| `MMSEQS2_AGENT_LOCAL_PATHS` | `1` | `0` withholds local paths from descriptors |
| `MMSEQS2_AGENT_RESOURCE_MAX_BYTES` | `16k` | cap on one resource read; `1k` … `32m` |
| `MMSEQS2_AGENT_INPUT_DIRS` | empty | colon-separated directories `queryPath` may read from |
| `MMSEQS2_AGENT_RESULT_ROW_CAP` | unset | 1 … 1000000; overrides the search saturation cap |

Twelve variables, one required. Both TTLs take a duration — `90s`, `30m`, `24h`, `7d` — or a plain number
of seconds. Out-of-range values fail at startup naming the variable and its range, rather than being
clamped.

Derived data expires fast, fetched data slowly. An artifact is rebuilt from the cached parse in
milliseconds, so thirty minutes costs nothing; the cached parse itself is a network round trip and a
multi-MB parse, so it is kept for a day. `ticket.json` and `selections.json` never expire.

## Installing

**Claude Code:**

```bash
claude mcp add mmseqs2 -e MMSEQS2_AGENT_BASE_URL=https://search.foldseek.com \
  -- npx -y mmseqs2-agent-mcp
```

Or project-scoped in `.mcp.json`, committed for a team:

```jsonc
{ "mcpServers": { "mmseqs2": {
    "command": "npx", "args": ["-y", "mmseqs2-agent-mcp"],
    "env": { "MMSEQS2_AGENT_BASE_URL": "https://search.foldseek.com" } } } }
```

**Claude Desktop:** the same object in `claude_desktop_config.json`
(`~/Library/Application Support/Claude/`, or `%APPDATA%\Claude\`). Needs Node and a working global
npm. **Cowork** uses Desktop's servers, so configuring Desktop configures Cowork — note the boundary:
the server runs outside the VM, the code Claude writes runs inside it.

From a checkout instead of the registry:

```bash
claude mcp add mmseqs2-agent -- node /path/to/headless/mcp-server/bin/mmseqs2-agent-mcp.js
```

The published package is one file: `dist/server.mjs`, with core and `frontend/lib` inlined by esbuild
and `@modelcontextprotocol/sdk` the only runtime dependency. `bin/mmseqs2-agent-mcp.js` runs the bundle
when it is present and `src/` otherwise, so a checkout works unbundled.

```bash
npm run build      # dist/server.mjs, ~254 KB; never committed
npm pack           # 4 files, ~70 KB
```

## Query input

`query` takes structure text. `queryPath` takes a path the server reads instead — a 361 KB mmCIF is
~91,000 tokens inline and 31 as a path. It is off until `MMSEQS2_AGENT_INPUT_DIRS` names the
directories the server may read; anything resolving outside them, symlinks included, is refused with
`INPUT_PATH_REFUSED`. `foldmason_msa` takes `filePaths` the same way. `query`, `queryPath` and
`accession` are mutually exclusive, and a path never reaches the backend or a result — only the bytes
it held, recorded as `queryBytes` and `queryHash`.

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

### Reading an artifact from a script

`export_result` returns, besides the JSON descriptor, one `resource_link` content block per file. It
also returns `artifactRoot`, `localPath` (the manifest inside it), and `localPathVerified: false` — the
server cannot know whether the caller shares its filesystem, so it says so rather than implying it.

The handshake, once per session:

1. read `manifest.json` at `localPath` with the host's own file tool — 1-3 KB;
2. compare its `artifactId` to the handle you were given. Equal means paths work here;
3. from then on, compose `artifactRoot` + any manifest path and open files directly. No tool call, no
   bytes through the model.

If step 1 or 2 fails, this host cannot support the local-script workflow. Fall back to resource reads
for the small files and treat the summary as the product.

Resource reads are capped at `MMSEQS2_AGENT_RESOURCE_MAX_BYTES` (16 KB by default), so a row file is
refused with `RESOURCE_TOO_LARGE` naming its size and pointing back here. That is deliberate: reading a
real 3Di+AA row file as a resource costs on the order of a million tokens.

## Selections

Named, saved against the ticket, and durable across restarts. The convention:

- edit `draft` (or `default`) freely;
- `action: "copy"` it to `to-<destination>__NNN` for each forwarding job;
- leave that name alone afterwards — it is what the job's `derivedFrom.selection` points at.

Copying never overwrites, and the copy is independent in both directions. Revise by copying again.

## Motifs and substitutions

A column selection's motif is always derived from `(entry, columns)`. There is no way to set one
directly, because an override lets the recorded columns and the searched motif disagree — and the
point of recording columns is that `msa/residue-map.jsonl` in the artifact reproduces the motif with
no server involved.

To ask for something other than the residue that is there, annotate the column:

```jsonc
select_msa_columns { ticketId, ranges: ["20-32"], residues: [{ "column": 23, "aa": "b" }] }
// -> motif          "A17, A18, A19, A20:b, …"
// -> residueMapping "20->A17, 21->A18, 22->A19, 23->A20(F):b, …"
```

`residueMapping` is the whole correspondence on one line: column, the token it resolved to, and — only
where a substitution asks for something else — the residue actually there in parentheses. `23->A20(F):b`
reads "column 23 is A20, which is phenylalanine, and hydrophobic was asked for", so a slip is visible
without a field per annotation. It is capped at 32 entries (`, +N more`); `selectedColumns` always
carries the complete list, compressed.

| `aa` | meaning |
|---|---|
| `A` `C` `D` `E` `F` `G` `H` `I` `K` `L` `M` `N` `P` `Q` `R` `S` `T` `V` `W` `Y` | that amino acid |
| `X` | any amino acid |
| `p` `n` `h` `b` `a` | positively charged, negatively charged, hydrophilic, hydrophobic, aromatic |
| `null` | clear the annotation |

**Case is significant and never normalised.** Four group codes collide with a real amino acid when the
case flips — `a`/`A` aromatic vs alanine, `n`/`N` negative vs asparagine, `h`/`H` hydrophilic vs
histidine, `p`/`P` positive vs proline.

The column must already be selected. An annotation on a column that is a gap *in the current entry* is
kept and simply absent from the motif, shown as `23->gap:Y` — exactly how a selected gap column already
behaves; switching entry re-resolves both. Deselecting a column drops its annotation and says so, in
`droppedSubstitutions`.

A whole hand-written motif goes to `folddisco_search` directly. `send_to` accepts `motif` only when the
source carries none — a Foldseek hit has no matched residues, so forwarding one to FoldDisco needs one
given. `derivedFrom.motifSource` records which of the three it was: `columns`, `hit` or `caller`.

## Errors

Two kinds, reported two ways.

- **`isError: true` with a `code`** — the tool ran and failed for a reason worth acting on:
  `RESULT_NOT_READY`, `RESULT_FAILED`, `INVALID_ENTRY`, `UNKNOWN_TICKET`, `INVALID_INPUT`,
  `SELECTION_NOT_FOUND`, `SELECTION_COLLISION`, `SELECTION_NAME_INVALID`, `EXPORT_FAILED`,
  `INPUT_PATH_REFUSED`, `UNSUPPORTED_ON_DEPLOYMENT`.
- **A protocol error** — the tool or resource does not exist, or a resource URI is not readable
  (`ARTIFACT_NOT_FOUND`, `INVALID_ARTIFACT_PATH`). Nothing ran and no argument change helps.

## Operator maintenance

```bash
mmseqs2-agent-mcp --gc --dry-run     # what would be collected, and why
mmseqs2-agent-mcp --gc               # collect it
```

Both print one report to stderr — `{ artifacts, results }` — and exit without starting a server. Each
sweep is bounded and audited to `<stateDir>/artifact-gc-audit.jsonl` (rotated at 4 MB), with a `scope`
field saying which collector wrote the line.

The artifact sweep cannot reach the ticket cache: its root is a sibling of it, not its parent. The
result sweep does walk `tickets/**`, and buys the guarantee back differently — it removes only files
named `result-<entry>.json`, `foldmason.json` or `folddisco.json`, it never removes a directory, and
`ticket.json` and `selections.json` are not candidates at any age.

## Tests

```bash
npm test                                                        # no network
MMSEQS2_AGENT_LIVE_TESTS=1 MMSEQS2_AGENT_BASE_URL=… npm test    # + read-only live checks
MMSEQS2_AGENT_PACK_TEST=1 node --test test/pack.test.js         # build, pack, install, drive it
```

The tools are defined in `src/tools.js` with no MCP SDK involved, so they can be exercised against a
stubbed client without a transport — which is what most of the suite does.

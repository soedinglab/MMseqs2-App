# `foldseek-server-lib`

A headless client for this repo's Go backend: submit Foldseek, FoldMason and FoldDisco jobs, poll
them, decode the results with the frontend's own parsing code, and forward a hit or an alignment
region into the next search.

Node 18+. No dependencies outside the repo except `msa-webgpu` (for the substitution matrices).

## Creating a client

```js
import { createClient } from 'foldseek-server-lib';

const client = createClient({
    baseUrl: 'https://search.foldseek.com',   // required — the site origin, not the /api path
    app: 'foldseek',                          // affects cross-reference links in parsed results
    apiPath: '/api',                          // for a deployment using config.Server.PathPrefix
    stateDir: '~/.foldseek-server',             // ticket cache; FOLDSEEK_SERVER_STATE_DIR overrides
    basicAuth: null,                          // { user, pass }
    cg2allUrl: 'https://3di.foldseek.com/cg2all/predict',
    onWarning: msg => console.warn(msg),      // non-fatal notes: a DB lookup that fell back, rows skipped
});
```

`baseUrl` has **no default**. A plausible one would send someone's structures to a public production
server without them choosing it.

## Submitting

```js
const ticket = await client.submitFoldseekSearch({ query, databases: ['pdb100'], mode: '3diaa' });
await client.submitMultimerSearch({ query, databases });          // complex search
await client.submitFoldMason({ files: [{ name, content }, …] });  // two or more
await client.submitFoldDisco({ query, databases, motif });        // motif checked against the query

await client.validateSubmission({ tool, query, databases, … });   // every check, nothing queued
```

Each returns a `Ticket` — `{ id, status }` plus `.wait()` and `.getResult()`. Submission validates
before it sends: databases against `list_databases`' capability flags (the same filter `Databases.vue`
applies, which is stricter than the backend's), the taxon filter against the backend's grammar, the
motif against the query structure, and FoldMason's two-file minimum. A failure here costs nothing; the
same mistake sent to the server costs a queue slot and comes back as "invalid taxon filter".

Multimer search rejects `iterativeSearch`: the complex job never receives it, so accepting it would
read as support that is not there.

## Polling

```js
const done = await client.waitForCompletion(id, { intervalMs: 2000, timeoutMs: 0, onStatus });
await client.pollTicket(id);          // one poll
await client.getTicketType(id);       // structuresearch | complexsearch | foldmasoneasymsa | folddisco
await client.resultUrl(id);           // the page a human would open
```

A cached `COMPLETE` skips the network: results never expire server-side, so a completed ticket cannot
revert to running.

## Orientation and export

```js
await client.getResultSummary(id, entry);   // bounded: counts, ranking, one top hit per database
await client.exportResult(id, entry);       // the complete result as files; returns a descriptor
```

`getResultSummary` takes a ticket and an entry and nothing else — no fields, sorting, filtering or
limits. It is bounded by construction and validated against `foldseek-server/result-summary@1` before
it is returned. An unfinished ticket comes back as `RESULT_NOT_READY` after a single status read —
never a wait loop.

`exportResult` writes one reproducible bundle per result unit and returns roles, byte counts and row
counts, never contents:

```text
manifest.json  databases.json  READY
search/db-<i>.rows.jsonl        every parsed row, one JSON object per line
search/db-<i>.taxonomy.json     every node, with parentTaxId derived from the depth ladder
search/db-<i>.motif-patterns.json
msa/entries.json  msa/aa.fasta  msa/3di.fasta
msa/columns.jsonl               every column, every available metric
msa/residue-map.jsonl           column -> residue and chain, one line per entry
msa/coordinates.json.gz  msa/tree.json
```

Filenames are index-based, so no database id reaches a path; the manifest maps index to id. The cache
key is `sha256(serverNamespace ␀ ticketId ␀ normalizedEntry ␀ artifactSchemaVersion)` — the four
components joined with NUL rather than concatenated, so no two component tuples can collide. Artifacts
expire two hours after last access.

`msa/residue-map.jsonl` carries `occupiedColumns` (compressed ranges) and `tokens` in parallel:
`tokens[i]` is the motif form of the i-th occupied column and also that residue's offset into the
entry's `ca` triplets. It is the same convention `MsaColumnSelection` derives its motif from, so a
consumer of an exported map cannot drift from the mounted page.

### The four kinds of state

| state | where | lifetime |
|---|---|---|
| ticket metadata and `derivedFrom` | `<stateDir>/tickets/…/ticket.json` | kept |
| source result cache | `<stateDir>/tickets/…/result-*.json` | 24 h from last **use**, collected |
| named selections | `<stateDir>/tickets/…/selections.json` | kept, explicit operations only |
| public artifacts | `<stateDir>/artifacts/<id>/` | 30 min from last access, collected |

Derived data expires fast, fetched data slowly: rebuilding an artifact re-reads the cached parse, so
thirty minutes costs milliseconds rather than a request. `readResult` touches the file it read, so the
result TTL runs from last use and an active ticket cannot expire mid-workflow.

`client.collectGarbage({ dryRun })` runs both sweeps and returns `{ artifacts, results }`, bounded and
audited. The artifact root is a *sibling* of the ticket cache, so that collector cannot reach source
results or selections at all. The result collector does walk `tickets/**`, and is constrained instead
by an allowlist: only `result-<entry>.json`, `foldmason.json` and `folddisco.json`, never a directory,
and never `ticket.json` or `selections.json`.

## Reading results

```js
const table = await client.getResult(id, entry);        // Foldseek / Multimer
const table = await client.getFoldDiscoResult(id);      // FoldDisco (no entry index on that route)
const table = await client.getResultTable(id);          // whichever this ticket is

table.getTableSummary({ merged: true });                 // survey every database, no rows
table.getTable({ db: 'afdb50', sortKey: 'eval', limit: 20, fields: ['target', 'eval'] });
table.getTaxonomy('afdb50');
```

Start with `getTableSummary()`. Surveying nine databases that way costs about 1,000 tokens against
73,000 for the equivalent `getTable({db:'*'})`, and it tells you which database is worth reading.
`merged: true` adds one ranking across all of them (100 hits per database enter the pool regardless
of how many you ask back).

Metrics arrive from the parser **rounded**, and the artifact and summary carry the rounded value as a
number: an E-value keeps 3 significant digits (`toExponential(2)`), a TM-score 3 decimals
(`toFixed(3)`), IDF-score and RMSD 3 decimals. Under `lolalign` the parser also multiplies `eval` by
100 before rounding, so a LOL-score reads the way the page shows it and not the way an upstream LoL
score would. `numericMetric` recovers the number; the precision that was dropped is gone for good.

`getTable` takes `taxonFilter` (by taxon id *or* name, descendants included by default) and, for
FoldDisco, `motifFilter` — which selects on the matched-query-residue pattern the parser calls `gaps`.
Both are applied before sorting and paging, so `total` describes the filtered set.

## Selecting and forwarding

```js
const selection = table.select({ db: 'afdb50', limit: 20 });   // or table.select(['0#1', '0#7'])
selection.remove({ taxonFilter: { taxon: 'Homo sapiens' }, limit: 50 });
selection.describe();                                          // what is in it; flags duplicate names
await selection.save('shortlist');                             // survives the process
await table.loadSelection('shortlist');

const ticket = await selection.sendTo({ tool: 'foldmason' });  // includeQuery: true by default
const ticket = await table.row('0#1').sendTo({ tool: 'folddisco', databases: ['pdb_folddisco'] });
```

Selections hold row ids only, and the structures behind them are fetched when `sendTo` runs — so a
thousand-row selection costs nothing until it is submitted. They are saved per ticket because
forwarding produces a *new* ticket, and coming back to adjust the original choice is the normal next
step.

What `sendTo` builds depends on **both** where the query came from and where it is going:

| origin | → foldseek / multimer | → foldmason | → folddisco |
|---|---|---|---|
| a Foldseek hit (per-chain CA) | `mergePdbs` if multi-chain, else `mockPDB` | `encodeMultimer` if multi-chain | the original file from the source database if there is one, else cg2all reconstruction |
| a FoldMason entry | `decodeMultimer`, used directly | as-is | `decodeMultimer` → one cg2all call |
| a structure file (FoldDisco hit, loaded accession) | as-is | as-is | as-is |

Two rules behind that table: Foldseek reads a real multi-chain PDB, so it must never be handed the
FoldMason encoding; and only FoldDisco needs full atoms, so reconstruction never happens for the
others. `tool: 'foldseek'` on a multi-chain query stays a plain search — Foldseek treats each chain as
its own query, which is a legitimate way to search a complex, so nothing is promoted automatically.

Every forwarded job records `derivedFrom` in its cache entry: the source ticket, the row or columns it
came from, and how the structure was assembled.

## Alignments

```js
const res = await client.getFoldMasonResult(id);
foldMasonSummary(res);                            // counts, available metrics, each metric's spread
await client.getFoldMasonColumns(id, { metrics: ['lddt', 'conservation'], offset: 40, limit: 20 });
await client.getFoldMasonFasta(id, { representation: 'aa' });
await client.getFoldMasonCoordinates(id, { entries: [0] });

msaResidueMap(res, 0);                            // column -> { residueIndex, chain, resno, token }

const columns = await client.selectMsaColumns(id, { entry: 0, columns: [12, 13, 14] });
columns.motif;                                    // 'A31, A32, A33' — chain + original residue number
await columns.sendTo({ tool: 'folddisco', databases: ['pdb_folddisco'] });
```

Quality and conservation come from a CPU port of the page's WGSL compute shader, checked column for
column against real GPU output (`test/fixtures/msa-gpu-metrics.json`). LDDT does not come from the
shader at all — the backend ships it per column, and `-1` means *absent*, reported as `null`.

`foldMasonSummary` is the cheap way in — entry and column counts, which metrics exist, and the spread
of each — and it is bounded, so it costs the same on a 149-column alignment and a 5,000-column one.
There is deliberately no server-side "interesting columns" pick beyond it: `foldMasonColumns` reports
every column with every available metric, and which columns matter is the caller's analysis. `msaResidueMap`
turns a column into the residue and chain frame of one entry — the same convention
`MsaColumnSelection` derives its motif from, so a consumer of an exported map cannot drift from it.

## Structures and motifs

```js
await client.loadAccession('1STP', { source: 'PDB' });    // + Q-BioLiP binding site as a motif
await client.loadAccessions(['1STP', '3ERK']);
await client.resolveStructureFromDb('afdb50', 'AF-P00001-F1-model_v4');
await client.reconstructFullAtom(caOnlyPdb);              // cg2all

client.computeDefaultMotif(text);                          // every residue; a palette to narrow
client.validateMotif(motif, text);                         // syntax, existence, nameability
client.normalizeChainNames(text, { motif });               // single-character chain names
```

`loadAccession` on a PDB id also asks Q-BioLiP for binding sites and, if one exists, comes back with
`.motif` already set — so a motif search on a known binding site is one call. It normalizes two
Q-BioLiP conventions:

- Q-BioLiP reports its sites in *auth* numbering for some entries and *label* numbering for others
  (1A4G is the latter). A residue that resolves only under label numbering is translated to auth
  rather than dropped, and anything that resolves under neither is reported.
- Its receptor assemblies name chains `A1`…`A4`, and a motif token concatenates chain and residue
  number, so `A1120` reads as chain `A` residue `1120`. Chains whose names contain a digit are renamed
  and the motif is rewritten with them, with the mapping in `.chainsRenamed`. Length is not the test:
  `AA187` has only one reading, so a chain called `AA` is left alone.

`validateMotif` distinguishes three outcomes: a token naming nothing is refused, a token that resolves
only by string concatenation is flagged (`ambiguous`) but allowed, and everything else passes.

## The cache

`stateDir` holds one directory per ticket, sharded like the backend's own job directories:
`ticket.json` (kind, status, submission summary, `derivedFrom`), `result-<entry>.json`,
`foldmason.json`, `folddisco.json`, `selections.json`. Only terminal results are cached, and the query
itself never is — 1CRN is 69 KB as mmCIF, and storing it would turn a 300-byte record into a 70 KB
one for something the server already has. Its length and a hash prefix are kept instead.

`client.listCachedTickets({ limit })` reads it without touching the network.

## Testing

`npm test` runs offline tests by default; live tests are opt-in.

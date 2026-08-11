// The sorted, paginated view of a parsed result — the headless counterpart of ResultView.vue's
// getTable().
//
// Sorting is not reimplemented: it imports resultSort.js, the same module the mounted table and the
// in-page API use. That file's own header explains why it exists ("the mounted table and the API
// import from here, which is the point: they cannot drift into sorting differently"), and a second
// implementation here would reintroduce exactly the drift it was extracted to prevent.
//
// Row shape follows _rowFor(), minus the fields that only mean something on a mounted page:
//   `selected`        reads component selection state
//   `visible`         reads the table's render-window filter
//   `filtersApplied`  reports whether the *open tab's* filters were in play
//   `activeDatabase`  is the open tab
// None have a headless equivalent, and reporting e.g. visible:true would state that no filter is
// active as though that had been checked. They are omitted rather than faked.
//
// Shape of the parsed object, since it is easy to guess wrong: parseResults() returns
// `{type, queries, mode, results}`. There is no top-level `query` — the queries are
// `queries[i].header`/`.sequence`, and each hit also names its own query. Taxonomy reports hang off
// each database, nested one level: `results[i].taxonomyreports[0]` is the flat depth-first array,
// which is how ResultView.vue and taxonomyFilter.js both address it.

import {
    FOLDSEEK_SORT_KEYS, FOLDDISCO_SORT_KEYS,
    createSortMemo, defaultSortOrder, isValidSortKey, sortIndices,
} from '../../../frontend/lib/resultSort.js';
import { expandDescendants } from '../../../frontend/lib/taxonomyFilter.js';

const SORT_KEYS = { foldseek: FOLDSEEK_SORT_KEYS, folddisco: FOLDDISCO_SORT_KEYS };

export class ResultTable {
    /**
     * @param {object} parsed  parseResults()/parseResultsFoldDisco() output
     * @param {{ticket: string, entry: number, app: string, tool?: string}} meta
     */
    constructor(parsed, { ticket, entry = 0, app = 'foldseek', tool = 'foldseek' } = {}) {
        this.raw = parsed;
        this.ticket = ticket;
        this.entry = entry;
        this.app = app;
        this.tool = tool;
        this._sortMemo = createSortMemo();
    }

    get databases() { return (this.raw?.results ?? []).map(r => r.db); }
    get mode() { return this.raw?.mode ?? ''; }
    get isComplex() {
        return String(this.raw?.mode ?? '').includes('complex') || this.raw?.type === 'complexsearch';
    }

    /** This entry's query. A ticket can hold several; the route's entry index picks one. */
    get queries() { return this.raw?.queries ?? []; }
    get query() { return this.queries[0] ?? null; }
    get queryHeader() { return this.query?.header ?? null; }

    _resolveDb(db) {
        const results = this.raw?.results ?? [];
        const byName = results.findIndex(r => r.db === db);
        if (byName !== -1) return byName;
        const asIndex = Number(db);
        if (Number.isInteger(asIndex) && asIndex >= 0 && asIndex < results.length) return asIndex;
        return null;
    }

    /**
     * Group ids allowed through by a taxonomy filter, or null for "no filter".
     *
     * The page does this by writing a visibility mask onto the mounted table and re-running its
     * render-window bookkeeping. None of that exists here, and none of it is the actual operation:
     * expandDescendants() already answers "every taxId under this subtree", and intersecting that
     * with each group's own taxId is the whole filter. Applied before sorting and pagination, so
     * `total` and `returned` describe the filtered set rather than the unfiltered one.
     */
    _taxonAllowSet(entryData, taxonFilter) {
        if (!taxonFilter || taxonFilter.taxId === undefined) return null;
        const { taxId, includeDescendants = true } = taxonFilter;

        const wanted = new Set([String(taxId)]);
        if (includeDescendants) {
            const report = entryData.taxonomyreports?.[0] ?? [];
            for (const id of expandDescendants(report, taxId)) wanted.add(String(id));
        }
        return wanted;
    }

    _rowFor(dbIdx, groupId, entryData, alignments, rank, includeChains, fields) {
        const group = alignments[groupId];
        const chains = Array.isArray(group) ? group : [group];
        const head = chains[0];

        const row = {
            id: `${dbIdx}#${groupId}`,
            entryIndex: Number(groupId),
            rank,
            target: head.target,
        };
        // A FoldDisco hit is one structure, not a chain group; the page reports no chain count for
        // it, and a constant 1 would only invite someone to read meaning into it.
        if (this.tool !== 'folddisco') row.chainCount = chains.length;
        if (entryData.hasDescription) row.description = head.description;
        if (entryData.hasTaxonomy) { row.taxId = head.taxId; row.taxName = head.taxName; }
        if (head.complexqtm !== undefined) {
            row.complexqtm = head.complexqtm;
            row.complexttm = head.complexttm;
        }
        if (this.tool === 'folddisco') {
            // FoldDisco hits carry their own measures, and dbkey is what addresses the structure
            // (see idForHit) — reporting Foldseek's alignment fields here would be nulls.
            // targetresidues/motifPattern are the matched motif on the hit itself, which is what a
            // caller forwarding this hit onwards needs.
            Object.assign(row, {
                // The page renames two parser fields on the way out, and the names it exposes are
                // the ones callers know: targetname -> targetName, gaps -> motifPattern (a
                // per-query-residue bitmask, "1" matched and "0" missing).
                targetName: head.targetname,
                dbkey: head.dbkey, idfscore: head.idfscore,
                rmsd: head.rmsd, nodecount: head.nodecount,
                targetresidues: head.targetresidues, motifPattern: head.gaps,
            });
        } else {
            Object.assign(row, {
                prob: head.prob, seqId: head.seqId, eval: head.eval, score: head.score,
                qStartPos: head.qStartPos, qEndPos: head.qEndPos, qLen: head.qLen,
                dbStartPos: head.dbStartPos, dbEndPos: head.dbEndPos, dbLen: head.dbLen,
            });
        }
        if (includeChains) {
            row.chains = chains.map(c => ({
                query: c.query, target: c.target, seqId: c.seqId,
                eval: c.eval, score: c.score, prob: c.prob,
            }));
        }
        if (!fields) return row;
        const picked = {};
        for (const f of ['id', 'entryIndex', 'rank', ...fields]) {
            if (f in row) picked[f] = row[f];
        }
        return picked;
    }

    /**
     * Which databases to report on.
     * @returns {{targets: number[]} | {error: object}}
     */
    _selectDatabases(db) {
        const results = this.raw.results;
        if (db === '*' || db === 'all') return { targets: results.map((_, i) => i) };

        if (Array.isArray(db)) {
            if (db.length === 0) {
                return { error: { page: this.tool, error: 'db was an empty array', available: this.databases } };
            }
            const targets = [];
            const unknown = [];
            for (const one of db) {
                const i = this._resolveDb(one);
                if (i === null) unknown.push(one);
                else if (!targets.includes(i)) targets.push(i);
            }
            if (unknown.length) {
                return {
                    error: {
                        page: this.tool,
                        error: `unknown database${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}`,
                        available: this.databases,
                    },
                };
            }
            return { targets };
        }

        if (db === null || db === undefined) {
            // No open tab exists here, so there is no "current" database to fall back to. One
            // database means no ambiguity; more than one is the caller's choice to make.
            if (results.length === 1) return { targets: [0] };
            return {
                error: {
                    page: this.tool,
                    error: 'this ticket has more than one database; pass db (a name, index, or array), or db:"*" for all',
                    available: this.databases,
                },
            };
        }

        const i = this._resolveDb(db);
        if (i === null) {
            return { error: { page: this.tool, error: `unknown database: ${db}`, available: this.databases } };
        }
        return { targets: [i] };
    }

    /**
     * @param {object} [opts]
     * @param {string|number|Array<string|number>} [opts.db]  database name(s) or index(es); '*' for all
     * @param {string} [opts.sortKey]
     * @param {number} [opts.sortOrder]
     * @param {number} [opts.offset]
     * @param {number} [opts.limit]
     * @param {boolean} [opts.includeChains]
     * @param {string[]} [opts.fields]
     * @param {{taxId: string|number, includeDescendants?: boolean}} [opts.taxonFilter]
     */
    getTable(opts = {}) {
        if (!this.raw?.results) return { page: this.tool, error: 'no results loaded' };

        const {
            db = null, sortKey = null, sortOrder = null,
            offset = 0, limit = 20, includeChains = false, fields = null,
            taxonFilter = null,
        } = opts;

        const selection = this._selectDatabases(db);
        if (selection.error) return selection.error;
        const { targets } = selection;

        // The limit applies per database, so a named limit is honoured but the default shrinks when
        // several are asked for — otherwise nine databases silently multiply the response ninefold.
        const perDb = targets.length > 1 && opts.limit === undefined ? 5 : limit;

        const validKeys = SORT_KEYS[this.tool] ?? FOLDSEEK_SORT_KEYS;
        const databases = targets.map(dbIdx => {
            const entryData = this.raw.results[dbIdx];
            const alignments = entryData.alignments || {};
            const key = sortKey
                || (this.tool === 'folddisco' ? 'idf' : (this.isComplex ? 'qtm' : 'score'));
            if (!isValidSortKey(key, this.tool)) {
                return {
                    db: entryData.db, dbIndex: dbIdx,
                    error: `invalid sortKey: ${key}`, validSortKeys: validKeys,
                };
            }
            const order = sortOrder != null
                ? Number(sortOrder)
                : defaultSortOrder(key, { mode: this.mode });

            const allow = this._taxonAllowSet(entryData, taxonFilter);
            let source = alignments;
            if (allow) {
                source = {};
                for (const [gid, group] of Object.entries(alignments)) {
                    const head = Array.isArray(group) ? group[0] : group;
                    if (head?.taxId !== undefined && allow.has(String(head.taxId))) source[gid] = group;
                }
            }

            // The memo caches by (cacheKey, sortKey, sortOrder), so a filtered view must not reuse
            // the unfiltered key; filtered sorts go straight to sortIndices instead.
            const sorted = allow
                ? sortIndices(source, key, order,
                    { mode: this.mode, isComplex: this.isComplex, tool: this.tool })
                : this._sortMemo.get(`${dbIdx}:${this.mode}`, alignments, key, order,
                    { mode: this.mode, isComplex: this.isComplex, tool: this.tool });

            const page = sorted.slice(offset, offset + perDb);
            return {
                db: entryData.db,
                dbIndex: dbIdx,
                sortKey: key,
                sortOrder: order,
                total: sorted.length,
                offset,
                returned: page.length,
                hasDescription: !!entryData.hasDescription,
                hasTaxonomy: !!entryData.hasTaxonomy,
                taxonFiltered: !!allow,
                rows: page.map((gid, i) => this._rowFor(
                    dbIdx, gid, entryData, source, offset + i, includeChains, fields)),
            };
        });

        const out = {
            ok: !databases.some(d => d.error),
            page: this.tool,
            ticket: this.ticket,
            entry: this.entry,
            type: this.raw.type ?? (this.tool === 'folddisco' ? 'folddisco' : 'structuresearch'),
            mode: this.mode,
            isComplex: this.isComplex,
            query: this.queryHeader,
            databases,
        };

        // Aliases for the single-database read, matching the page's API. `rows` is moved rather than
        // copied — aliasing it serialized the same array twice and doubled the response.
        if (databases.length === 1 && !databases[0].error) {
            const d = databases[0];
            const rows = d.rows;
            delete d.rows;
            Object.assign(out, {
                db: d.db, dbIndex: d.dbIndex, rows,
                total: d.total, returned: d.returned,
                taxonFiltered: d.taxonFiltered,
                truncated: d.total > offset + d.returned,
            });
        }
        return out;
    }
}

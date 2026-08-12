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
    createSortMemo, defaultSortOrder, isValidSortKey, sortIndices, rowFieldForSortKey,
} from '../../../frontend/lib/resultSort.js';
import { expandDescendants, findTaxonByName, summarizeTaxonomy } from '../../../frontend/lib/taxonomyFilter.js';

const SORT_KEYS = { foldseek: FOLDSEEK_SORT_KEYS, folddisco: FOLDDISCO_SORT_KEYS };

/**
 * How many hits per database enter a merged ranking. Matches the page's constant, and is deliberately
 * independent of `topN`: pooling only each database's topN would make the cross-database ranking
 * depend on a display option, so a database holding the ten best hits would contribute three.
 */
const MERGE_POOL_PER_DB = 100;

/** Sort keys whose values are not comparable between databases. See getTableSummary's `merged`. */
const INCOMPARABLE_ACROSS_DATABASES = { eval: 'e-values depend on each database\'s search-space size' };

function numeric(value) {
    const n = typeof value === 'string' ? Number(value) : value;
    return Number.isFinite(n) ? n : null;
}

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
     * The taxa a filter names, resolving a taxon **name** through this database's own tree.
     *
     * `taxon` may be an id, a name, or an array of either — matching what the page's
     * setTaxonomyFilter accepts. Names are resolved per database on purpose: a real taxon absent
     * from this database's report is a miss, not a match, and saying so is more useful than
     * silently filtering to nothing.
     *
     * @returns {{ids: string[]} | {error: string}}
     */
    _resolveTaxa(report, taxon) {
        const requested = Array.isArray(taxon) ? taxon : [taxon];
        const ids = [];
        for (const one of requested) {
            if (one === null || one === undefined || one === '') continue;
            if (/^\d+$/.test(String(one))) { ids.push(String(one)); continue; }
            const id = findTaxonByName(report, String(one));   // returns the taxon_id, or null
            if (id === null) return { error: `no taxon named "${one}" in this database` };
            ids.push(String(id));
        }
        return { ids };
    }

    /**
     * Group ids allowed through by a taxonomy filter, or null for "no filter".
     *
     * The page does this by writing a visibility mask onto the mounted table and re-running its
     * render-window bookkeeping. None of that exists here, and none of it is the actual operation:
     * expandDescendants() already answers "every taxId under this subtree", and intersecting that
     * with each group's own taxId is the whole filter. Applied before sorting and pagination, so
     * `total` and `returned` describe the filtered set rather than the unfiltered one.
     *
     * @returns {{allow: Set<string>|null, resolvedIds?: string[], error?: string}}
     */
    _taxonAllowSet(entryData, taxonFilter) {
        if (!taxonFilter) return { allow: null };
        const { taxon, taxId, includeDescendants = true } = taxonFilter;
        const requested = taxon !== undefined ? taxon : taxId;
        if (requested === undefined) return { allow: null };

        const report = entryData.taxonomyreports?.[0] ?? [];
        const resolved = this._resolveTaxa(report, requested);
        if (resolved.error) return { allow: null, error: resolved.error };
        if (resolved.ids.length === 0) return { allow: null };

        const wanted = new Set(resolved.ids);
        if (includeDescendants) {
            // Hits carry leaf taxIds, so an internal node without its subtree matches nothing —
            // which is why this defaults to true.
            for (const id of resolved.ids) {
                for (const descendant of expandDescendants(report, id)) wanted.add(String(descendant));
            }
        }
        return { allow: wanted, resolvedIds: [...wanted] };
    }

    /**
     * Group ids allowed through by a FoldDisco motif-pattern filter.
     *
     * The pattern is one character per query residue, "1" matched and "0" missing — the parser calls
     * it `gaps`, which is why the page's own setter warns that its internal `gapFilter` has nothing
     * to do with sequence gaps. Named after what it selects.
     */
    _motifAllowSet(entryData, motifFilter) {
        if (motifFilter === undefined || motifFilter === null || motifFilter === '') return null;
        const wanted = new Set(Array.isArray(motifFilter) ? motifFilter.map(String) : [String(motifFilter)]);
        const allow = new Set();
        for (const [gid, group] of Object.entries(entryData.alignments || {})) {
            const head = Array.isArray(group) ? group[0] : group;
            if (wanted.has(String(head?.gaps))) allow.add(gid);
        }
        return allow;
    }

    /** Which query residues matched, grouped and counted — the page's getMotifPatterns. */
    _motifPatterns(entryData) {
        const counts = new Map();
        for (const group of Object.values(entryData.alignments || {})) {
            const head = Array.isArray(group) ? group[0] : group;
            const pattern = String(head?.gaps ?? '');
            counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
        }
        return {
            queryResidues: entryData.queryresidues ?? null,
            note: 'one character per query residue: "1" matched, "0" missing',
            patterns: [...counts.entries()]
                .map(([pattern, hits]) => ({ pattern, hits }))
                .sort((a, b) => b.hits - a.hits),
        };
    }

    /** The taxon listing for one database — the page's getTaxonomy. */
    getTaxonomy(db = null, opts = {}) {
        const selection = this._selectDatabases(db ?? (this.raw?.results?.length === 1 ? 0 : null));
        if (selection.error) return selection.error;
        const dbIdx = selection.targets[0];
        const entryData = this.raw.results[dbIdx];
        const report = entryData.taxonomyreports?.[0];
        if (!report?.length) {
            return { db: entryData.db, dbIndex: dbIdx, available: false,
                reason: 'no taxonomy data for this database' };
        }
        return {
            db: entryData.db, dbIndex: dbIdx, available: true,
            totalNodes: report.length,
            taxa: summarizeTaxonomy(report, opts),
        };
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
            taxonFilter = null, motifFilter = null,
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

            const taxon = this._taxonAllowSet(entryData, taxonFilter);
            if (taxon.error) {
                return { db: entryData.db, dbIndex: dbIdx, error: taxon.error };
            }
            const motifAllow = this._motifAllowSet(entryData, motifFilter);
            const allow = taxon.allow || motifAllow ? { taxon: taxon.allow, motif: motifAllow } : null;

            let source = alignments;
            if (allow) {
                source = {};
                for (const [gid, group] of Object.entries(alignments)) {
                    const head = Array.isArray(group) ? group[0] : group;
                    if (allow.taxon && !(head?.taxId !== undefined && allow.taxon.has(String(head.taxId)))) continue;
                    if (allow.motif && !allow.motif.has(gid)) continue;
                    source[gid] = group;
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
                taxonFiltered: !!taxon.allow,
                ...(taxon.allow ? { taxonIdsMatched: taxon.resolvedIds.length } : {}),
                ...(motifAllow ? { motifFiltered: true } : {}),
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

    /**
     * Survey every database without transporting rows — "which database has the good hits?".
     *
     * The page API added this for a measured reason: 1,071 tokens to survey nine databases against
     * 73,545 for the equivalent getTable({db:'*'}). Without it, finding the database worth reading
     * means fetching rows from all of them.
     *
     * @param {object} [opts]
     * @param {string|number|Array} [opts.db]  default '*', every database
     * @param {number} [opts.topN]   sample size per database, and the default size of the merged
     *                               ranking; 0 for statistics only. Default 3
     * @param {boolean} [opts.merged] add one ranking across every database
     * @param {number} [opts.mergedLimit] merged rows to return; defaults to `topN`, capped at 100
     */
    getTableSummary(opts = {}) {
        if (!this.raw?.results) return { ok: false, page: this.tool, error: 'no results loaded' };
        const { db = '*', topN = 3, merged = false, mergedLimit = null } = opts;

        const selection = this._selectDatabases(db);
        if (selection.error) return { ok: false, ...selection.error };
        const { targets } = selection;

        const pool = [];
        const databases = targets.map(dbIdx => {
            const entryData = this.raw.results[dbIdx];
            const alignments = entryData.alignments || {};
            const key = this.tool === 'folddisco' ? 'idf' : (this.isComplex ? 'qtm' : 'score');
            const order = defaultSortOrder(key, { mode: this.mode });
            const sorted = this._sortMemo.get(`${dbIdx}:${this.mode}`, alignments, key, order,
                { mode: this.mode, isComplex: this.isComplex, tool: this.tool });

            // The sort key is not always the row field: qtm lives in complexqtm, idf in idfscore,
            // desc in description. Asking for the key directly returns nulls for those.
            const field = rowFieldForSortKey(key, this.tool);
            const valueAt = gid => numeric(
                this._rowFor(dbIdx, gid, entryData, alignments, 0, false, [field])?.[field]);

            // best/median/worst are free: the sort cache already holds the ordering, so these are its
            // first, middle and last entries. Any other column would cost a full pass.
            const metrics = {
                [key]: sorted.length
                    ? {
                        best: valueAt(sorted[0]),
                        median: valueAt(sorted[Math.floor(sorted.length / 2)]),
                        worst: valueAt(sorted[sorted.length - 1]),
                    }
                    : { best: null, median: null, worst: null },
            };

            if (merged) {
                for (const gid of sorted.slice(0, MERGE_POOL_PER_DB)) {
                    const row = this._rowFor(dbIdx, gid, entryData, alignments, 0, false, ['target', field]);
                    pool.push({ ...row, db: entryData.db, _value: numeric(row[field]) });
                }
            }

            const summary = {
                db: entryData.db,
                dbIndex: dbIdx,
                total: sorted.length,
                sortKey: key,
                sortOrder: order,
                // There is no mounted tab here, so this is always the built-in default rather than a
                // sort anyone chose. The page reports 'active' for its open tab; saying so keeps a
                // caller from presenting it as a user's choice.
                sortKeySource: 'default',
                hasTaxonomy: !!entryData.hasTaxonomy,
                metrics,
            };
            if (topN > 0) summary.top = sorted.slice(0, topN).map(gid =>
                this._rowFor(dbIdx, gid, entryData, alignments, 0, false, ['target', field]));
            if (this.tool === 'folddisco') summary.motifPatterns = this._motifPatterns(entryData);
            return summary;
        });

        const out = {
            ok: true,
            page: this.tool,
            ticket: this.ticket,
            entry: this.entry,
            isComplex: this.isComplex,
            databases,
        };

        if (merged) {
            const key = databases[0]?.sortKey;
            const order = databases[0]?.sortOrder ?? 1;
            const ranked = pool
                .filter(r => r._value !== null)
                .sort((a, b) => (a._value - b._value) * (order < 0 ? -1 : 1));

            // Two different numbers, kept apart. The *pool* is 100 per database and never depends on
            // topN — pooling only each database's topN would make the cross-database ranking depend
            // on a display option, so a database holding the ten best hits would contribute three.
            // How many of the result are *returned* is a display choice, and follows what the caller
            // asked for. The page returns up to 100 here regardless, which hands a caller asking for
            // 3 a hundred rows.
            const limit = Math.min(mergedLimit ?? (topN > 0 ? topN : 100), 100);
            out.merged = {
                sortKey: key,
                sortOrder: order,
                pooledPerDatabase: MERGE_POOL_PER_DB,
                ranked: ranked.length,
                returned: Math.min(limit, ranked.length),
                topN: ranked.slice(0, limit).map(({ _value, ...r }) => r),
            };
            // Not every sort key means the same thing in two databases. The UI's own top-100 has the
            // same property — it is a property of e-values, not of this API — but a caller reading a
            // merged e-value ranking should know it is comparing different denominators.
            if (INCOMPARABLE_ACROSS_DATABASES[key]) {
                out.merged.caveat = `ranking by "${key}" across databases is not strictly comparable: `
                    + INCOMPARABLE_ACROSS_DATABASES[key];
            }
        }
        return out;
    }
}

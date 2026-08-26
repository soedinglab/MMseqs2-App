// The sorted, paginated view of a parsed result
//
import {
    FOLDSEEK_SORT_KEYS, FOLDDISCO_SORT_KEYS,
    createSortMemo, defaultSortOrder, isValidSortKey, sortIndices, rowFieldForSortKey,
} from '../../../frontend/lib/resultSort.js';
import { expandDescendants, findTaxonByName, summarizeTaxonomy } from '../../../frontend/lib/taxonomyFilter.js';
import { getAccession } from '../../../frontend/lib/targetName.js';
import { QuerySet } from './submit.js';
import { motifFromTargetResidues } from './motif.js';
import { defaultSortKey } from './metrics.js';

const SORT_KEYS = { foldseek: FOLDSEEK_SORT_KEYS, folddisco: FOLDDISCO_SORT_KEYS };

const MERGE_POOL_PER_DB = 100;

const INCOMPARABLE_ACROSS_DATABASES = { eval: 'e-values depend on each database\'s search-space size' };

export const SELECT_MAX = 1000;

export function idForHit(hit, database) {
    return String(database).startsWith('pdb') ? hit.target : hit.dbkey;
}

/**
 * One hit, with the ability to become a new job's query.
 */
export class Row {
    constructor(table, dbIdx, groupId) {
        this.table = table;
        this.dbIdx = dbIdx;
        this.groupId = String(groupId);
    }

    get id() { return `${this.dbIdx}#${this.groupId}`; }
    get db() { return this.table.raw.results[this.dbIdx]?.db ?? null; }

    /** The group's chains; `head` is the first, which carries the fields shared by all of them. */
    get chains() {
        const group = this.table.raw.results[this.dbIdx]?.alignments?.[this.groupId];
        return Array.isArray(group) ? group : (group ? [group] : []);
    }

    get head() { return this.chains[0] ?? null; }

    /** @returns {SubmittableQuery} */
    toQuery() {
        const { table } = this;
        const head = this.head;
        if (!head) throw new Error(`no hit ${this.id} in this result`);
        const db = this.db;
        const client = table.requireClient();
        const label = head.target ?? head.targetname ?? this.id;

        if (table.tool === 'folddisco') {
            return client.query(async () => ({
                kind: 'structure',
                text: await client.getFoldDiscoTargetStructure(table.ticket,
                    { id: idForHit(head, db), database: db }),
                name: getAccession(head.target ?? label),
                motif: motifFromTargetResidues(head.targetresidues) || undefined,
                db,
                ticket: table.ticket,
                lineage: { queryIdx: table.queryIdx, rowId: this.id, db },
            }), { label });
        }

        return client.query(async () => ({
            kind: 'chains',
            chains: await client.getHitChains(table.ticket,
                { queryIdx: table.queryIdx, db, idx: Number(this.groupId) }),
            db,
            accession: getAccession(head.target ?? label),
            ticket: table.ticket,
            lineage: { queryIdx: table.queryIdx, rowId: this.id, db },
        }), { label });
    }

    sendTo(opts) { return this.toQuery().sendTo(opts); }
}

function numeric(value) {
    const n = typeof value === 'string' ? Number(value) : value;
    return Number.isFinite(n) ? n : null;
}

export class ResultTable {
    /**
     * @param {object} parsed  parseResults()/parseResultsFoldDisco() output
     * @param {{ticket: string, queryIdx: number, app: string, tool?: string}} meta
     */
    constructor(parsed, { ticket, queryIdx = 0, app = 'foldseek', tool = 'foldseek', client = null } = {}) {
        this.raw = parsed;
        this.ticket = ticket;
        this.queryIdx = queryIdx;
        this.app = app;
        this.tool = tool;
        // Reading a table needs no client; forwarding a row does. A table built straight from a
        // parsed fixture is therefore still usable for everything except sendTo.
        this.client = client;
        this._sortMemo = createSortMemo();
    }

    requireClient() {
        if (!this.client) {
            throw new Error('this result table was built without a client, so its rows cannot be ' +
                            'forwarded — use client.getResult()/getFoldDiscoResult() to get one that can');
        }
        return this.client;
    }

    get databases() { return (this.raw?.results ?? []).map(r => r.db); }
    get mode() { return this.raw?.mode ?? ''; }
    get isComplex() {
        return String(this.raw?.mode ?? '').includes('complex') || this.raw?.type === 'complexsearch';
    }

    /** This query. A ticket can hold several; queryIdx picks one. */
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
        if (this.tool !== 'folddisco') row.chainCount = chains.length;
        if (entryData.hasDescription) row.description = head.description;
        if (entryData.hasTaxonomy) { row.taxId = head.taxId; row.taxName = head.taxName; }
        if (head.complexqtm !== undefined) {
            row.complexqtm = head.complexqtm;
            row.complexttm = head.complexttm;
        }
        if (this.tool === 'folddisco') {
            Object.assign(row, {
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
                || defaultSortKey({ tool: this.tool, mode: this.mode, isComplex: this.isComplex });
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
            queryIdx: this.queryIdx,
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
            const key = defaultSortKey({ tool: this.tool, mode: this.mode, isComplex: this.isComplex });
            const order = defaultSortOrder(key, { mode: this.mode });
            const sorted = this._sortMemo.get(`${dbIdx}:${this.mode}`, alignments, key, order,
                { mode: this.mode, isComplex: this.isComplex, tool: this.tool });

            const field = rowFieldForSortKey(key, this.tool);
            const valueAt = gid => numeric(
                this._rowFor(dbIdx, gid, entryData, alignments, 0, false, [field])?.[field]);

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
            queryIdx: this.queryIdx,
            isComplex: this.isComplex,
            databases,
        };

        if (merged) {
            const key = databases[0]?.sortKey;
            const order = databases[0]?.sortOrder ?? 1;
            const ranked = pool
                .filter(r => r._value !== null)
                .sort((a, b) => (a._value - b._value) * (order < 0 ? -1 : 1));

            const limit = Math.min(mergedLimit ?? (topN > 0 ? topN : 100), 100);
            out.merged = {
                sortKey: key,
                sortOrder: order,
                pooledPerDatabase: MERGE_POOL_PER_DB,
                ranked: ranked.length,
                returned: Math.min(limit, ranked.length),
                topN: ranked.slice(0, limit).map(({ _value, ...r }) => r),
            };
            if (INCOMPARABLE_ACROSS_DATABASES[key]) {
                out.merged.caveat = `ranking by "${key}" across databases is not strictly comparable: `
                    + INCOMPARABLE_ACROSS_DATABASES[key];
            }
        }
        return out;
    }

    /**
     * One row, by the `id` getTable reports (`dbIndex#entryIndex`), by `{db, idx}`, or by `[db, idx]`.
     * The database half may be a name or an index either way.
     */
    row(id) {
        let db;
        let idx;
        if (typeof id === 'string') {
            const hash = id.indexOf('#');
            if (hash === -1) throw new Error(`not a row id: ${id} (expected "db#index")`);
            db = id.slice(0, hash);
            idx = id.slice(hash + 1);
        } else if (Array.isArray(id) && id.length === 2) {
            [db, idx] = id;
        } else if (id && typeof id === 'object') {
            ({ db, idx } = id);
        } else {
            throw new Error(`not a row id: ${JSON.stringify(id)}`);
        }

        const dbIdx = this._resolveDb(db);
        if (dbIdx === null) {
            throw new Error(`unknown database: ${db}. Available: ${this.databases.join(', ')}`);
        }
        if (!(String(idx) in (this.raw.results[dbIdx].alignments || {}))) {
            throw new Error(`no hit ${idx} in ${this.raw.results[dbIdx].db}`);
        }
        return new Row(this, dbIdx, idx);
    }

    rows(ids) { return (ids ?? []).map(id => this.row(id)); }

    /**
     * The row ids a spec selects.
     *
     * A spec is either an explicit list of ids — an array, or `{ids: [...]}` — or any getTable filter:
     * database, sort key, limit, taxon filter, motif filter. 
     */
    selectIds(spec = {}) {
        if (Array.isArray(spec)) return this.rows(spec).map(r => r.id);
        if (spec.ids) return this.rows(spec.ids).map(r => r.id);

        const { limit = 25, ...rest } = spec;
        const capped = Math.max(0, Math.min(limit, SELECT_MAX));
        const table = this.getTable({ ...rest, limit: capped, fields: ['target'] });
        if (table.error) throw new Error(table.error);

        const ids = [];
        const take = rows => { for (const r of rows ?? []) ids.push(r.id); };
        take(table.rows);                       // single-database alias
        for (const d of table.databases ?? []) {
            if (d.error) throw new Error(`${d.db}: ${d.error}`);
            take(d.rows);
        }
        return ids;
    }

    /**
     * A named set of hits to work with — inspect it, add to it, drop from it, save it, and submit when
     * it is what you meant. Takes the same spec as selectIds.
     *
     * @returns {Selection}
     */
    select(spec = {}, { name = 'default' } = {}) {
        return new Selection(this, this.selectIds(spec), { name });
    }

    /** A selection saved earlier, for this ticket. Null if there is none by that name. */
    async loadSelection(name = 'default') {
        const record = await this.requireClient().store.readSelection(this.ticket, name);
        if (!record) return null;
        return new Selection(this, record.ids ?? [], { name, savedAt: record.updatedAt });
    }

    /** Names and sizes of this ticket's saved selections. */
    listSelections() {
        return this.requireClient().store.listSelections(this.ticket);
    }

    deleteSelection(name = 'default') {
        return this.requireClient().store.deleteSelection(this.ticket, name);
    }
}

/**
 * A mutable, savable set of selected rows.
 *
 * Ids are canonicalised on the way in, so `"BFVD#12"` and `"0#12"` are the same row and cannot both be
 * present. Insertion order is kept: a selection reads back in the order it was built, not the order
 * the table happens to sort in.
 */
export class Selection {
    constructor(table, ids = [], { name = 'default', savedAt = null } = {}) {
        this.table = table;
        this.name = name;
        this.savedAt = savedAt;
        this._ids = new Set();
        this.add(ids);
    }

    get ids() { return [...this._ids]; }
    get size() { return this._ids.size; }

    /** Add rows. Takes an id list or a filter spec, exactly like table.select(). */
    add(spec) {
        for (const id of this.table.selectIds(spec)) this._ids.add(id);
        return this;
    }

    /** Drop rows. Same forms as add(), so a filter can be subtracted as well as added. */
    remove(spec) {
        for (const id of this.table.selectIds(spec)) this._ids.delete(id);
        return this;
    }

    clear() { this._ids.clear(); return this; }

    has(id) { return this._ids.has(this.table.row(id).id); }

    rows() { return this.table.rows(this.ids); }

    /** Persist under `name`, scoped to this ticket. Returns the stored record. */
    async save(name = this.name) {
        this.name = name;
        const record = await this.table.requireClient().store.writeSelection(this.table.ticket, name, {
            queryIdx: this.table.queryIdx,
            page: this.table.tool,
            ids: this.ids,
        });
        this.savedAt = record.updatedAt;
        return record;
    }

    /**
     * What is in the selection, without fetching a single structure.
     */
    describe() {
        const entries = this.rows().map(r => ({
            id: r.id,
            db: r.db,
            target: r.head?.target ?? r.head?.targetname ?? null,
            name: getAccession(r.head?.target ?? ''),
            ...(this.table.tool === 'folddisco' ? {} : { chainCount: r.chains.length }),
        }));
        const counts = new Map();
        for (const e of entries) counts.set(e.name, (counts.get(e.name) ?? 0) + 1);
        const duplicateNames = [...counts.entries()]
            .filter(([, n]) => n > 1)
            .map(([name, count]) => ({ name, count }));

        return {
            name: this.name,
            ticket: this.table.ticket,
            queryIdx: this.table.queryIdx,
            page: this.table.tool,
            size: entries.length,
            ...(this.savedAt ? { savedAt: this.savedAt } : { saved: false }),
            databases: [...new Set(entries.map(e => e.db))],
            ...(duplicateNames.length ? { duplicateNames } : {}),
            entries,
        };
    }

    /** The queries this selection would submit. Lazily resolved — nothing is fetched by asking. */
    toQuerySet() {
        const client = this.table.requireClient();
        return new QuerySet(client, this.rows().map(r => r.toQuery()), {
            ticket: this.table.ticket,
            queryIdx: this.table.queryIdx,
            description: this.describe(),
        });
    }

    sendTo(opts) { return this.toQuerySet().sendTo(opts); }
}

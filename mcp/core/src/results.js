// Row lookup, saved selections and forwarding for a parsed result.
import { createSortMemo, defaultSortOrder } from '../../../frontend/lib/resultSort.js';
import { getAccession } from '../../../frontend/lib/targetName.js';
import { QuerySet } from './submit.js';
import { motifFromTargetResidues } from './motif.js';
import { defaultSortKey } from './metrics.js';

export function idForHit(hit, database) {
    return String(database).startsWith('pdb') ? hit.target : hit.dbkey;
}

/** One hit that can become a new job's query. */
export class Row {
    constructor(table, dbIdx, groupId) {
        this.table = table;
        this.dbIdx = dbIdx;
        this.groupId = String(groupId);
    }

    get id() { return `${this.dbIdx}#${this.groupId}`; }
    get db() { return this.table.raw.results[this.dbIdx]?.db ?? null; }

    /** Return all chains in this parsed hit group. */
    get chains() {
        const group = this.table.raw.results[this.dbIdx]?.alignments?.[this.groupId];
        return Array.isArray(group) ? group : (group ? [group] : []);
    }

    get head() { return this.chains[0] ?? null; }

    /** Convert this hit into a lazily resolved query. */
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

export class ResultTable {
    constructor(parsed, { ticket, queryIdx = 0, tool = 'foldseek', client = null } = {}) {
        this.raw = parsed;
        this.ticket = ticket;
        this.queryIdx = queryIdx;
        this.tool = tool;
        // A client is required only for persistence and forwarding.
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

    /** Return the default top row id for each database. */
    topRowIds() {
        const out = new Map();
        for (let dbIdx = 0; dbIdx < (this.raw?.results ?? []).length; dbIdx++) {
            const entryData = this.raw.results[dbIdx];
            const alignments = entryData.alignments || {};
            const key = defaultSortKey({ tool: this.tool, mode: this.mode, isComplex: this.isComplex });
            const order = defaultSortOrder(key, { mode: this.mode });
            const sorted = this._sortMemo.get(`${dbIdx}:${this.mode}`, alignments, key, order,
                { mode: this.mode, isComplex: this.isComplex, tool: this.tool });
            out.set(dbIdx, sorted.length ? `${dbIdx}#${sorted[0]}` : null);
        }
        return out;
    }

    _resolveDb(db) {
        const results = this.raw?.results ?? [];
        const byName = results.findIndex(r => r.db === db);
        if (byName !== -1) return byName;
        const asIndex = Number(db);
        if (Number.isInteger(asIndex) && asIndex >= 0 && asIndex < results.length) return asIndex;
        return null;
    }

    /** Resolve one row from a canonical id or database/index pair. */
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

    /** Canonicalize an explicit row-id list. */
    selectIds(spec = {}) {
        if (Array.isArray(spec)) return this.rows(spec).map(r => r.id);
        if (Array.isArray(spec?.ids)) return this.rows(spec.ids).map(r => r.id);
        throw new Error('a selection requires an explicit ids array');
    }

    /** Create a named mutable selection from explicit row ids. */
    select(spec = {}, { name = 'default' } = {}) {
        return new Selection(this, this.selectIds(spec), { name });
    }

    /** Load a named selection or return null. */
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

/** A mutable saved set of canonical row ids that preserves insertion order. */
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

    /** Add explicit row ids. */
    add(spec) {
        for (const id of this.table.selectIds(spec)) this._ids.add(id);
        return this;
    }

    /** Drop explicit row ids. */
    remove(spec) {
        for (const id of this.table.selectIds(spec)) this._ids.delete(id);
        return this;
    }

    clear() { this._ids.clear(); return this; }

    has(id) { return this._ids.has(this.table.row(id).id); }

    rows() { return this.table.rows(this.ids); }

    /** Persist this selection under a ticket-scoped name. */
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

    /** Describe members without fetching structures. */
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

    /** Return lazily resolved queries for all selected rows. */
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

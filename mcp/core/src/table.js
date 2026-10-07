// Pure table, row and hit-selection objects.
import { createSortMemo, defaultSortOrder } from '../../../frontend/lib/resultSort.js';
import { getAccession } from '../../../frontend/lib/targetName.js';
import { defaultSortKey } from './metrics.js';

export function idForHit(hit, database) {
    return String(database).startsWith('pdb') ? hit.target : hit.dbkey;
}

function parseRowId(id) {
    if (typeof id === 'string') {
        const hash = id.indexOf('#');
        if (hash === -1) throw new Error(`not a row id: ${id} (expected "db#index")`);
        return [id.slice(0, hash), id.slice(hash + 1)];
    }
    if (Array.isArray(id) && id.length === 2) return id;
    if (id && typeof id === 'object') return [id.db, id.idx];
    throw new Error(`not a row id: ${JSON.stringify(id)}`);
}

export class Row {
    constructor(table, dbIdx, groupId, chains) {
        this.table = table;
        this.dbIdx = dbIdx;
        this.groupId = String(groupId);
        this.id = `${dbIdx}#${groupId}`;
        this.db = table.raw.results[dbIdx].db;
        this.chains = chains;
        this.head = chains[0] ?? null;
    }
}

export class ResultTable {
    constructor(parsed, { ticket, queryIdx = 0, tool = 'foldseek' } = {}) {
        this.raw = parsed;
        this.ticket = ticket;
        this.queryIdx = queryIdx;
        this.tool = tool;
        this.mode = parsed?.mode ?? '';
        this.databases = (parsed?.results ?? []).map(result => result.db);
        this.isComplex = String(this.mode).includes('complex') || parsed?.type === 'complexsearch';
        this.sortMemo = createSortMemo();
    }

    topRowIds() {
        const out = new Map();
        for (let dbIdx = 0; dbIdx < (this.raw?.results ?? []).length; dbIdx++) {
            const alignments = this.raw.results[dbIdx].alignments || {};
            const key = defaultSortKey({
                tool: this.tool, mode: this.mode, isComplex: this.isComplex,
            });
            const order = defaultSortOrder(key, { mode: this.mode });
            const sorted = this.sortMemo.get(`${dbIdx}:${this.mode}`, alignments, key, order, {
                mode: this.mode, isComplex: this.isComplex, tool: this.tool,
            });
            out.set(dbIdx, sorted.length ? `${dbIdx}#${sorted[0]}` : null);
        }
        return out;
    }

    row(id) {
        const [db, idx] = parseRowId(id);
        const results = this.raw?.results ?? [];
        const byName = results.findIndex(result => result.db === db);
        const asIndex = Number(db);
        const dbIdx = byName !== -1 ? byName
            : Number.isInteger(asIndex) && asIndex >= 0 && asIndex < results.length ? asIndex : null;
        if (dbIdx === null) {
            throw new Error(`unknown database: ${db}. Available: ${this.databases.join(', ')}`);
        }
        const group = results[dbIdx].alignments?.[String(idx)];
        if (group === undefined) throw new Error(`no hit ${idx} in ${results[dbIdx].db}`);
        return new Row(this, dbIdx, idx, Array.isArray(group) ? group : [group]);
    }

    rows(ids) {
        return (ids ?? []).map(id => this.row(id));
    }

    selection(ids = [], options = {}) {
        return new HitSelection(this, ids, options);
    }
}

export class HitSelection {
    constructor(table, ids = [], { name = 'default', savedAt = null } = {}) {
        this.table = table;
        this.name = name;
        this.savedAt = savedAt;
        this.ids = [];
        this.add(ids);
    }

    normalizeIds(spec = {}) {
        const ids = Array.isArray(spec) ? spec : spec?.ids;
        if (!Array.isArray(ids)) throw new Error('a selection requires an explicit ids array');
        return this.table.rows(ids).map(row => row.id);
    }

    add(spec) {
        const seen = new Set(this.ids);
        for (const id of this.normalizeIds(spec)) {
            if (!seen.has(id)) this.ids.push(id);
            seen.add(id);
        }
        return this;
    }

    remove(spec) {
        const remove = new Set(this.normalizeIds(spec));
        this.ids = this.ids.filter(id => !remove.has(id));
        return this;
    }

    clear() {
        this.ids = [];
        return this;
    }

    has(id) {
        return this.ids.includes(this.table.row(id).id);
    }

    rows() {
        return this.table.rows(this.ids);
    }

    describe() {
        const entries = this.rows().map(row => ({
            id: row.id,
            db: row.db,
            target: row.head?.target ?? row.head?.targetname ?? null,
            name: getAccession(row.head?.target ?? ''),
            ...(this.table.tool === 'folddisco' ? {} : { chainCount: row.chains.length }),
        }));
        const counts = new Map();
        for (const entry of entries) counts.set(entry.name, (counts.get(entry.name) ?? 0) + 1);
        const duplicateNames = [...counts.entries()]
            .filter(([, count]) => count > 1)
            .map(([name, count]) => ({ name, count }));
        return {
            name: this.name,
            ticket: this.table.ticket,
            queryIdx: this.table.queryIdx,
            page: this.table.tool,
            size: entries.length,
            ...(this.savedAt ? { savedAt: this.savedAt } : { saved: false }),
            databases: [...new Set(entries.map(entry => entry.db))],
            ...(duplicateNames.length ? { duplicateNames } : {}),
            entries,
        };
    }
}

export const createResultTable = (parsed, options) => new ResultTable(parsed, options);
export const topRowIds = table => table.topRowIds();
export const resultRow = (table, id) => table.row(id);
export const resultRows = (table, ids) => table.rows(ids);
export const createSelection = (table, ids, options) => table.selection(ids, options);
export const describeSelection = selection => selection.describe();

// Facts about a parsed result, as pure functions: identity, counts, completeness, provenance, and
// the full serializations the artifact exports. Nothing here reads the network or the filesystem.

import { numericMetric, NUMERIC_METRIC_FIELDS } from './metrics.js';

export const TERMINAL_STATUSES = new Set(['COMPLETE', 'ERROR', 'UNKNOWN']);

export function kindForJobType(jobType) {
    switch (jobType) {
        case 'foldmasoneasymsa': return 'foldmason';
        case 'folddisco': return 'folddisco';
        case 'complexsearch': return 'complexsearch';
        default: return 'search';       // search, structuresearch, interfacesearch, msa, pair, …
    }
}

// backend/worker.go:1918-1920 — folddisco query runs with a literal `--top 1000`, so this cap is
// structural. worker.go:2139-2141 appends `--max-seqs 1000` only when the config does not set it.
const FOLDDISCO_ROW_CAP = 1000;
const SEARCH_ROW_CAP_DEFAULT = 1000;

const SINGLE_UNIT_KINDS = new Set(['foldmason', 'folddisco']);

/** Render fields and coordinates: neither belongs in an exported row. */
const DROPPED_ROW_FIELDS = new Set(['href', 'active', 'id', 'ca', 'tCa', 'qCa']);
const NUMERIC_FIELDS = new Set(NUMERIC_METRIC_FIELDS);

function coded(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

function num(value) {
    const n = typeof value === 'string' ? Number(value) : value;
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

export function isComplexResult(parsed) {
    return String(parsed?.mode ?? '').includes('complex') || parsed?.type === 'complexsearch';
}

/**
 * The entry index that addresses one result unit.
 * FoldMason and FoldDisco serve one unit per ticket, so any valid index normalizes to 0.
 */
export function normalizeEntry(jobType, entry = 0) {
    const value = entry === undefined || entry === null ? 0 : entry;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
        throw coded('INVALID_ENTRY',
            `invalid entry: ${JSON.stringify(entry)} — expected a non-negative safe integer`);
    }
    if (SINGLE_UNIT_KINDS.has(kindForJobType(jobType))) {
        return { entry: 0, normalized: value !== 0 };
    }
    return { entry: value, normalized: false };
}

/**
 * Chain-level items as delivered, groups after parsing, and which grouping produced the difference.
 * Totals are the counts contract; `databases` is the per-database breakdown callers merge elsewhere.
 */
export function resultCounts(parsed, { tool = 'foldseek' } = {}) {
    const results = parsed?.results ?? [];
    const databases = results.map((entryData, dbIndex) => {
        let serverAlignments = 0;
        let parsedRows = 0;
        for (const group of Object.values(entryData?.alignments ?? {})) {
            parsedRows += 1;
            serverAlignments += Array.isArray(group) ? group.length : 1;
        }
        return { dbIndex, db: entryData?.db ?? null, serverAlignments, parsedRows };
    });
    return {
        serverAlignments: databases.reduce((a, d) => a + d.serverAlignments, 0),
        parsedRows: databases.reduce((a, d) => a + d.parsedRows, 0),
        grouping: tool !== 'folddisco' && isComplexResult(parsed) ? 'complexid' : 'none',
        databases,
    };
}

export function resultRowCap({ jobType, configuredCap = null } = {}) {
    const kind = kindForJobType(jobType);
    if (kind === 'foldmason') return { rowCap: null, capSource: 'not-applicable' };
    if (kind === 'folddisco') return { rowCap: FOLDDISCO_ROW_CAP, capSource: 'worker-fixed' };
    if (configuredCap !== null && configuredCap !== undefined) {
        if (!Number.isSafeInteger(configuredCap) || configuredCap < 1) {
            throw coded('INVALID_CONFIG',
                `invalid result row cap: ${JSON.stringify(configuredCap)} — expected an integer >= 1`);
        }
        return { rowCap: configuredCap, capSource: 'configured' };
    }
    return { rowCap: SEARCH_ROW_CAP_DEFAULT, capSource: 'deployment-default' };
}

/**
 * Tri-state completeness. Reaching a cap proves truncation; staying under one proves nothing, so
 * `complete` is null rather than true.
 */
export function completenessOf({ jobType, parsedRows = 0, rowCap, capSource, configuredCap = null } = {}) {
    const resolved = rowCap === undefined || capSource === undefined
        ? resultRowCap({ jobType, configuredCap })
        : { rowCap, capSource };

    if (kindForJobType(jobType) === 'foldmason') {
        return { complete: true, saturated: false, capSource: 'not-applicable', rowCap: null };
    }
    const saturated = resolved.rowCap !== null && parsedRows >= resolved.rowCap;
    return {
        complete: saturated ? false : null,
        saturated,
        capSource: resolved.capSource,
        rowCap: resolved.rowCap ?? null,
    };
}

/**
 * Per-database identity, with the catalog's version/status when `/databases` was reachable.
 * `safeName` is the artifact filename stem, so no database id ever reaches a path.
 */
export function databaseProvenance(parsed, catalog = null) {
    const list = Array.isArray(catalog) ? catalog : null;
    const byPath = new Map((list ?? []).map(d => [d.path, d]));
    const databases = (parsed?.results ?? []).map((entryData, dbIndex) => {
        const id = entryData?.db ?? null;
        const known = id !== null ? byPath.get(id) : undefined;
        return {
            dbIndex,
            id: id ?? `db-${dbIndex}`,
            safeName: `db-${dbIndex}`,
            display: known?.name ?? null,
            version: known?.version ?? null,
            status: known?.status ?? null,
            taxonomy: known ? !!known.taxonomy : !!entryData?.hasTaxonomy,
            hasTaxonomy: !!entryData?.hasTaxonomy,
            hasDescription: !!entryData?.hasDescription,
        };
    });
    return { catalogAvailable: list !== null && list.length > 0, databases };
}

/**
 * Every taxonomy node, with a parent derived from the depth-ordered report by a stack — the report
 * itself carries no parent link, and without one a clade cannot be walked offline.
 */
export function taxonomyExport(report) {
    const nodes = [];
    const issues = [];
    if (!Array.isArray(report)) return { nodes, issues };

    const stack = [];
    let previousDepth = null;
    for (let i = 0; i < report.length; i++) {
        const row = report[i] ?? {};
        let depth = num(row.depth);
        if (depth === null) {
            depth = previousDepth === null ? 0 : previousDepth;
            issues.push({
                code: 'TAXONOMY_DEPTH_JUMP',
                detail: `row ${i} (${row.name ?? 'unnamed'}) has a non-numeric depth ` +
                        `${JSON.stringify(row.depth)}; treated as depth ${depth}`,
            });
        } else if (previousDepth !== null && depth > previousDepth + 1) {
            issues.push({
                code: 'TAXONOMY_DEPTH_JUMP',
                detail: `row ${i} (${row.name ?? 'unnamed'}) jumps from depth ${previousDepth} to ` +
                        `${depth}; parent resolved to the nearest shallower node`,
            });
        }

        while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
        const taxId = num(row.taxon_id);
        nodes.push({
            taxId,
            name: row.name ?? null,
            rank: row.rank ?? null,
            depth,
            cladeReads: num(row.clade_reads),
            taxonReads: num(row.taxon_reads),
            proportion: num(row.proportion),
            parentTaxId: stack.length ? stack[stack.length - 1].taxId : null,
        });
        stack.push({ depth, taxId });
        previousDepth = depth;
    }
    return { nodes, issues };
}

function serializeChain(item) {
    const out = {};
    for (const [key, value] of Object.entries(item ?? {})) {
        if (DROPPED_ROW_FIELDS.has(key)) continue;
        out[key] = NUMERIC_FIELDS.has(key) ? numericMetric(item, key) : value;
    }
    return out;
}

/**
 * One row, complete: every parsed field of the group's head, numeric metrics as numbers, and the
 * per-chain facts when the parser grouped several chains into it.
 */
export function serializeRow(parsed, dbIndex, groupId, { tool = 'foldseek' } = {}) {
    const entryData = parsed?.results?.[dbIndex];
    const group = entryData?.alignments?.[String(groupId)];
    if (!group) {
        throw coded('ROW_NOT_FOUND', `no hit ${groupId} in database index ${dbIndex}`);
    }
    const chains = Array.isArray(group) ? group : [group];
    const row = {
        id: `${dbIndex}#${groupId}`,
        dbIndex,
        groupId: String(groupId),
        ...serializeChain(chains[0]),
    };

    if (tool === 'folddisco') {
        if ('gaps' in row) {
            row.motifPattern = row.gaps;
            delete row.gaps;
        }
        return row;
    }

    row.chainCount = chains.length;
    if (chains.length > 1) row.chains = chains.map(serializeChain);
    return row;
}

/**
 * Which query residues each hit matched, aggregated over every hit. Ties break on the pattern so
 * the exported file is byte-stable.
 */
export function motifPatternExport(entryData) {
    const counts = new Map();
    for (const group of Object.values(entryData?.alignments ?? {})) {
        const head = Array.isArray(group) ? group[0] : group;
        const pattern = String(head?.gaps ?? '');
        counts.set(pattern, (counts.get(pattern) ?? 0) + 1);
    }
    const patterns = [...counts.entries()]
        .map(([pattern, hits]) => ({ pattern, hits }))
        .sort((a, b) => b.hits - a.hits || a.pattern.localeCompare(b.pattern));
    return {
        queryResidues: entryData?.queryresidues ?? null,
        note: 'one character per query residue: "1" matched, "0" missing',
        distinctPatterns: patterns.length,
        patterns,
    };
}

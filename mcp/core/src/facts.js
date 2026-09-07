// Pure result identity, count, completeness, provenance and serialization helpers.

import { numericMetric, NUMERIC_METRIC_FIELDS } from './metrics.js';

export const TERMINAL_STATUSES = new Set(['COMPLETE', 'ERROR', 'UNKNOWN']);

/** Map backend job types to the tool name exposed to callers. */
export function toolForJobType(jobType) {
    switch (kindForJobType(jobType)) {
        case 'foldmason': return 'foldmason';
        case 'folddisco': return 'folddisco';
        case 'complexsearch': return 'multimer';
        default: return 'foldseek';
    }
}

export function kindForJobType(jobType) {
    switch (jobType) {
        case 'foldmasoneasymsa': return 'foldmason';
        case 'folddisco': return 'folddisco';
        case 'complexsearch': return 'complexsearch';
        case 'search':
        case 'structuresearch': return 'search';

        case 'rnasearch': throw coded('UNSUPPORTED_TOOL',
            'rnasearch (Riboseek) tickets are not supported for now.'
            + 'Read it in the web UI');

        case 'interfacesearch': throw coded('UNSUPPORTED_TOOL',
            'interfacesearch tickets are not supported for now. '
            + 'Read it in the web UI');

        case 'index': throw coded('UNSUPPORTED_TOOL',
            'index is a database indexing job, not a result.');
        case 'nuclmsa': throw coded('UNSUPPORTED_TOOL',
            'nuclmsa results are only served as a tarball download.');
        case 'msa':
        case 'pair': throw coded('UNSUPPORTED_TOOL',
            `${jobType} tickets have no readable result route.`);

        default:
            if (jobType === undefined || jobType === null || jobType === '') return 'search';
            throw coded('UNSUPPORTED_TOOL', `unknown job type: ${JSON.stringify(jobType)}`);
    }
}

const FOLDDISCO_ROW_CAP = 1000;
const SEARCH_ROW_CAP_DEFAULT = 1000;

const SINGLE_UNIT_KINDS = new Set(['foldmason', 'folddisco']);

/** Fields excluded from exported rows. */
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

/** Validate a query index without reinterpreting single-unit alignment entries. */
export function normalizeQueryIdx(jobType, queryIdx = 0) {
    const value = queryIdx === undefined || queryIdx === null ? 0 : queryIdx;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
        throw coded('INVALID_QUERY_IDX',
            `invalid queryIdx: ${JSON.stringify(queryIdx)} — expected a non-negative safe integer`);
    }
    if (SINGLE_UNIT_KINDS.has(kindForJobType(jobType)) && value !== 0) {
        throw coded('INVALID_QUERY_IDX',
            `${kindForJobType(jobType)} serves one result per ticket, so queryIdx must be 0 or omitted `
            + `— got ${value}.`);
    }
    return { queryIdx: value };
}

/** Count delivered alignments and parsed row groups per database. */
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
    if (kind === 'foldmason') return { rowCap: null };
    if (kind === 'folddisco') return { rowCap: FOLDDISCO_ROW_CAP };
    if (configuredCap !== null && configuredCap !== undefined) {
        if (!Number.isSafeInteger(configuredCap) || configuredCap < 1) {
            throw coded('INVALID_CONFIG',
                `invalid result row cap: ${JSON.stringify(configuredCap)} — expected an integer >= 1`);
        }
        return { rowCap: configuredCap };
    }
    return { rowCap: SEARCH_ROW_CAP_DEFAULT };
}

/** Report proven truncation, known completeness, or unknown completeness. */
export function completenessOf({ jobType, parsedRows = 0, rowCap, configuredCap = null } = {}) {
    const resolved = rowCap === undefined ? resultRowCap({ jobType, configuredCap }) : { rowCap };

    if (kindForJobType(jobType) === 'foldmason') {
        return { complete: true, saturated: false, rowCap: null };
    }
    const saturated = resolved.rowCap !== null && parsedRows >= resolved.rowCap;
    return {
        complete: saturated ? false : null,
        saturated,
        rowCap: resolved.rowCap ?? null,
    };
}

/** Combine parsed database identity with optional catalog metadata and safe file names. */
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
            taxonomyTree: !!entryData?.taxonomyreports?.[0]?.length,
            hasDescription: !!entryData?.hasDescription,
        };
    });
    return { catalogAvailable: list !== null && list.length > 0, databases };
}

/** Export a depth-ordered taxonomy report with derived parent links. */
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

/** Serialize one parsed hit group with numeric metrics and optional chain details. */
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

/** Aggregate FoldDisco match patterns with deterministic tie ordering. */
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

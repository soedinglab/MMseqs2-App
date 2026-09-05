// Bounded result orientation: identity, contents and next action.

import { SUMMARY_SCHEMA, validateResultSummary } from './schemas.js';
import { defaultRankingSemantics } from './metrics.js';
import {
    kindForJobType, toolForJobType, resultCounts, completenessOf, databaseProvenance,
    motifPatternExport, serializeRow,
} from './facts.js';
import { foldMasonSummary } from './msa.js';

// Single-unit jobs have no query index.
const SINGLE_UNIT = new Set(['foldmason', 'folddisco']);

const MOTIF_PATTERN_SAMPLE = 5;

/** Summarize saved selections without their members. */
function selectionMetadata(records) {
    return (records ?? []).map(record => ({
        name: record.name,
        kind: record.page === 'foldmason' ? 'columns' : 'rows',
        size: record.size ?? 0,
        // Preserve each selection kind's own index name.
        ...(Number.isSafeInteger(record.queryIdx) ? { queryIdx: record.queryIdx } : {}),
        ...(Number.isSafeInteger(record.entry) ? { entry: record.entry } : {}),
        createdAt: record.createdAt ?? null,
        updatedAt: record.updatedAt ?? null,
    }));
}

/** Summarize query identity without retaining query text. */
function submissionSummary(record, parsed) {
    const request = record?.request ?? null;
    const out = {};
    for (const key of ['motif', 'taxFilter', 'iterativeSearch', 'queryBytes', 'queryHash']) {
        if (request?.[key] !== undefined) out[key] = request[key];
    }
    if (Array.isArray(request?.files)) out.files = request.files;
    const query = parsed?.queries?.[0] ?? null;
    if (query?.header) out.queryHeader = query.header;
    if (typeof query?.sequence === 'string') out.querySequenceLength = query.sequence.length;
    if (parsed?.motif && out.motif === undefined) out.motif = parsed.motif;
    return Object.keys(out).length ? out : null;
}

/** Pool motif patterns across databases and return a bounded sample. */
function motifPatternSample(parsed) {
    const hits = new Map();
    let queryResidues = null;
    for (const entryData of parsed?.results ?? []) {
        const one = motifPatternExport(entryData);
        queryResidues = queryResidues ?? one.queryResidues;
        for (const { pattern, hits: n } of one.patterns) {
            hits.set(pattern, (hits.get(pattern) ?? 0) + n);
        }
    }
    const patterns = [...hits.entries()]
        .map(([pattern, n]) => ({ pattern, hits: n }))
        .sort((a, b) => b.hits - a.hits || a.pattern.localeCompare(b.pattern));
    return {
        distinct: patterns.length,
        top: patterns.slice(0, MOTIF_PATTERN_SAMPLE),
        queryResidues,
    };
}

function topHitFor(parsed, dbIndex, rowId, tool, field) {
    if (!rowId) return null;
    const groupId = String(rowId).slice(String(rowId).indexOf('#') + 1);
    const row = serializeRow(parsed, dbIndex, groupId, { tool });
    return {
        id: row.id,
        target: row.target ?? row.targetName ?? null,
        value: typeof row[field] === 'number' ? row[field] : null,
        taxName: row.taxName ?? null,
    };
}

export function notReadySummary({ ticket, queryIdx = 0, status, jobType = null }) {
    const failed = status === 'ERROR' || status === 'UNKNOWN';
    const out = {
        schema: SUMMARY_SCHEMA,
        ticket,
        ...(SINGLE_UNIT.has(kindForJobType(jobType)) ? {} : { queryIdx }),
        status,
        tool: toolForJobType(jobType),
        code: failed ? 'RESULT_FAILED' : 'RESULT_NOT_READY',
        next: 'get_ticket_status',
    };
    const check = validateResultSummary(out);
    if (!check.ok) throw new Error(`built an invalid summary: ${JSON.stringify(check.errors)}`);
    return out;
}

/** Build a validated summary for one completed result unit. */
export function resultSummary({
    ticket, queryIdx = 0, jobType, status = 'COMPLETE',
    table = null, foldMasonResult = null, record = null, catalog = null,
    selections = [], configuredCap = null,
}) {
    const kind = kindForJobType(jobType);
    const head = {
        schema: SUMMARY_SCHEMA,
        ticket,
        ...(SINGLE_UNIT.has(kindForJobType(jobType)) ? {} : { queryIdx }),
        status,
        tool: toolForJobType(jobType),
        derivedFrom: record?.derivedFrom ?? null,
        selections: selectionMetadata(selections),
    };

    let out;
    if (kind === 'foldmason') {
        const entries = foldMasonResult?.entries ?? [];
        // counts.parsedRows already carries the entry count.
        const { entryCount, ...msa } = foldMasonSummary(foldMasonResult);
        out = {
            ...head,
            mode: null,
            submission: submissionSummary(record, null),
            databases: [],
            counts: {
                serverAlignments: entries.length,
                parsedRows: entries.length,
                grouping: 'none',
            },
            completeness: completenessOf({ jobType, parsedRows: entries.length }),
            ranking: null,
            // Empty results still export a manifest recording that outcome.
            msa,
        };
    } else {
        const parsed = table.raw;
        const counts = resultCounts(parsed, { tool: table.tool });
        const provenance = databaseProvenance(parsed, catalog);
        const ranking = defaultRankingSemantics({
            tool: table.tool, mode: table.mode, isComplex: table.isComplex,
        });
        const topRow = table.topRowIds();

        // Keep database orientation smaller than the complete export record.
        const databases = provenance.databases.map((db, i) => ({
            dbIndex: db.dbIndex,
            id: db.id,
            display: db.display,
            version: db.version,
            taxonomyTree: db.taxonomyTree,
            parsedRows: counts.databases[i].parsedRows,
            topHit: topHitFor(parsed, db.dbIndex, topRow.get(db.dbIndex), table.tool, ranking.field),
        }));

        // Saturation is per database, not across their sum.
        const largest = counts.databases.reduce((a, d) => Math.max(a, d.parsedRows), 0);

        out = {
            ...head,
            mode: table.mode || null,
            submission: submissionSummary(record, parsed),
            databases,
            counts: {
                serverAlignments: counts.serverAlignments,
                parsedRows: counts.parsedRows,
                grouping: counts.grouping,
            },
            completeness: completenessOf({ jobType, parsedRows: largest, configuredCap }),
            ranking,
            ...(table.tool === 'folddisco' ? { motifPatterns: motifPatternSample(parsed) } : {}),
        };
    }

    const check = validateResultSummary(out);
    if (!check.ok) throw new Error(`built an invalid summary: ${JSON.stringify(check.errors)}`);
    return out;
}

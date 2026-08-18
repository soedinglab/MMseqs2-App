// The bounded orientation payload: what this ticket is, what it holds, and what can be read next.
// Fixed by the job — no field selection, sorting, filtering or sampling parameters.

import { SUMMARY_SCHEMA, validateResultSummary } from './schemas.js';
import { defaultRankingSemantics } from './metrics.js';
import {
    kindForJobType, resultCounts, completenessOf, databaseProvenance, motifPatternExport, serializeRow,
} from './facts.js';
import { foldMasonSummary } from './msa.js';

const MOTIF_PATTERN_SAMPLE = 5;

/** Names, sizes and timestamps. Membership belongs to the selection tools, not to an orientation. */
function selectionMetadata(records) {
    return (records ?? []).map(record => ({
        name: record.name,
        kind: record.page === 'foldmason' ? 'columns' : 'rows',
        size: record.size ?? 0,
        entry: Number.isSafeInteger(record.entry) ? record.entry : null,
        createdAt: record.createdAt ?? null,
        updatedAt: record.updatedAt ?? null,
    }));
}

/**
 * Length and hash of the query, never the query. `mode` and `databases` are left out: the payload
 * already carries the mode at the top level and the databases as their own list.
 */
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

/** Patterns pooled over every database, capped — a distinct count plus a sample stays bounded. */
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

export function notReadySummary({ ticket, entry = 0, entryNormalized = false, status, jobType = null }) {
    const failed = status === 'ERROR' || status === 'UNKNOWN';
    const out = {
        schema: SUMMARY_SCHEMA,
        ticket,
        entry,
        ...(entryNormalized ? { entryNormalized } : {}),
        status,
        jobType,
        code: failed ? 'RESULT_FAILED' : 'RESULT_NOT_READY',
        next: 'get_ticket_status',
    };
    const check = validateResultSummary(out);
    if (!check.ok) throw new Error(`built an invalid summary: ${JSON.stringify(check.errors)}`);
    return out;
}

/**
 * @param {object} input
 * @param {import('./results.js').ResultTable} [input.table]  search / folddisco
 * @param {object} [input.foldMasonResult]                    foldmason
 * @param {object[]} [input.catalog]   /databases, when it was reachable
 * @param {object[]} [input.selections] store.listSelections output
 */
export function resultSummary({
    ticket, entry = 0, entryNormalized = false, jobType, status = 'COMPLETE',
    table = null, foldMasonResult = null, record = null, catalog = null,
    selections = [], configuredCap = null,
}) {
    const kind = kindForJobType(jobType);
    const head = {
        schema: SUMMARY_SCHEMA,
        ticket,
        entry,
        ...(entryNormalized ? { entryNormalized } : {}),
        status,
        jobType,
        derivedFrom: record?.derivedFrom ?? null,
        selections: selectionMetadata(selections),
    };

    let out;
    if (kind === 'foldmason') {
        const entries = foldMasonResult?.entries ?? [];
        // entryCount would repeat counts.parsedRows, which is the shared contract with the manifest.
        const { entryCount, ...msa } = foldMasonSummary(foldMasonResult);
        out = {
            ...head,
            mode: null,
            resultKind: 'foldmason',
            submission: submissionSummary(record, null),
            databases: [],
            counts: {
                serverAlignments: entries.length,
                parsedRows: entries.length,
                grouping: 'none',
            },
            completeness: completenessOf({ jobType, parsedRows: entries.length }),
            ranking: null,
            exportAvailable: entries.length > 0,
            msa,
        };
    } else {
        const parsed = table.raw;
        const counts = resultCounts(parsed, { tool: table.tool });
        const provenance = databaseProvenance(parsed, catalog);
        const ranking = defaultRankingSemantics({
            tool: table.tool, mode: table.mode, isComplex: table.isComplex,
        });
        const survey = table.getTableSummary({ db: '*', topN: 1 });
        const topRow = new Map((survey.databases ?? []).map(d => [d.dbIndex, d.top?.[0]?.id ?? null]));

        // Orientation, not the export record: safeName is derivable from dbIndex, the catalog's own
        // taxonomy/status flags belong to list_databases, and per-database serverAlignments only ever
        // differs from parsedRows under a grouping the top-level counts already report.
        const databases = provenance.databases.map((db, i) => ({
            dbIndex: db.dbIndex,
            id: db.id,
            display: db.display,
            version: db.version,
            hasTaxonomy: db.hasTaxonomy,
            parsedRows: counts.databases[i].parsedRows,
            topHit: topHitFor(parsed, db.dbIndex, topRow.get(db.dbIndex), table.tool, ranking.field),
        }));

        // The row cap applies per database, so saturation is decided on the largest one. Summing
        // across databases would report two half-full results as a truncated one.
        const largest = counts.databases.reduce((a, d) => Math.max(a, d.parsedRows), 0);

        out = {
            ...head,
            mode: table.mode || null,
            resultKind: kind === 'complexsearch' ? 'complexsearch' : (table.tool === 'folddisco' ? 'folddisco' : 'search'),
            submission: submissionSummary(record, parsed),
            databases,
            counts: {
                serverAlignments: counts.serverAlignments,
                parsedRows: counts.parsedRows,
                grouping: counts.grouping,
            },
            completeness: completenessOf({ jobType, parsedRows: largest, configuredCap }),
            ranking,
            exportAvailable: counts.parsedRows > 0,
            ...(table.tool === 'folddisco' ? { motifPatterns: motifPatternSample(parsed) } : {}),
        };
    }

    const check = validateResultSummary(out);
    if (!check.ok) throw new Error(`built an invalid summary: ${JSON.stringify(check.errors)}`);
    return out;
}

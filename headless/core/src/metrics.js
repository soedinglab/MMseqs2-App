// What each result metric is called, which way is better, and whether it survives a comparison across
// databases.
//
// Direction is a property of the number and comes from the table. Default sort order is whatever the
// frontend's sorter does, imported rather than restated — the two can disagree, and where they do,
// saying so is the point.

import { defaultSortOrder, rowFieldForSortKey } from '../../../frontend/lib/resultSort.js';

const HIGHER = 'higher';
const LOWER = 'lower';

/** Sort key per row field — the inverse of rowFieldForSortKey, asserted in the tests. */
export const SORT_KEY_FOR_FIELD = {
    eval: 'eval',
    score: 'score',
    prob: 'prob',
    seqId: 'seqId',
    complexqtm: 'qtm',
    complexttm: 'ttm',
    idfscore: 'idf',
    rmsd: 'rmsd',
    nodecount: 'node',
    target: 'target',
    description: 'desc',
    taxName: 'tax',
};

/** Fields the artifact must emit as numbers; the parser leaves several of them as strings. */
export const NUMERIC_METRIC_FIELDS = [
    'eval', 'score', 'prob', 'seqId', 'complexqtm', 'complexttm',
    'idfscore', 'rmsd', 'nodecount',
    'alnLength', 'qStartPos', 'qEndPos', 'qLen', 'dbStartPos', 'dbEndPos', 'dbLen',
    'gapsopened', 'missmatches',
];

// Labels are the page's own (ResultFoldseekDB.vue, ResultFoldDiscoDB.vue), so a value an agent
// reports is named the way a human reading the same result sees it.
export const METRIC_SEMANTICS = Object.freeze({
    '3di.eval': { label: 'E-Value', direction: LOWER, crossDatabaseComparable: false },
    '3di.score': { label: 'Score', direction: HIGHER, crossDatabaseComparable: true },
    '3diaa.eval': { label: 'E-Value', direction: LOWER, crossDatabaseComparable: false },
    '3diaa.score': { label: 'Score', direction: HIGHER, crossDatabaseComparable: true },
    'tmalign.eval': { label: 'TM-score', direction: HIGHER, crossDatabaseComparable: true },
    'tmalign.score': { label: 'Score', direction: HIGHER, crossDatabaseComparable: true },
    'lolalign.eval': { label: 'LOL-score', direction: HIGHER, crossDatabaseComparable: true },
    'lolalign.score': { label: 'Score', direction: HIGHER, crossDatabaseComparable: true },
    'shared.prob': { label: 'Probability', direction: HIGHER, crossDatabaseComparable: true },
    'shared.seqId': { label: 'Seq. Id.', direction: HIGHER, crossDatabaseComparable: true },
    'complex.complexqtm': { label: 'Query TM-score', direction: HIGHER, crossDatabaseComparable: true },
    'complex.complexttm': { label: 'Target TM-score', direction: HIGHER, crossDatabaseComparable: true },
    'folddisco.idfscore': { label: 'IDF-score', direction: HIGHER, crossDatabaseComparable: false },
    'folddisco.rmsd': { label: 'RMSD', direction: LOWER, crossDatabaseComparable: true },
    'folddisco.nodecount': { label: 'Nodes', direction: HIGHER, crossDatabaseComparable: true },
});

function baseMode(rawMode) {
    return rawMode.startsWith('complex-') ? rawMode.slice('complex-'.length) : rawMode;
}

function registryKey(tool, mode, field) {
    if (tool === 'folddisco') return `folddisco.${field}`;
    const byMode = `${mode}.${field}`;
    if (byMode in METRIC_SEMANTICS) return byMode;
    if (`complex.${field}` in METRIC_SEMANTICS) return `complex.${field}`;
    return `shared.${field}`;
}

/**
 * What a caller needs to act on one metric. Deliberately does not echo `tool`, `mode` or `field` back:
 * the caller passed them, and repeating them in every summary and manifest is payload nobody reads.
 */
export function metricSemantics({ tool = 'foldseek', mode = '', field } = {}) {
    // Submission spells a complex search "complex-tmalign"; the backend strips that before storing the
    // job, so the result — and therefore the parser and the sorter — only ever sees "tmalign".
    const resolved = baseMode(String(mode ?? ''));
    const entry = METRIC_SEMANTICS[registryKey(tool, resolved, field)];
    const sortKey = SORT_KEY_FOR_FIELD[field] ?? null;
    const sortOrder = sortKey ? defaultSortOrder(sortKey, { mode: resolved }) : null;

    if (!entry) {
        return { known: false, label: field, direction: HIGHER, crossDatabaseComparable: null, sortOrder };
    }
    return {
        known: true,
        label: entry.label,
        direction: entry.direction,
        crossDatabaseComparable: entry.crossDatabaseComparable,
        sortOrder,
    };
}

/** The ranking a result table uses when nothing is asked for — mirrors ResultTable.getTable. */
export function defaultRankingSemantics({ tool = 'foldseek', mode = '', isComplex = false } = {}) {
    const sortKey = tool === 'folddisco' ? 'idf' : (isComplex ? 'qtm' : 'score');
    const field = rowFieldForSortKey(sortKey, tool);
    const { known, ...facts } = metricSemantics({ tool, mode, field });
    return { sortKey, field, ...facts };
}

/**
 * Recovers a number from the parser's display strings; null where there is no value. Needed because
 * parseResults rewrites eval/prob/idfscore/rmsd in place as formatted strings, and under lolalign
 * multiplies eval by 100 first.
 */
export function numericMetric(row, field) {
    const raw = row?.[field];
    if (raw === null || raw === undefined || raw === '') return null;
    const value = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(value) ? value : null;
}

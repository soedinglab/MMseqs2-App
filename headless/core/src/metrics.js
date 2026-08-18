// What each result metric is called, which way is better, whether it survives a comparison across
// databases, and what the parser did to it on the way here.
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

/** parseResults branches on the raw mode string, so "complex-tmalign" takes the E-value path. */
function parserTransform(field, rawMode) {
    if (field === 'eval') {
        if (rawMode === 'tmalign') return 'toFixed(3) -> String';
        if (rawMode === 'lolalign') {
            return 'toExponential(2) -> x100 -> toFixed(2) -> String (3 significant digits kept)';
        }
        return 'toExponential(2) -> String';
    }
    if (field === 'prob') return 'toFixed(2) -> String (foldseek app only)';
    if (field === 'idfscore' || field === 'rmsd') return 'toFixed(3) -> String';
    return 'none';
}

function baseMode(rawMode) {
    return rawMode.startsWith('complex-') ? rawMode.slice('complex-'.length) : rawMode;
}

function registryKey(tool, rawMode, field) {
    if (tool === 'folddisco') return `folddisco.${field}`;
    const byMode = `${baseMode(rawMode)}.${field}`;
    if (byMode in METRIC_SEMANTICS) return byMode;
    if (`complex.${field}` in METRIC_SEMANTICS) return `complex.${field}`;
    return `shared.${field}`;
}

export function metricSemantics({ tool = 'foldseek', mode = '', field } = {}) {
    const rawMode = String(mode ?? '');
    const key = registryKey(tool, rawMode, field);
    const entry = METRIC_SEMANTICS[key];
    const sortKey = SORT_KEY_FOR_FIELD[field] ?? null;
    const order = sortKey ? defaultSortOrder(sortKey, { mode: rawMode }) : null;

    if (!entry) {
        return {
            key, field, tool, mode: rawMode, known: false,
            label: field,
            direction: HIGHER,
            crossDatabaseComparable: null,
            parserTransform: parserTransform(field, rawMode),
            defaultSortOrder: order,
            sortOrderMatchesDirection: null,
        };
    }

    const matches = order === null ? null : (entry.direction === HIGHER ? order === -1 : order === 1);
    const out = {
        key, field, tool, mode: rawMode, known: true,
        label: entry.label,
        direction: entry.direction,
        crossDatabaseComparable: entry.crossDatabaseComparable,
        // Kept because it is a correctness fact, not prose: it says the value arrives as a display
        // string, and that a lolalign eval was already multiplied by 100.
        parserTransform: parserTransform(field, rawMode),
        defaultSortOrder: order,
        sortOrderMatchesDirection: matches,
    };
    if (matches === false) {
        out.note = `mode "${rawMode}" is still a ${baseMode(rawMode)} value, but the parser and the `
            + 'table both branch on the raw mode string, so this value is formatted and sorted as if '
            + 'it were an E-value';
    }
    return out;
}

/** The ranking a result table uses when nothing is asked for — mirrors ResultTable.getTable. */
export function defaultRankingSemantics({ tool = 'foldseek', mode = '', isComplex = false } = {}) {
    const sortKey = tool === 'folddisco' ? 'idf' : (isComplex ? 'qtm' : 'score');
    const field = rowFieldForSortKey(sortKey, tool);
    return {
        sortKey,
        sortOrder: defaultSortOrder(sortKey, { mode }),
        field,
        semantics: metricSemantics({ tool, mode, field }),
    };
}

/** Recovers a number from the parser's display strings; null where there is no value. */
export function numericMetric(row, field) {
    const raw = row?.[field];
    if (raw === null || raw === undefined || raw === '') return null;
    const value = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(value) ? value : null;
}

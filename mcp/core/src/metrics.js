// Metric names, direction and cross-database comparability.

import { defaultSortOrder, rowFieldForSortKey } from '../../../frontend/lib/resultSort.js';

const HIGHER = 'higher';
const LOWER = 'lower';

/** Fields the artifact must emit as numbers; the parser leaves several of them as strings. */
export const NUMERIC_METRIC_FIELDS = [
    'eval', 'score', 'prob', 'seqId', 'complexqtm', 'complexttm',
    'idfscore', 'rmsd', 'nodecount',
    'alnLength', 'qStartPos', 'qEndPos', 'qLen', 'dbStartPos', 'dbEndPos', 'dbLen',
    'gapsopened', 'missmatches',
];

// Labels match the user-facing result tables.
export const METRIC_SEMANTICS = Object.freeze({
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

/** Return the semantics needed to interpret one metric. */
export function metricSemantics({ tool = 'foldseek', mode = '', field } = {}) {
    // Stored complex modes omit the `complex-` prefix.
    const resolved = baseMode(String(mode ?? ''));
    const entry = METRIC_SEMANTICS[registryKey(tool, resolved, field)];
    if (!entry) {
        return { known: false, label: field, direction: HIGHER, crossDatabaseComparable: null };
    }
    return {
        known: true,
        label: entry.label,
        direction: entry.direction,
        crossDatabaseComparable: entry.crossDatabaseComparable,
    };
}

/** Return the default result ordering key. */
export function defaultSortKey({ tool = 'foldseek', mode = '', isComplex = false } = {}) {
    if (tool === 'folddisco') return 'idf';
    if (isComplex) return 'qtm';
    const resolved = baseMode(String(mode ?? ''));
    return resolved === 'tmalign' || resolved === 'lolalign' ? 'eval' : 'score';
}

export function defaultRankingSemantics({ tool = 'foldseek', mode = '', isComplex = false } = {}) {
    const sortKey = defaultSortKey({ tool, mode, isComplex });
    const field = rowFieldForSortKey(sortKey, tool);
    const { known, ...facts } = metricSemantics({ tool, mode, field });
    return { field, ...facts };
}

/** Recover numeric metrics from parser-formatted values. */
export function numericMetric(row, field) {
    const raw = row?.[field];
    if (raw === null || raw === undefined || raw === '') return null;
    const value = typeof raw === 'number' ? raw : Number(raw);
    return Number.isFinite(value) ? value : null;
}

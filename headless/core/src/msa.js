// Per-column metrics for a FoldMason alignment, without a browser.
//
// The page gets quality/conservation from a WGSL compute shader and reads them off the viewer. Here
// they come from msaTracks.js's CPU path, which — with an alphabet supplied — computes the same
// numbers, verified against real GPU output column for column (test/fixtures/msa-gpu-metrics.json).
//
// LDDT is the primary metric and does not come from the shader at all: the backend ships it as
// `scores`, one value per column, which MSA.vue feeds through as `extraValues: { lddt }`. A value of
// -1 means the column has no LDDT rather than an LDDT of -1, so it is reported as null and counted
// as missing — the same treatment the page's own summary gives it.
//
// Field names follow getColumnTable()'s so the two APIs share a vocabulary. Its `visible` and
// `selected` are absent here: both read mounted-component state and have no headless meaning.

import { computeMetricsCpu, decodeConservation } from '../../../frontend/lib/msaTracks.js';
import { aminoAcidAlphabet, threeDIAlphabet } from 'msa-webgpu';

/**
 * FoldMason entries carry both an amino-acid alignment (`aa`) and a 3Di one (`ss`); which one is
 * being measured decides both the sequences and the substitution matrix, so they travel together.
 * Conservation is amino-acid only — the shader stubs it to zero for 3Di, and this follows.
 */
const REPRESENTATIONS = {
    aa: { alphabet: aminoAcidAlphabet, field: 'aa' },
    '3di': { alphabet: threeDIAlphabet, field: 'ss' },
};

/** Every metric a column row can carry. LDDT first: it is the one that measures the structures. */
export const COLUMN_METRICS = [
    'lddt', 'quality', 'conservation', 'consensus', 'occupancy', 'entropy', 'informationContent',
];

/** Metrics that are a plain number per column, and can therefore be ranked or thresholded. */
const SCALAR_METRICS = ['lddt', 'quality', 'conservation', 'occupancy', 'entropy', 'informationContent'];

const MISSING_LDDT = -1;

/**
 * Values that mean something specific rather than just "high", so a mean hides them. Conservation's
 * come from the shader: 11 identity, 10 every property shared, 0 nothing shared.
 */
const CATEGORIES = {
    conservation: [
        ['identity', v => v === 11],
        ['fullyConserved', v => v === 10],
        ['unconserved', v => v === 0],
    ],
    quality: [
        ['perfect', v => v === 1],
        ['zero', v => v === 0],
    ],
    occupancy: [
        ['fullyOccupied', v => v === 1],
    ],
};

function round(value, precision) {
    if (typeof value !== 'number' || Number.isInteger(value) || precision == null) return value;
    return +value.toFixed(precision);
}

function prepare(foldMasonResult, representation, wanted) {
    const spec = REPRESENTATIONS[representation];
    if (!spec) {
        return { error: `unknown representation: ${representation}`, available: Object.keys(REPRESENTATIONS) };
    }
    if (wanted) {
        const unknown = wanted.filter(m => !COLUMN_METRICS.includes(m));
        if (unknown.length) return { error: `unknown metric(s): ${unknown.join(', ')}`, available: COLUMN_METRICS };
    }

    const entries = foldMasonResult?.entries ?? [];
    const sequences = entries.map(e => e[spec.field]).filter(s => typeof s === 'string');
    if (sequences.length === 0) {
        return {
            error: entries.length
                ? `this alignment has no "${spec.field}" sequences for the ${representation} representation`
                : 'this result has no entries',
            entryCount: entries.length,
        };
    }

    const symbols = spec.alphabet.symbols.slice(0, spec.alphabet.metricConfig.coreSize);
    const metrics = computeMetricsCpu(sequences, { symbols, alphabet: spec.alphabet });
    const scores = Array.isArray(foldMasonResult?.scores) ? foldMasonResult.scores : [];

    // One accessor per scalar metric, returning null where the value does not exist, so callers
    // never have to know which array a metric lives in or how absence is spelled.
    const value = {
        lddt: c => (Number.isFinite(scores[c]) && scores[c] !== MISSING_LDDT ? scores[c] : null),
        quality: c => metrics.quality?.[c] ?? null,
        conservation: c => metrics.conservationScore?.[c] ?? null,
        occupancy: c => metrics.occupancy[c],
        entropy: c => metrics.entropy[c],
        informationContent: c => metrics.informationContentRaw[c],
    };
    const available = COLUMN_METRICS.filter(m => (
        m === 'consensus' ? true
            : m === 'lddt' ? scores.length > 0
                : m === 'conservation' ? !!metrics.conservationScore
                    : m === 'quality' ? !!metrics.quality
                        : true
    ));

    return { spec, symbols, sequences, metrics, scores, value, available };
}

/**
 * Collapse consecutive columns into ranges: [1,2,3,4,5,6,8] -> ['1-6', '8']. These lists are mostly
 * runs, so listing them one by one is both longer and harder to read than the shape it describes.
 * Uniformly strings, so a caller never has to branch on the element type.
 */
export function compressRanges(columns) {
    const out = [];
    for (let i = 0; i < columns.length;) {
        let j = i;
        while (j + 1 < columns.length && columns[j + 1] === columns[j] + 1) j++;
        out.push(i === j ? String(columns[i]) : `${columns[i]}-${columns[j]}`);
        i = j + 1;
    }
    return out;
}

/**
 * Counts *and positions* for a metric's notable values: a count says such a column exists, not
 * which one to look at. `count` is always exact; the range list is capped and says when cut.
 */
function categorize(metric, values, maxRanges) {
    const defs = CATEGORIES[metric];
    if (!defs) return null;
    const out = {};
    for (const [name, predicate] of defs) {
        const columns = [];
        for (let c = 0; c < values.length; c++) if (predicate(values[c])) columns.push(c);
        const ranges = compressRanges(columns);
        out[name] = { count: columns.length, columns: ranges.slice(0, maxRanges) };
        if (ranges.length > maxRanges) out[name].truncated = true;
    }
    return out;
}

function statOf(values) {
    const real = values.filter(v => typeof v === 'number' && Number.isFinite(v));
    if (!real.length) return null;
    const sum = real.reduce((a, b) => a + b, 0);
    return {
        min: +Math.min(...real).toFixed(4),
        max: +Math.max(...real).toFixed(4),
        mean: +(sum / real.length).toFixed(4),
        missing: values.length - real.length,
    };
}

/**
 * @param {{entries: {name: string, aa: string, ss?: string}[], scores?: number[]}} foldMasonResult
 * @param {object} [opts]
 * @param {'aa'|'3di'} [opts.representation]
 * @param {string[]} [opts.metrics]   subset of COLUMN_METRICS; default all that are available
 * @param {number[]} [opts.columns]   explicit column indices; default every column
 * @param {number} [opts.offset]
 * @param {number} [opts.limit]       default 0, meaning no cap
 * @param {number} [opts.precision]   decimal places for floats; null to leave them alone
 */
export function foldMasonColumns(foldMasonResult, {
    representation = 'aa', metrics: wanted = null, columns = null, offset = 0, limit = 0, precision = 4,
} = {}) {
    const prepared = prepare(foldMasonResult, representation, wanted);
    if (prepared.error) return prepared;
    const { spec, symbols, sequences, metrics, value, available } = prepared;

    const include = (wanted ?? available).filter(m => available.includes(m));
    const total = metrics.occupancy.length;

    let indices = columns ?? Array.from({ length: total }, (_, i) => i);
    indices = limit ? indices.slice(offset, offset + limit) : indices.slice(offset);

    const rows = indices.map(c => {
        const row = { column: c };
        for (const metric of include) {
            if (metric === 'consensus') {
                const idx = metrics.consensusIndex[c];
                row.consensus = {
                    glyph: metrics.consensusTie[c] === 1 ? '+' : (idx < symbols.length ? symbols[idx] : null),
                    modalFractionNonGap: round(metrics.modalFractionNonGap[c], precision),
                };
            } else if (metric === 'conservation') {
                row.conservation = decodeConservation(metrics.conservationMask[c], metrics.conservationScore[c]);
            } else {
                row[metric] = round(value[metric](c), precision);
            }
        }
        return row;
    });

    return {
        representation,
        alphabetId: spec.alphabet.id,
        entryCount: sequences.length,
        totalColumns: total,
        offset,
        returned: rows.length,
        metrics: include,
        rows,
    };
}

/**
 * Contiguous runs of columns at or above a threshold on one metric, each scored by its mean.
 */
function findRegions(total, valueAt, threshold, minLength) {
    const regions = [];
    let start = null;
    for (let c = 0; c <= total; c++) {
        const v = c < total ? valueAt(c) : null;
        const inside = typeof v === 'number' && v >= threshold;
        if (inside && start === null) start = c;
        if (!inside && start !== null) {
            if (c - start >= minLength) regions.push({ start, end: c - 1, length: c - start });
            start = null;
        }
    }
    return regions;
}

/**
 * Pick a threshold that actually yields regions.
 *
 * A fixed high cut-off is the wrong instrument here: conservation reaches 10 only where every
 * residue shares all ten properties, and plenty of real alignments have no such run, so a "top
 * regions" call would come back empty and say nothing about an alignment that does have a clear
 * best-aligned core. Taking a quantile of the values actually present makes the answer relative to
 * the alignment in hand — always the best regions *of this alignment*, whatever its absolute range.
 */
function quantileThreshold(values, quantile) {
    const real = values.filter(v => typeof v === 'number' && Number.isFinite(v)).sort((a, b) => a - b);
    if (!real.length) return null;
    const idx = Math.min(real.length - 1, Math.max(0, Math.floor(quantile * (real.length - 1))));
    return real[idx];
}

/**
 * One-call orientation for an alignment: the spread of each metric, the best-scoring columns, and
 * the actual column ranges where the primary metric runs high — so a caller can page into those
 * rather than walk the whole alignment.
 *
 * @param {object} [opts]
 * @param {'aa'|'3di'} [opts.representation]
 * @param {string[]} [opts.metrics]    which metrics to report; default all available
 * @param {string} [opts.primary]      metric the regions and top columns are ranked on; default
 *                                     'lddt' — it measures how well the structures actually
 *                                     superpose, which the sequence-derived metrics do not
 * @param {number|'auto'} [opts.threshold]  absolute cut-off, or 'auto' for a quantile of this
 *                                          alignment's own values
 * @param {number} [opts.quantile]     used when threshold is 'auto'; default 0.5, the median —
 *                                     "the better-aligned half". On the validation alignment 0.75
 *                                     covered 33 of 149 columns and split the core; 0.5 covers 69
 * @param {number} [opts.minLength]    shortest run worth reporting; default 3
 * @param {number} [opts.maxRegions]   how many regions to return, best first; default 10
 * @param {number} [opts.topColumns]   how many individual columns to return, best first; default 10
 * @param {number} [opts.maxRanges]    cap on each notable-value range list; default 20
 */
export function foldMasonColumnSummary(foldMasonResult, {
    representation = 'aa', metrics: wanted = null, primary = 'lddt', threshold = 'auto',
    quantile = 0.5, minLength = 3, maxRegions = 10, topColumns = 10, maxRanges = 20,
} = {}) {
    const prepared = prepare(foldMasonResult, representation, wanted);
    if (prepared.error) return prepared;
    const { spec, symbols, sequences, metrics, value, available } = prepared;

    const include = (wanted ?? available).filter(m => available.includes(m));
    const scalars = include.filter(m => SCALAR_METRICS.includes(m));
    const total = metrics.occupancy.length;
    const columnsOf = metric => Array.from({ length: total }, (_, c) => value[metric](c));

    const out = {
        representation,
        alphabetId: spec.alphabet.id,
        entryCount: sequences.length,
        totalColumns: total,
        metrics: include,
        stats: Object.fromEntries(scalars.map(m => [m, statOf(columnsOf(m))])),
        notable: Object.fromEntries(
            scalars
                .map(m => [m, categorize(m, columnsOf(m), maxRanges)])
                .filter(([, v]) => v !== null),
        ),
        // The consensus string is the cheapest whole-alignment orientation there is.
        consensus: metrics.consensusIndex.map((idx, c) => (
            metrics.consensusTie[c] === 1 ? '+' : (idx < symbols.length ? symbols[idx] : '-')
        )).join(''),
    };

    // Fall back to the first available scalar rather than erroring: a 3Di alignment has no
    // conservation, and a result without `scores` has no LDDT.
    const rankOn = scalars.includes(primary) ? primary : scalars[0] ?? null;
    if (!rankOn) return out;
    out.rankedOn = rankOn;
    if (rankOn !== primary) {
        out.rankedOnNote = `${primary} is not available for this alignment; ranked on ${rankOn} instead`;
    }

    const values = columnsOf(rankOn);
    const cut = threshold === 'auto' ? quantileThreshold(values, quantile) : threshold;
    out.threshold = { metric: rankOn, value: cut == null ? null : +Number(cut).toFixed(4), minLength };
    if (threshold === 'auto') out.threshold.quantile = quantile;

    // Best individual columns, descending — the page's summary ranks the same way.
    out.topColumns = values
        .map((v, column) => ({ column, value: typeof v === 'number' ? +v.toFixed(4) : null }))
        .filter(x => x.value !== null)
        .sort((a, b) => b.value - a.value || a.column - b.column)
        .slice(0, Math.max(0, topColumns));

    if (cut != null) {
        const meanOver = (region, metric) => {
            const present = [];
            for (let c = region.start; c <= region.end; c++) {
                const v = value[metric](c);
                if (typeof v === 'number' && Number.isFinite(v)) present.push(v);
            }
            return present.length ? +(present.reduce((a, b) => a + b, 0) / present.length).toFixed(4) : null;
        };
        out.regions = findRegions(total, c => value[rankOn](c), cut, minLength)
            .map(r => ({ ...r, ...Object.fromEntries(scalars.map(m => [m, meanOver(r, m)])) }))
            // Best region first, by the metric being ranked on — not the first or the longest one.
            .sort((a, b) => (b[rankOn] ?? -Infinity) - (a[rankOn] ?? -Infinity) || a.start - b.start)
            .slice(0, Math.max(0, maxRegions));
    }

    return out;
}

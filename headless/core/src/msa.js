// Per-column metrics for a FoldMason alignment, without a browser.

import { computeMetricsCpu, decodeConservation } from '../../../frontend/lib/msaTracks.js';
import { getResidueIndices, entryChainMap } from '../../../frontend/lib/alignmentColumns.js';
import { mockPDB } from '../../../frontend/lib/pdbAssembly.js';
import { getAccession } from '../../../frontend/lib/targetName.js';
import { aminoAcidAlphabet, threeDIAlphabet } from 'msa-webgpu';

const REPRESENTATIONS = {
    aa: { alphabet: aminoAcidAlphabet, field: 'aa' },
    '3di': { alphabet: threeDIAlphabet, field: 'ss' },
};

export const COLUMN_METRICS = [
    'lddt', 'quality', 'conservation', 'consensus', 'occupancy', 'entropy', 'informationContent',
];

const SCALAR_METRICS = ['lddt', 'quality', 'conservation', 'occupancy', 'entropy', 'informationContent'];

const MISSING_LDDT = -1;

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
 * The inverse of compressRanges: ['1-6', '8'] -> [1,2,3,4,5,6,8]. Accepts plain numbers too, so a
 * caller can hand back exactly what a summary printed — the regions it reports are the columns worth
 * selecting, and retyping them as a list is the step where they get miscopied.
 */
export function expandRanges(ranges) {
    const out = [];
    for (const item of ranges ?? []) {
        if (typeof item === 'number') { out.push(item); continue; }
        const text = String(item).trim();
        const dash = text.indexOf('-', 1);          // index 1: a leading '-' would be a negative
        if (dash === -1) {
            const n = Number(text);
            if (Number.isInteger(n)) out.push(n);
            continue;
        }
        const start = Number(text.slice(0, dash));
        const end = Number(text.slice(dash + 1));
        if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
        for (let c = Math.min(start, end); c <= Math.max(start, end); c++) out.push(c);
    }
    return [...new Set(out)].sort((a, b) => a - b);
}

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
    minOccupancy = null, includeLetters = false, maxLetters = 5,
} = {}) {
    const prepared = prepare(foldMasonResult, representation, wanted);
    if (prepared.error) return prepared;
    const { spec, symbols, sequences, metrics, value, available } = prepared;

    const include = (wanted ?? available).filter(m => available.includes(m));
    const total = metrics.occupancy.length;

    let indices = columns ?? Array.from({ length: total }, (_, i) => i);
    // The data operation behind the page's gap threshold and getColumnVisibility, without the
    // retained state or its debounce: a column is masked when too few rows have a residue in it.
    const maskedByOccupancy = minOccupancy == null
        ? 0
        : indices.filter(c => metrics.occupancy[c] < minOccupancy).length;
    if (minOccupancy != null) indices = indices.filter(c => metrics.occupancy[c] >= minOccupancy);
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
                if (includeLetters) {
                    const counts = metrics.counts[c];
                    const nonGap = counts.reduce((a, b) => a + b, 0);
                    const present = counts
                        .map((count, i) => ({ glyph: symbols[i], count }))
                        .filter(l => l.count > 0)
                        .sort((a, b) => b.count - a.count);
                    row.consensus.nonGapCount = nonGap;
                    // Capped like the page's getColumnTable, which slices to 5: a column can hold 20
                    // residue types and the tail is almost always single counts.
                    row.consensus.letters = present.slice(0, maxLetters).map(l => ({
                        glyph: l.glyph, count: l.count,
                        logoFraction: round(nonGap ? l.count / nonGap : 0, precision),
                    }));
                    if (present.length > maxLetters) row.consensus.lettersTruncated = present.length;
                }
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
        ...(minOccupancy != null ? { minOccupancy, maskedByOccupancy } : {}),
        rows,
    };
}

export function foldMasonFasta(foldMasonResult, {
    representation = 'aa', entries: wantedEntries = null, offset = 0, limit = 500,
} = {}) {
    const spec = REPRESENTATIONS[representation];
    if (!spec) {
        return { error: `unknown representation: ${representation}`, available: Object.keys(REPRESENTATIONS) };
    }
    const all = foldMasonResult?.entries ?? [];
    if (all.length === 0) return { error: 'this result has no entries' };

    let indices = wantedEntries ?? all.map((_, i) => i);
    const totalRequested = indices.length;
    indices = limit ? indices.slice(offset, offset + limit) : indices.slice(offset);

    const records = [];
    for (const i of indices) {
        const entry = all[i];
        if (!entry || typeof entry[spec.field] !== 'string') continue;
        records.push(`>${entry.name}\n${entry[spec.field]}`);
    }
    const fasta = records.length ? `${records.join('\n')}\n` : '';
    return {
        representation,
        alphabet: spec.field,
        totalEntries: all.length,
        offset,
        returned: records.length,
        truncated: offset + records.length < totalRequested,
        bytes: Buffer.byteLength(fasta),
        fasta,
    };
}

/**
 * CA coordinates per entry.
 */
export function foldMasonCoordinates(foldMasonResult, { entries: wantedEntries = null } = {}) {
    const all = foldMasonResult?.entries ?? [];
    if (all.length === 0) return { error: 'this result has no entries' };

    const indices = wantedEntries == null
        ? [0]                       // no argument means one entry, not all of them
        : (Array.isArray(wantedEntries) ? wantedEntries : [wantedEntries]);

    const out = [];
    for (const i of indices) {
        const entry = all[i];
        if (!entry) continue;
        const ca = typeof entry.ca === 'string' ? entry.ca : '';
        out.push({
            index: i,
            name: entry.name,
            residueCount: ca ? ca.split(',').length / 3 : 0,
            alignedLength: entry.aa?.length ?? null,
            bytes: Buffer.byteLength(ca),
            ca,
        });
    }
    return {
        totalEntries: all.length,
        format: 'comma-separated x,y,z triplets, one per ungapped residue — indices are residue '
            + 'positions, not alignment columns',
        returned: out.length,
        entries: out,
    };
}

/** Entry roster: names, ungapped lengths, and which representations each carries. */
export function foldMasonEntries(foldMasonResult) {
    const all = foldMasonResult?.entries ?? [];
    return {
        totalEntries: all.length,
        columns: all[0]?.aa?.length ?? 0,
        entries: all.map((e, index) => ({
            index,
            name: e.name,
            residueCount: typeof e.aa === 'string' ? e.aa.replace(/-/g, '').length : null,
            alignedLength: e.aa?.length ?? null,
            has: ['aa', 'ss', 'ca'].filter(f => typeof e[f] === 'string' && e[f].length > 0),
        })),
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

const SUFFIX_DELIMITER = '-_-_-_';

function suffixOf(name) {
    return String(name).includes(SUFFIX_DELIMITER) ? String(name).split(SUFFIX_DELIMITER)[1] : '';
}

/**
 * A set of alignment columns within one FoldMason entry, and the query they describe.
 */
export class MsaColumnSelection {
    constructor(client, foldMasonResult, {
        entry = 0, columns = [], ticket = null, name = 'default', motif = null, savedAt = null,
    } = {}) {
        this.client = client;
        this.result = foldMasonResult;
        this.ticket = ticket;
        this.name = name;
        this.savedAt = savedAt;
        this._motif = motif;
        this.columns = MsaColumnSelection._normalize(columns);
        this.setEntry(entry);
    }

    static _normalize(columns) {
        return [...new Set((columns ?? []).map(Number).filter(Number.isInteger))]
            .sort((a, b) => a - b);
    }

    setEntry(entry) {
        const entries = this.result?.entries ?? [];
        const data = entries[entry];
        if (!data) {
            throw new Error(`no entry ${entry} in this alignment (it has ${entries.length})`);
        }
        this.entryIndex = entry;
        this.entry = data;
        this.suffix = data.suffix ?? suffixOf(data.name);
        this.map = entryChainMap(data.aa, this.suffix);
        return this;
    }

    setColumns(columns) { this.columns = MsaColumnSelection._normalize(columns); return this; }

    addColumns(columns) {
        this.columns = MsaColumnSelection._normalize([...this.columns, ...(columns ?? [])]);
        return this;
    }

    removeColumns(columns) {
        const drop = new Set((columns ?? []).map(Number));
        this.columns = this.columns.filter(c => !drop.has(c));
        return this;
    }

    /**
     * Use this motif instead of the one the columns produce.
     */
    setMotif(motif) { this._motif = motif || null; return this; }

    get residues() {
        return getResidueIndices(this.entry.aa, this.columns).map(i => i + 1);
    }

    /**
     * The motif these columns describe: `chain + original residue number` per residue.
     */
    get motif() {
        if (this._motif) return this._motif;
        return this.residues
            .map((i) => {
                const chain = this.map.chains[i] ?? 'A';
                return chain + String(i - (this.map.offsets[chain] ?? 0));
            })
            .join(', ');
    }

    /** Persist under `name`, scoped to this alignment's ticket. */
    async save(name = this.name) {
        if (!this.ticket) throw new Error('this selection has no ticket, so there is nothing to save it against');
        this.name = name;
        const record = await this.client.store.writeSelection(this.ticket, name, {
            page: 'foldmason',
            entry: this.entryIndex,
            columns: this.columns,
            ...(this._motif ? { motif: this._motif } : {}),
        });
        this.savedAt = record.updatedAt;
        return record;
    }

    describe() {
        const residues = this.residues;
        return {
            name: this.name,
            ticket: this.ticket,
            entry: this.entryIndex,
            entryName: this.entry.name,
            accession: getAccession(this.entry.name),
            isMultimer: !!this.suffix,
            chains: [...new Set(this.map.chains.slice(1))],
            totalColumns: this.entry.aa?.length ?? 0,
            selectedColumns: compressRanges(this.columns),
            residueCount: residues.length,
            gapColumns: this.columns.length - residues.length,
            ...(this.savedAt ? { savedAt: this.savedAt } : { saved: false }),
            ...(this._motif ? { motifSource: 'override' } : {}),
            motif: this.motif,
        };
    }

    /**
     * A FoldMason entry's native pseudo-monomer form, which is the one origin that already has a
     * motif attached — the columns picked it out.
     */
    toQuery() {
        return this.client.query({
            kind: 'fm-entry',
            pdb: mockPDB(this.entry.ca, this.entry.aa.replace(/-/g, ''), 'A'),
            suffix: this.suffix,
            name: this.entry.name,
            motif: this.motif || undefined,
            ticket: this.ticket ?? undefined,
            lineage: {
                entry: this.entryIndex,
                entryName: this.entry.name,
                columns: compressRanges(this.columns),
                ...(this.name ? { selection: this.name } : {}),
            },
        });
    }

    sendTo(opts) { return this.toQuery().sendTo(opts); }
}

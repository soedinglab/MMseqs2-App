// Read per-column track values out of the msa-webgpu viewer.

const CONSERVATION_GROUPS = [
    'hydrophobic', 'polar', 'small', 'proline', 'tiny',
    'aliphatic', 'aromatic', 'positive', 'negative', 'charged',
];

// A plain alphabetical fallback for callers with no alphabet to hand
const AA_CORE = ['A','C','D','E','F','G','H','I','K','L','M','N','P','Q','R','S','T','V','W','Y'];

let warnedOnce = false;
function warnFallback(reason) {
    if (warnedOnce) return;
    warnedOnce = true;
    console.warn(`[msaTracks] falling back to CPU column metrics: ${reason}. `
        + 'The msa-webgpu internal layout may have changed.');
}

export function toPlainArray(a) {
    if (a == null) return null;
    return Array.isArray(a) ? a : Array.from(a);
}

/**
 * Decode a packed conservation mask. Mirrors the library's internal tooltip decoder, which is
 * not exported; the bit layout is fixed by the compute shader.
 *   bits  0..9   group present        bits 10..19  group absent (rendered "!group")
 *   bit  20      identity  -> "*"     bit  21      fully conserved -> "+"
 */
export function decodeConservation(mask, score) {
    const m = Number(mask) >>> 0;
    const positive = [], negative = [];
    for (let i = 0; i < CONSERVATION_GROUPS.length; i++) {
        if (m & (1 << i)) positive.push(CONSERVATION_GROUPS[i]);
        if (m & (1 << (10 + i))) negative.push(`!${CONSERVATION_GROUPS[i]}`);
    }
    const isIdentity = !!(m & (1 << 20));
    const isFullyConserved = !!(m & (1 << 21));
    const s = Number(score);
    // getGlyph in the library: 11 -> "*", 10 -> "+", otherwise the numeric score.
    const glyph = s === 11 ? '*' : s === 10 ? '+' : String(s);
    return { score: s, glyph, positive, negative, isIdentity, isFullyConserved };
}

function readStore(viewer, repId) {
    const rep = viewer?.representationStore?.get?.(repId);
    return rep || null;
}

/**
 * Read a representation's cached metrics, if it has any.
 */
export function readRepresentation(viewer, repId) {
    return readStore(viewer, repId);
}

/** Core alphabet symbols for a representation, from the viewer's own registry. */
export function resolveAlphabet(viewer, repId) {
    const rep = readStore(viewer, repId);
    const alphabetId = rep?.alphabetId ?? null;
    const def = alphabetId ? viewer?.alphabetRegistry?.get?.(alphabetId) : null;
    const coreSize = def?.metricConfig?.coreSize ?? 20;
    // symbols includes the gap character last; the core buckets are the first coreSize.
    const symbols = Array.isArray(def?.symbols) ? def.symbols.slice(0, coreSize) : null;
    return { alphabetId, symbols, coreSize };
}

function resolveRepId(viewer, repId) {
    if (repId) return repId;
    return viewer?.getActiveRepresentation?.()?.id ?? null;
}

// Quality and conservation
//
// Ports of the WGSL `calculate_quality` and `calculate_conservation` in msa-webgpu's compute
// shader, so the same two numbers can be produced without a GPU. Both are plain arithmetic over a
// column's residue counts; nothing about them needed the GPU in the first place.

/** Livingstone & Barton (1993) physicochemical property groups, bits 0-9. */
export const AMAS_PROP = {
    HYDROPHOBIC: 1 << 0, POLAR: 1 << 1, SMALL: 1 << 2, PROLINE: 1 << 3, TINY: 1 << 4,
    ALIPHATIC: 1 << 5, AROMATIC: 1 << 6, POSITIVE: 1 << 7, NEGATIVE: 1 << 8, CHARGED: 1 << 9,
};
export const AMAS_PROPERTY_MASK_ALL = Object.values(AMAS_PROP).reduce((a, b) => a | b, 0);
export const AMAS_NEGATIVE_SHIFT = 10;
export const AMAS_IDENTITY_BIT = 1 << 20;
export const AMAS_ALL_PROPERTIES_BIT = 1 << 21;

const P = AMAS_PROP;
/** Indexed by the amino-acid alphabet's bucket order, ARNDCQEGHILKMFPSTWYV. */
export const AMAS_PROPERTY_BITS = [
    /* A */ P.HYDROPHOBIC | P.SMALL | P.TINY,
    /* R */ P.POLAR | P.POSITIVE | P.CHARGED,
    /* N */ P.POLAR | P.SMALL,
    /* D */ P.POLAR | P.SMALL | P.NEGATIVE | P.CHARGED,
    /* C */ P.HYDROPHOBIC | P.SMALL,
    /* Q */ P.POLAR,
    /* E */ P.POLAR | P.NEGATIVE | P.CHARGED,
    /* G */ P.HYDROPHOBIC | P.SMALL | P.TINY,
    /* H */ P.HYDROPHOBIC | P.POLAR | P.AROMATIC | P.POSITIVE | P.CHARGED,
    /* I */ P.HYDROPHOBIC | P.ALIPHATIC,
    /* L */ P.HYDROPHOBIC | P.ALIPHATIC,
    /* K */ P.POLAR | P.POSITIVE | P.CHARGED,
    /* M */ P.HYDROPHOBIC,
    /* F */ P.HYDROPHOBIC | P.AROMATIC,
    /* P */ P.SMALL | P.PROLINE,
    /* S */ P.POLAR | P.SMALL | P.TINY,
    /* T */ P.POLAR | P.SMALL,
    /* W */ P.HYDROPHOBIC | P.POLAR | P.AROMATIC,
    /* Y */ P.HYDROPHOBIC | P.POLAR | P.AROMATIC,
    /* V */ P.HYDROPHOBIC | P.SMALL | P.ALIPHATIC,
];

function popcount(n) {
    let x = n - ((n >> 1) & 0x55555555);
    x = (x & 0x33333333) + ((x >> 2) & 0x33333333);
    x = (x + (x >> 4)) & 0x0f0f0f0f;
    return (x * 0x01010101) >> 24;
}

/**
 * One column's quality: every ordered pair of residue types present, weighted by how often each
 * occurs, scored by the substitution matrix normalised against the better of the two self-scores,
 * then scaled by occupancy.
 *
 * @param {number[]} counts   per-core-bucket counts for the column
 * @param {{qualityMatrix: ArrayLike<number>, qualityMatrixSize: number, rows: number}} opts
 */
export function columnQuality(counts, { qualityMatrix, qualityMatrixSize, rows }) {
    const core = counts.length;
    let nonGap = 0;
    for (let i = 0; i < core; i++) nonGap += counts[i];
    // A single residue has nothing to be compared against, so the shader reports 0 rather than a
    // perfect score.
    if (nonGap < 2 || rows === 0) return 0;

    const occupancy = nonGap / rows;
    let quality = 0;
    let totalPairs = 0;

    for (let i = 0; i < core; i++) {
        const countI = counts[i];
        if (countI === 0) continue;
        const selfI = qualityMatrix[i * qualityMatrixSize + i];
        for (let j = 0; j < core; j++) {
            const countJ = counts[j];
            if (countJ === 0) continue;
            const pairCount = countI * countJ;
            const selfJ = qualityMatrix[j * qualityMatrixSize + j];
            const denom = Math.max(selfI, selfJ);
            const ratio = denom > 0 ? qualityMatrix[i * qualityMatrixSize + j] / denom : 0;
            quality += pairCount * ratio;
            totalPairs += pairCount;
        }
    }
    if (totalPairs === 0) return 0;
    return Math.max(0, (quality / totalPairs) * occupancy);
}

/**
 * One column's conservation: the AMAS score, i.e. how many physicochemical properties every
 * sufficiently common residue in the column shares (or all lack).
 *
 * @param {number[]} counts   per-core-bucket counts for the column
 * @param {{rows: number, gapCount: number}} opts
 * @returns {{score: number, mask: number}}
 */
export function columnConservation(counts, { rows, gapCount }) {
    const core = counts.length;
    let nonGap = 0;
    for (let i = 0; i < core; i++) nonGap += counts[i];
    if (nonGap === 0 || rows === 0) return { score: 0, mask: 0 };

    // A column that is a quarter gaps is not called conserved at all.
    if (gapCount * 100 >= 25 * rows) return { score: 0, mask: 0 };

    // Residues appearing in 3% of rows or fewer are treated as noise and ignored — integer
    // division, so for small alignments the threshold is 0 and every residue counts.
    const residueThreshold = Math.floor((rows * 3) / 100);

    let observedKinds = 0;
    let observedNonGapKindsAll = 0;
    let conservedPositive = AMAS_PROPERTY_MASK_ALL;
    let conservedNegative = AMAS_PROPERTY_MASK_ALL;

    for (let aa = 0; aa < core; aa++) {
        const count = counts[aa];
        if (count === 0) continue;
        observedNonGapKindsAll++;
        if (count <= residueThreshold) continue;
        const props = AMAS_PROPERTY_BITS[aa] ?? 0;
        conservedPositive &= props;
        conservedNegative &= AMAS_PROPERTY_MASK_ALL & ~props;
        observedKinds++;
    }

    if (observedKinds === 0) return { score: 0, mask: 0 };

    let score = popcount(conservedPositive) + popcount(conservedNegative);
    let mask = conservedPositive | (conservedNegative << AMAS_NEGATIVE_SHIFT);

    // One residue type throughout is identity, scored above the 10-property maximum.
    if (observedNonGapKindsAll === 1) {
        score = 11;
        mask |= AMAS_IDENTITY_BIT;
    } else if (score === 10) {
        mask |= AMAS_ALL_PROPERTIES_BIT;
    }
    return { score, mask };
}

// CPU fallback
/**
 * Recompute the column metrics from the alignment strings. Mirrors the shader's definitions
 */
export function computeMetricsCpu(sequences, { symbols = null, alphabet = null } = {}) {
    const core = alphabet?.metricConfig?.coreSize ?? null;
    const fromAlphabet = alphabet && Array.isArray(alphabet.symbols)
        ? alphabet.symbols.slice(0, core ?? alphabet.symbols.length)
        : null;
    if (fromAlphabet && symbols && symbols.join('') !== fromAlphabet.join('')) {
        warnFallback(`symbols do not match alphabet "${alphabet.id}" — using the alphabet's own order`);
    }
    return computeMetrics(sequences, fromAlphabet ?? symbols ?? AA_CORE, alphabet);
}

function computeMetrics(sequences, symbols, alphabet) {
    const rows = sequences.length;
    const cols = rows ? sequences[0].length : 0;
    const core = symbols.length;
    const index = new Map(symbols.map((s, i) => [s, i]));
    const logCore = Math.log2(core);

    const occupancy = new Array(cols).fill(0);
    const entropy = new Array(cols).fill(0);
    const modalFractionNonGap = new Array(cols).fill(0);
    const informationContentRaw = new Array(cols).fill(0);
    const consensusIndex = new Array(cols).fill(core);
    const consensusTie = new Array(cols).fill(0);
    const countsPerCol = [];

    // The alphabet decides whether the matrix-dependent metrics can be computed at all, and
    // conservation is defined for amino acids only — the shader stubs the other alphabets to zero.
    const qualityMatrix = alphabet?.qualityMatrix ?? null;
    const qualityMatrixSize = alphabet?.metricConfig?.qualityMatrixSize ?? null;
    const wantQuality = !!(qualityMatrix && qualityMatrixSize);
    const wantConservation = wantQuality && alphabet?.id === 'aa';
    const quality = wantQuality ? new Array(cols).fill(0) : null;
    const conservationScore = wantConservation ? new Array(cols).fill(0) : null;
    const conservationMask = wantConservation ? new Array(cols).fill(0) : null;

    for (let c = 0; c < cols; c++) {
        const counts = new Array(core).fill(0);
        let nonGap = 0;
        let gapCount = 0;
        for (let r = 0; r < rows; r++) {
            const ch = sequences[r][c];
            if (ch >= 'a' && ch <= 'z') continue;          // insertion column for this row
            const i = index.get(ch);
            if (i === undefined) { gapCount++; continue; }  // gap / unknown
            counts[i]++; nonGap++;
        }
        countsPerCol.push(counts);
        if (wantQuality) {
            quality[c] = columnQuality(counts, { qualityMatrix, qualityMatrixSize, rows });
        }
        if (wantConservation) {
            const { score, mask } = columnConservation(counts, { rows, gapCount });
            conservationScore[c] = score;
            conservationMask[c] = mask;
        }
        occupancy[c] = rows > 0 ? nonGap / rows : 0;

        let max = 0, argmax = core, ties = 0;
        for (let i = 0; i < core; i++) {
            if (counts[i] > max) { max = counts[i]; argmax = i; }
        }
        for (let i = 0; i < core; i++) if (counts[i] === max && max > 0) ties++;
        consensusIndex[c] = argmax;
        consensusTie[c] = ties > 1 ? 1 : 0;
        modalFractionNonGap[c] = nonGap > 0 ? max / nonGap : 0;

        if (nonGap >= 2) {
            let h = 0;
            for (let i = 0; i < core; i++) {
                if (!counts[i]) continue;
                const p = counts[i] / nonGap;
                h -= p * Math.log2(p);
            }
            entropy[c] = h / logCore;
        }
        informationContentRaw[c] = Math.max(0, 1 - entropy[c]);
    }

    return {
        occupancy, entropy, modalFractionNonGap, informationContentRaw,
        consensusIndex, consensusTie,
        quality, conservationScore, conservationMask,
        counts: countsPerCol, symbols,
    };
}

function consensusFromCpu(m, symbols) {
    return m.consensusIndex.map((idx, c) => {
        const counts = m.counts[c];
        const nonGap = counts.reduce((a, b) => a + b, 0);
        const letters = counts
            .map((n, i) => ({ glyph: symbols[i], count: n, logoFraction: nonGap ? n / nonGap : 0 }))
            .filter(l => l.count > 0)
            .sort((a, b) => b.count - a.count);
        return {
            occupancy: m.occupancy[c],
            modalFractionNonGap: m.modalFractionNonGap[c],
            informationContentRaw: m.informationContentRaw[c],
            nonGapCount: nonGap,
            consensusGlyph: m.consensusTie[c] === 1 ? '+'
                : (idx < symbols.length ? symbols[idx] : null),
            letters: letters.map(({ glyph, logoFraction }) => ({ glyph, logoFraction })),
        };
    });
}

// Public surface
export function getTrackCatalog(viewer) {
    return viewer?.getTracks?.() ?? [];
}

export async function getColumnMetrics(viewer, { representationId = null, sequences = null, symbols = null } = {}) {
    const repId = resolveRepId(viewer, representationId);
    const rep = repId ? readRepresentation(viewer, repId) : null;
    const cm = rep?.columnMetrics;

    if (!cm) {
        if (!sequences?.length) {
            return { source: 'unavailable', representationId: repId,
                reason: 'no columnMetrics for this representation and no sequences for fallback' };
        }
        const alpha = resolveAlphabet(viewer, repId);
        const sym = symbols || alpha.symbols;
        if (!rep) warnFallback('representationStore unavailable');
        const m = computeMetricsCpu(sequences, sym ? { symbols: sym } : {});
        return { source: 'cpu-fallback', representationId: repId,
            alphabetId: alpha.alphabetId,
            reason: 'metrics are only computed for the active representation; '
                + 'call setRepresentation() first for GPU values',
            ...m };
    }

    return {
        source: 'viewer',
        representationId: repId,
        alphabetId: rep.alphabetId ?? null,
        quality: toPlainArray(cm.quality),
        occupancy: toPlainArray(cm.occupancy),
        entropy: toPlainArray(cm.entropy),
        modalFractionNonGap: toPlainArray(cm.modalFractionNonGap),
        informationContentRaw: toPlainArray(cm.informationContentRaw),
        consensusIndex: toPlainArray(cm.consensusIndex),
        consensusTie: toPlainArray(cm.consensusTie),
        conservationScore: toPlainArray(cm.conservationScore),
        conservationMask: toPlainArray(cm.conservationMask),
    };
}

export async function getConsensus(viewer, { representationId = null, sequences = null, symbols = null } = {}) {
    const repId = resolveRepId(viewer, representationId);
    const rep = repId ? readRepresentation(viewer, repId) : null;
    const cols = rep?.trackState?.consensus?.columns;
    if (cols) {
        return { source: 'viewer', representationId: repId, columns: cols };
    }
    if (!sequences?.length) {
        return { source: 'unavailable', representationId: repId, columns: [] };
    }
    const sym = symbols || resolveAlphabet(viewer, repId).symbols;
    const m = computeMetricsCpu(sequences, sym ? { symbols: sym } : {});
    return { source: 'cpu-fallback', representationId: repId,
        columns: consensusFromCpu(m, m.symbols) };
}

export function getColumnVisibility(viewer, opts = {}) {
    const v = viewer?.getColumnVisibility?.(opts);
    if (!v) return null;
    return {
        mode: v.mode,
        visible: toPlainArray(v.visible),
        visibleCount: v.visibleCount,
        totalCols: v.totalCols,
    };
}

export async function getTrackValues(viewer, trackId, { representationId = null, sequences = null, symbols = null } = {}) {
    const cfg = viewer?.getConfig?.();
    const userTrack = (cfg?.tracks || []).find(t => t.id === trackId);
    if (userTrack?.source?.type === 'values') {
        return { source: 'definition', trackId, values: toPlainArray(userTrack.source.values) };
    }
    const metrics = await getColumnMetrics(viewer, { representationId, sequences, symbols });
    const METRIC_OF = { quality: 'quality', occupancy: 'occupancy', conservation: 'conservationScore' };
    const field = METRIC_OF[trackId] || trackId;
    if (metrics && field in metrics) {
        return { source: metrics.source, trackId, values: metrics[field] };
    }
    if (trackId === 'consensus') {
        const c = await getConsensus(viewer, { representationId, sequences, symbols });
        return { source: c.source, trackId, values: c.columns };
    }
    return { source: 'unavailable', trackId, values: null };
}

export async function getColumnTable(viewer, {
    representationId = null,
    sequences = null,
    symbols = null,
    columns = null,          // explicit column indices, else all
    offset = 0,
    limit = null,
    extraValues = {},        // e.g. { lddt: scores }
    selectedColumns = [],
} = {}) {
    const repId = resolveRepId(viewer, representationId);
    const metrics = await getColumnMetrics(viewer, { representationId: repId, sequences, symbols });
    const consensus = await getConsensus(viewer, { representationId: repId, sequences, symbols });
    const visibility = getColumnVisibility(viewer, { representationId: repId });

    const total = metrics?.occupancy?.length
        ?? visibility?.totalCols
        ?? (sequences?.[0]?.length ?? 0);
    const selected = new Set(selectedColumns);

    let idx = columns ?? Array.from({ length: total }, (_, i) => i);
    if (limit != null) idx = idx.slice(offset, offset + limit);
    else if (offset) idx = idx.slice(offset);

    const rows = idx.map(c => {
        const row = { column: c, visible: visibility ? visibility.visible[c] !== 0 : true,
            selected: selected.has(c) };
        for (const [k, arr] of Object.entries(extraValues)) {
            if (arr && arr[c] !== undefined) row[k] = arr[c];
        }
        if (metrics?.quality) row.quality = metrics.quality[c];
        if (metrics?.occupancy) row.occupancy = metrics.occupancy[c];
        if (metrics?.entropy) row.entropy = metrics.entropy[c];
        if (metrics?.informationContentRaw) row.informationContent = metrics.informationContentRaw[c];
        if (metrics?.conservationScore) {
            row.conservation = decodeConservation(metrics.conservationMask?.[c] ?? 0,
                metrics.conservationScore[c]);
        }
        const col = consensus?.columns?.[c];
        if (col) {
            row.consensus = {
                glyph: col.consensusGlyph,
                nonGapCount: col.nonGapCount,
                modalFractionNonGap: col.modalFractionNonGap,
                letters: (col.letters || []).slice(0, 5)
                    .map(l => ({ glyph: l.glyph, logoFraction: l.logoFraction })),
            };
        }
        return row;
    });

    return {
        source: metrics?.source ?? 'unavailable',
        representationId: repId,
        alphabetId: metrics?.alphabetId ?? null,
        totalColumns: total,
        visibleColumns: visibility?.visibleCount ?? total,
        returned: rows.length,
        tracks: getTrackCatalog(viewer).map(t => t.id),
        columns: rows,
    };
}

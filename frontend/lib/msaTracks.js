// Read per-column track values out of the msa-webgpu viewer.
//
// The library's public API exposes getTracks(), but that returns the track *catalog* — ids,
// labels and which variants are enabled — not the computed values. The values are produced by a
// WGSL compute shader and cached on the representation:
//
//   viewer.representationStore.get(id).columnMetrics
//     { quality, occupancy, entropy, modalFractionNonGap, informationContentRaw,
//       consensusIndex, consensusTie, conservationScore, conservationMask, counts }
//   viewer.representationStore.get(id).trackState
//     { alphabet, metrics: {...}, consensus: { columns: [...] } }
//
// `representationStore` is an ordinary property, so it is readable; the methods that *populate*
// it are ECMAScript-private, which is the real constraint — see readRepresentation().
//
// Everything here is read-only and feature-detected. If the internal shape ever changes (this is
// msa-webgpu 0.0.10 and the bundle is minified), the CPU fallback keeps the same output shape.

const CONSERVATION_GROUPS = [
    'hydrophobic', 'polar', 'small', 'proline', 'tiny',
    'aliphatic', 'aromatic', 'positive', 'negative', 'charged',
];

// Residue order the shader buckets into (residue_to_index): the 20 standard amino acids,
// alphabetical. Used only by the CPU fallback.
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
 *
 * Only the *active* representation is guaranteed to be populated: the library computes
 * trackState during activation, and its internal ensure-pass covers other representations only
 * when a track variant names them concretely. FoldMason's tracks are all bound to the
 * pseudo-representation "active", so nothing ever names "structure".
 *
 * Two documented ways to force it were tried and neither works:
 *   setTrackEnabled({trackId:'occupancy', representation:'structure'}, true)
 *     -> the catalog matches the existing "active" variant instead of creating a concrete one
 *   setConfig({trackDisplay:{variants:[..., {trackId:'occupancy', representation:'structure'}]}})
 *     -> same outcome; the store stays empty
 * Verified in a browser against a live FoldMason result.
 *
 * So: no trick. A caller that wants GPU-quality numbers for the non-active representation should
 * switch to it (the API exposes setRepresentation); otherwise the CPU fallback runs and says so.
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

// ---------------------------------------------------------------------------------------------
// CPU fallback
// ---------------------------------------------------------------------------------------------

/**
 * Recompute the column metrics from the alignment strings. Mirrors the shader's definitions:
 * lowercase is treated as an insertion and skipped; entropy is normalised by log2(coreSize) and
 * is 0 when fewer than two non-gap residues; informationContentRaw is max(0, 1 - entropy).
 */
export function computeMetricsCpu(sequences, { symbols = AA_CORE } = {}) {
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

    for (let c = 0; c < cols; c++) {
        const counts = new Array(core).fill(0);
        let nonGap = 0;
        for (let r = 0; r < rows; r++) {
            const ch = sequences[r][c];
            if (ch >= 'a' && ch <= 'z') continue;          // insertion column for this row
            const i = index.get(ch);
            if (i === undefined) continue;                  // gap / unknown
            counts[i]++; nonGap++;
        }
        countsPerCol.push(counts);
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
        // quality and conservation need the substitution matrices the shader carries; the
        // fallback reports them as absent rather than inventing numbers.
        quality: null, conservationScore: null, conservationMask: null,
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

// ---------------------------------------------------------------------------------------------
// Public surface
// ---------------------------------------------------------------------------------------------

export function getTrackCatalog(viewer) {
    return viewer?.getTracks?.() ?? [];
}

/**
 * Column metrics as plain arrays. `source` is 'viewer' or 'cpu-fallback' so callers can tell
 * which numbers they are looking at — the fallback cannot produce quality/conservation.
 */
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

/** Values for one track id. Dispatches on the track definition's source type. */
export async function getTrackValues(viewer, trackId, { representationId = null, sequences = null, symbols = null } = {}) {
    const cfg = viewer?.getConfig?.();
    const userTrack = (cfg?.tracks || []).find(t => t.id === trackId);
    // `values` tracks carry their data inline — this is how the app's own LDDT track works, and
    // it generalises to any future per-column track the app registers.
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

/**
 * One row per alignment column, joining every track. This is the method worth calling: the
 * individual getters return heterogeneous TypedArrays that a caller would otherwise have to zip
 * by index, and which do not survive JSON.stringify as arrays.
 */
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

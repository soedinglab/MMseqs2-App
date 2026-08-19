// Per-column metrics for a FoldMason alignment, without a browser.

import { computeMetricsCpu, decodeConservation } from '../../../frontend/lib/msaTracks.js';
import { getResidueIndices, entryChainMap } from '../../../frontend/lib/alignmentColumns.js';
import { mockPDB } from '../../../frontend/lib/pdbAssembly.js';
import { getAccession } from '../../../frontend/lib/targetName.js';
import { aminoAcidAlphabet, threeDIAlphabet } from 'msa-webgpu';
import { MOTIF_MAX_RESIDUES } from './motif.js';

const REPRESENTATIONS = {
    aa: { alphabet: aminoAcidAlphabet, field: 'aa' },
    '3di': { alphabet: threeDIAlphabet, field: 'ss' },
};

export const COLUMN_METRICS = [
    'lddt', 'quality', 'conservation', 'consensus', 'occupancy', 'entropy', 'informationContent',
];

const MISSING_LDDT = -1;

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
    // The page's gap threshold: a column is masked when too few rows have a residue in it.
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

const SCALAR_METRICS = COLUMN_METRICS.filter(m => m !== 'consensus');

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
 * Bounded orientation for one alignment: how large it is, which metrics exist, and the spread of
 * each. Deliberately no threshold, regions or ranked columns — which columns matter is the caller's
 * analysis, made on the per-column data rather than guessed at here.
 */
export function foldMasonSummary(foldMasonResult, { representation = 'aa' } = {}) {
    const prepared = prepare(foldMasonResult, representation, null);
    if (prepared.error) return prepared;
    const { spec, sequences, metrics, value, available } = prepared;

    const entries = foldMasonResult?.entries ?? [];
    const total = metrics.occupancy.length;
    const columnsOf = metric => Array.from({ length: total }, (_, c) => value[metric](c));
    return {
        representation,
        entryCount: sequences.length,
        totalColumns: total,
        hasCoordinates: entries.some(e => typeof e.ca === 'string' && e.ca.length > 0),
        hasTree: typeof foldMasonResult?.tree === 'string' && foldMasonResult.tree.length > 0,
        metrics: available,
        stats: Object.fromEntries(
            available.filter(m => SCALAR_METRICS.includes(m)).map(m => [m, statOf(columnsOf(m))]),
        ),
        statistics: foldMasonResult?.statistics ?? null,
    };
}

const SUFFIX_DELIMITER = '-_-_-_';

function suffixOf(name) {
    return String(name).includes(SUFFIX_DELIMITER) ? String(name).split(SUFFIX_DELIMITER)[1] : '';
}

/**
 * Alignment column -> the entry's own residue and chain frame, with gaps stated rather than implied.
 *
 * Stored as two parallel lists rather than an object per column: `tokens[i]` is the motif form of the
 * i-th occupied column, and i is also that residue's 0-based offset into the entry's `ca` triplets.
 * The object-per-column form cost ~70 bytes a column, which on a 100x2000 alignment was 12 MB of the
 * 14 MB artifact; this is the same information in about a twelfth of the space.
 */
export function msaResidueMap(foldMasonResult, entryIndex = 0) {
    const entries = foldMasonResult?.entries ?? [];
    const data = entries[entryIndex];
    if (!data) {
        throw new Error(`no entry ${entryIndex} in this alignment (it has ${entries.length})`);
    }
    const aligned = typeof data.aa === 'string' ? data.aa : '';
    const suffix = data.suffix ?? suffixOf(data.name);
    const map = entryChainMap(aligned, suffix);

    const occupied = [];
    const tokens = [];
    const gaps = [];
    let residueIndex = 0;
    for (let c = 0; c < aligned.length; c++) {
        if (aligned[c] === '-') { gaps.push(c); continue; }
        residueIndex += 1;
        const chain = map.chains[residueIndex] ?? 'A';
        occupied.push(c);
        tokens.push(`${chain}${residueIndex - (map.offsets[chain] ?? 0)}`);
    }

    return {
        entryIndex,
        entryName: data.name ?? null,
        suffix,
        isMultimer: !!suffix,
        totalColumns: aligned.length,
        residueCount: residueIndex,
        chains: [...new Set(tokens.map(t => t.replace(/[0-9]+$/, '')))],
        chainBoundaries: map.chainInfo,
        occupiedColumns: compressRanges(occupied),
        tokens,
        gaps: compressRanges(gaps),
    };
}

/** Column -> motif token for a set of columns. One convention, one implementation. */
export function residueTokenPairs(residueMap, columns) {
    const wanted = new Set(columns ?? []);
    const occupied = expandRanges(residueMap?.occupiedColumns ?? []);
    const out = [];
    for (let i = 0; i < occupied.length; i++) {
        if (wanted.has(occupied[i])) out.push({ column: occupied[i], token: residueMap.tokens[i] });
    }
    return out;
}

/** The motif tokens for a set of columns, read off a residue map. */
export function residueTokens(residueMap, columns) {
    return residueTokenPairs(residueMap, columns).map(pair => pair.token);
}

export const AMINO_ACIDS = 'ACDEFGHIKLMNPQRSTVWY';
export const SUBSTITUTION_CLASSES = {
    X: 'any amino acid',
    p: 'positively charged', n: 'negatively charged',
    h: 'hydrophilic', b: 'hydrophobic', a: 'aromatic',
};

export function substitutionKind(aa) {
    if (typeof aa !== 'string' || aa.length !== 1) return null;
    if (aa === 'X') return 'wildcard';
    if (Object.hasOwn(SUBSTITUTION_CLASSES, aa)) return 'group';
    return AMINO_ACIDS.includes(aa) ? 'amino-acid' : null;
}

function acceptedSubstitutions() {
    const groups = Object.entries(SUBSTITUTION_CLASSES).map(([code, meaning]) => `${code} = ${meaning}`);
    return `one letter of ${AMINO_ACIDS}, or ${groups.join(', ')}`;
}

function coded(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

/**
 * A set of alignment columns within one FoldMason entry, and the query they describe.
 */
export class MsaColumnSelection {
    constructor(client, foldMasonResult, {
        entry = 0, columns = [], ticket = null, name = 'default', residueAa = [], savedAt = null,
    } = {}) {
        this.client = client;
        this.result = foldMasonResult;
        this.ticket = ticket;
        this.name = name;
        this.savedAt = savedAt;
        this.columns = MsaColumnSelection._normalize(columns);
        this.residueAa = [];
        this.setEntry(entry);
        this.setResidueAa(residueAa);
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
        this.residueMap = msaResidueMap(this.result, entry);
        return this;
    }

    setColumns(columns) {
        this.columns = MsaColumnSelection._normalize(columns);
        return this.#pruneResidueAa();
    }

    addColumns(columns) {
        this.columns = MsaColumnSelection._normalize([...this.columns, ...(columns ?? [])]);
        return this;
    }

    removeColumns(columns) {
        const drop = new Set((columns ?? []).map(Number));
        this.columns = this.columns.filter(c => !drop.has(c));
        return this.#pruneResidueAa();
    }

    /** A deselected column cannot carry a substitution: the anchor is what was removed. */
    #pruneResidueAa() {
        const selected = new Set(this.columns);
        this.residueAa = this.residueAa.filter(r => selected.has(r.column));
        return this;
    }

    setResidueAa(entries) {
        const selected = new Set(this.columns);
        const next = new Map(this.residueAa.map(r => [r.column, r.aa]));
        for (const entry of entries ?? []) {
            const column = Number(entry?.column);
            if (!Number.isInteger(column)) {
                throw coded('INVALID_INPUT',
                    `a substitution needs an integer column, got ${JSON.stringify(entry?.column)}`);
            }
            if (!selected.has(column)) {
                throw coded('INVALID_INPUT',
                    `column ${column} is not in this selection, so it cannot carry a substitution; ` +
                    'add the column first');
            }
            const { aa } = entry;
            if (aa === undefined) {
                throw coded('INVALID_INPUT', `column ${column} needs an aa; pass null to clear it`);
            }
            if (aa === null || aa === '') { next.delete(column); continue; }
            if (!substitutionKind(aa)) {
                throw coded('INVALID_INPUT',
                    `${JSON.stringify(aa)} is not a substitution code for column ${column}; expected ` +
                    `${acceptedSubstitutions()}.`);
            }
            next.set(column, aa);
        }
        if (next.size > MOTIF_MAX_RESIDUES) {
            throw coded('INVALID_INPUT',
                `${next.size} substitutions, but a motif holds at most ${MOTIF_MAX_RESIDUES} residues`);
        }
        this.residueAa = [...next.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([column, aa]) => ({ column, aa }));
        return this;
    }

    get residues() {
        return getResidueIndices(this.entry.aa, this.columns).map(i => i + 1);
    }

    /**
     * The motif these columns describe: `chain + original residue number` per residue, with `:aa`
     * appended where a column carries a substitution.
     */
    get motif() {
        const substitution = new Map(this.residueAa.map(r => [r.column, r.aa]));
        return residueTokenPairs(this.residueMap, this.columns)
            .map(({ column, token }) => (substitution.has(column)
                ? `${token}:${substitution.get(column)}`
                : token))
            .join(', ');
    }

    /**
     * Which column resolved to which residue, in one line: `20->A17, 29->A26(G):b, 23->gap:Y`.
     */
    residueMapping({ limit = MOTIF_MAX_RESIDUES } = {}) {
        const tokens = new Map(
            residueTokenPairs(this.residueMap, this.columns).map(p => [p.column, p.token]));
        const substitution = new Map(this.residueAa.map(r => [r.column, r.aa]));
        const shown = this.columns.slice(0, limit).map((column) => {
            const token = tokens.get(column) ?? 'gap';
            if (!substitution.has(column)) return `${column}->${token}`;
            const actual = token === 'gap' ? '' : `(${this.entry.aa?.[column] ?? '?'})`;
            return `${column}->${token}${actual}:${substitution.get(column)}`;
        });
        const more = this.columns.length - shown.length;
        return shown.join(', ') + (more > 0 ? `, +${more} more` : '');
    }

    /** Persist under `name`, scoped to this alignment's ticket. */
    async save(name = this.name) {
        if (!this.ticket) throw new Error('this selection has no ticket, so there is nothing to save it against');
        this.name = name;
        const record = await this.client.store.writeSelection(this.ticket, name, {
            page: 'foldmason',
            entry: this.entryIndex,
            columns: this.columns,
            ...(this.residueAa.length ? { residueAa: this.residueAa } : {}),
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
            chains: this.residueMap.chains,
            totalColumns: this.entry.aa?.length ?? 0,
            selectedColumns: compressRanges(this.columns),
            residueCount: residues.length,
            gapColumns: this.columns.length - residues.length,
            residueMapping: this.residueMapping(),
            ...(this.savedAt ? { savedAt: this.savedAt } : { saved: false }),
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
            motifSource: 'columns',
            ticket: this.ticket ?? undefined,
            lineage: {
                entry: this.entryIndex,
                entryName: this.entry.name,
                columns: compressRanges(this.columns),
                ...(this.residueAa.length ? { residueAa: this.residueAa } : {}),
                ...(this.name ? { selection: this.name } : {}),
            },
        });
    }

    sendTo(opts) { return this.toQuery().sendTo(opts); }
}

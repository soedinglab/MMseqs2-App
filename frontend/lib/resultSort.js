// Sorting for the Foldseek / FoldDisco result tables.

export const FOLDSEEK_SORT_KEYS = [
    'qtm', 'ttm', 'target', 'desc', 'tax', 'prob', 'seqId', 'eval', 'score',
];

export const FOLDDISCO_SORT_KEYS = ['target', 'desc', 'tax', 'idf', 'rmsd', 'node'];

// Keys sorted by a precomputed numeric reduction over the group's chains.
const FOLDSEEK_NUMERIC = ['prob', 'seqId', 'score', 'eval', 'qtm', 'ttm'];
const FOLDDISCO_NUMERIC = { idf: 'idfscore', rmsd: 'rmsd', node: 'nodecount' };
// Keys sorted by a string field on the group's first chain.
const STRING_FIELD = { target: 'target', desc: 'description', tax: 'taxName' };

export function rowFieldForSortKey(sortKey, tool = 'foldseek') {
    if (STRING_FIELD[sortKey]) return STRING_FIELD[sortKey];
    if (tool === 'folddisco') return FOLDDISCO_NUMERIC[sortKey] ?? sortKey;
    if (sortKey === 'qtm') return 'complexqtm';
    if (sortKey === 'ttm') return 'complexttm';
    return FOLDSEEK_NUMERIC.includes(sortKey) ? sortKey : sortKey;
}

export function buildSortCache(alignments, { mode = '', isComplex = false, tool = 'foldseek' } = {}) {
    const cache = {};
    if (!alignments) return cache;
    const idxs = Object.keys(alignments);
    const reduce = (field, fn) =>
        Object.fromEntries(idxs.map(k => [k, fn(...alignments[k].map(e => e[field]))]));

    if (tool === 'folddisco') {
        for (const [key, field] of Object.entries(FOLDDISCO_NUMERIC)) {
            cache[key] = reduce(field, Math.max);
        }
        return cache;
    }

    cache.prob = reduce('prob', Math.max);
    cache.seqId = reduce('seqId', Math.max);
    cache.score = reduce('score', Math.max);
    cache.eval = reduce('eval', mode === 'tmalign' || mode === 'lolalign' ? Math.max : Math.min);
    if (isComplex) {
        cache.qtm = reduce('complexqtm', Math.max);
        cache.ttm = reduce('complexttm', Math.max);
    }
    return cache;
}

/** Default direction when a sort key is first selected. -1 descending, 1 ascending. */
export function defaultSortOrder(sortKey, { mode = '' } = {}) {
    switch (sortKey) {
        case 'target':
        case 'desc':
        case 'tax':
        case 'rmsd':
            return 1;
        case 'eval':
            return mode === 'tmalign' || mode === 'lolalign' ? -1 : 1;
        default:
            return -1;
    }
}

export function makeComparator(alignments, sortKey, sortOrder, cache) {
    const stringField = STRING_FIELD[sortKey];
    if (stringField) {
        return (a, b) => sortOrder * String(alignments[a][0][stringField] ?? '')
            .localeCompare(String(alignments[b][0][stringField] ?? ''));
    }
    const bucket = cache ? cache[sortKey] : null;
    if (bucket) {
        return (a, b) => sortOrder * (bucket[a] - bucket[b]);
    }
    // Unknown key — preserve input order rather than throwing, so a bad sortKey degrades
    // to "unsorted" instead of blanking the table.
    return () => 0;
}

/** Returns group ids (numbers), sorted. Never positions. */
export function sortIndices(alignments, sortKey, sortOrder, opts = {}) {
    if (!alignments) return [];
    const cache = opts.cache || buildSortCache(alignments, opts);
    return Object.keys(alignments)
        .map(Number)
        .sort(makeComparator(alignments, sortKey, sortOrder, cache));
}

export function isValidSortKey(sortKey, tool = 'foldseek') {
    const keys = tool === 'folddisco' ? FOLDDISCO_SORT_KEYS : FOLDSEEK_SORT_KEYS;
    return keys.includes(sortKey);
}

export function createSortMemo() {
    let store = new Map();
    return {
        get(cacheKey, alignments, sortKey, sortOrder, opts) {
            const k = `${cacheKey}|${sortKey}|${sortOrder}`;
            if (!store.has(k)) store.set(k, sortIndices(alignments, sortKey, sortOrder, opts));
            return store.get(k);
        },
        clear() { store = new Map(); },
    };
}

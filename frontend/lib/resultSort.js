// Sorting for the Foldseek / FoldDisco result tables.
//
// This lives outside the table components because only the active tab's child is mounted
// (ResultView.vue renders ResultFoldseekDB with `v-if="(entryidx + 1) == selectedDatabases"`),
// so `getTable({db})` for any other database has no child to ask. Both the mounted table and
// the API import from here, which is the point: they cannot drift into sorting differently.
//
// `alignments` is always the post-parseResults grouped object — keys are group ids
// (complexid for complex searches, the hit index otherwise) and values are arrays of
// chain-level hits. Group ids are NOT guaranteed to be dense; never treat a key as a position.

export const FOLDSEEK_SORT_KEYS = [
    'qtm', 'ttm', 'target', 'desc', 'tax', 'prob', 'seqId', 'eval', 'score',
];

export const FOLDDISCO_SORT_KEYS = ['target', 'desc', 'tax', 'idf', 'rmsd', 'node'];

// Keys sorted by a precomputed numeric reduction over the group's chains.
const FOLDSEEK_NUMERIC = ['prob', 'seqId', 'score', 'eval', 'qtm', 'ttm'];
const FOLDDISCO_NUMERIC = { idf: 'idfscore', rmsd: 'rmsd', node: 'nodecount' };
// Keys sorted by a string field on the group's first chain.
const STRING_FIELD = { target: 'target', desc: 'description', tax: 'taxName' };

/**
 * Per-group numeric reductions, mirroring ResultFoldseekDB.sortKeyCache.
 * `eval` reduces with max under tmalign/lolalign (higher is better) and min otherwise.
 */
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

/**
 * Memoised sortIndices, keyed by (cacheKey, sortKey, sortOrder). The mounted table gets this
 * free from Vue's computed caching; the API path calls sortIndices directly and would otherwise
 * re-sort tens of thousands of rows on every getTable().
 */
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

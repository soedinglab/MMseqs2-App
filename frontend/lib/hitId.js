// A hit's identity: "dbIdx#entryIdx". Shared by the result pages' selection handling.

/**
 * Accepts "dbIdx#entryIdx", {db, idx}, or [dbIdx, entryIdx] and returns a canonical
 * "dbIdx#entryIdx" string, resolving database names through dbToIdx.
 * Returns null when the id cannot be resolved, so callers can report it as rejected rather
 * than throwing on one bad entry in a batch.
 */
export function normalizeId(id, dbToIdx) {
    let db, idx;
    if (typeof id === 'string') {
        const hash = id.indexOf('#');
        if (hash === -1) return null;
        db = id.slice(0, hash);
        idx = id.slice(hash + 1);
    } else if (Array.isArray(id) && id.length === 2) {
        [db, idx] = id;
    } else if (id && typeof id === 'object') {
        db = id.db;
        idx = id.idx;
    } else {
        return null;
    }

    if (idx === undefined || idx === null || idx === '') return null;

    // db may be a numeric index already, or a database name needing lookup.
    let dbIdx = null;
    if (typeof db === 'number') {
        dbIdx = db;
    } else if (typeof db === 'string') {
        if (/^\d+$/.test(db)) {
            dbIdx = Number(db);
        } else if (dbToIdx && Object.prototype.hasOwnProperty.call(dbToIdx, db)) {
            dbIdx = dbToIdx[db];
        }
    }
    if (dbIdx === null || dbIdx === undefined || Number.isNaN(Number(dbIdx))) return null;

    const entryIdx = Number(idx);
    if (!Number.isFinite(entryIdx)) return null;

    return `${Number(dbIdx)}#${entryIdx}`;
}

export function splitId(id) {
    const hash = String(id).indexOf('#');
    if (hash === -1) return null;
    return {
        dbIdx: Number(String(id).slice(0, hash)),
        entryIdx: Number(String(id).slice(hash + 1)),
    };
}

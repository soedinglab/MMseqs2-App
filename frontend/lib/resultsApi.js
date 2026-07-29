// Programmatic access to whatever page is currently mounted.
//
// The result and search pages hold sort order, filtering, clustering, selection, and the whole
// search form inside Vue component instances that are otherwise unreachable. This registry
// exposes the mounted page on a global so that derived state can be read and driven without
// scraping the DOM.
//
// One page of a given kind is mounted at a time, but the router swaps them without a reload and
// teardown order is not guaranteed (an outgoing page's beforeDestroy can run after the incoming
// page's mounted). Keying by kind + page and republishing on every change keeps the globals honest
// instead of letting a dying page clobber a live one.

import { routeForTicket } from './ticketRoute.js';

const GLOBAL_FOR = {
    result: 'resultsApi',
    search: 'searchApi',
    queue: 'queueApi',
};

/** kind -> Map<key, api> */
const registry = new Map();
/** kind -> [resolve, ...] for awaitPageApi */
const waiters = new Map();

function kindRegistry(kind) {
    if (!registry.has(kind)) registry.set(kind, new Map());
    return registry.get(kind);
}

function describe() {
    const pages = [];
    for (const [kind, entries] of registry) {
        for (const [key, api] of entries) {
            pages.push({
                kind,
                page: key,
                global: GLOBAL_FOR[kind] ?? null,
                methods: Object.keys(api).filter(k => typeof api[k] === 'function').sort(),
                ...(typeof api.describePage === 'function' ? api.describePage() : {}),
            });
        }
    }
    return {
        pages,
        live: [...registry.entries()]
            .filter(([, m]) => m.size > 0)
            .map(([kind]) => GLOBAL_FOR[kind] ?? kind),
        usage: pages.length === 0
            ? 'No page is mounted. Navigate to a search or result route first.'
            : 'Call methods directly on the global for a kind, or via <global>.pages[<name>].',
        navigation: 'goToTicket(ticket, {type, entry}) is on every global; omit type and it routes '
            + 'via the queue, which resolves and redirects. `entry` picks the query in a '
            + 'multi-query ticket.',
    };
}

function publish(kind) {
    if (typeof window === 'undefined') return;
    const name = GLOBAL_FOR[kind];
    if (!name) return;
    const entries = kindRegistry(kind);

    if (entries.size === 0) {
        delete window[name];
        return;
    }
    const only = entries.size === 1 ? [...entries.values()][0] : null;
    // Copy own enumerable methods onto the handle rather than inheriting them via
    // Object.create(only). Prototype-inherited methods are invisible to Object.keys() and to
    // console autocomplete, which defeats the point for anything introspecting the object
    // before calling it.
    const handle = {};
    if (only) {
        for (const [k, v] of Object.entries(only)) {
            handle[k] = typeof v === 'function' ? v.bind(only) : v;
        }
    }
    handle.pages = Object.fromEntries(entries);
    handle.describe = describe;
    handle.awaitPageApi = awaitPageApi;
    handle.goToTicket = goToTicket;
    window[name] = handle;
}

function notifyWaiters(kind) {
    const list = waiters.get(kind);
    if (!list?.length) return;
    const handle = typeof window !== 'undefined' ? window[GLOBAL_FOR[kind]] : null;
    if (!handle) return;
    waiters.set(kind, []);
    for (const resolve of list) resolve(handle);
}

/**
 * Resolve once a page of `kind` is registered and its global is published.
 *
 * Deliberately a module-level export rather than a method on a page object: the usual caller is
 * `sendTo()`, which navigates away and is therefore being unmounted while it waits. A promise
 * held by the module survives that; one held by the component does not.
 */
export function awaitPageApi(kind, { timeoutMs = 15000 } = {}) {
    const name = GLOBAL_FOR[kind];
    if (!name) return Promise.reject(new Error(`unknown page kind: ${kind}`));
    if (typeof window !== 'undefined' && window[name]) return Promise.resolve(window[name]);

    return new Promise((resolve, reject) => {
        let settled = false;
        const timer = setTimeout(() => {
            if (settled) return;
            settled = true;
            const list = waiters.get(kind) || [];
            waiters.set(kind, list.filter(r => r !== wrapped));
            reject(new Error(`timed out after ${timeoutMs}ms waiting for ${name}`));
        }, timeoutMs);
        const wrapped = (handle) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve(handle);
        };
        if (!waiters.has(kind)) waiters.set(kind, []);
        waiters.get(kind).push(wrapped);
    });
}

/**
 * Navigate to a ticket's results.
 *
 * Navigation is not page-specific, so it lives here rather than being duplicated on every page
 * API. The router comes from whichever page is currently registered (each exposes `_vm`).
 *
 * The type is optional: without it this routes to /queue, which resolves the type and redirects
 * on its own — the same fallback History.vue uses. Pass a cached type (History keeps a
 * `type_map` in localStorage) to skip the queue hop.
 */
export async function goToTicket(ticket, { type = null, entry = 0, wait = true, timeoutMs = 15000 } = {}) {
    if (!ticket) return { ok: false, reason: 'ticket is required' };

    let vm = null;
    for (const entries of registry.values()) {
        for (const api of entries.values()) {
            if (api?._vm?.$router) { vm = api._vm; break; }
        }
        if (vm) break;
    }
    if (!vm) return { ok: false, reason: 'no page is mounted, so there is no router to navigate' };

    // `entry` selects the query within a multi-query ticket; it only applies to the plain
    // result route, and routeForTicket ignores it elsewhere.
    const route = routeForTicket(ticket, type, { entry });
    const current = vm.$route?.fullPath ?? null;
    try {
        await vm.$router.push({ name: route.name, params: route.params });
    } catch (e) {
        // Vue Router rejects a push to the current location; that is not a failure.
        if (!/redundant|avoided/i.test(String(e?.message ?? e))) {
            return { ok: false, reason: `navigation failed: ${e?.message ?? e}` };
        }
    }

    const out = { ok: true, ticket, route: route.name, viaQueue: route.viaQueue,
        type: route.type, navigated: (vm.$route?.fullPath ?? null) !== current,
        ...(route.params.entry !== undefined ? { entry: route.params.entry } : {}) };
    if (wait) {
        // Direct routes land on a result page. Via the queue we only await the queue itself —
        // the job may be PENDING for minutes, so use queueApi.waitForResult() for the rest.
        const kind = route.viaQueue ? 'queue' : 'result';
        try { await awaitPageApi(kind, { timeoutMs }); out.arrived = kind; }
        catch { out.arrived = false; }
    }
    return out;
}

/**
 * @param {'result'|'search'|'queue'} kind
 * @param {string} key    page identifier, e.g. 'foldseek'
 * @param {object} api    methods to expose
 * @returns {() => void}  disposer — call from beforeDestroy()
 */
export function registerPageApi(kind, key, api) {
    kindRegistry(kind).set(key, api);
    publish(kind);
    notifyWaiters(kind);
    let disposed = false;
    return () => {
        if (disposed) return;
        disposed = true;
        // Only unregister if we still own the slot; a newer page may have replaced us.
        const entries = kindRegistry(kind);
        if (entries.get(key) === api) {
            entries.delete(key);
            publish(kind);
        }
    };
}

/** Back-compat alias — the result pages were written against this name. */
export function registerResultApi(key, api) {
    return registerPageApi('result', key, api);
}

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

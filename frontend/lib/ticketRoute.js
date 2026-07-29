// Where does a ticket's result live?
//
// This mapping existed twice — History.vue (keyed by normalised UI type) and Queue.vue (keyed by
// raw backend type) — so it lives here once and both import it, along with the ticket-navigation
// API. Same reason resultSort.js and accession.js exist.
//
// The important trick is History's fallback: when the type is not known, route to /queue/<id> and
// let Queue.vue resolve the type and redirect. That means a caller never has to know the type.

/** Sentinel for a COMPLETE job whose type we do not render a dedicated avatar for. */
export const RAW_TYPE = 'raw';

/** Backend job type -> the normalised UI type used for avatars and routing. */
export function normalizeJobType(type) {
    switch (type) {
        case 'search':
        case 'structuresearch':
            return 'structure';
        case 'interfacesearch':
            return 'interface';
        case 'complexsearch':
            return 'complex';
        case 'foldmasoneasymsa':
            return 'msa';
        case 'folddisco':
            return 'motif';
        default:
            return RAW_TYPE;
    }
}

/** Normalised UI type -> Vue Router route name. null when it has no dedicated result page. */
export function routeNameForType(uiType) {
    switch (uiType) {
        case 'structure':
        case 'complex':
        case 'interface':
            return 'result';
        case 'msa':
            return 'foldmasonresult';
        case 'motif':
            return 'folddiscoresult';
        default:
            return null;
    }
}

/**
 * Route descriptor for a ticket.
 *
 * `type` may be a normalised UI type OR a raw backend type — both are accepted, since History
 * caches the former and `api/ticket/type/{id}` returns the latter. Unknown or absent type falls
 * back to the queue, which resolves and redirects on its own.
 */
export function routeForTicket(ticket, type = null, { entry = 0 } = {}) {
    const ui = type ? (routeNameForType(type) ? type : normalizeJobType(type)) : null;
    const name = ui ? routeNameForType(ui) : null;
    if (!name) {
        return { name: 'queue', params: { ticket }, viaQueue: true, type: ui };
    }
    return {
        name,
        // The plain search result route is paginated by query entry; the others are not, so `entry`
        // is silently irrelevant for msa/motif rather than an error.
        params: name === 'result' ? { ticket, entry: Number(entry) || 0 } : { ticket },
        viaQueue: false,
        type: ui,
    };
}

/** Path string form, for `:to` bindings that expect a path. */
export function pathForTicket(ticket, type = null, { entry = 0 } = {}) {
    const r = routeForTicket(ticket, type, { entry });
    if (r.viaQueue) return `/queue/${ticket}`;
    if (r.name === 'result') return `/result/${ticket}/${r.params.entry}`;
    if (r.name === 'foldmasonresult') return `/result/foldmason/${ticket}`;
    return `/result/folddisco/${ticket}`;
}

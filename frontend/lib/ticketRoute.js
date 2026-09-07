// Where does a ticket's result live?

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
        case 'rnasearch':
            return 'rna';
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
        case 'rna':
            return 'riboseekresult';
        default:
            return null;
    }
}

// Accept either spelling of a type and return the normalised UI one.
export function asUiType(type) {
    if (!type) {
        return RAW_TYPE;
    }
    return routeNameForType(type) ? type : normalizeJobType(type);
}

//Route descriptor for a ticket.
export function routeForTicket(ticket, type = null, { entry = 0 } = {}) {
    const ui = type ? asUiType(type) : null;
    const name = ui ? routeNameForType(ui) : null;
    if (!name) {
        return { name: 'queue', params: { ticket }, viaQueue: true, type: ui };
    }
    return {
        name,
        // The search and riboseek result routes are paginated by query entry; the others are not,
        // so `entry` is silently irrelevant for msa/motif rather than an error.
        params: (name === 'result' || name === 'riboseekresult')
            ? { ticket, entry: Number(entry) || 0 }
            : { ticket },
        viaQueue: false,
        type: ui,
    };
}

/** Path string form, for `:to` bindings that expect a path. */
export function pathForTicket(ticket, type = null, { entry = 0 } = {}) {
    const r = routeForTicket(ticket, type, { entry });
    if (r.viaQueue) return `/queue/${ticket}`;
    if (r.name === 'result') return `/result/${ticket}/${r.params.entry}`;
    if (r.name === 'riboseekresult') return `/result/riboseek/${ticket}/${r.params.entry}`;
    if (r.name === 'foldmasonresult') return `/result/foldmason/${ticket}`;
    return `/result/folddisco/${ticket}`;
}

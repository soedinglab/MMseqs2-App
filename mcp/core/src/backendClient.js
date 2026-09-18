// Raw HTTP access to the Foldseek backend.

export class UnsupportedOnDeploymentError extends Error {
    constructor(tool) {
        super(`this deployment does not serve ${tool} jobs — /ticket/${tool} returned 404 ` +
              `(the backend only registers that route when config.App is "foldseek")`);
        this.name = 'UnsupportedOnDeploymentError';
        this.tool = tool;
    }
}

export class HttpError extends Error {
    constructor(status, url, body) {
        super(`${status} from ${url}${body ? `: ${String(body).slice(0, 300)}` : ''}`);
        this.name = 'HttpError';
        this.status = status;
        this.url = url;
        this.body = body;
    }
}

function withDatabases(params, databases) {
    for (const database of databases ?? []) params.append('database[]', database);
    return params;
}

export function createBackendClient({
    baseUrl, apiPath = '/api', basicAuth = null, fetchImpl = globalThis.fetch,
} = {}) {
    if (!baseUrl || typeof baseUrl !== 'string') {
        throw new Error('createBackendClient({ baseUrl }) is required — pass the site origin, e.g. ' +
                        '"http://localhost:3000" or "https://search.foldseek.com"');
    }
    if (typeof fetchImpl !== 'function') {
        throw new Error('no fetch available — Node 18+ is required, or pass fetchImpl');
    }

    const cleanBaseUrl = baseUrl.replace(/\/+$/, '');
    const apiRoot = cleanBaseUrl + apiPath.replace(/\/+$/, '');

    const headers = (extra = {}) => {
        const value = { ...extra };
        if (basicAuth) {
            const { user, pass } = basicAuth;
            value.Authorization = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
        }
        return value;
    };

    const request = async (pathname, {
        method = 'GET', form, tool = null, signal, as = 'json',
    } = {}) => {
        const url = `${apiRoot}${pathname}`;
        const init = {
            method,
            headers: headers({ Accept: as === 'json' ? 'application/json' : 'text/plain, */*' }),
            signal,
        };
        if (form instanceof FormData) {
            init.body = form;
        } else if (form) {
            init.headers['Content-Type'] = 'application/x-www-form-urlencoded';
            init.body = form.toString();
        }

        const response = await fetchImpl(url, init);
        if (!response.ok) {
            const body = await response.text().catch(() => '');
            if (response.status === 404 && tool) throw new UnsupportedOnDeploymentError(tool);
            throw new HttpError(response.status, url, body);
        }
        return as === 'json' ? response.json() : response.text();
    };

    return {
        baseUrl: cleanBaseUrl,
        apiRoot,
        fetchImpl,
        request,
        getDatabases: () => request('/databases'),
        submitSearch({ query, databases, mode, email, iterativeSearch, taxFilter }) {
            const form = withDatabases(new URLSearchParams(), databases);
            form.set('q', query);
            form.set('mode', mode);
            form.set('email', email);
            form.set('iterativesearch', iterativeSearch ? 'true' : 'false');
            form.set('taxfilter', taxFilter);
            return request('/ticket', { method: 'POST', form });
        },
        submitFoldMason({ files, email }) {
            const form = new FormData();
            for (const file of files) form.append('queries[]', new Blob([file.content]), file.name);
            if (email) form.append('email', email);
            return request('/ticket/foldmason', { method: 'POST', form, tool: 'foldmason' });
        },
        submitFoldDisco({ query, databases, motif, email }) {
            const form = withDatabases(new URLSearchParams(), databases);
            form.set('q', query);
            form.set('motif', motif);
            form.set('email', email);
            return request('/ticket/folddisco', { method: 'POST', form, tool: 'folddisco' });
        },
        pollTicket: ticket => request(`/ticket/${encodeURIComponent(ticket)}`),
        getTicketType: ticket => request(`/ticket/type/${encodeURIComponent(ticket)}`),
        getResult: (ticket, entry) => request(
            `/result/${encodeURIComponent(ticket)}/${encodeURIComponent(entry)}`),
        getFoldMasonResult: ticket => request(`/result/foldmason/${encodeURIComponent(ticket)}`),
        getFoldDiscoResult: ticket => request(`/result/folddisco/${encodeURIComponent(ticket)}`),
        getQueries: (ticket, { limit, page }) => request(
            `/result/queries/${encodeURIComponent(ticket)}/${limit}/${page}`),
        getHitRows(ticket, { queryIdx, db, idx, signal }) {
            const query = new URLSearchParams({
                format: 'brief', index: String(idx), database: String(db),
            });
            return request(
                `/result/${encodeURIComponent(ticket)}/${encodeURIComponent(queryIdx)}?${query}`,
                { signal });
        },
        getQueryStructure: (ticket, { signal } = {}) => request(
            `/result/${encodeURIComponent(ticket)}/query`, { as: 'text', signal }),
    };
}

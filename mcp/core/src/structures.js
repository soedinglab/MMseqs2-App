// Fetch, reconstruct and prepare structures for submission.

import { fetchAccession, searchBindingSites, fetchBindingSite } from '../../../frontend/lib/accession.js';
import { checkMotif, normalizeChainNames } from './motif.js';

function coded(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

export const RECONSTRUCT_TIMEOUT_MS = 180_000;
export const FETCH_TIMEOUT_MS = 120_000;

function withTimeout(signal, ms) {
    const deadline = AbortSignal.timeout(ms);
    if (!signal) return deadline;
    return typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, deadline]) : signal;
}
const DB_URL_PATTERNS = [
    {
        match: db => db === 'BFVD',
        url: acc => `https://bfvd.steineggerlab.workers.dev/pdb/${acc}.pdb`,
        retryAsCif: false,
    },
    {
        match: db => db.startsWith('afdb'),
        url: acc => `https://alphafold.ebi.ac.uk/files/${acc}.pdb`,
        retryAsCif: true,
    },
    {
        match: db => db.includes('esm'),
        url: acc => `https://api.esmatlas.com/fetchPredictedStructure/${acc}.pdb`,
        retryAsCif: false,
    },
    {
        match: db => db.startsWith('pdb'),
        url: acc => `https://files.rcsb.org/download/${acc.substring(0, 4).toUpperCase()}.pdb`,
        retryAsCif: true,
    },
];

/** No public URL pattern covers this database, so the caller should reconstruct instead. */
export class DatabaseNotResolvableError extends Error {
    constructor(db) {
        super(`no public structure URL is known for database "${db}" — reconstruct instead`);
        this.name = 'DatabaseNotResolvableError';
        this.db = db;
    }
}

/** A known structure URL could not be fetched. */
export class StructureFetchError extends Error {
    constructor(url, status) {
        super(`failed to fetch ${url}${status ? ` (${status})` : ''}`);
        this.name = 'StructureFetchError';
        this.url = url;
        this.status = status;
    }
}

/** Fetch an original hit structure from a known database URL pattern. */
export async function resolveStructureFromDb(db, accession, {
    signal, fetchImpl = globalThis.fetch, timeoutMs = FETCH_TIMEOUT_MS,
} = {}) {
    if (!db || !accession) throw new DatabaseNotResolvableError(db ?? '(none)');
    const pattern = DB_URL_PATTERNS.find(p => p.match(String(db)));
    if (!pattern) throw new DatabaseNotResolvableError(db);

    const attempt = async (url) => {
        try {
            const res = await fetchImpl(url, { signal: withTimeout(signal, timeoutMs) });
            if (!res.ok) throw new StructureFetchError(url, res.status);
            return await res.text();
        } catch (err) {
            if (err instanceof StructureFetchError) throw err;
            if (err?.name === 'AbortError' && signal?.aborted) throw err;
            throw new StructureFetchError(url, err?.name === 'TimeoutError' ? 'timed out' : err?.message);
        }
    };

    const url = pattern.url(String(accession));
    try {
        return { text: await attempt(url), url, db, accession };
    } catch (err) {
        if (!pattern.retryAsCif || !url.endsWith('.pdb')) throw err;
        const cif = url.replace(/\.pdb$/, '.cif');
        return { text: await attempt(cif), url: cif, db, accession };
    }
}

/** Mark a structure reconstructed by cg2all. */
export function prependRemark(pdbstr) {
    const isCif = pdbstr[0] === '#' || pdbstr.startsWith('data_');
    const prefix = isCif ? '# ' : 'REMARK  90 ';
    let firstline = `${prefix}This model is rebuilt with cg2all(https://github.com/huhlim/cg2all)`;
    if (!isCif && firstline.length > 79) firstline = `${firstline.slice(76)}... `;
    return `${firstline.padEnd(80, ' ')}\n${pdbstr}`;
}

/** Reconstruct a CA-only model through cg2all. */
export async function reconstructFullAtom(pdbText, {
    cg2allUrl, signal, fetchImpl = globalThis.fetch, timeoutMs = RECONSTRUCT_TIMEOUT_MS,
} = {}) {
    if (!cg2allUrl) throw new Error('reconstructFullAtom needs cg2allUrl');
    const form = new FormData();
    form.append('file', new Blob([pdbText], { type: 'text/plain' }), 'tmp.pdb');

    let res;
    try {
        res = await fetchImpl(cg2allUrl, {
            method: 'POST', body: form, headers: { Accept: 'text/plain' },
            signal: withTimeout(signal, timeoutMs),
        });
    } catch (err) {
        if (err?.name === 'TimeoutError') {
            throw new ReconstructionError(`cg2all did not answer within ${timeoutMs}ms`);
        }
        if (err?.name === 'AbortError') throw err;
        throw new ReconstructionError(`could not reach cg2all at ${cg2allUrl}: ${err?.message ?? err}`);
    }
    if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new ReconstructionError(
            `cg2all reconstruction failed: ${res.status}${body ? ` ${body.slice(0, 200)}` : ''}`);
    }
    const text = await res.text();
    if (!/^(ATOM|HETATM|data_|#)/m.test(text)) {
        throw new ReconstructionError('cg2all returned no structure records');
    }
    return prependRemark(text);
}

/** Distinguishes reconstruction failures from submission failures. */
export class ReconstructionError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ReconstructionError';
    }
}

/** Fetch a FoldDisco hit's full-atom structure from the backend. */
export async function fetchFoldDiscoStructure(request, ticket, {
    id, database, retries = 4, retryDelayMs = 500, signal,
} = {}) {
    if (!id) throw new Error('fetchFoldDiscoStructure({ id }) is required');
    const qs = new URLSearchParams({ id: String(id) });
    if (database !== undefined && database !== null) qs.set('database', String(database));
    const path = `/result/folddisco/${encodeURIComponent(ticket)}?${qs}`;

    let lastErr;
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            return await request(path, { as: 'text', signal });
        } catch (err) {
            lastErr = err;
            if (attempt < retries - 1) {
                await new Promise(r => setTimeout(r, retryDelayMs * (attempt + 1)));
            }
        }
    }
    throw lastErr;
}

/** Ensure FoldMason can infer the structure format from the file name. */
export function ensureStructureExtension(name, text) {
    if (name.includes('-_-_-_')) return name;

    const head = text.trimStart();
    const wanted = head.startsWith('data_') || head.startsWith('#') ? '.cif' : '.pdb';
    return name.endsWith(wanted) ? name : `${name}${wanted}`;
}

/** A fetched structure and its optional motif metadata. */
export class LoadedStructure {
    constructor({ id, source, name, text, motif = undefined, motifSource = undefined,
        qbiolipSites = undefined, resolvedFrom = undefined, motifProblem = undefined,
        motifWarnings = undefined, motifDropped = undefined, motifRenumbered = undefined,
        chainsRenamed = undefined } = {}) {
        this.id = id;
        this.source = source;
        this.name = name;
        this.text = text;
        this.motif = motif;
        this.motifSource = motifSource;
        this.qbiolipSites = qbiolipSites;
        this.resolvedFrom = resolvedFrom;
        this.motifProblem = motifProblem;
        this.motifWarnings = motifWarnings;
        this.motifDropped = motifDropped;
        this.motifRenumbered = motifRenumbered;
        this.chainsRenamed = chainsRenamed;
    }

    /** Describe the structure without echoing its text. */
    describe() {
        return {
            id: this.id, source: this.source, name: this.name,
            bytes: Buffer.byteLength(this.text ?? ''),
            ...(this.motif ? { motif: this.motif, motifSource: this.motifSource } : {}),
            ...(this.motifProblem ? { motifProblem: this.motifProblem } : {}),
            ...(this.motifWarnings ? { motifWarnings: this.motifWarnings } : {}),
            ...(this.motifDropped ? { motifDropped: this.motifDropped } : {}),
            ...(this.motifRenumbered ? { motifRenumbered: this.motifRenumbered } : {}),
            ...(this.chainsRenamed ? { chainsRenamed: this.chainsRenamed } : {}),
            ...(this.qbiolipSites ? { qbiolipSites: this.qbiolipSites } : {}),
            ...(this.resolvedFrom ? { resolvedFrom: this.resolvedFrom } : {}),
        };
    }
}

const QBIOLIP_SOURCE = 'PDB';

/** Load one accession and, for PDB entries, an optional binding-site motif. */
export async function loadAccession(client, id, {
    source = 'PDB', autoMotif = true, normalizeChains = true,
} = {}) {
    const { name, text } = await fetchAccession(id, source).catch(() => {
        throw coded('UPSTREAM_FAILED', `could not load ${id} from ${source}`);
    });

    const loaded = new LoadedStructure({ id, source, name, text });
    if (!autoMotif || source !== QBIOLIP_SOURCE) return loaded;

    let sites = [];
    try {
        sites = await searchBindingSites(id);
    } catch {
        return loaded;
    }
    const withSites = (Array.isArray(sites) ? sites : [])
        .filter(item => String(item?.Complex?.bs ?? '').trim() !== '');
    if (withSites.length === 0) return loaded;

    loaded.qbiolipSites = withSites.map((item, index) => ({
        index,
        label: item.Complex.bs.trim(),
        ligand: item?.Ligand?.name ?? null,
    }));
    try {
        const site = await fetchBindingSite(withSites[0]);
        if (site.motif) {
            let { text, motif } = site;

            let checked = checkMotif(motif, text);
            if (normalizeChains && (checked.ambiguous || checked.unnameableChains)) {
                const normalized = normalizeChainNames(text, { motif });
                if (normalized.changed) {
                    const after = checkMotif(normalized.motif, normalized.text);
                    // Keep chain renaming only when it makes the motif usable.
                    if (after.valid && !after.ambiguous) {
                        ({ text, motif } = normalized);
                        loaded.chainsRenamed = normalized.renames;
                        checked = after;
                    }
                }
            }

            loaded.name = site.name;
            loaded.text = text;
            loaded.motif = motif;
            loaded.motifSource = 'qbiolip';
            loaded.resolvedFrom = 'qbiolip-assembly';
            if (!checked.valid) loaded.motifProblem = checked.reason;
            if (checked.warnings) loaded.motifWarnings = checked.warnings;
            if (site.dropped?.length) {
                loaded.motifDropped = site.dropped.map(d => `${d.chain}${d.resno}`);
            }
            if (site.translated) loaded.motifRenumbered = site.translated;
        }
    } catch {
        // Keep the structure when optional motif lookup fails.
    }
    return loaded;
}

export async function loadAccessions(client, ids, opts = {}) {
    opts.autoMotif = false;
    const settled = await Promise.allSettled(
        (ids ?? []).map(id => loadAccession(client, id, opts)));
    const structures = [];
    const failed = [];
    settled.forEach((r, i) => {
        if (r.status === 'fulfilled') structures.push(r.value);
        else failed.push({ id: ids[i], reason: r.reason?.message ?? String(r.reason) });
    });
    return { structures, failed };
}

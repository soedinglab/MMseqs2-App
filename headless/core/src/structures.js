// Getting hold of a real structure: reconstructing one from CA coordinates, fetching the original
// from the database it came from, or loading one by accession from a public service.

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

/**
 * A pattern matched but the fetch failed. Kept distinct from the above: the original file does exist
 * in principle, so a caller may prefer to retry or report rather than silently reconstruct.
 */
export class StructureFetchError extends Error {
    constructor(url, status) {
        super(`failed to fetch ${url}${status ? ` (${status})` : ''}`);
        this.name = 'StructureFetchError';
        this.url = url;
        this.status = status;
    }
}

/**
 * The original structure file for a hit, from the database it came from.
 *
 * @returns {Promise<{text: string, url: string, db: string, accession: string}>}
 * @throws {DatabaseNotResolvableError} when no pattern matches — the caller decides to reconstruct
 * @throws {StructureFetchError} when a matching URL could not be fetched
 */
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
            if (err?.name === 'AbortError' && signal?.aborted) throw err;   // the caller cancelled
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

/**
 * cg2all's provenance remark, ported from AllAtomPredictMixin.vue's prependRemark.
 */
export function prependRemark(pdbstr) {
    const isCif = pdbstr[0] === '#' || pdbstr.startsWith('data_');
    const prefix = isCif ? '# ' : 'REMARK  90 ';
    let firstline = `${prefix}This model is rebuilt with cg2all(https://github.com/huhlim/cg2all)`;
    if (!isCif && firstline.length > 79) firstline = `${firstline.slice(76)}... `;
    return `${firstline.padEnd(80, ' ')}\n${pdbstr}`;
}

/**
 * Full-atom reconstruction from a CA-only model, via the same remote service the page uses:
 * a multipart POST to cg2all, field `file`, plain-text PDB back.
 */
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
        if (err?.name === 'AbortError') throw err;      // the caller's own cancellation
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

/** Reconstruction failed. Named so a caller can tell it from a submission or validation failure. */
export class ReconstructionError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ReconstructionError';
    }
}

/**
 * A FoldDisco hit's structure: the original full-atom model, served by the backend itself.
 *
 * @param {(path: string, opts?: object) => Promise<string>} request  the client's HTTP helper
 */
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

/**
 * FoldMason reads a file's format from its *name*, and mis-parses a mmCIF entry whose name has no
 * `.cif` extension — the entry is then silently dropped from the alignment. Every name that reaches
 * a FoldMason submission goes through here.
 */
export function ensureStructureExtension(name, text) {
    if (name.includes('-_-_-_')) return name;

    const head = text.trimStart();
    const wanted = head.startsWith('data_') || head.startsWith('#') ? '.cif' : '.pdb';
    return name.endsWith(wanted) ? name : `${name}${wanted}`;
}

/**
 * A structure loaded by accession, ready to submit.
 */
export class LoadedStructure {
    constructor(client, { id, source, name, text, motif = undefined, motifSource = undefined,
        qbiolipSites = undefined, resolvedFrom = undefined, motifProblem = undefined,
        motifWarnings = undefined, motifDropped = undefined, motifRenumbered = undefined,
        chainsRenamed = undefined } = {}) {
        this.client = client;
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

    /**
     * A real structure file, so the origin is 'structure': there is nothing to build from CA
     * coordinates and nothing to reconstruct for any destination.
     */
    toQuery() {
        return this.client.query({ kind: 'structure', text: this.text, name: this.name, motif: this.motif });
    }

    sendTo(opts) { return this.toQuery().sendTo(opts); }

    /** Without the structure text, which is the bulk of it and rarely what a caller wants echoed. */
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

/** Several loaded structures — the only origin that can reach FoldMason on its own. */
export class LoadedStructureList {
    constructor(client, structures, failed = []) {
        this.client = client;
        this.structures = structures;
        this.failed = failed;
    }

    get length() { return this.structures.length; }

    /** FoldMason needs two or more; submitFoldMason enforces that and says so if not. */
    submitFoldMason({ email = '' } = {}) {
        return this.client.submitFoldMason({
            files: this.structures.map(s => ({ name: s.name, content: s.text })),
            email,
        });
    }

    describe() {
        return { loaded: this.structures.map(s => s.describe()), failed: this.failed };
    }
}

const QBIOLIP_SOURCE = 'PDB';

/**
 * Load one structure by accession.
 */
export async function loadAccession(client, id, {
    source = 'PDB', autoMotif = true, normalizeChains = true,
} = {}) {
    const { name, text } = await fetchAccession(id, source).catch(() => {
        throw coded('UPSTREAM_FAILED', `could not load ${id} from ${source}`);
    });

    const loaded = new LoadedStructure(client, { id, source, name, text });
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
                    // Only if it actually helped: renaming that leaves the motif no better would be
                    // a gratuitous edit to someone's structure.
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
        /* keep the structure, drop the motif */
    }
    return loaded;
}

export async function loadAccessions(client, ids, opts = {}) {
    opts.autoMotif = false // FoldMason doesn't need any motif, so skip searching for bs
    const settled = await Promise.allSettled(
        (ids ?? []).map(id => loadAccession(client, id, opts)));
    const structures = [];
    const failed = [];
    settled.forEach((r, i) => {
        if (r.status === 'fulfilled') structures.push(r.value);
        else failed.push({ id: ids[i], reason: r.reason?.message ?? String(r.reason) });
    });
    return new LoadedStructureList(client, structures, failed);
}

// Getting hold of a real structure: reconstructing one from CA coordinates, fetching the original
// from the database it came from, or loading one by accession from a public service.
//
// All three exist for the same reason — a Foldseek hit is stored as CA coordinates and a name, and
// FoldDisco needs a full-atom structure to compute local geometry from. Which of the three applies is
// decided by the *destination*, never by the source: Foldseek and FoldMason both work on CA
// coordinates and need none of this (see plan.md's dispatch table and context.md §8).
//
// Order of preference for a FoldDisco destination is deliberate: the original file, when the source
// database has a public URL, beats a reconstruction of it. resolveStructureFromDb tries that first
// and says which of the two happened.

import { fetchAccession, searchBindingSites, fetchBindingSite } from '../../../frontend/lib/accession.js';

/**
 * Ceilings on the calls that leave this process for a third party. Neither service is under this
 * deployment's control and `fetch` has no default timeout, so without these a hung reconstruction
 * hangs the caller indefinitely. cg2all's is generous — the page's own dialog warns it "may take up
 * to a minute".
 */
export const RECONSTRUCT_TIMEOUT_MS = 180_000;
/**
 * Covers the download, not just the response headers — some real entries are large (RCSB serves 7A01
 * as a 14 MB mmCIF, and it is far from the biggest), so this is a deliberately loose ceiling on a
 * slow transfer rather than a tight one on a slow server. Overridable per call for the cases where
 * the file is known to be enormous.
 */
export const FETCH_TIMEOUT_MS = 120_000;

/**
 * One signal that fires if either the caller aborts or the deadline passes. AbortSignal.any is Node
 * 20+; falling back to the caller's own signal on older runtimes loses the timeout but not the abort.
 */
function withTimeout(signal, ms) {
    const deadline = AbortSignal.timeout(ms);
    if (!signal) return deadline;
    return typeof AbortSignal.any === 'function' ? AbortSignal.any([signal, deadline]) : signal;
}

/**
 * Public URL patterns per source database, from ResultView.vue's fetchStructureFileURL. Matching is
 * prefix/substring based in the same order the page tests them — `BFVD` exactly, then `afdb*`, then
 * anything containing `esm`, then `pdb*`.
 *
 * `retryAsCif` reproduces the page's `.pdb`-then-`.cif` retry, which exists because these services
 * serve large models as mmCIF only.
 *
 * One verified difference from the page, in the `pdb*` branch: it asks RCSB for `.cif`
 * unconditionally, and passes `retry: true` alongside a URL the retry cannot act on (the rewrite is
 * `/\.pdb$/` -> `.cif`, which never matches a `.cif` URL). Asking for `.pdb` first and falling back
 * is what that flag was meant to do, and PDB format is the smaller file where it exists. Checked
 * against RCSB directly: `1CRN.pdb` and `1CRN.cif` are both served, while `3J3Q.pdb` and `7A01.pdb`
 * are 404 — those entries exceed the PDB format's limits — and their `.cif` are 200. So the fallback
 * is not decorative, and neither format alone covers the database.
 */
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
        // PDB entries are addressed by their four-character id; the accession carries a chain and
        // sometimes an extension after it.
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
        // The body read is inside the try as well as the request: the timeout covers the download,
        // so a large file that stalls half way aborts in text(), not in fetch().
        try {
            const res = await fetchImpl(url, { signal: withTimeout(signal, timeoutMs) });
            if (!res.ok) throw new StructureFetchError(url, res.status);
            return await res.text();
        } catch (err) {
            if (err instanceof StructureFetchError) throw err;
            if (err?.name === 'AbortError' && signal?.aborted) throw err;   // the caller cancelled
            // A network failure and a 404 are the same decision for the caller — reconstruct instead —
            // so a thrown fetch is reported as the same kind of failure rather than escaping raw.
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
 *
 * The odd `slice(76)` branch is the page's, kept as-is: it only triggers for a line already past
 * column 79, which this fixed string never is, so it is dead in both.
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
 *
 * Takes the whole structure in one call — a decoded multi-chain text goes in as one request, not one
 * per chain, which is how SelectToSendPanelFoldMason.vue calls it too.
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
    // An empty or non-structure body would otherwise be submitted as a query and fail much later, in
    // a queued job, with nothing pointing back here.
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
 * This is the best forwarding case there is — no reconstruction, no third-party lookup, and the motif
 * already computed server-side (context.md §9). It lives here rather than in client.js because it is
 * one of the three ways to get hold of a structure, and having it sit apart from the other two is
 * what made it easy to mistake a FoldDisco hit for CA coordinates in the first place.
 *
 * Retried because the server may have to decompress the structure with foldcomp on first request; the
 * page retries this same call for the same reason.
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
    // An encodeMultimer suffix must stay last: MSA.vue reads it as `name.split('-_-_-_')[1]` and
    // parses the trailing field as a number, so an extension appended after it turns the chain offset
    // into NaN. Such a name is always PDB text anyway — encodeMultimer emits PDB — so there is nothing
    // to fix here.
    if (name.includes('-_-_-_')) return name;

    const head = text.trimStart();
    const wanted = head.startsWith('data_') || head.startsWith('#') ? '.cif' : '.pdb';
    return name.endsWith(wanted) ? name : `${name}${wanted}`;
}

/**
 * A structure loaded by accession, ready to submit.
 *
 * `motif` is populated from Q-BioLiP when the source is PDB and binding-site data exists — see
 * context.md §12 for why that lookup is folded in here rather than left as a second step. All
 * candidates stay visible in `qbiolipSites`, since the auto-picked first result is not always the
 * wanted one.
 */
export class LoadedStructure {
    constructor(client, { id, source, name, text, motif = undefined, motifSource = undefined,
        qbiolipSites = undefined, resolvedFrom = undefined } = {}) {
        this.client = client;
        this.id = id;
        this.source = source;
        this.name = name;
        this.text = text;
        this.motif = motif;
        this.motifSource = motifSource;
        this.qbiolipSites = qbiolipSites;
        this.resolvedFrom = resolvedFrom;
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

/** Q-BioLiP covers PDB entries only, so the other sources skip the lookup entirely. */
const QBIOLIP_SOURCE = 'PDB';

/**
 * Load one structure by accession.
 *
 * `source` is one of accession.js's: 'PDB', 'AlphaFoldDB', 'BFVD'. ('AlphaFill' is defined there but
 * enabled by no page, and is not offered here either.) Note AlphaFoldDB is a fuzzy *search* rather
 * than a lookup, so the entry that comes back can differ from the one asked for — the returned
 * `name` is the entry actually loaded.
 */
export async function loadAccession(client, id, { source = 'PDB', autoMotif = true } = {}) {
    const { name, text } = await fetchAccession(id, source).catch(() => {
        throw new Error(`could not load ${id} from ${source}`);
    });

    const loaded = new LoadedStructure(client, { id, source, name, text });
    if (!autoMotif || source !== QBIOLIP_SOURCE) return loaded;

    // A missing binding site is the normal case, not an error: most entries have none, and one
    // unreachable third-party service should not fail a structure that already loaded.
    let sites = [];
    try {
        sites = await searchBindingSites(id);
    } catch {
        return loaded;
    }
    // Q-BioLiP answers for an entry it knows even when that entry has no binding site: 1CRN comes
    // back as one record whose `bs` is a single space. Listing those as candidates would offer a
    // choice between nothing and nothing.
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
            loaded.motif = site.motif;
            loaded.motifSource = 'qbiolip';
            // The binding site's own receptor assembly, not the plain entry: its residue numbering is
            // what the motif refers to, so keeping the other file would name residues that are not
            // in it. fetchBindingSite already maps Q-BioLiP's label chains to this file's auth chains.
            loaded.name = site.name;
            loaded.text = site.text;
            loaded.resolvedFrom = 'qbiolip-assembly';
        }
    } catch {
        /* keep the structure, drop the motif */
    }
    return loaded;
}

export async function loadAccessions(client, ids, opts = {}) {
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

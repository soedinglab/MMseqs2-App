// One place where "this thing can be submitted as a query" is defined, for every origin and every
// destination.
//
// A hit row, an MSA column selection and a loaded accession are three different things to have in
// hand, and the page implements forwarding separately for each (SelectToSendPanel.vue,
// SelectToSendPanelFoldMason.vue, LoadAcessionButton.vue). They agree on almost everything, which is
// exactly the situation where three copies drift. Here each one only has to produce a
// `SubmittableQuery` of the right *origin* shape; how a query becomes a job lives in `sendTo` alone.
//
// Three origins, not the two the plan first named:
//   chains     — a Foldseek hit's per-chain CA coordinates: [{ca, seq, chain, target}], as the brief
//                result endpoint returns them. Real data, nothing encoded.
//   fm-entry   — a FoldMason entry's native pseudo-monomer form: {pdb, suffix}. FoldMason's MSA engine
//                aligns one linear sequence per entry, so that is genuinely how it stores a complex;
//                there is no per-chain data sitting beside it to use instead.
//   structure  — an actual structure file. A **FoldDisco hit** arrives this way: the backend serves
//                the original full-atom model for a hit, not CA coordinates, so it is
//                not a `chains` origin at all. A loaded accession is the same shape.
//
// What varies by destination is how a multi-chain input is combined, and whether a full-atom
// reconstruction is needed. Three rules worth stating because
// getting them backwards produces a query the destination silently misreads:
//   * Foldseek takes a real multi-chain PDB. Never encode for it.
//   * Only FoldDisco needs full atoms. Foldseek and FoldMason both work on CA coordinates.
//   * FoldMason reads a file's format from its name — a mmCIF entry whose name lacks `.cif` is
//     dropped from the alignment without a word (ensureStructureExtension).

import {
    mockPDB, mergePdbs, encodeMultimer, decodeMultimer,
} from '../../../frontend/lib/pdbAssembly.js';
import { getAccession } from '../../../frontend/lib/targetName.js';
import {
    reconstructFullAtom, resolveStructureFromDb, ensureStructureExtension,
    DatabaseNotResolvableError,
} from './structures.js';

export const ORIGINS = ['chains', 'fm-entry', 'structure'];
export const DESTINATIONS = ['foldseek', 'multimer', 'foldmason', 'folddisco'];

/** FoldMason is the one destination that takes several structures, so a lone query cannot reach it. */
const MULTI_INPUT_DESTINATIONS = new Set(['foldmason']);

function isCif(text) {
    const head = text.trimStart();
    return head.startsWith('#') || head.startsWith('data_');
}

/**
 * The provenance header the page writes onto a forwarded structure, from SelectToSendPanel.vue's
 * prependRemark: which entry it was and which ticket it came from.
 */
export function provenanceRemark(text, { accession, db = null, ticket = null }) {
    const prefix = isCif(text) ? '# ' : 'REMARK  99 ';
    let firstline = `${prefix}Accession: ${accession}${db ? `, DB: ${db}` : ''}`;
    if (!isCif(text) && firstline.length > 79) firstline = `${firstline.slice(76)}... `;

    let second = '';
    if (ticket) {
        const t = ticket.length > 55 ? `${ticket.slice(52)}...` : ticket;
        second = `${prefix}${`Imported from ${t}`.padEnd(69, ' ')}\n`;
    }
    return `${firstline.padEnd(80, ' ')}\n${second}${text}`;
}

/**
 * A query that knows how to become a job.
 *
 * `spec.kind` picks the origin; everything else on the spec is that origin's data plus optional
 * provenance (`db`, `accession`, `ticket`) and a default `motif`.
 */
export class SubmittableQuery {
    /**
     * @param {object} client
     * @param {object|(() => Promise<object>)} spec  the origin data, or a function producing it.
     * @param {{label?: string}} [opts]  a name for diagnostics before the spec is resolved
     */
    constructor(client, spec, { label = null } = {}) {
        if (typeof spec !== 'function' && !ORIGINS.includes(spec?.kind)) {
            throw new Error(`unknown query origin: ${JSON.stringify(spec?.kind)} ` +
                            `(expected one of ${ORIGINS.join(', ')})`);
        }
        this.client = client;
        this.label = label;
        this._resolver = typeof spec === 'function' ? spec : null;
        this.spec = this._resolver ? null : spec;
    }

    /** Resolve the spec once, whatever the caller passed. */
    async resolve() {
        if (this.spec) return this.spec;
        const spec = await this._resolver();
        if (!ORIGINS.includes(spec?.kind)) {
            throw new Error(`unknown query origin: ${JSON.stringify(spec?.kind)} ` +
                            `(expected one of ${ORIGINS.join(', ')})`);
        }
        this.spec = spec;
        return spec;
    }

    get kind() { return this.spec?.kind ?? null; }

    /** Chain letters in order, for naming — the page's `chainset`: an underscore, then each chain. */
    _chainset(spec) {
        return `_${(spec.chains ?? []).map(c => c.chain).join('')}`;
    }

    /** Every chain of a hit group carries the same target name; the accession comes off the first. */
    _baseName(spec) {
        return spec.name ?? getAccession(spec.chains?.[0]?.target ?? 'query');
    }

    /**
     * Assemble the structure text this destination should receive.
     *
     * @param {'foldseek'|'multimer'|'foldmason'|'folddisco'} tool
     * @returns {Promise<{pdb: string, name: string, isMultimer: boolean, suffix?: string,
     *                    motif?: string, resolvedFrom?: string, reconstructed?: boolean}>}
     */
    async build(tool, { signal } = {}) {
        if (!DESTINATIONS.includes(tool)) {
            throw new Error(`unknown destination: ${JSON.stringify(tool)} ` +
                            `(expected one of ${DESTINATIONS.join(', ')})`);
        }
        const spec = await this.resolve();
        const motif = spec.motif ? { motif: spec.motif } : {};

        if (spec.kind === 'structure') {
            return {
                pdb: spec.text,
                name: spec.name ?? 'query',
                isMultimer: false,
                ...motif,
                ...(spec.resolvedFrom ? { resolvedFrom: spec.resolvedFrom } : {}),
            };
        }

        if (spec.kind === 'fm-entry') {
            const { pdb, suffix } = spec;
            const name = spec.name ?? 'query';
            if (tool === 'foldmason') {
                return { pdb, suffix, name, isMultimer: !!suffix };
            }
            const real = suffix ? decodeMultimer(pdb, suffix) : pdb;
            if (tool !== 'folddisco') {
                return { pdb: real, name, isMultimer: !!suffix, ...motif };
            }
            return {
                pdb: await this._reconstruct(real, signal, name),
                name, isMultimer: !!suffix, reconstructed: true, ...motif,
            };
        }

        // kind === 'chains'
        const chains = spec.chains ?? [];
        if (chains.length === 0) throw new Error('this query has no chains to build from');
        const parts = chains.map(c => ({ pdb: mockPDB(c.ca, c.seq ?? '', c.chain), chain: c.chain }));
        const multi = parts.length > 1;
        const base = this._baseName(spec);

        if (tool === 'foldmason') {
            if (!multi) return { pdb: parts[0].pdb, name: base, isMultimer: false };
            const { pdb, suffix } = encodeMultimer(parts);
            return { pdb, suffix, name: `${base}${this._chainset(spec)}${suffix}`, isMultimer: true };
        }

        if (tool === 'folddisco') {
            if (!multi) {
                const accession = spec.accession ?? base;
                try {
                    const found = await resolveStructureFromDb(spec.db, accession,
                        { signal, fetchImpl: this.client.fetchImpl });
                    return { pdb: found.text, name: base, isMultimer: false, resolvedFrom: found.url, ...motif };
                } catch (err) {
                    if (!(err instanceof DatabaseNotResolvableError)) {
                        this.client.onWarning?.(`${base}: falling back to reconstruction (${err.message})`);
                    }
                }
            }
            return {
                pdb: await this._reconstruct(multi ? mergePdbs(parts) : parts[0].pdb, signal, base),
                name: multi ? `${base}${this._chainset(spec)}` : base,
                isMultimer: multi,
                reconstructed: true,
                ...motif,
            };
        }

        // Foldseek/Multimer: a genuine multi-chain PDB, chain ids preserved.
        return {
            pdb: multi ? mergePdbs(parts) : parts[0].pdb,
            name: multi ? `${base}${this._chainset(spec)}` : base,
            isMultimer: multi,
            ...motif,
        };
    }

    /**
     * Reconstruction is the one build step that leaves the process, so it is also the one that fails
     * for reasons having nothing to do with the caller — cg2all being down, slow, or answering with
     * something that is not a structure. Every such failure is caught and renamed after the structure
     * it was working on; on its own the message says only that a POST failed.
     */
    async _reconstruct(text, signal, name) {
        try {
            return await reconstructFullAtom(text, {
                cg2allUrl: this.client.cg2allUrl, signal, fetchImpl: this.client.fetchImpl,
            });
        } catch (err) {
            if (err?.name === 'AbortError') throw err;      // the caller's own cancellation
            throw new Error(`could not reconstruct ${name}: ${err.message}`);
        }
    }

    /** The `{name, content}` pair a FoldMason submission wants for this query. */
    async buildFile(opts = {}) {
        const built = await this.build('foldmason', opts);
        return { name: ensureStructureExtension(built.name, built.pdb), content: built.pdb };
    }

    /**
     * Build for the destination and submit.
     *
     * @param {object} opts
     * @param {'foldseek'|'multimer'|'folddisco'} opts.tool
     * @param {string[]} opts.databases
     * @param {string} [opts.motif]    folddisco; defaults to the query's own motif when it has one
     * @param {boolean} [opts.remark]  write the provenance header; default true
     * @returns {Promise<import('./client.js').Ticket>}
     */
    async sendTo({
        tool, databases = null, mode = '3diaa', motif = null, taxFilter = '', email = '',
        iterativeSearch = false, remark = true, signal = undefined,
    } = {}) {
        if (MULTI_INPUT_DESTINATIONS.has(tool)) {
            throw new Error('FoldMason aligns two or more structures, so a single query cannot be ' +
                            'sent to it on its own — select several rows and use the selection\'s ' +
                            'sendTo, which can also forward the original query alongside them');
        }
        const built = await this.build(tool, { signal });
        const query = remark
            ? provenanceRemark(built.pdb, {
                accession: built.name, db: this.spec.db ?? null, ticket: this.spec.ticket ?? null,
            })
            : built.pdb;

        const ticket = tool === 'folddisco'
            ? await this.client.submitFoldDisco({ query, databases, motif: motif ?? built.motif, email })
            : await this.client.submitFoldseekSearch({
                query, databases, mode, multimer: tool === 'multimer', email, iterativeSearch, taxFilter,
            });
        return this._recordLineage(ticket, tool, built);
    }

    /**
     * Record which ticket this job came out of.
     */
    async _recordLineage(ticket, tool, built) {
        const source = this.spec?.ticket;
        if (!source) return ticket;
        const derivedFrom = {
            ticket: source,
            origin: this.spec.kind,
            tool,
            ...(this.spec.lineage ?? {}),
            ...(this.label ? { from: this.label } : {}),
            ...(built?.name ? { name: built.name } : {}),
            ...(built?.resolvedFrom ? { resolvedFrom: built.resolvedFrom } : {}),
            ...(built?.reconstructed ? { reconstructed: true } : {}),
        };
        try {
            await this.client.store.writeTicket(ticket.id, { derivedFrom });
        } catch (err) {
            this.client.onWarning?.(`could not record lineage for ${ticket.id}: ${err.message}`);
        }
        ticket.derivedFrom = derivedFrom;
        return ticket;
    }
}

/**
 * Several queries, submitted together - for FoldMason job.
 */
export class QuerySet {
    constructor(client, queries, { ticket = null, entry = 0, description = null } = {}) {
        this.client = client;
        this.queries = queries;
        this.ticket = ticket;
        this.entry = entry;
        this.description = description;
    }

    get length() { return this.queries.length; }

    /**
     * @param {object} opts
     * @param {boolean} [opts.includeQuery]  for foldmason: add the ticket's own query structure as an
     *                                       entry, the way the page's toggle does (default true)
     * @param {number} [opts.concurrency]    how many structures to build at once; default 8
     */
    async sendTo({ tool, includeQuery = true, concurrency = 8, email = '', signal, ...rest } = {}) {
        if (tool !== 'foldmason') {
            if (this.queries.length !== 1) {
                throw new Error(`${tool} takes one query; this selection has ${this.queries.length}. ` +
                                'Narrow it to one row, or send to foldmason.');
            }
            return this.queries[0].sendTo({ tool, email, signal, ...rest });
        }

        const files = [];
        const skipped = [];
        const seen = new Set();

        const add = (file, index) => {
            if (seen.has(file.name)) {
                skipped.push({ index, name: file.name, reason: 'duplicate entry name' });
                return;
            }
            seen.add(file.name);
            files.push(file);
        };

        for (let i = 0; i < this.queries.length; i += concurrency) {
            const batch = this.queries.slice(i, i + concurrency);
            const settled = await Promise.allSettled(batch.map(q => q.buildFile({ signal })));
            settled.forEach((r, j) => {
                if (r.status === 'fulfilled' && r.value?.content) add(r.value, i + j);
                else {
                    skipped.push({
                        index: i + j,
                        name: this.queries[i + j]?.label ?? this.queries[i + j]?.spec?.name ?? null,
                        reason: r.reason?.message ?? 'produced no structure',
                    });
                }
            });
        }

        if (includeQuery && this.ticket) {
            const original = await this.client.getQueryStructure(this.ticket, { entry: this.entry })
                .catch(err => {
                    skipped.push({ index: -1, name: 'query', reason: err.message });
                    return null;
                });
            if (original) add(original, -1);
        }

        const ticket = await this.client.submitFoldMason({ files, email });
        ticket.skipped = skipped;
        ticket.submittedFiles = files.length;

        if (this.ticket) {
            const derivedFrom = {
                ticket: this.ticket,
                entry: this.entry,
                origin: 'selection',
                tool: 'foldmason',
                ...(this.description?.name ? { selection: this.description.name } : {}),
                entries: files.map(f => f.name),
                ...(skipped.length ? { skipped: skipped.length } : {}),
            };
            try {
                await this.client.store.writeTicket(ticket.id, { derivedFrom });
            } catch (err) {
                this.client.onWarning?.(`could not record lineage for ${ticket.id}: ${err.message}`);
            }
            ticket.derivedFrom = derivedFrom;
        }
        return ticket;
    }
}

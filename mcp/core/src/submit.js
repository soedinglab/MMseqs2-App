// Build destination-specific submissions from chain hits, FoldMason entries, or structures.

import {
    mockPDB, mergePdbs, encodeMultimer, decodeMultimer,
} from '../../../frontend/lib/pdbAssembly.js';
import { getAccession } from '../../../frontend/lib/targetName.js';
import {
    reconstructFullAtom, resolveStructureFromDb, ensureStructureExtension,
    DatabaseNotResolvableError,
} from './structures.js';

function coded(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

export const ORIGINS = ['chains', 'fm-entry', 'structure'];
export const DESTINATIONS = ['foldseek', 'multimer', 'foldmason', 'folddisco'];

/** Destinations that require a query set. */
const MULTI_INPUT_DESTINATIONS = new Set(['foldmason']);

function isCif(text) {
    const head = text.trimStart();
    return head.startsWith('#') || head.startsWith('data_');
}

/** Add source accession and ticket provenance to a structure. */
export function provenanceRemark(text, { accession, db = null, ticket = null }) {
    const prefix = isCif(text) ? '# ' : 'REMARK  99 ';
    let firstline = `${prefix}Accession: ${accession}${db ? `, DB: ${db}` : ''}`;
    if (!isCif(text) && firstline.length > 79) firstline = `${firstline.slice(0, 76)}... `;

    let second = '';
    if (ticket) {
        const t = ticket.length > 55 ? `${ticket.slice(0, 52)}...` : ticket;
        second = `${prefix}${`Imported from ${t}`.padEnd(69, ' ')}\n`;
    }
    return `${firstline.padEnd(80, ' ')}\n${second}${text}`;
}

/** A lazily resolved query with origin data and optional provenance. */
export class SubmittableQuery {
    constructor(client, spec, { label = null } = {}) {
        if (typeof spec !== 'function' && !ORIGINS.includes(spec?.kind)) {
            throw coded('INVALID_INPUT', `unknown query origin: ${JSON.stringify(spec?.kind)} ` +
                            `(expected one of ${ORIGINS.join(', ')})`);
        }
        this.client = client;
        this.label = label;
        this._resolver = typeof spec === 'function' ? spec : null;
        this.spec = this._resolver ? null : spec;
    }

    /** Resolve the source once. */
    async resolve() {
        if (this.spec) return this.spec;
        const spec = await this._resolver();
        if (!ORIGINS.includes(spec?.kind)) {
            throw coded('INVALID_INPUT', `unknown query origin: ${JSON.stringify(spec?.kind)} ` +
                            `(expected one of ${ORIGINS.join(', ')})`);
        }
        this.spec = spec;
        return spec;
    }

    /** Chain letters used in generated names. */
    _chainset(spec) {
        return `_${(spec.chains ?? []).map(c => c.chain).join('')}`;
    }

    /** Derive the source name from the first chain when needed. */
    _baseName(spec) {
        return spec.name ?? getAccession(spec.chains?.[0]?.target ?? 'query');
    }

    /** Build the structure representation required by a destination. */
    async build(tool, { signal } = {}) {
        if (!DESTINATIONS.includes(tool)) {
            throw coded('INVALID_INPUT', `unknown destination: ${JSON.stringify(tool)} ` +
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
        if (chains.length === 0) throw coded('INVALID_INPUT', 'this query has no chains to build from');
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

        // Foldseek and Multimer preserve real chain identifiers.
        return {
            pdb: multi ? mergePdbs(parts) : parts[0].pdb,
            name: multi ? `${base}${this._chainset(spec)}` : base,
            isMultimer: multi,
            ...motif,
        };
    }

    /** Reconstruct full atoms and report upstream failures against the source name. */
    async _reconstruct(text, signal, name) {
        try {
            return await reconstructFullAtom(text, {
                cg2allUrl: this.client.cg2allUrl, signal, fetchImpl: this.client.fetchImpl,
            });
        } catch (err) {
            if (err?.name === 'AbortError') throw err;
            throw coded('UPSTREAM_FAILED', `could not reconstruct ${name}: ${err.message}`);
        }
    }

    /** The `{name, content}` pair a FoldMason submission wants for this query. */
    async buildFile(opts = {}) {
        const built = await this.build('foldmason', opts);
        return { name: ensureStructureExtension(built.name, built.pdb), content: built.pdb };
    }

    /** Build and submit to a single-query destination. */
    async sendTo({
        tool, databases = null, mode = '3diaa', motif = null, taxFilter = '', email = '',
        iterativeSearch = false, remark = true, signal = undefined,
    } = {}) {
        if (MULTI_INPUT_DESTINATIONS.has(tool)) {
            throw coded('INVALID_INPUT', 'FoldMason requires two or more structures');
        }
        const built = await this.build(tool, { signal });
        if (tool === 'folddisco' && motif && built.motif) {
            const err = new Error(
                'this source already carries a motif, so supplying one would let the two disagree - ' +
                'change the source selection instead');
            err.code = 'INVALID_INPUT';
            throw err;
        }
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
        const motifSource = tool !== 'folddisco' ? null
            : motif ? 'caller'
            : built.motif ? (this.spec.motifSource ?? 'hit')
            : null;
        return this._recordLineage(ticket, tool, built, { motifSource });
    }

    /** Record the source ticket and selection used for forwarding. */
    async _recordLineage(ticket, tool, built, { motifSource = null } = {}) {
        const source = this.spec?.ticket;
        if (!source) return ticket;
        const derivedFrom = {
            ticket: source,
            origin: this.spec.kind,
            tool,
            ...(this.spec.lineage ?? {}),
            ...(motifSource ? { motifSource } : {}),
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

/** A set of queries submitted together to FoldMason. */
export class QuerySet {
    constructor(client, queries, { ticket = null, queryIdx = 0, description = null } = {}) {
        this.client = client;
        this.queries = queries;
        this.ticket = ticket;
        this.queryIdx = queryIdx;
        this.description = description;
    }

    get length() { return this.queries.length; }

    /** Submit one query elsewhere or build a bounded-concurrency FoldMason file set. */
    async sendTo({ tool, includeQuery = true, concurrency = 8, email = '', signal, ...rest } = {}) {
        if (tool !== 'foldmason') {
            if (this.queries.length !== 1) {
                throw coded('INVALID_INPUT', `${tool} takes one query; this selection has ${this.queries.length}. ` +
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
            const original = await this.client.getQueryStructure(this.ticket)
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
                queryIdx: this.queryIdx,
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

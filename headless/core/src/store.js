// Filesystem cache for ticket metadata and completed results.
//
// Layout mirrors the backend's own job-directory sharding, so a ticket's cache entry is easy to
// line up with its server-side job dir:
//
//   <stateDir>/tickets/<id[0:2]>/<id[2:4]>/<id>/
//     ticket.json          { id, kind, submittedAt, lastPolledAt, lastStatus, request }
//     result-<entry>.json  parsed search result, one file per query entry
//     foldmason.json       one payload per ticket — the endpoint has no entry index
//     folddisco.json       same reasoning

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

/** Ticket ids are base64url from the backend. Reject anything else rather than build a path from it. */
const SAFE_ID = /^[A-Za-z0-9_-]{4,}$/;

/** Selection names are object keys in a file that is read back and spread. */
const SAFE_SELECTION_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const RESERVED_SELECTION_NAMES = new Set(['__proto__', 'prototype', 'constructor']);

export function assertSelectionName(name) {
    if (typeof name !== 'string' || !SAFE_SELECTION_NAME.test(name)
        || RESERVED_SELECTION_NAMES.has(name)) {
        const err = new Error(
            `invalid selection name: ${JSON.stringify(name)} — expected 1-64 characters of ` +
            'letters, digits, dot, dash or underscore, starting alphanumeric ' +
            `(and not one of ${[...RESERVED_SELECTION_NAMES].join(', ')})`);
        err.code = 'SELECTION_NAME_INVALID';
        throw err;
    }
    return name;
}

function coded(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

export function defaultStateDir() {
    return process.env.MMSEQS2_AGENT_STATE_DIR || path.join(os.homedir(), '.mmseqs2-agent');
}

/**
 * What we keep about a submission — deliberately not the submission itself.
 *
 * The raw query is the one unbounded field in the whole record: 1CRN, a 46-residue protein and
 * about the smallest real structure available, is 69 KB as mmCIF, and multimer queries reach into
 * the megabytes. Caching it buys nothing — the server already has it, and the result is what a
 * caller comes back for — while turning a ~300 byte record into a ~70 KB one, which is the
 * difference between a 10,000-ticket cache costing 3 MB and costing 700 MB.
 *
 * Length plus a hash prefix keeps the useful part: "is this the query I think it is" stays
 * answerable, without storing it.
 */
export function summarizeRequest(request = {}) {
    const { query, files, ...rest } = request;
    const summary = { ...rest };
    if (typeof query === 'string') {
        summary.queryBytes = Buffer.byteLength(query);
        summary.queryHash = crypto.createHash('sha256').update(query).digest('hex').slice(0, 16);
    }
    if (Array.isArray(files)) {
        summary.files = files.map(f => ({
            name: f.name,
            bytes: Buffer.byteLength(f.content ?? ''),
        }));
    }
    return summary;
}

export class Store {
    constructor(stateDir = defaultStateDir()) {
        this.stateDir = stateDir;
    }

    ticketDir(id) {
        if (!SAFE_ID.test(id)) throw new Error(`refusing to build a cache path from ticket id: ${JSON.stringify(id)}`);
        return path.join(this.stateDir, 'tickets', id.slice(0, 2), id.slice(2, 4), id);
    }

    async #readJson(file) {
        try {
            return JSON.parse(await fs.readFile(file, 'utf8'));
        } catch (err) {
            if (err.code === 'ENOENT') return null;
            throw err;
        }
    }

    async #writeJson(file, value) {
        await fs.mkdir(path.dirname(file), { recursive: true });
        const tmp = `${file}.tmp-${crypto.randomBytes(6).toString('hex')}`;
        await fs.writeFile(tmp, JSON.stringify(value));
        await fs.rename(tmp, file);
    }

    readTicket(id) {
        return this.#readJson(path.join(this.ticketDir(id), 'ticket.json'));
    }

    async writeTicket(id, patch) {
        const existing = (await this.readTicket(id)) || { id };
        const merged = { ...existing, ...patch, id };
        await this.#writeJson(path.join(this.ticketDir(id), 'ticket.json'), merged);
        return merged;
    }

    #resultFile(id, kind, entry) {
        if (kind === 'foldmason') return path.join(this.ticketDir(id), 'foldmason.json');
        if (kind === 'folddisco') return path.join(this.ticketDir(id), 'folddisco.json');
        return path.join(this.ticketDir(id), `result-${entry}.json`);
    }

    async readResult(id, kind, entry = 0) {
        const file = this.#resultFile(id, kind, entry);
        const value = await this.#readJson(file);
        if (value !== null) {
            const at = new Date();
            await fs.utimes(file, at, at).catch(() => {});
        }
        return value;
    }

    writeResult(id, kind, entry, value) {
        return this.#writeJson(this.#resultFile(id, kind, entry), value);
    }

    #selectionFile(id) {
        return path.join(this.ticketDir(id), 'selections.json');
    }

    /** Null-prototype: these keys come from a file, and one of them could be spelled __proto__. */
    async readSelections(id) {
        const stored = await this.#readJson(this.#selectionFile(id));
        const all = Object.create(null);
        for (const [name, record] of Object.entries(stored ?? {})) {
            if (RESERVED_SELECTION_NAMES.has(name)) continue;
            all[name] = record;
        }
        return all;
    }

    async readSelection(id, name = 'default') {
        const all = await this.readSelections(id);
        return Object.hasOwn(all, name) ? all[name] : null;
    }

    /** Merge-write, so saving one selection never drops another. */
    async writeSelection(id, name, payload) {
        assertSelectionName(name);
        const all = await this.readSelections(id);
        const now = new Date().toISOString();
        const record = {
            ...payload,
            name,
            createdAt: Object.hasOwn(all, name) ? all[name].createdAt ?? now : now,
            updatedAt: now,
        };
        all[name] = record;
        await this.#writeJson(this.#selectionFile(id), { ...all });
        return record;
    }

    async deleteSelection(id, name) {
        assertSelectionName(name);
        const all = await this.readSelections(id);
        if (!Object.hasOwn(all, name)) return false;
        delete all[name];
        await this.#writeJson(this.#selectionFile(id), { ...all });
        return true;
    }

    /**
     * Copy a selection under a new name, so the original can be left exactly as a forwarded job
     * recorded it. A deep copy: later edits to either name must not reach the other.
     */
    async copySelection(id, fromName, toName) {
        assertSelectionName(fromName);
        assertSelectionName(toName);
        if (fromName === toName) {
            throw coded('SELECTION_COLLISION', `"${toName}" is already the source of the copy`);
        }
        const all = await this.readSelections(id);
        if (!Object.hasOwn(all, fromName)) {
            throw coded('SELECTION_NOT_FOUND', `no saved selection named "${fromName}" on ${id}`);
        }
        if (Object.hasOwn(all, toName)) {
            throw coded('SELECTION_COLLISION',
                `a selection named "${toName}" already exists on ${id} — copying never overwrites`);
        }
        const source = all[fromName];
        const now = new Date().toISOString();
        const record = { ...structuredClone(source), name: toName, createdAt: now, updatedAt: now };
        all[toName] = record;
        await this.#writeJson(this.#selectionFile(id), { ...all });
        return record;
    }

    /**
     * Names and sizes, without the lists themselves — enough to pick one to load.
     *
     * Two kinds of selection share this file: rows of a search result (`ids`) and columns of an
     * alignment (`columns`). They belong to different tickets, so they never mix in practice, but the
     * size is reported from whichever the record holds rather than assuming one.
     */
    async listSelections(id) {
        const all = await this.readSelections(id);
        return Object.values(all).map(({ ids, columns, ...rest }) => ({
            ...rest,
            size: (ids ?? columns)?.length ?? 0,
        }));
    }

    /** Whether a name exists, without reading its membership. */
    async hasSelection(id, name) {
        return Object.hasOwn(await this.readSelections(id), name);
    }

    /**
     * Walk the sharded tree. There is deliberately no index file: an index is a second source of
     * truth that can disagree with the directories it describes, and the walk is cheap — records
     * are ~300 bytes, so even 10,000 cached tickets read back as ~3 MB, dominated by syscalls
     * rather than memory. Reads within a shard run concurrently.
     *
     * Every record is read before `limit` applies, because ordering by submittedAt cannot be known
     * from the paths alone. If a cache ever grows large enough for that to hurt, the fix is an
     * ordering hint in the layout, not a partial scan that would silently drop recent tickets.
     */
    async listTickets({ limit = 100 } = {}) {
        const root = path.join(this.stateDir, 'tickets');
        const out = [];
        let outer;
        try {
            outer = await fs.readdir(root);
        } catch (err) {
            if (err.code === 'ENOENT') return [];
            throw err;
        }
        for (const a of outer) {
            let inner;
            try { inner = await fs.readdir(path.join(root, a)); } catch { continue; }
            for (const b of inner) {
                let ids;
                try { ids = await fs.readdir(path.join(root, a, b)); } catch { continue; }
                const batch = await Promise.all(
                    ids.map(id => this.#readJson(path.join(root, a, b, id, 'ticket.json'))),
                );
                for (const t of batch) if (t) out.push(t);
            }
        }
        out.sort((x, y) => String(y.submittedAt ?? '').localeCompare(String(x.submittedAt ?? '')));
        return out.slice(0, limit);
    }
}

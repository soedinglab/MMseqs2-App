// Filesystem cache for ticket metadata, completed results and named selections.

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';

/** Only backend-shaped ticket ids may become paths. */
const SAFE_ID = /^[A-Za-z0-9_-]{4,}$/;

/** Restrict persisted selection names and prototype keys. */
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
    return process.env.FOLDSEEK_SERVER_STATE_DIR || path.join(os.homedir(), '.foldseek-server');
}

/** Store only the query length and hash; the backend already owns the unbounded query text. */
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

    /** Read untrusted selection keys into a null-prototype object. */
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

    /** Merge one selection without dropping its siblings. */
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

    /** Deep-copy a selection so later edits cannot alter its source. */
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

    /** List selection names, kinds and sizes without their members. */
    async listSelections(id) {
        const all = await this.readSelections(id);
        return Object.values(all).map(({ ids, columns, ...rest }) => ({
            ...rest,
            size: (ids ?? columns)?.length ?? 0,
        }));
    }

}

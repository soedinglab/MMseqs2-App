// Read, cache and summarize ticket results.

import { parseResults, parseResultsFoldDisco } from '../../../frontend/lib/parseResults.js';
import { getChainName } from '../../../frontend/lib/targetName.js';
import { listChains } from '../../../frontend/lib/structureText.js';
import { mockPDB, encodeMultimer } from '../../../frontend/lib/pdbAssembly.js';
import { pathForTicket } from '../../../frontend/lib/ticketRoute.js';
import { createResultTable } from './table.js';
import { fetchFoldDiscoStructure, ensureStructureExtension } from './structures.js';
import { TERMINAL_STATUSES, kindForJobType, normalizeQueryIdx } from './facts.js';
import { resultSummary, notReadySummary } from './summary.js';

const PARSED_CACHE_SIZE = 16;

function coded(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

export function createResultService({
    backend,
    store,
    getDatabases,
    resultRowCap = null,
} = {}) {
    if (!backend) throw new Error('createResultService({ backend }) is required');
    if (!store) throw new Error('createResultService({ store }) is required');

    const parsedResults = new Map();
    const memo = async (key, load) => {
        if (parsedResults.has(key)) return parsedResults.get(key);
        const value = await load();
        if (parsedResults.size >= PARSED_CACHE_SIZE) {
            parsedResults.delete(parsedResults.keys().next().value);
        }
        parsedResults.set(key, value);
        return value;
    };

    const results = {
        async pollTicket(ticket) {
            const res = await backend.pollTicket(ticket);
            await store.writeTicket(ticket, {
                lastStatus: res.status,
                lastPolledAt: new Date().toISOString(),
            });
            return res;
        },

        async resultUrl(ticket, { entry = 0 } = {}) {
            const { type } = await results.getTicketType(ticket).catch(() => ({ type: null }));
            return `${backend.baseUrl}${pathForTicket(ticket, type, { entry })}`;
        },

        async getTicketType(ticket) {
            const cached = await store.readTicket(ticket);
            if (cached?.jobType) return { type: cached.jobType };
            const res = await backend.getTicketType(ticket);
            let kind = null;
            try { kind = kindForJobType(res.type); } catch { /* unsupported: kind stays null */ }
            await store.writeTicket(ticket, { jobType: res.type, kind });
            return res;
        },

        getTicketRecord(ticket) {
            return store.readTicket(ticket);
        },

        async getResult(ticket, entry = 0) {
            const data = await memo(`search:${ticket}:${entry}`, async () => {
                const cached = await store.readResult(ticket, 'search', entry);
                if (cached) return cached;
                const value = parseResults(await backend.getResult(ticket, entry));
                await store.writeResult(ticket, 'search', entry, value);
                return value;
            });
            return createResultTable(data, { ticket, queryIdx: entry });
        },

        getFoldMasonResult(ticket) {
            return memo(`foldmason:${ticket}`, async () => {
                const cached = await store.readResult(ticket, 'foldmason');
                if (cached) return cached;
                const res = await backend.getFoldMasonResult(ticket);
                await store.writeResult(ticket, 'foldmason', 0, res);
                return res;
            });
        },

        async getFoldDiscoResult(ticket) {
            const data = await memo(`folddisco:${ticket}`, async () => {
                const cached = await store.readResult(ticket, 'folddisco');
                if (cached) return cached;
                const value = parseResultsFoldDisco(await backend.getFoldDiscoResult(ticket));
                await store.writeResult(ticket, 'folddisco', 0, value);
                return value;
            });
            return createResultTable(data, { ticket, queryIdx: 0, tool: 'folddisco' });
        },

        async getResultTable(ticket, { queryIdx = 0 } = {}) {
            const { type } = await results.getTicketType(ticket);
            return type === 'folddisco'
                ? results.getFoldDiscoResult(ticket)
                : results.getResult(ticket, queryIdx);
        },

        getFoldDiscoTargetStructure(ticket, opts) {
            return fetchFoldDiscoStructure(backend.request, ticket, opts);
        },

        getQueries(ticket, { limit = 200, page = 0 } = {}) {
            return backend.getQueries(ticket, { limit, page });
        },

        async getHitChains(ticket, { queryIdx = 0, db, idx, signal } = {}) {
            if (db === undefined || idx === undefined) {
                throw new Error('getHitChains({ db, idx }) is required');
            }
            const rows = await backend.getHitRows(ticket, { queryIdx, db, idx, signal });
            if (!Array.isArray(rows) || rows.length === 0) {
                throw new Error(`no hit at index ${idx} in ${db} for ticket ${ticket}`);
            }
            return rows.map(r => ({
                ca: r.tCa, seq: r.tSeq, chain: getChainName(r.target), target: r.target,
            }));
        },

        async getQueryStructure(ticket, { signal, encodeComplex = true } = {}) {
            const text = await backend.getQueryStructure(ticket, { signal });
            if (encodeComplex) {
                const chains = listChains(text);
                if (chains.length > 1) {
                    const parts = chains.map(c => ({ pdb: mockPDB(c.ca, c.seq, c.chain), chain: c.chain }));
                    const { pdb, suffix } = encodeMultimer(parts);
                    return { name: `query${suffix}`, content: pdb, chains: chains.length };
                }
            }
            return { name: ensureStructureExtension('query', text), content: text };
        },

        async resolveUnit(ticket, queryIdx = 0) {
            const { type: jobType } = await results.getTicketType(ticket);
            const { queryIdx: index } = normalizeQueryIdx(jobType, queryIdx);
            const kind = kindForJobType(jobType);

            if (index > 0) {
                const list = await results.getQueries(ticket, { limit: 1000 }).catch(() => null);
                const count = list?.lookup?.length ?? null;
                if (count !== null && index >= count) {
                    throw coded('QUERY_IDX_OUT_OF_RANGE',
                        `queryIdx ${index} is past the end of ${ticket}: it holds ${count} `
                        + `quer${count === 1 ? 'y' : 'ies'}, so valid values are 0..${count - 1}`);
                }
            }

            const cached = await store.readTicket(ticket).catch(() => null);
            const status = TERMINAL_STATUSES.has(cached?.lastStatus)
                ? cached.lastStatus
                : (await results.pollTicket(ticket)).status;
            const unit = { ticket, jobType, kind, status, queryIdx: index, record: cached };
            if (status !== 'COMPLETE') return unit;

            if (kind === 'foldmason') unit.foldMasonResult = await results.getFoldMasonResult(ticket);
            else if (kind === 'folddisco') unit.table = await results.getFoldDiscoResult(ticket);
            else unit.table = await results.getResult(ticket, index);
            unit.record = await store.readTicket(ticket).catch(() => cached);
            return unit;
        },

        async getResultSummary(ticket, queryIdx = 0) {
            const unit = await results.resolveUnit(ticket, queryIdx);
            if (unit.status !== 'COMPLETE') return notReadySummary(unit);
            const [catalog, selections] = await Promise.all([
                getDatabases?.().catch(() => null) ?? null,
                store.listSelections(ticket).catch(() => []),
            ]);
            return resultSummary({ ...unit, catalog, selections, configuredCap: resultRowCap });
        },
    };

    return results;
}

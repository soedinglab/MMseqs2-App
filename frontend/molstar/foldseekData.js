import { Mat4 } from 'molstar/lib/mol-math/linear-algebra';
import { pulchra } from 'pulchra-wasm';
import { detectStructureFormat, mockPDB } from './molstarStructure.js';

export function getChainName(name) {
    if (!name || /_v[0-9]+$/.test(name)) return 'A';
    if (/^[A-Za-z0-9]$/.test(name)) return name;
    const pos = name.lastIndexOf('_');
    const chain = pos !== -1 ? name.substring(pos + 1, pos + 2) : '';
    return chain || 'A';
}

function getAccession(name) {
    if (!name || /_v[0-9]+$/.test(name)) return name;
    const pos = name.lastIndexOf('_');
    return pos !== -1 ? name.substring(0, pos) : name;
}

export async function prepareFoldseekStructureInput(ctx) {
    if (!ctx.alignments?.length || (ctx.structureMode !== 'interface' && typeof ctx.alignments[0].tCa === 'undefined')) {
        return emptyInput();
    }
    const query = await buildQuery(ctx);
    const activeQuery = selectActiveQuery(ctx);
    const target = ctx.structureMode === 'interface'
        ? await buildInterfaceTarget(ctx)
        : await buildTarget(ctx);
    const targetTransform = ctx.structureMode === 'multimer'
        ? computeMultimerTransform(ctx.alignments)
        : null;
    const superpositionAlignments = targetTransform || ctx.structureMode === 'interface'
        ? ctx.alignments
        : ctx.alignments.slice(0, 1);
    return {
        query,
        target,
        targetTransform,
        alignments: ctx.alignments,
        superpositionAlignments,
        hasQuery: Boolean(query),
        structureMode: ctx.structureMode || 'alignment',
        interfaceCutoff: ctx.interfaceCutoff || 10,
        queryIndex: queryIndex(ctx),
        queryChain: ctx.structureMode === 'multimer' || ctx.structureMode === 'interface'
            ? null
            : activeQueryChain(ctx, activeQuery),
    };
}

function emptyInput() {
    return {
        query: null,
        target: null,
        targetTransform: null,
        hasQuery: false,
        structureMode: 'alignment',
        interfaceCutoff: 10,
    };
}

async function buildQuery(ctx) {
    const data = await loadQueryData(ctx);
    if (!data) return null;

    const format = detectStructureFormat(data);
    return { data, format, label: 'query' };
}

async function loadQueryData(ctx) {
    const query = selectActiveQuery(ctx);
    if (!query) return '';
    const chain = getChainName(ctx.alignments?.[0]?.query);

    if (ctx.isLocal) {
        if (query.hasOwnProperty('pdb')) return JSON.parse(query.pdb);
        return mockPDB(query.qCa, query.sequence, chain);
    }

    if (ctx.route.params.ticket.startsWith('user-')) {
        if (query.hasOwnProperty('pdb')) return JSON.parse(query.pdb);
        const localData = ctx.root.userData[ctx.route.params.entry];
        const localQuery = selectQueryByName(localData?.queries, ctx.alignments?.[0]?.query)
            || selectQueryByIndex(localData?.queries, queryIndex(ctx))
            || localData?.queries?.[0];
        return localQuery ? mockPDB(localQuery.qCa, localQuery.sequence, chain) : '';
    }

    try {
        const request = await ctx.axios.get(`api/result/${ctx.route.params.ticket}/query`);
        return request.data;
    } catch (e) {
        return '';
    }
}

function selectActiveQuery(ctx) {
    return selectQueryByName(ctx.hits?.queries, ctx.alignments?.[0]?.query, { allowChainFallback: false })
        || selectQueryByIndex(ctx.hits?.queries, queryIndex(ctx))
        || selectQueryByName(ctx.hits?.queries, ctx.alignments?.[0]?.query, { allowChainFallback: true })
        || ctx.hits?.queries?.[0];
}

function selectQueryByName(queries, alignmentQuery, options = {}) {
    if (!queries?.length || !alignmentQuery) return null;
    const queryName = getAccession(alignmentQuery);
    const queryChain = getChainName(alignmentQuery);
    return queries.find(query => queryNameOf(query) === alignmentQuery)
        || queries.find(query => queryNameOf(query) === queryName)
        || (options.allowChainFallback ? queries.find(query => getChainName(queryNameOf(query)) === queryChain) : null)
        || null;
}

function queryNameOf(query) {
    return query?.name || query?.header || '';
}

function activeQueryChain(ctx, activeQuery) {
    const alignmentQuery = ctx.alignments?.[0]?.query || '';
    if (/^[A-Za-z0-9]$/.test(alignmentQuery)) return alignmentQuery;
    if (hasChainSuffix(alignmentQuery)) return getChainName(alignmentQuery);
    return getChainName(queryNameOf(activeQuery));
}

function hasChainSuffix(name) {
    return Boolean(name && !/_v[0-9]+$/.test(name) && name.lastIndexOf('_') !== -1);
}

function selectQueryByIndex(queries, index) {
    return Number.isInteger(index) && queries?.[index] ? queries[index] : null;
}

function queryIndex(ctx) {
    const value = Number.parseInt(ctx.route?.params?.entry, 10);
    return Number.isFinite(value) && value >= 0 ? value : 0;
}

async function buildTarget(ctx) {
    const targets = [];
    let lastIdx = null;
    let remoteData = null;
    let remoteOffset = 0;

    for (const alignment of ctx.alignments) {
        const chain = getChainName(alignment.target);
        let tSeq = alignment.tSeq;
        let tCa = alignment.tCa;

        if (Number.isInteger(alignment.tCa) && Number.isInteger(alignment.tSeq)) {
            const idx = alignment.tCa;
            if (idx !== lastIdx) {
                const response = await ctx.axios.get(
                    `api/result/${ctx.route.params.ticket}/${ctx.route.params.entry}?format=brief&index=${idx}&database=${alignment.db}`,
                );
                remoteData = response.data;
                remoteOffset = 0;
                lastIdx = idx;
            }
            if (Array.isArray(remoteData) && remoteData[remoteOffset]) {
                tSeq = remoteData[remoteOffset].tSeq;
                tCa = remoteData[remoteOffset].tCa;
                remoteOffset += 1;
            }
        }

        if (!tSeq || !tCa) continue;

        const mock = mockPDB(tCa, tSeq, chain, alignment.dbStartPos || 1);
        try {
            targets.push(applyChainId(await pulchra(mock), chain));
        } catch (e) {
            targets.push(mock);
        }
    }

    const data = mergePdbChunks(targets);
    return data ? { data, format: 'pdb', label: 'target' } : null;
}

async function buildInterfaceTarget(ctx) {
    const chunks = [];
    const seen = new Set();

    for (const alignment of ctx.alignments) {
        if (!alignment?.target || !alignment?.db) continue;
        const accession = getAccession(alignment.target);
        const key = `${alignment.db}:${accession}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const response = await ctx.axios.get(
            `api/result/interface/${ctx.route.params.ticket}?database=${encodeURIComponent(alignment.db)}&id=${encodeURIComponent(alignment.target)}`,
            {
                headers: { Accept: 'text/plain' },
                transformResponse: [(data) => data],
            },
        );
        chunks.push(response.data);
    }

    const data = mergePdbChunks(chunks);
    return data ? { data, format: 'pdb', label: 'target' } : null;
}

function computeMultimerTransform(alignments) {
    const first = alignments[0];
    if (!first?.complexu || !first?.complext) return null;
    const u = Array.isArray(first.complexu) ? first.complexu : String(first.complexu).split(',').map(Number);
    const t = Array.isArray(first.complext) ? first.complext : String(first.complext).split(',').map(Number);

    return Mat4.ofRows([
        [u[0], u[1], u[2], t[0]],
        [u[3], u[4], u[5], t[1]],
        [u[6], u[7], u[8], t[2]],
        [0, 0, 0, 1],
    ]);
}

function applyChainId(pdb, chain) {
    if (!pdb || !chain) return pdb;
    return pdb.split('\n').map((line) => {
        if (!line.startsWith('ATOM') && !line.startsWith('HETATM')) return line;
        return `${line.slice(0, 21)}${chain}${line.slice(22)}`;
    }).join('\n');
}

function mergePdbChunks(chunks) {
    return chunks
        .flatMap(chunk => (chunk || '').split(/\r?\n/).filter(line => line.startsWith('ATOM') || line.startsWith('HETATM')))
        .join('\n');
}

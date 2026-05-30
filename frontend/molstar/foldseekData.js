import { Mat4 } from 'molstar/lib/mol-math/linear-algebra';
import { pulchra } from 'pulchra-wasm';
import { getAccession, getChainName, mockPDB } from './foldseekUtilities.js';

export async function prepareFoldseekStructureInput(ctx) {
    if (!ctx.alignments?.length || (ctx.structureMode !== 'interface' && typeof ctx.alignments[0].tCa === 'undefined')) {
        return emptyInput();
    }
    const query = await buildQuery(ctx);
    const target = ctx.structureMode === 'interface'
        ? await buildInterfaceTarget(ctx)
        : await buildTarget(ctx);
    const targetTransform = computeMultimerTransform(ctx.alignments);
    return {
        query: query.source,
        target: target.source,
        targetTransform,
        alignments: ctx.alignments,
        hasQuery: Boolean(query.source),
        structureMode: ctx.structureMode || 'alignment',
        interfaceCutoff: ctx.interfaceCutoff || 10,
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
    if (!data) {
        return { source: null, pdb: '' };
    }

    const format = detectFormat(data);
    return {
        source: { data, format, label: 'query' },
        pdb: format === 'pdb' ? data : '',
    };
}

async function loadQueryData(ctx) {
    const query = ctx.hits?.queries?.[0];
    if (!query) return '';

    if (ctx.isLocal) {
        if (query.hasOwnProperty('pdb')) return JSON.parse(query.pdb);
        return mockPDB(query.qCa, query.sequence, 'A');
    }

    if (ctx.route.params.ticket.startsWith('user-')) {
        if (query.hasOwnProperty('pdb')) return JSON.parse(query.pdb);
        const localData = ctx.root.userData[ctx.route.params.entry];
        return mockPDB(localData.queries[0].qCa, localData.queries[0].sequence, 'A');
    }

    try {
        const request = await ctx.axios.get(`api/result/${ctx.route.params.ticket}/query`);
        return request.data;
    } catch (e) {
        return '';
    }
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

        const mock = mockPDB(tCa, tSeq, chain);
        try {
            targets.push(applyChainId(await pulchra(mock), chain));
        } catch (e) {
            targets.push(mock);
        }
    }

    const pdb = mergePdbChunks(targets);
    return {
        source: pdb ? { data: pdb, format: 'pdb', label: 'target' } : null,
        pdb,
    };
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

    const pdb = mergePdbChunks(chunks);
    return {
        source: pdb ? { data: pdb, format: 'pdb', label: 'target' } : null,
        pdb,
    };
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

function extractAtomLines(pdb) {
    if (!pdb) return [];
    return pdb.split(/\r?\n/).filter(line => line.startsWith('ATOM') || line.startsWith('HETATM'));
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
        .flatMap(chunk => extractAtomLines(chunk))
        .join('\n');
}

function detectFormat(data) {
    const trimmed = (data || '').trimStart();
    return trimmed.startsWith('#') || trimmed.startsWith('data_') ? 'mmcif' : 'pdb';
}

import { prepareFoldseekStructureInput } from './foldseekData.js';

export function thumbnailSceneInput(input, mode) {
    return {
        ...input,
        showQuery: mode === 2 ? input.showQuery : 1,
        showTarget: mode === 2 ? input.showTarget : 1,
        showArrows: false,
        queryAlpha: 0.9,
        targetAlpha: 0.7,
        representationQuality: 'thumbnail',
        highlightSelections: [],
        hoverSelection: null,
        focusSelection: null,
    };
}

export async function prepareThumbnailInput(ctx, item) {
    if (ctx.mode === 2) {
        return prepareFolddiscoInput(ctx, item);
    }

    return prepareFoldseekStructureInput({
        alignments: alignmentsForItem(item),
        hits: ctx.hits,
        axios: ctx.axios,
        route: ctx.route,
        root: ctx.root,
        isLocal: ctx.isLocal,
        structureMode: ctx.structureMode,
        interfaceCutoff: 10,
    });
}

function alignmentsForItem(item) {
    return (item.alignments || []).map(alignment => ({
        ...alignment,
        db: alignment.db || item.db,
    }));
}

async function prepareFolddiscoInput(ctx, item) {
    const alignment = alignmentsForItem(item)[0];
    if (!alignment || !ctx.queryPdb) return null;

    const targetPdb = await fetchFolddiscoTargetPdb(ctx, alignment, item.db);
    if (!targetPdb) return null;

    return {
        alignment,
        queryPdb: ctx.queryPdb,
        targetPdb,
        showQuery: 0,
        showTarget: 0,
    };
}

async function fetchFolddiscoTargetPdb(ctx, alignment, db) {
    const target = db?.startsWith('pdb') ? alignment.target : alignment.dbkey;
    if (!target) return null;

    const url = `api/result/folddisco/${ctx.route.params.ticket}?database=${db}&id=${target}`;
    const response = await ctx.axios.get(url, {
        transformResponse: [(data) => data],
    });
    return response.data;
}

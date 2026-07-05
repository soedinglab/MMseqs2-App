import { to_mmCIF } from 'molstar/lib/mol-model/structure/export/mmcif';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import {
    addUniformRepresentation,
    ballAndStickParams,
    cartoonParams,
    chainExpression,
    isValidLoci,
    loadStructureFromData,
    lociFromExpression,
    mat4FromCommaStrings,
    mergeExpressions,
    normalizedPdbSourceFromText,
    residueExpression,
    residueInfoFromLoci,
    representationRef,
    structuresMatch,
    transformStructureConformation,
} from './molstarStructure.js';

const QueryColor = 0x1e88e5;
const TargetColor = 0xffc107;
const QueryLightColor = 0xa5cff5;
const TargetLightColor = 0xffe699;
const MotifRadius = 0.28;

async function addRepresentation(plugin, structure, label, expression, color, alpha = 1, type = 'cartoon', qualityPreset = 'viewer') {
    return addUniformRepresentation(
        plugin,
        structure,
        {
            label,
            expression,
            color,
            type,
            typeParams: type === 'ball-and-stick'
                ? ballAndStickParams({ alpha, sizeFactor: MotifRadius })
                : cartoonParams({ alpha, sizeFactor: 0.2, qualityPreset }),
        },
    );
}

function parseMotif(value = '') {
    const residues = [];
    const chains = new Set();
    const seen = new Set();
    for (const raw of String(value).split(',')) {
        const item = raw.trim();
        if (!item || item === '_') continue;
        const [chain, numeric] = splitAlphaNum(item);
        const residue = Number(numeric);
        if (!chain || !Number.isFinite(residue)) continue;
        const key = `${chain}:${residue}`;
        if (seen.has(key)) continue;
        seen.add(key);
        residues.push({ chain, residue });
        chains.add(chain);
    }
    return { residues, chains: Array.from(chains) };
}

function splitAlphaNum(str) {
    const value = String(str || '');
    const len = value.length;
    let i = 0;
    while (i < len) {
        const cc = value.charCodeAt(i);
        if (cc >= 48 && cc <= 57) break;
        i++;
    }
    let j = i;
    while (j < len) {
        const cc = value.charCodeAt(j);
        if (cc < 48 || cc > 57) break;
        j++;
    }
    return [value.slice(0, i), value.slice(i, j)];
}

function motifExpression(motif) {
    return mergeExpressions(parseMotif(motif).residues.map(({ chain, residue }) => residueExpression(chain, residue)));
}

function chainSetExpression(motif) {
    return mergeExpressions(parseMotif(motif).chains.map(chainExpression));
}

function nonChainSetExpression(motif) {
    const chains = chainSetExpression(motif);
    if (!chains) return null;
    return MS.struct.modifier.exceptBy({
        0: MS.struct.generator.all(),
        by: chains,
    });
}

async function deleteReprGroup(plugin, state) {
    for (const ref of state.reprRefs || []) {
        await plugin.state.data.build().delete(ref).commit();
    }
    state.reprRefs = [];
}

async function addRepr(plugin, state, input, structure, label, expression, color, alpha, type) {
    const repr = await addRepresentation(
        plugin,
        structure,
        label,
        expression,
        color,
        alpha,
        type,
        input?.representationQuality || 'viewer',
    );
    const ref = representationRef(repr);
    if (ref) state.reprRefs.push(ref);
}

async function applyRepresentations(plugin, state, input) {
    const key = `${input.showQuery}:${input.showTarget}:${input.alignment?.queryresidues}:${input.alignment?.targetresidues}`;
    if (state.reprKey === key) return;
    state.reprKey = key;
    await deleteReprGroup(plugin, state);

    const queryMotif = motifExpression(input.alignment?.queryresidues);
    const targetMotif = motifExpression(input.alignment?.targetresidues);
    const queryChains = chainSetExpression(input.alignment?.queryresidues);
    const targetChains = chainSetExpression(input.alignment?.targetresidues);

    if (input.showQuery === 2) {
        await addRepr(plugin, state, input, state.query, 'query-rest', nonChainSetExpression(input.alignment?.queryresidues), QueryLightColor, 0.3, 'cartoon');
    }
    if (input.showQuery >= 1) {
        await addRepr(plugin, state, input, state.query, 'query-matched', queryChains, QueryLightColor, 0.8, 'cartoon');
    }
    await addRepr(plugin, state, input, state.query, 'query-motif', queryMotif, QueryColor, 1, 'ball-and-stick');

    if (input.showTarget === 2) {
        await addRepr(plugin, state, input, state.target, 'target-rest', nonChainSetExpression(input.alignment?.targetresidues), TargetLightColor, 0.3, 'cartoon');
    }
    if (input.showTarget >= 1) {
        await addRepr(plugin, state, input, state.target, 'target-matched', targetChains, TargetLightColor, 0.8, 'cartoon');
    }
    await addRepr(plugin, state, input, state.target, 'target-motif', targetMotif, TargetColor, 1, 'ball-and-stick');
}

function resetSceneState(state) {
    state.query = null;
    state.target = null;
    state.reprRefs = [];
    state.reprKey = null;
}

async function rebuildScene(plugin, state, input) {
    await plugin.clear();
    resetSceneState(state);

    state.query = await loadStructureFromData(plugin, normalizedPdbSourceFromText(input.queryPdb, 'queryStructure'));
    const targetSource = normalizedPdbSourceFromText(input.targetPdb, 'targetStructure', { dropConect: true });
    const targetTransform = mat4FromCommaStrings(input.alignment?.tmat, input.alignment?.umat);
    state.target = await loadStructureFromData(plugin, targetSource, 'targetStructure');
    state.target = await transformStructureConformation(plugin, state.target, targetTransform);
    await applyRepresentations(plugin, state, input);
    const loci = lociFromExpression(state.query, motifExpression(input.alignment?.queryresidues));
    if (loci) plugin.managers.camera.focusLoci(loci, { durationMs: 100, extraRadius: 10, minRadius: 5 });
    else plugin.managers.camera.reset();
}

function structureEvent(state, current, type) {
    if (!isValidLoci(current?.loci)) {
        return { type, hasLoci: false };
    }
    const side = structuresMatch(current.loci.structure, state.query?.cell?.obj?.data)
        ? 'query'
        : 'target';
    const residue = residueInfoFromLoci(current.loci);
    if (!residue) return { type, side, hasLoci: true };

    return {
        type,
        side,
        hasLoci: true,
        chain: residue.chain,
        residue: residue.residue,
        residueName: residue.threeLetter,
    };
}

function makeCIF(state) {
    const blocks = [];
    const query = state.query?.cell?.obj?.data;
    const target = state.target?.cell?.obj?.data;
    if (query) blocks.push(to_mmCIF('query', query, false, { copyAllCategories: false }));
    if (target) blocks.push(to_mmCIF('target', target, false, { copyAllCategories: false }));
    return blocks.join('\n');
}

export const folddiscoResult = {
    async update(plugin, state, input) {
        const key = `${input.alignment?.dbkey || input.alignment?.target}:${input.alignment?.queryresidues}:${input.alignment?.targetresidues}`;
        if (state.loadKey !== key) {
            state.loadKey = key;
            state.queryPdbSource = input.queryPdb;
            state.targetPdbSource = input.targetPdb;
            await rebuildScene(plugin, state, input);
            return;
        }
        if (state.queryPdbSource !== input.queryPdb || state.targetPdbSource !== input.targetPdb) {
            state.queryPdbSource = input.queryPdb;
            state.targetPdbSource = input.targetPdb;
            await rebuildScene(plugin, state, input);
            return;
        }
        await applyRepresentations(plugin, state, input);
    },

    onHover(plugin, state, input, event) {
        return structureEvent(state, event?.current, 'structure-hover');
    },

    resetView(plugin, state, input, options = {}) {
        const loci = lociFromExpression(state.query, motifExpression(input.alignment?.queryresidues));
        if (loci) plugin.managers.camera.focusLoci(loci, { durationMs: options.durationMs ?? 250, extraRadius: 10, minRadius: 5 });
        else plugin.managers.camera.reset();
    },

    async makeCIF(plugin, state) {
        return makeCIF(state);
    },
};

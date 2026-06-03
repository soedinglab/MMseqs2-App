import { Mat4 } from 'molstar/lib/mol-math/linear-algebra';
import { QueryContext, StructureElement, StructureSelection } from 'molstar/lib/mol-model/structure';
import { to_mmCIF } from 'molstar/lib/mol-model/structure/export/mmcif';
import { compile } from 'molstar/lib/mol-script/runtime/query/compiler';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { mockPDB } from './foldseekUtilities.js';
import { loadStructureFromData, normalizedPdbSourceFromText } from './io.js';
import { isValidLoci, residueInfoFromLoci, structuresMatch } from './interactions.js';
import { addUniformRepresentation, ballAndStickParams, cartoonParams } from './representations.js';
import { transformStructureConformation } from './transforms.js';

const QueryColor = 0x1e88e5;
const TargetColor = 0xffc107;
const QueryLightColor = 0xa5cff5;
const TargetLightColor = 0xffe699;
const MotifRadius = 0.28;

function transformParams(alignment) {
    const t = String(alignment?.tmat || '').split(',').map(Number);
    const u = String(alignment?.umat || '').split(',').map(Number);
    if (t.length < 3 || u.length < 9 || t.some(Number.isNaN) || u.some(Number.isNaN)) return null;
    return {
        t,
        u: [
            [u[0], u[1], u[2]],
            [u[3], u[4], u[5]],
            [u[6], u[7], u[8]],
        ],
    };
}

function makeMat4({ t, u }) {
    return Mat4.ofRows([
        [u[0][0], u[0][1], u[0][2], t[0]],
        [u[1][0], u[1][1], u[1][2], t[1]],
        [u[2][0], u[2][1], u[2][2], t[2]],
        [0, 0, 0, 1],
    ]);
}

async function transformStructure(plugin, structure, params) {
    if (!params) return structure;
    return transformStructureConformation(plugin, structure, makeMat4(params));
}

async function addRepresentation(plugin, structure, label, expression, color, alpha = 1, type = 'cartoon', qualityPreset = 'viewer') {
    const item = await addUniformRepresentation(plugin, structure, {
        label,
        type,
        color,
        expression,
        typeParams: type === 'ball-and-stick'
            ? ballAndStickParams({ alpha, sizeFactor: MotifRadius })
            : cartoonParams({ alpha, sizeFactor: 0.2, qualityPreset }),
    });
    return item?.representation || null;
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

function atomGroupExpression(chain, residue) {
    const { or } = MS.core.logic;
    const { eq } = MS.core.rel;
    const { macromolecular } = MS.struct.atomProperty;
    return MS.struct.generator.atomGroups({
        'chain-test': or([
            eq([macromolecular.auth_asym_id(), chain]),
            eq([macromolecular.label_asym_id(), chain]),
        ]),
        'residue-test': or([
            eq([macromolecular.auth_seq_id(), residue]),
            eq([macromolecular.label_seq_id(), residue]),
        ]),
    });
}

function chainExpression(chain) {
    const { or } = MS.core.logic;
    const { eq } = MS.core.rel;
    const { macromolecular } = MS.struct.atomProperty;
    return MS.struct.generator.atomGroups({
        'chain-test': or([
            eq([macromolecular.auth_asym_id(), chain]),
            eq([macromolecular.label_asym_id(), chain]),
        ]),
    });
}

function mergeExpressions(expressions) {
    const valid = expressions.filter(Boolean);
    if (valid.length === 0) return null;
    if (valid.length === 1) return valid[0];
    return MS.struct.combinator.merge(valid.map(expression => MS.struct.modifier.union([expression])));
}

function motifExpression(motif) {
    return mergeExpressions(parseMotif(motif).residues.map(({ chain, residue }) => atomGroupExpression(chain, residue)));
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
    const ref = repr?.ref || repr?.cell?.transform?.ref;
    if (ref) state.reprRefs.push(ref);
}

function targetMotifSource(alignment) {
    if (!alignment?.tCa) return null;
    return {
        data: mockPDB(alignment.tCa, '', 'A'),
        format: 'pdb',
        label: 'targetMotifStructure',
    };
}

async function applyRepresentations(plugin, state, input) {
    const key = `${input.showQuery}:${input.showTarget}:${input.alignment?.queryresidues}:${input.alignment?.targetresidues}`;
    if (state.reprKey === key) return;
    state.reprKey = key;
    await deleteReprGroup(plugin, state);

    const queryMotif = motifExpression(input.alignment?.queryresidues);
    const targetMotif = state.targetMotif ? MS.struct.generator.all() : motifExpression(input.alignment?.targetresidues);
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
    await addRepr(plugin, state, input, state.targetMotif || state.target, 'target-motif', targetMotif, TargetColor, 1, 'ball-and-stick');
}

function resetSceneState(state) {
    state.query = null;
    state.target = null;
    state.targetMotif = null;
    state.reprRefs = [];
    state.reprKey = null;
}

async function rebuildScene(plugin, state, input) {
    await plugin.clear();
    resetSceneState(state);

    state.query = await loadStructureFromData(plugin, normalizedPdbSourceFromText(input.queryPdb, 'queryStructure'));
    const targetSource = normalizedPdbSourceFromText(input.targetPdb, 'targetStructure');
    const targetTransform = transformParams(input.alignment);
    state.target = await loadStructureFromData(plugin, targetSource, 'targetStructure');
    state.target = await transformStructure(plugin, state.target, targetTransform);
    const motifSource = targetMotifSource(input.alignment);
    if (motifSource) {
        state.targetMotif = await loadStructureFromData(plugin, motifSource, 'targetMotifStructure');
        state.targetMotif = await transformStructure(plugin, state.targetMotif, targetTransform);
    }
    await applyRepresentations(plugin, state, input);
    const loci = lociFromExpression(state.query, motifExpression(input.alignment?.queryresidues));
    if (loci) plugin.managers.camera.focusLoci(loci, { durationMs: 100, extraRadius: 10, minRadius: 5 });
    else plugin.managers.camera.reset();
}

function lociFromExpression(structureRef, expression) {
    const structure = structureRef?.cell?.obj?.data;
    if (!structure || !expression) return null;
    const query = compile(expression);
    const selection = query(new QueryContext(structure));
    const loci = StructureSelection.toLociWithSourceUnits(selection);
    return StructureElement.Loci.isEmpty(loci) ? null : loci;
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
    async mount() {
        return {};
    },

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

    resetView(plugin, state, input) {
        const loci = lociFromExpression(state.query, motifExpression(input.alignment?.queryresidues));
        if (loci) plugin.managers.camera.focusLoci(loci, { durationMs: 250, extraRadius: 10, minRadius: 5 });
        else plugin.managers.camera.reset();
    },

    async makeCIF(plugin, state) {
        return makeCIF(state);
    },

    async dispose(plugin) {
        await plugin?.clear?.();
    },
};

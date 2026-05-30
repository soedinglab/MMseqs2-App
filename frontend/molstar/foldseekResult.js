import { OrderedSet } from 'molstar/lib/mol-data/int';
import { QueryContext, StructureElement, StructureProperties, StructureSelection } from 'molstar/lib/mol-model/structure';
import { to_mmCIF } from 'molstar/lib/mol-model/structure/export/mmcif';
import { compile } from 'molstar/lib/mol-script/runtime/query/compiler';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { setSubtreeVisibility } from 'molstar/lib/mol-plugin/behavior/static/state';
import { Color } from 'molstar/lib/mol-util/color';
import {
    alignmentRegions,
    atomGroupExpression,
    backgroundExpressionForMode,
    baseSelectionExpressionForMode,
    chainColorEntries,
    computeInterfaceRegions,
    interfaceExpressionForChain,
    mergeSelectionExpressions,
    selectionExpressionForChains,
    structureSelectionExpression,
} from './foldseekSelections.js';
import { superposeTargetWithFoldseekAlignment, transformStructure } from './foldseekSuperposition.js';
import { setArrows } from './foldseekArrows.js';

const QueryChainSurfaceColors = [
    0x991999,
    0x00bfbf,
    0xe9967a,
    0x009e73,
    0xf0e442,
    0x0072b2,
    0xd55e00,
    0xcc79a7,
];
const InterfacePalettes = {
    query: [0x1e88e5, 0xe53935, 0x991999, 0x00bfbf],
    target: [0xffc107, 0x43a047, 0xe9967a, 0x009e73],
};

async function buildStructureRepresentations(plugin, state, structure, side, input, color, alignedColor) {
    if (input?.structureMode === 'interface') {
        return buildInterfaceStructureRepresentations(plugin, state, structure, side, input);
    }

    const mode = input[`show${capitalize(side)}`] || 0;
    const type = input[`${side}Representation`] || 'cartoon';
    const aligned = await addRepresentation(
        plugin,
        structure,
        `${side}-aligned`,
        type,
        alignedColor,
        baseSelectionExpressionForMode(state, input, side, 0),
        representationOverrides(input, side),
    );
    const stateEntry = {
        structure,
        type,
        mode,
        aligned,
        background: null,
        surfaces: await addChainSurfaces(plugin, structure, side, input),
        baseColor: color,
        alignedColor,
    };
    await setBackgroundRepresentation(plugin, state, stateEntry, input, side, mode);
    setSurfaceVisibility(plugin, stateEntry, input, side, mode);
    return stateEntry;
}

async function applyVisibility(plugin, state, input) {
    const queryMode = input?.showQuery || 0;
    const targetMode = input?.showTarget || 0;

    if (state.query) {
        await setSelectionMode(plugin, state, state.query, input, 'query', queryMode);
    }
    if (state.target) {
        await setSelectionMode(plugin, state, state.target, input, 'target', targetMode);
    }
    await setArrows(plugin, state, input);
}

function representationTypeParams(type, overrides = {}) {
    if (type === 'cartoon') {
        return {
            quality: 'higher',
            ignoreLight: false,
            sizeFactor: 0.25,
            visuals: ['polymer-trace', 'polymer-gap'],
            helixProfile: 'rounded',
            nucleicProfile: 'rounded',
            linearSegments: 10,
            radialSegments: 16,
            material: {
                metalness: 0,
                roughness: 0.55,
                bumpiness: 0.1,
            },
            ...overrides,
        };
    }

    return {
        quality: 'higher',
        ignoreLight: false,
        ...overrides,
    };
}

async function addRepresentation(plugin, structure, label, type, color, expression = MS.struct.generator.all(), typeParams = {}) {
    const component = await plugin.builders.structure.tryCreateComponentFromExpression(
        structure,
        expression,
        label,
        { label },
    );
    if (!component) return null;

    const representation = await plugin.builders.structure.representation.addRepresentation(component, {
        type,
        color: 'uniform',
        colorParams: { value: Color(color) },
        typeParams: representationTypeParams(type, typeParams),
    }, {
        tag: `${label}-representation`,
    });
    return { component, representation };
}

async function addChainSurfaces(plugin, structure, side, input) {
    if (input?.structureMode !== 'multimer' || side !== 'query') return [];

    const entries = querySurfaceEntries(input.alignments);

    const surfaces = [];
    for (const entry of entries) {
        const surface = await addRepresentation(
            plugin,
            structure,
            `${side}-${entry.chain}-${entry.level || 'surface'}`,
            'gaussian-surface',
            entry.color,
            entry.expression,
            {
                alpha: input.chainSurfaceAlpha || 0.18,
                visuals: ['gaussian-surface-mesh'],
                smoothness: 1.5,
                ignoreHydrogens: true,
                material: {
                    metalness: 0,
                    roughness: 0.35,
                    bumpiness: 0,
                },
            },
        );
        if (surface) surfaces.push({ ...surface, level: entry.level || 'base' });
    }
    return surfaces;
}

function querySurfaceEntries(alignments) {
    const byChain = new Map();
    for (const region of alignmentRegions(alignments, 'query')) {
        if (!byChain.has(region.chain)) byChain.set(region.chain, []);
        byChain.get(region.chain).push(atomGroupExpression(region.chain, region.start, region.end));
    }
    const entries = [];
    let i = 0;
    for (const [chain, expressions] of byChain.entries()) {
        const alignedExpression = mergeSelectionExpressions(expressions);
        const color = QueryChainSurfaceColors[i % QueryChainSurfaceColors.length];
        entries.push({
            chain,
            level: 'aligned',
            color,
            expression: alignedExpression,
        });
        entries.push({
            chain,
            level: 'unaligned',
            color,
            expression: MS.struct.modifier.exceptBy({
                0: atomGroupExpression(chain),
                by: alignedExpression,
            }),
        });
        i += 1;
    }

    const queryChains = selectionExpressionForChains(alignments, 'query');
    if (queryChains) {
        entries.push({
            chain: 'other',
            level: 'other',
            color: 0xcccccc,
            expression: MS.struct.modifier.exceptBy({
                0: MS.struct.generator.all(),
                by: queryChains,
            }),
        });
    }
    return entries;
}

async function buildInterfaceStructureRepresentations(plugin, state, structure, side, input) {
    const mode = input[`show${capitalize(side)}`] || 0;
    const type = input[`${side}Representation`] || 'cartoon';
    const aligned = [];

    for (const { chain, color } of chainColorEntries(input, side, InterfacePalettes)) {
        const expression = interfaceExpressionForChain(state, side, chain) || atomGroupExpression(chain);
        const representation = await addRepresentation(
            plugin,
            structure,
            `${side}-${chain}-interface`,
            type,
            color,
            expression,
        );
        if (representation) aligned.push({ ...representation, chain, color });
    }

    const stateEntry = {
        structure,
        type,
        mode,
        aligned,
        background: null,
        surfaces: [],
        baseColor: null,
        alignedColor: null,
    };
    await setInterfaceBackgroundRepresentation(plugin, state, stateEntry, input, side, mode);
    return stateEntry;
}

function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

async function setSelectionMode(plugin, state, stateEntry, input, side, mode) {
    if (!stateEntry || stateEntry.mode === mode) return;
    stateEntry.mode = mode;
    if (input?.structureMode === 'interface') {
        await setInterfaceBackgroundRepresentation(plugin, state, stateEntry, input, side, mode);
    } else {
        await setBackgroundRepresentation(plugin, state, stateEntry, input, side, mode);
    }
    setSurfaceVisibility(plugin, stateEntry, input, side, mode);
    plugin.managers.camera.reset();
}

async function setBackgroundRepresentation(plugin, state, stateEntry, input, side, mode) {
    const expression = backgroundExpressionForMode(state, input, side, mode);
    await deleteRepresentations(plugin, stateEntry.background);
    stateEntry.background = null;

    if (!expression) {
        return;
    }

    stateEntry.background = await addRepresentation(
        plugin,
        stateEntry.structure,
        `${side}-background`,
        stateEntry.type,
        stateEntry.baseColor,
        expression,
        representationOverrides(input, side),
    );
}

async function setInterfaceBackgroundRepresentation(plugin, state, stateEntry, input, side, mode) {
    await deleteRepresentations(plugin, stateEntry.background);
    stateEntry.background = null;
    if (mode === 0) return;

    const alpha = mode === 1 ? 0.28 : 1;
    const background = [];
    for (const { chain, color } of chainColorEntries(input, side, InterfacePalettes)) {
        const chainExpression = atomGroupExpression(chain);
        const interfaceExpression = interfaceExpressionForChain(state, side, chain);
        const expression = interfaceExpression
            ? MS.struct.modifier.exceptBy({ 0: chainExpression, by: interfaceExpression })
            : chainExpression;
        const representation = await addRepresentation(
            plugin,
            stateEntry.structure,
            `${side}-${chain}-context`,
            stateEntry.type,
            color,
            expression,
            { alpha },
        );
        if (representation) background.push({ ...representation, chain, color });
    }
    stateEntry.background = background;
}

async function deleteRepresentations(plugin, representations) {
    const items = Array.isArray(representations)
        ? representations
        : (representations ? [representations] : []);
    for (const item of items) {
        if (item?.component?.ref) {
            await plugin.state.data.build().delete(item.component.ref).commit();
        }
    }
}

function representationOverrides(input, side) {
    const alpha = input?.[`${side}Alpha`];
    return Number.isFinite(alpha) ? { alpha } : {};
}

function setSurfaceVisibility(plugin, stateEntry, input, side, mode) {
    if (input?.structureMode !== 'multimer' || side !== 'query') return;

    for (const surface of stateEntry.surfaces || []) {
        const ref = surface.component?.ref;
        if (!ref) continue;

        const visible = surface.level === 'aligned'
            || (surface.level === 'unaligned' && mode >= 1)
            || (surface.level === 'other' && mode >= 2);
        setSubtreeVisibility(plugin.state.data, ref, !visible);
    }
}

async function loadStructure(plugin, source) {
    const raw = await plugin.builders.data.rawData(
        { data: source.data, label: source.label },
        { state: { isGhost: true } },
    );
    const trajectory = await plugin.builders.structure.parseTrajectory(raw, source.format);
    const model = await plugin.builders.structure.createModel(trajectory);
    return plugin.builders.structure.createStructure(model);
}

function needsBaseRebuild(state, input) {
    return state.querySource !== input?.query
        || state.targetSource !== input?.target
        || state.targetTransform !== input?.targetTransform
        || state.alignments !== input?.alignments
        || state.structureMode !== input?.structureMode;
}

function resetSceneState(state, input) {
    state.querySource = input?.query || null;
    state.targetSource = input?.target || null;
    state.targetTransform = input?.targetTransform || null;
    state.alignments = input?.alignments || null;
    state.structureMode = input?.structureMode || 'alignment';
    state.query = null;
    state.target = null;
    state.arrows = null;
    state.tmAlignResults = null;
    state.focusKey = null;
    state.interfaceRegions = { query: [], target: [] };
    state.interfaceResidueMap = { query: [], target: [] };
}

function lociFromExpression(state, expression, side = 'target') {
    if (!state[side] || !expression) return null;
    const structure = state[side].structure?.cell?.obj?.data;
    if (!structure) return null;

    const query = compile(expression);
    const selection = query(new QueryContext(structure));
    const loci = StructureSelection.toLociWithSourceUnits(selection);
    return StructureElement.Loci.isEmpty(loci) ? null : loci;
}

function structureEventFromInteraction(state, current, type) {
    const picked = pickedComponentInfo(state, current?.loci) || pickedRepresentationInfo(state, current?.repr);
    const event = structureEventFromLoci(state, current?.loci, type);
    if (!event.side && picked?.side) event.side = picked.side;
    if (!event.chain && picked?.chain) event.chain = picked.chain;
    return event;
}

function pickedRepresentationInfo(state, repr) {
    if (!repr) return null;
    for (const { side, item } of structureRepresentationItems(state)) {
        if (representationObject(item) === repr) return { side, chain: item.chain };
    }
    return null;
}

function pickedComponentInfo(state, loci) {
    if (!StructureElement.Loci.is(loci) || StructureElement.Loci.isEmpty(loci)) return null;
    for (const { side, item } of structureRepresentationItems(state)) {
        if (componentStructure(item) === loci.structure) return { side, chain: item.chain };
    }
    return null;
}

function* structureRepresentationItems(state) {
    for (const side of ['query', 'target']) {
        const entry = state[side];
        if (!entry) continue;
        for (const item of representationItems(entry.aligned)) {
            yield { side, item };
        }
        for (const item of representationItems(entry.background)) {
            yield { side, item };
        }
    }
}

function representationItems(value) {
    return Array.isArray(value) ? value : (value ? [value] : []);
}

function representationObject(item) {
    return item?.representation?.cell?.obj?.data?.repr
        || item?.representation?.obj?.data?.repr
        || item?.representation?.data?.repr
        || null;
}

function componentStructure(item) {
    return item?.component?.cell?.obj?.data
        || item?.component?.obj?.data
        || item?.component?.data
        || null;
}

function structureEventFromLoci(state, loci, type) {
    if (!StructureElement.Loci.is(loci) || StructureElement.Loci.isEmpty(loci)) {
        return { type, residue: null };
    }

    const lociStructure = loci.structure;
    const side = ['query', 'target'].find((name) => {
        const structure = state[name]?.structure?.cell?.obj?.data;
        return structuresMatch(lociStructure, structure);
    });
    if (!side) return { type, residue: null };

    const entry = loci.elements?.[0];
    if (!entry || OrderedSet.size(entry.indices) === 0) {
        return { type, residue: null };
    }

    const loc = StructureElement.Location.create(lociStructure);
    loc.unit = entry.unit;
    loc.element = OrderedSet.getAt(entry.indices, 0);

    const authResidue = StructureProperties.residue.auth_seq_id(loc);
    const labelResidue = StructureProperties.residue.label_seq_id(loc);

    return {
        type,
        side,
        chain: StructureProperties.chain.auth_asym_id(loc) || StructureProperties.chain.label_asym_id(loc),
        residue: labelResidue || authResidue,
        authResidue,
        labelResidue,
        residues: Array.from(new Set([labelResidue, authResidue].filter(Number.isFinite))),
    };
}

function structuresMatch(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.root && a.root === b) return true;
    if (a.root && b.root && a.root === b.root) return true;
    return false;
}

async function setStructureSelection(plugin, state, input) {
    const selections = input?.highlightSelections || [];
    if (selections.length === 0) {
        plugin.managers.interactivity.lociSelects.deselectAll();
        return;
    }

    const lociList = [];
    for (const side of ['query', 'target']) {
        if (!state[side]) continue;
        const expression = mergeSelectionExpressions(
            selections
                .filter(selection => (selection.side || 'target') === side)
                .map(selection => structureSelectionExpression(state, input, selection)),
        );
        const loci = lociFromExpression(state, expression, side);
        if (loci) lociList.push(loci);
    }

    if (lociList.length === 0) {
        plugin.managers.interactivity.lociSelects.deselectAll();
        return;
    }

    plugin.managers.interactivity.lociSelects.deselectAll();
    for (const loci of lociList) {
        plugin.managers.interactivity.lociSelects.select({ loci }, false);
    }
}

async function setStructureHover(plugin, state, input) {
    const loci = lociFromInputSelection(state, input, input?.hoverSelection);
    if (!loci) {
        plugin.managers.interactivity.lociHighlights.clearHighlights();
        return;
    }

    plugin.managers.interactivity.lociHighlights.highlightOnly({ loci }, false);
}

async function setTargetFocus(plugin, state, input) {
    const selection = input?.focusSelection;
    const key = selection
        ? `${selection.side || 'target'}:${selection.index}:${selection.start}:${selection.length}:${selection.token || 0}`
        : null;
    if (state.focusKey === key) return;
    state.focusKey = key;
    if (!selection) return;

    const loci = lociFromInputSelection(state, input, selection);
    if (!loci) return;

    plugin.managers.camera.focusLoci(loci, {
        durationMs: 250,
        extraRadius: 6,
        minRadius: 3,
    });
}

function lociFromInputSelection(state, input, selection) {
    const side = selection?.side || 'target';
    if (!state[side]) return null;
    return lociFromExpression(state, structureSelectionExpression(state, input, selection), side);
}

async function rebuildBaseScene(plugin, state, input) {
    await plugin.clear();
    resetSceneState(state, input);
    if (!input) return;

    let target = input.target ? await loadStructure(plugin, input.target) : null;
    const query = input.query ? await loadStructure(plugin, input.query) : null;

    if (target && input.targetTransform) {
        target = await transformStructure(plugin, target, input.targetTransform);
    } else if (target && query) {
        const superposition = await superposeTargetWithFoldseekAlignment(plugin, target, query, input.alignments);
        target = superposition.structure;
        state.tmAlignResults = superposition.results;
    }

    const interfaceData = computeInterfaceRegions(query, target, input);
    state.interfaceRegions = interfaceData.regions;
    state.interfaceResidueMap = interfaceData.residueMap;

    if (target) {
        state.target = await buildStructureRepresentations(
            plugin,
            state,
            target,
            'target',
            input,
            input.targetUnalignedColor || 0xffe699,
            input.targetColor || 0xffc107,
        );
    }

    if (query) {
        state.query = await buildStructureRepresentations(
            plugin,
            state,
            query,
            'query',
            input,
            input.queryUnalignedColor || 0xa5cff5,
            input.queryColor || 0x1e88e5,
        );
    }

    plugin.managers.camera.reset();
}

function makeCIF(state) {
    const queryStructure = state.query?.structure?.cell?.obj?.data;
    const targetStructure = state.target?.structure?.cell?.obj?.data;
    if (!queryStructure && !targetStructure) return '';

    const blocks = [];
    if (queryStructure) {
        blocks.push(to_mmCIF('query', queryStructure, false, { copyAllCategories: false }));
    }
    if (targetStructure) {
        blocks.push(to_mmCIF('target', targetStructure, false, { copyAllCategories: false }));
    }
    return blocks.join('\n');
}

export const foldseekResult = {
    async mount() {
        return {};
    },

    async update(plugin, state, input) {
        if (needsBaseRebuild(state, input)) {
            await rebuildBaseScene(plugin, state, input);
        }
        await applyVisibility(plugin, state, input);
        await setStructureSelection(plugin, state, input);
        await setStructureHover(plugin, state, input);
        await setTargetFocus(plugin, state, input);
    },

    onHover(plugin, state, input, event) {
        return structureEventFromInteraction(state, event?.current, 'structure-hover');
    },

    onClick(plugin, state, input, event) {
        return structureEventFromInteraction(state, event?.current, 'structure-click');
    },

    resetView(plugin) {
        plugin.managers.camera.reset();
    },

    async makeCIF(plugin, state, input) {
        return makeCIF(state, input);
    },

    async dispose(plugin) {
        await plugin?.clear?.();
    },
};

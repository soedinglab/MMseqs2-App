import { to_mmCIF } from 'molstar/lib/mol-model/structure/export/mmcif';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { setSubtreeVisibility } from 'molstar/lib/mol-plugin/behavior/static/state';
import {
    alignmentRegions,
    alignedSelectionExpression,
    atomGroupExpression,
    backgroundExpressionForMode,
    baseSelectionExpressionForMode,
    chainColorEntries,
    computeInterfaceRegions,
    computeResidueMaps,
    interfaceExpressionForChain,
    mergeSelectionExpressions,
    selectionExpressionForChains,
    structureChains,
    structureSelectionExpression,
} from './foldseekSelections.js';
import { superposeTargetWithFoldseekAlignment } from './foldseekSuperposition.js';
import { transformStructureConformation } from './transforms.js';
import { setArrows } from './foldseekArrows.js';
import { loadStructureFromData } from './io.js';
import { isValidLoci, lociFromExpression as lociFromStructureExpression, residueInfoFromLoci, structuresMatch } from './interactions.js';
import { addUniformRepresentation } from './representations.js';
import { getChainName } from './foldseekUtilities.js';

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
    const aligned = withInteractionChain(
        await addRepresentation(
            plugin,
            structure,
            `${side}-aligned`,
            type,
            alignedColor,
            baseSelectionExpressionForMode(state, input, side, 0),
            representationOverrides(input, side),
        ),
        input,
        side,
    );
    registerInteraction(state, aligned, { side, chain: aligned?.chain, sequenceMappable: true });
    const stateEntry = {
        structure,
        type,
        mode,
        aligned,
        background: null,
        surfaces: await addChainSurfaces(plugin, state, structure, side, input),
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
    const key = visibilityKey(input, queryMode, targetMode);
    if (state.visibilityKey === key) return;
    state.visibilityKey = key;

    if (state.query) {
        await setSelectionMode(plugin, state, state.query, input, 'query', queryMode);
    }
    if (state.target) {
        await setSelectionMode(plugin, state, state.target, input, 'target', targetMode);
    }
    await setArrows(plugin, state, input);
}

function visibilityKey(input, queryMode = input?.showQuery || 0, targetMode = input?.showTarget || 0) {
    return [
        queryMode,
        targetMode,
        input?.showArrows ? 1 : 0,
        input?.queryRepresentation || 'cartoon',
        input?.targetRepresentation || 'cartoon',
        input?.queryAlpha ?? '',
        input?.targetAlpha ?? '',
        input?.representationQuality || '',
        input?.queryIndex ?? '',
        input?.queryChain ?? '',
    ].join(':');
}

async function addRepresentation(plugin, structure, label, type, color, expression = MS.struct.generator.all(), typeParams = {}) {
    return addUniformRepresentation(plugin, structure, {
        label,
        type,
        color,
        expression,
        typeParams,
        state: { tag: `${label}-representation` },
    });
}

async function addChainSurfaces(plugin, state, structure, side, input) {
    if (input?.structureMode !== 'multimer' || side !== 'query') return [];

    const entries = querySurfaceEntries(state, input);

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
        if (surface) {
            registerInteraction(state, surface, {
                side,
                chain: entry.chain,
                sequenceMappable: entry.level === 'aligned',
            });
            surfaces.push({ ...surface, chain: entry.chain, level: entry.level || 'base' });
        }
    }
    return surfaces;
}

function querySurfaceEntries(state, input) {
    const byChain = new Map();
    const resolver = (chain) => state?.chainOverrides?.query?.[chain] || chain;
    for (const region of alignmentRegions(input.alignments, 'query', resolver)) {
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

    if (input?.queryChain) return entries;

    const queryChains = selectionExpressionForChains(input.alignments, 'query', resolver);
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
        if (representation) {
            registerInteraction(state, representation, { side, chain, sequenceMappable: true });
            aligned.push({ ...representation, chain, color });
        }
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

    if (side === 'query' && input?.queryChain && mode === 2) {
        stateEntry.background = await addQueryFullBackgroundRepresentations(plugin, state, stateEntry, input);
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
    registerInteraction(state, stateEntry.background, { side, sequenceMappable: false });
}

async function addQueryFullBackgroundRepresentations(plugin, state, stateEntry, input) {
    const background = [];
    const base = alignedSelectionExpression(state, input, 'query');
    const chains = structureChains(stateEntry.structure);
    for (const chain of chains) {
        const chainExpression = atomGroupExpression(chain);
        const representation = await addRepresentation(
            plugin,
            stateEntry.structure,
            `query-${chain}-background`,
            stateEntry.type,
            stateEntry.baseColor,
            base
                ? MS.struct.modifier.exceptBy({ 0: chainExpression, by: base })
                : chainExpression,
            representationOverrides(input, 'query'),
        );
        if (representation) {
            registerInteraction(state, representation, { side: 'query', chain, sequenceMappable: false });
            background.push({ ...representation, chain });
        }
    }
    return background.length > 0 ? background : null;
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
        if (representation) {
            registerInteraction(state, representation, { side, chain, sequenceMappable: false });
            background.push({ ...representation, chain, color });
        }
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
    return {
        ...(Number.isFinite(alpha) ? { alpha } : {}),
        ...(input?.representationQuality ? { qualityPreset: input.representationQuality } : {}),
    };
}

function withInteractionChain(representation, input, side) {
    if (!representation || side !== 'query' || !input?.queryChain) return representation;
    return { ...representation, chain: input.queryChain };
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

function needsBaseRebuild(state, input) {
    return state.baseKey !== baseSceneKey(input);
}

function diffInput(previous, next) {
    if (!previous) {
        return {
            rebuild: true,
            visibility: true,
            selection: true,
            hover: true,
            focus: true,
        };
    }

    const rebuild = baseSceneKey(previous) !== baseSceneKey(next);
    return {
        rebuild,
        visibility: rebuild || visibilityKey(previous) !== visibilityKey(next),
        selection: rebuild || selectionsKey(previous?.highlightSelections || []) !== selectionsKey(next?.highlightSelections || []),
        hover: rebuild || hoverInputKey(previous?.hoverSelection) !== hoverInputKey(next?.hoverSelection),
        focus: rebuild || focusInputKey(previous?.focusSelection) !== focusInputKey(next?.focusSelection),
    };
}

function resetSceneState(state, input) {
    state.baseKey = baseSceneKey(input);
    state.structureMode = input?.structureMode || 'alignment';
    state.activeQueryChain = input?.queryChain || null;
    state.query = null;
    state.target = null;
    state.arrows = null;
    state.tmAlignResults = null;
    state.focusKey = null;
    state.selectionKey = null;
    state.hoverSelectionKey = null;
    state.visibilityKey = null;
    state.hoverLoci = null;
    state.hoverKey = null;
    state.chainOverrides = { query: {}, target: {} };
    state.interfaceRegions = { query: [], target: [] };
    state.interfaceResidueMap = { query: {}, target: {} };
    state.residueMap = { query: {}, target: {} };
    state.interactionByRepr = new WeakMap();
    state.interactionByComponent = new WeakMap();
}

function baseSceneKey(input) {
    if (!input) return 'empty';
    return [
        input.structureMode || 'alignment',
        sourceKey(input.query),
        sourceKey(input.target),
        transformKey(input.targetTransform),
        alignmentsKey(input.alignments),
        input.queryIndex ?? '',
        input.queryChain ?? '',
    ].join('|');
}

function sourceKey(source) {
    if (!source) return 'none';
    const data = source.data || '';
    return [
        source.format || '',
        source.label || '',
        data.length,
        data.slice(0, 96),
        data.slice(-96),
    ].join(':');
}

function transformKey(transform) {
    if (!transform) return 'none';
    if (Array.isArray(transform)) return transform.join(',');
    if (typeof transform?.ref?.value === 'string') return transform.ref.value;
    if (Array.isArray(transform?.data)) return transform.data.join(',');
    return JSON.stringify(transform);
}

function alignmentsKey(alignments = []) {
    return alignments.map((alignment, index) => [
        index,
        alignment.id,
        alignment.query,
        alignment.target,
        alignment.db,
        alignment.qStartPos,
        alignment.qEndPos,
        alignment.dbStartPos,
        alignment.dbEndPos,
        alignment.complexu,
        alignment.complext,
    ].join(':')).join(';');
}

function lociFromExpression(state, expression, side = 'target') {
    if (!state[side] || !expression) return null;
    return lociFromStructureExpression(state[side].structure, expression);
}

function structureEventFromInteraction(state, input, current, type) {
    const picked = interactionInfoFromCurrent(state, current);
    const event = structureEventFromLoci(state, current?.loci, type);
    if (!event.side && picked?.side) event.side = picked.side;
    if (picked?.chain && picked.side === event.side) {
        event.chain = picked.chain;
        if (event.residue && typeof event.residue === 'object') {
            event.residue = {
                ...event.residue,
                chain: picked.chain,
            };
        }
    }
    if (picked?.sequenceMappable === false) {
        event.sequenceMappable = false;
    }
    addFoldseekResidueMapping(state, input, event);
    return event;
}

function addFoldseekResidueMapping(state, input, event) {
    if (!event?.side || !event.chain || !event.residue || event.sequenceMappable === false) return;

    const chainResidues = state.residueMap?.[event.side]?.[event.chain] || [];
    const residueIndex = chainResidues.findIndex(entry => (
        (Number.isFinite(event.labelResidue) && entry.labelResidue === event.labelResidue)
        || (Number.isFinite(event.authResidue) && entry.authResidue === event.authResidue)
    ));
    if (residueIndex < 0) return;

    const alignment = (input?.alignments || []).find(entry => {
        const sideName = event.side === 'query' ? entry.query : entry.target;
        const chain = state.chainOverrides?.[event.side]?.[getChainName(sideName)] || getChainName(sideName);
        return chain === event.chain;
    });
    if (!alignment) return;

    const alignmentStart = event.side === 'query' ? 1 : alignment.dbStartPos;
    if (!Number.isFinite(alignmentStart)) return;

    event.foldseekResidue = alignmentStart + residueIndex;
    event.residues = [event.foldseekResidue];
}

function registerInteraction(state, item, meta) {
    if (!item || !meta?.side) return;
    const repr = representationObject(item);
    if (repr) state.interactionByRepr?.set(repr, meta);
    const component = componentStructure(item);
    if (component) state.interactionByComponent?.set(component, meta);
}

function interactionInfoFromCurrent(state, current) {
    const byRepresentation = current?.repr
        ? state.interactionByRepr?.get(current.repr)
        : null;
    if (byRepresentation) return byRepresentation;
    return isValidLoci(current?.loci)
        ? state.interactionByComponent?.get(current.loci.structure)
        : null;
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
    if (!isValidLoci(loci)) {
        return { type, residue: null };
    }

    const lociStructure = loci.structure;
    const side = ['query', 'target'].find((name) => {
        const structure = state[name]?.structure?.cell?.obj?.data;
        return structuresMatch(lociStructure, structure);
    });
    if (!side) return { type, residue: null };

    const residue = residueInfoFromLoci(loci);
    if (!residue) {
        return { type, residue: null };
    }

    return {
        type,
        side,
        chain: residue.chain,
        authChain: residue.authChain,
        labelChain: residue.labelChain,
        residue: {
            chain: residue.chain,
            residue: residue.residue,
            oneLetter: residue.oneLetter,
            threeLetter: residue.threeLetter,
        },
        authResidue: residue.authResidue,
        labelResidue: residue.labelResidue,
        residues: residue.residues,
    };
}

async function setStructureSelection(plugin, state, input) {
    const selections = input?.highlightSelections || [];
    const key = selectionsKey(selections);
    if (state.selectionKey === key) return;
    state.selectionKey = key;

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
    const key = hoverSelectionKey(input?.hoverSelection, state);
    if (state.hoverSelectionKey === key) return;
    state.hoverSelectionKey = key;

    const loci = input?.hoverSelection?.source === 'molstar'
        ? state.hoverLoci
        : lociFromInputSelection(state, input, input?.hoverSelection);
    if (!loci) {
        plugin.managers.interactivity.lociHighlights.clearHighlights();
        return;
    }

    plugin.managers.interactivity.lociHighlights.highlightOnly({ loci }, false);
}

function selectionsKey(selections) {
    return selections.map(selection => [
        selection.side || 'target',
        selection.index,
        selection.start,
        selection.length,
    ].join(':')).join(';');
}

function hoverSelectionKey(selection, state) {
    if (!selection) return 'none';
    if (selection.source === 'molstar') {
        return `molstar:${selection.hoverKey || state.hoverKey || ''}`;
    }
    return [
        selection.side || 'target',
        selection.index,
        selection.start,
        selection.length,
    ].join(':');
}

function hoverInputKey(selection) {
    if (!selection) return 'none';
    return [
        selection.source || 'sequence',
        selection.hoverKey || '',
        selection.side || 'target',
        selection.index,
        selection.start,
        selection.length,
    ].join(':');
}

function focusInputKey(selection) {
    if (!selection) return 'none';
    return [
        selection.side || 'target',
        selection.index,
        selection.start,
        selection.length,
        selection.token || 0,
    ].join(':');
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

function resolveChainOverrides(structure, input, side) {
    const chains = structureChains(structure);
    if (chains.length === 0) return {};

    const requested = Array.from(new Set(alignmentRegions(input?.alignments || [], side).map(region => region.chain)));
    const explicitQueryChain = side === 'query' && input?.queryChain ? input.queryChain : null;
    const useQueryIndexFallback = side === 'query'
        && !explicitQueryChain
        && requested.length === 1
        && Number.isInteger(input?.queryIndex)
        && chains.length > 1
        && chains[input.queryIndex];
    const overrides = {};
    for (const chain of requested) {
        if (explicitQueryChain) {
            overrides[chain] = explicitQueryChain;
        } else if (useQueryIndexFallback) {
            overrides[chain] = chains[input.queryIndex];
        } else if (chains.includes(chain)) {
            overrides[chain] = chain;
        } else if (side === 'query' && Number.isInteger(input?.queryIndex) && chains[input.queryIndex]) {
            overrides[chain] = chains[input.queryIndex];
        } else if (chains.length === 1) {
            overrides[chain] = chains[0];
        }
    }
    return overrides;
}

async function rebuildBaseScene(plugin, state, input) {
    await plugin.clear();
    resetSceneState(state, input);
    if (!input) return;

    let target = input.target ? await loadStructureFromData(plugin, input.target) : null;
    const query = input.query ? await loadStructureFromData(plugin, input.query) : null;
    state.chainOverrides = {
        query: resolveChainOverrides(query, input, 'query'),
        target: resolveChainOverrides(target, input, 'target'),
    };

    if (target && input.targetTransform) {
        target = await transformStructureConformation(plugin, target, input.targetTransform);
    } else if (target && query) {
        const superposition = await superposeTargetWithFoldseekAlignment(
            plugin,
            target,
            query,
            input.superpositionAlignments || input.alignments,
            state.chainOverrides,
        );
        target = superposition.structure;
        state.tmAlignResults = superposition.results;
    }

    const interfaceData = computeInterfaceRegions(query, target, input);
    state.interfaceRegions = interfaceData.regions;
    state.interfaceResidueMap = interfaceData.residueMap;
    state.residueMap = computeResidueMaps(query, target, input, state.chainOverrides);

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

    diffInput,

    async update(plugin, state, input, previous, change = null) {
        const plan = change || {
            rebuild: true,
            visibility: true,
            selection: true,
            hover: true,
            focus: true,
        };

        if (plan.rebuild && needsBaseRebuild(state, input)) {
            await rebuildBaseScene(plugin, state, input);
        }
        if (plan.visibility) await applyVisibility(plugin, state, input);
        if (plan.selection) await setStructureSelection(plugin, state, input);
        if (plan.hover) await setStructureHover(plugin, state, input);
        if (plan.focus) await setTargetFocus(plugin, state, input);
    },

    onHover(plugin, state, input, event) {
        const sceneEvent = structureEventFromInteraction(state, input, event?.current, 'structure-hover');
        if (sceneEvent?.residue && isValidLoci(event?.current?.loci)) {
            state.hoverLoci = event.current.loci;
            state.hoverKey = `${sceneEvent.side}:${sceneEvent.chain}:${sceneEvent.labelResidue}:${sceneEvent.authResidue}`;
            state.hoverSelectionKey = `molstar:${state.hoverKey}`;
            plugin.managers.interactivity.lociHighlights.highlightOnly({ loci: state.hoverLoci }, false);
            sceneEvent.hoverSource = 'molstar';
            sceneEvent.hoverKey = state.hoverKey;
        } else {
            state.hoverLoci = null;
            state.hoverKey = null;
            state.hoverSelectionKey = 'none';
            plugin.managers.interactivity.lociHighlights.clearHighlights();
        }
        return sceneEvent;
    },

    onClick(plugin, state, input, event) {
        return structureEventFromInteraction(state, input, event?.current, 'structure-click');
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

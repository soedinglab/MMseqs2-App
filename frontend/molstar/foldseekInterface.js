import { StructureElement } from 'molstar/lib/mol-model/structure';
import { setSubtreeVisibility } from 'molstar/lib/mol-plugin/behavior/static/state';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms';
import {
    addUniformRepresentation,
    chainExpression,
    componentStructure,
    lociFromExpression as lociFromStructureExpression,
    mergeExpressions,
    representationObject,
    residueRanges,
    residueInfosFromLoci,
    structureResidueKeys,
} from './molstarStructure.js';

const InterfaceChainColors = {
    query: [0x1e88e5, 0x90caf9],
    target: [0xffc107, 0xffe082],
};

export function interfaceVisibilityKey(input, queryMode = input?.showQuery || 0, targetMode = input?.showTarget || 0) {
    return [
        queryMode,
        targetMode,
    ].join(':');
}

export function interfaceSceneKey(input, baseSceneKey) {
    return [
        baseSceneKey(input),
        input?.interfaceCutoff ?? '',
    ].join('|');
}

export function prepareInterfaceState(state, input, { query, target }) {
    const interfaceState = computeInterfaceState(query, target, input, state.alignmentMaps);
    state.interfaceRegions = interfaceState.regions;
    state.interfaceSelections = interfaceState.selections;
}

function computeInterfaceState(query, target, input, alignmentMaps) {
    if (input?.structureMode !== 'interface') {
        return {
            regions: { query: [], target: [] },
            selections: { query: new Map(), target: new Map() },
        };
    }
    const queryState = computeInterfaceSide(query, alignmentMaps?.query || [], input.interfaceCutoff);
    const targetState = computeInterfaceSide(target, alignmentMaps?.target || [], input.interfaceCutoff);
    return {
        regions: {
            query: queryState.regions,
            target: targetState.regions,
        },
        selections: {
            query: queryState.selections,
            target: targetState.selections,
        },
    };
}

function computeInterfaceSide(structureRef, alignmentMaps, cutoff) {
    const selections = interfaceSelectionsByChain(structureRef, chainsFromMaps(alignmentMaps), cutoff);
    const regions = mapInterfaceRegions(alignmentMaps, selections);
    for (const region of regions) {
        const selection = selections.get(region.chain);
        if (selection) selection.regions.push(region);
    }
    return { selections, regions };
}

export async function applyInterfaceVisibility(plugin, state, input) {
    const queryMode = input?.showQuery || 0;
    const targetMode = input?.showTarget || 0;
    const key = interfaceVisibilityKey(input, queryMode, targetMode);
    if (state.visibilityKey === key) return;
    state.visibilityKey = key;

    if (state.query) await setInterfaceMode(plugin, state.query, queryMode);
    if (state.target) await setInterfaceMode(plugin, state.target, targetMode);
}

export async function buildInterfaceRepresentations(plugin, state, structure, side, input) {
    const mode = side === 'query' ? input.showQuery || 0 : input.showTarget || 0;
    const type = side === 'query' ? input.queryRepresentation || 'cartoon' : input.targetRepresentation || 'cartoon';
    const entries = interfaceEntries(state, side);
    const stateEntry = {
        structure,
        type,
        mode,
        entries,
        background: null,
    };
    stateEntry.background = await createInterfaceBackground(plugin, state, stateEntry, side);
    await applyInterfaceBackgroundMode(plugin, stateEntry, mode);
    for (const entry of entries) {
        const label = `${side}-${entry.chain}-interface`;
        const representation = await addInterfaceRepresentation(
            plugin,
            structure,
            label,
            entry.interfaceExpression,
            type,
            entry.color,
        );
        if (!representation) continue;
        await emphasizeInterface(plugin, representation, entry.interfaceLoci, input);
    }

    return stateEntry;
}

async function setInterfaceMode(plugin, stateEntry, mode) {
    if (!stateEntry || stateEntry.mode === mode) return;
    stateEntry.mode = mode;
    await applyInterfaceBackgroundMode(plugin, stateEntry, mode);
    plugin.managers.camera.reset();
}

function interfaceEntries(state, side) {
    const palette = side === 'query' ? InterfaceChainColors.query : InterfaceChainColors.target;
    const selections = state.interfaceSelections?.[side] || new Map();
    return chainsFromMaps(state.alignmentMaps?.[side]).map((chain, index) => ({
        chain,
        color: palette[index % palette.length],
        chainExpression: chainExpression(chain),
        interfaceExpression: selections.get(chain)?.expression || null,
        interfaceLoci: selections.get(chain)?.loci || null,
        regions: selections.get(chain)?.regions || [],
    }));
}

async function createInterfaceBackground(plugin, state, stateEntry, side) {
    const background = [];
    for (const entry of stateEntry.entries) {
        const expression = entry.interfaceExpression
            ? MS.struct.modifier.exceptBy({ 0: entry.chainExpression, by: entry.interfaceExpression })
            : entry.chainExpression;
        const label = `${side}-${entry.chain}-context`;
        const representation = await addInterfaceRepresentation(
            plugin,
            stateEntry.structure,
            label,
            expression,
            stateEntry.type,
            entry.color,
        );
        if (!representation) continue;
        markNonSequenceMappable(state, representation);
        const loci = lociFromStructureExpression(stateEntry.structure, expression);
        background.push({
            ...representation,
            chain: entry.chain,
            color: entry.color,
            contextBundle: loci ? StructureElement.Bundle.fromLoci(loci) : null,
        });
    }
    return background;
}

async function applyInterfaceBackgroundMode(plugin, stateEntry, mode) {
    const background = stateEntry.background || [];
    if (background.length === 0) return;

    const update = plugin.state.data.build();
    for (const item of background) {
        if (item?.component?.ref) {
            setSubtreeVisibility(plugin.state.data, item.component.ref, mode === 0);
        }

        const ref = representationRef(item);
        if (!ref) continue;
        update.to(ref).applyOrUpdate(
            `${ref}-interface-context-transparency`,
            StateTransforms.Representation.TransparencyStructureRepresentation3DFromBundle,
            {
                kind: 'element-loci',
                layers: mode === 1 && item.contextBundle
                    ? [{ bundle: item.contextBundle, value: 0.3 }]
                    : [],
            },
            { tags: ['foldseek-interface-context-transparency'] },
        );
    }
    await update.commit({ doNotUpdateCurrent: true });
}

async function addInterfaceRepresentation(plugin, structure, label, expression, type, color, typeParams = {}) {
    return addUniformRepresentation(plugin, structure, {
        label,
        expression,
        type,
        color,
        typeParams,
    });
}

async function emphasizeInterface(plugin, representation, loci, input) {
    const ref = representationRef(representation);
    if (!loci || !ref) return;

    const update = plugin.state.data.build();
    update.to(ref).apply(StateTransforms.Representation.EmissiveStructureRepresentation3DFromBundle, {
        layers: [{
            bundle: StructureElement.Bundle.fromLoci(loci),
            value: input.interfaceHighlightValue ?? 1,
        }],
    }, { tags: 'foldseek-interface-emissive' });
    update.to(ref).apply(StateTransforms.Representation.ThemeStrengthRepresentation3D, {
        overpaintStrength: 1,
        transparencyStrength: 1,
        emissiveStrength: input.interfaceHighlightStrength ?? 0.1,
        substanceStrength: 1,
        wiggleStrength: 1,
    }, { tags: 'foldseek-interface-emissive-strength' });
    await update.commit({ doNotUpdateCurrent: true });
}

function representationRef(item) {
    return item?.representation?.ref || item?.representation?.cell?.transform?.ref;
}

function mapInterfaceRegions(alignmentMaps, selectionsByChain) {
    const regions = [];
    for (const map of alignmentMaps) {
        const interfaceKeys = selectionsByChain.get(map.chain)?.keys;
        if (!interfaceKeys?.size) continue;

        const positions = [];
        for (const [position, residue] of map.toStructure.entries()) {
            if (structureResidueKeys(residue, map.chain).some(key => interfaceKeys.has(key))) {
                positions.push(position);
            }
        }

        for (const [start, end] of residueRanges(positions.sort((a, b) => a - b))) {
            regions.push({ chain: map.chain, index: map.index, start, end });
        }
    }
    return regions;
}

function interfaceSelectionsByChain(structureRef, chains, cutoff = 10) {
    const structure = structureRef?.cell?.obj?.data;
    const chainList = Array.from(new Set((chains || []).filter(Boolean)));
    const selections = new Map(chainList.map(chain => [
        chain,
        { expression: null, loci: null, keys: new Set(), regions: [] },
    ]));
    if (!structure || chainList.length < 2) return selections;

    for (const chain of chainList) {
        const expression = interfaceSurroundingsExpression(chain, chainList, cutoff);
        const loci = lociFromStructureExpression(structure, expression);
        const selection = selections.get(chain);
        if (!selection) continue;
        selection.expression = expression;
        selection.loci = loci;
        for (const residue of residueInfosFromLoci(loci)) {
            for (const key of structureResidueKeys(residue, chain)) {
                selection.keys.add(key);
            }
        }
    }

    return selections;
}

function interfaceSurroundingsExpression(chain, chains, cutoff) {
    const currentChain = chainExpression(chain);
    const otherChains = mergeExpressions(
        chains
            .filter(other => other !== chain)
            .map(chainExpression),
    );
    if (!currentChain || !otherChains) return null;

    return MS.struct.modifier.intersectBy({
        0: currentChain,
        by: MS.struct.modifier.includeSurroundings({
            0: otherChains,
            radius: cutoff,
            'as-whole-residues': true,
        }),
    });
}

function chainsFromMaps(alignmentMaps = []) {
    return Array.from(new Set(alignmentMaps.map(map => map.chain).filter(Boolean)));
}

function markNonSequenceMappable(state, item) {
    if (!item) return;
    const repr = representationObject(item);
    if (repr) state.nonSequenceMappable?.add(repr);
    const component = componentStructure(item);
    if (component) state.nonSequenceMappable?.add(component);
}

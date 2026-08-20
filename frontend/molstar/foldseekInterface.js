import { StructureElement } from 'molstar/lib/mol-model/structure';
import { setSubtreeVisibility } from 'molstar/lib/mol-plugin/behavior/static/state';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms';
import {
    addUniformRepresentation,
    addRepresentationToSet,
    caResiduesByChain,
    chainExpression,
    expressionForResidues,
    lociFromExpression as lociFromStructureExpression,
    representationRef,
    residueRanges,
    residueInfosFromLoci,
    nearestResidue,
    parseCaCoordinates,
    structureResidueKeys,
} from './molstarStructure.js';

// Hue identifies the paired chain; lightness identifies the structure.
// This restores the NGL interface palette: query chains are the lighter
// variants, their matched target chains the darker variants.
export const InterfaceVisualPalette = {
    query: [0x90caf9, 0xffb74d],
    target: [0x0d47a1, 0xe65100],
};

export const InterfaceToolbarColors = {
    query: '#90CAF9',
    target: '#0D47A1',
};

const InterfaceContextTransparency = 0.7;

export function interfaceVisibilityKey(input, queryMode = input?.showQuery || 0, targetMode = input?.showTarget || 0) {
    return [
        queryMode,
        targetMode,
        input?.showArrows ? 1 : 0,
        input?.interfaceContextTransparency ?? '',
    ].join(':');
}

export function interfaceSceneKey(input, baseSceneKey) {
    return [
        baseSceneKey(input),
        ...(input?.alignments || []).map(alignment => `${alignment.qCa || ''}:${alignment.tCa || ''}`),
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
    const queryState = computeInterfaceSide(query, alignmentMaps?.query || [], input, 'query');
    const targetState = computeInterfaceSide(target, alignmentMaps?.target || [], input, 'target');
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

function computeInterfaceSide(structureRef, alignmentMaps, input, side) {
    const selections = interfaceSelectionsByChain(
        structureRef,
        alignmentMaps,
        input?.alignments || [],
        side,
    );
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
    if (state.visibilityKey === key) return false;
    state.visibilityKey = key;

    let modeChanged = false;
    if (state.query) {
        state.query.contextTransparency = input.interfaceContextTransparency ?? InterfaceContextTransparency;
        modeChanged = (await setInterfaceMode(plugin, state.query, queryMode)) || modeChanged;
    }
    if (state.target) {
        state.target.contextTransparency = input.interfaceContextTransparency ?? InterfaceContextTransparency;
        modeChanged = (await setInterfaceMode(plugin, state.target, targetMode)) || modeChanged;
    }
    return modeChanged;
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
        contextTransparency: input.interfaceContextTransparency ?? InterfaceContextTransparency,
    };
    stateEntry.background = await createInterfaceBackground(plugin, state, stateEntry, side);
    await applyInterfaceBackgroundMode(plugin, stateEntry, mode);
    for (const entry of entries) {
        const label = `${side}-${entry.chain}-interface`;
        const representation = await addUniformRepresentation(
            plugin,
            structure,
            {
                label,
                expression: entry.interfaceExpression,
                type,
                color: entry.interfaceColor,
            },
        );
        if (!representation) continue;
    }

    return stateEntry;
}

async function setInterfaceMode(plugin, stateEntry, mode) {
    if (!stateEntry) return false;
    const modeChanged = stateEntry.mode !== mode;
    stateEntry.mode = mode;
    await applyInterfaceBackgroundMode(plugin, stateEntry, mode);
    return modeChanged;
}

function interfaceEntries(state, side) {
    const palette = InterfaceVisualPalette[side];
    const selections = state.interfaceSelections?.[side] || new Map();
    return chainsFromMaps(state.alignmentMaps?.[side]).map((chain, index) => {
        const color = palette[index % palette.length];
        return {
            chain,
            interfaceColor: color,
            contextColor: color,
            chainExpression: chainExpression(chain),
            interfaceExpression: selections.get(chain)?.expression || null,
            regions: selections.get(chain)?.regions || [],
        };
    });
}

async function createInterfaceBackground(plugin, state, stateEntry, side) {
    const background = [];
    for (const entry of stateEntry.entries) {
        const expression = entry.interfaceExpression
            ? MS.struct.modifier.exceptBy({ 0: entry.chainExpression, by: entry.interfaceExpression })
            : entry.chainExpression;
        const label = `${side}-${entry.chain}-context`;
        const representation = await addUniformRepresentation(
            plugin,
            stateEntry.structure,
            {
                label,
                expression,
                type: stateEntry.type,
                color: entry.contextColor,
            },
        );
        if (!representation) continue;
        markNonSequenceMappable(state, representation);
        const loci = lociFromStructureExpression(stateEntry.structure, expression);
        background.push({
            ...representation,
            chain: entry.chain,
            color: entry.contextColor,
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
                    ? [{ bundle: item.contextBundle, value: stateEntry.contextTransparency }]
                    : [],
            },
            { tags: ['foldseek-interface-context-transparency'] },
        );
    }
    await update.commit({ doNotUpdateCurrent: true });
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

function interfaceSelectionsByChain(structureRef, alignmentMaps, alignments, side) {
    const structure = structureRef?.cell?.obj?.data;
    const chainList = chainsFromMaps(alignmentMaps);
    const selections = new Map(chainList.map(chain => [
        chain,
        { expression: null, keys: new Set(), regions: [], residues: new Map(), hasSearchCoordinates: false },
    ]));
    if (!structure || chainList.length === 0) return selections;

    // Interface search returns the CA coordinates of the residues that define
    // the searched interface. These are authoritative; a generic distance
    // cutoff finds a different contact patch on many assemblies.
    const residuesByChain = caResiduesByChain(structure);
    for (const map of alignmentMaps || []) {
        const coords = parseCaCoordinates(alignments[map.index]?.[side === 'query' ? 'qCa' : 'tCa']);
        if (coords.length === 0) continue;

        const selection = selections.get(map.chain);
        const residues = residuesByChain.get(map.chain) || [];
        if (!selection || residues.length === 0) continue;

        selection.hasSearchCoordinates = true;
        for (const coordinate of coords) {
            const residue = nearestResidue(residues, coordinate);
            if (residue) addInterfaceResidue(selection, residue);
        }
    }

    for (const chain of chainList) {
        const selection = selections.get(chain);
        if (!selection) continue;

        if (selection.hasSearchCoordinates && selection.residues.size > 0) {
            selection.expression = expressionForResidues(Array.from(selection.residues.values()));
            continue;
        }

        // qCa/tCa are optional in older or malformed results. In that case we
        // cannot identify a precise interface safely, so preserve NGL's
        // graceful fallback: render the complete matched chain rather than
        // fabricating a new contact patch with a geometric cutoff.
        const expression = chainExpression(chain);
        const loci = lociFromStructureExpression(structure, expression);
        selection.expression = expression;
        for (const residue of residueInfosFromLoci(loci)) {
            addInterfaceResidue(selection, residue);
        }
    }

    return selections;
}

function addInterfaceResidue(selection, residue) {
    const key = structureResidueKeys(residue).join('|');
    if (!key) return;
    selection.residues.set(key, residue);
    for (const residueKey of structureResidueKeys(residue)) selection.keys.add(residueKey);
}

function chainsFromMaps(alignmentMaps = []) {
    return Array.from(new Set(alignmentMaps.map(map => map.chain).filter(Boolean)));
}

function markNonSequenceMappable(state, item) {
    addRepresentationToSet(state.nonSequenceMappable, item, { includeComponent: true });
}

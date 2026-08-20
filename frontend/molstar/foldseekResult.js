import { to_mmCIF } from 'molstar/lib/mol-model/structure/export/mmcif';
import { OrderedSet } from 'molstar/lib/mol-data/int';
import { Vec3 } from 'molstar/lib/mol-math/linear-algebra';
import { StructureElement, StructureProperties, Unit } from 'molstar/lib/mol-model/structure';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms';
import { tmalign, parse as parseTMOutput, parseMatrix as parseTMMatrix } from 'tmalign-wasm';
import {
    addUniformRepresentation,
    addRepresentationToSet,
    atomToPdbRow,
    chainExpression,
    expressionForResidues,
    isValidLoci,
    loadStructureFromData,
    lociFromExpression as lociFromStructureExpression,
    mat4FromRotationTranslation,
    mergeExpressions,
    residueInfosFromLoci,
    representationRef,
    residuesForMappedRange,
    setRepresentationNonPickable,
    structureResidueKeys,
    transformStructureConformation,
} from './molstarStructure.js';
import { getChainName } from './foldseekData.js';
import { setArrows } from './foldseekArrows.js';
import { setChainLabels } from './foldseekChainLabels.js';
import {
    applyInterfaceVisibility,
    buildInterfaceRepresentations,
    interfaceSceneKey,
    interfaceVisibilityKey,
    prepareInterfaceState,
} from './foldseekInterface.js';

const ChainSurfaceColors = [
    0x991999,
    0x00bfbf,
    0xe9967a,
    0x009e73,
    0xf0e442,
    0x0072b2,
    0xd55e00,
    0xcc79a7,
];

// Separation is explanatory rather than a physical packing simulation: allow
// a little projected overlap in the faded context, while keeping the coloured
// interface patches easy to distinguish.
const InterfaceSeparationOverlapScale = 0.72;
const InterfaceSeparationClearance = 14;

function selectionsKey(selections) {
    return selections.map(selectionKey).join(';');
}

function selectionKey(selection, { state = null, focus = false } = {}) {
    if (!selection) return 'none';
    if (selection.source === 'molstar') {
        return `molstar:${selection.hoverKey || state?.hoverKey || ''}`;
    }
    return [
        selection.side || 'target',
        selection.index,
        selection.start,
        selection.length,
        ...(focus ? [selection.token || 0] : []),
    ].join(':');
}

function handleStructureHover(plugin, state, event) {
    const sceneEvent = structureEventFromCurrent(state, event?.current, 'structure-hover');
    if (sceneEvent?.residue && isValidLoci(event?.current?.loci) && !isNonHoverable(state, event.current)) {
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

    const rebuild = sceneKey(previous) !== sceneKey(next);
    return {
        rebuild,
        visibility: rebuild || visibilityKey(previous) !== visibilityKey(next),
        selection: rebuild || selectionsKey(previous?.highlightSelections || []) !== selectionsKey(next?.highlightSelections || []),
        hover: rebuild || selectionKey(previous?.hoverSelection) !== selectionKey(next?.hoverSelection),
        focus: rebuild || selectionKey(previous?.focusSelection, { focus: true }) !== selectionKey(next?.focusSelection, { focus: true }),
    };
}

function separationChanged(previous, next) {
    return previous?.structureMode === 'interface'
        && next?.structureMode === 'interface'
        && Boolean(previous?.structuresSeparated) !== Boolean(next?.structuresSeparated);
}

function standardVisibilityKey(input, queryMode = input?.showQuery || 0, targetMode = input?.showTarget || 0) {
    return [
        queryMode,
        targetMode,
        input?.showArrows ? 1 : 0,
        input?.showChainLabels === false ? 0 : 1,
        input?.chainLabelScale ?? input?.chainLabelSize ?? '',
        input?.chainLabelOffset ?? '',
    ].join(':');
}

function sceneKey(input) {
    return input?.structureMode === 'interface'
        ? interfaceSceneKey(input, baseSceneKey)
        : baseSceneKey(input);
}

function visibilityKey(input) {
    return input?.structureMode === 'interface'
        ? interfaceVisibilityKey(input)
        : standardVisibilityKey(input);
}

function rangesByChain(alignments, side, input = null) {
    const ranges = new Map();
    for (const { chain, start, end } of alignmentRegions(alignments, side, input)) {
        if (!ranges.has(chain)) ranges.set(chain, []);
        ranges.get(chain).push([start, end]);
    }
    return ranges;
}

function alignmentRegions(alignments, side, input = null) {
    const regions = [];
    for (const alignment of alignments || []) {
        const name = side === 'query' ? alignment.query : alignment.target;
        const start = side === 'query' ? alignment.qStartPos : alignment.dbStartPos;
        const end = side === 'query' ? alignment.qEndPos : alignment.dbEndPos;
        if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
        regions.push({
            chain: structureChainForAlignment(input, side, getChainName(name)),
            start: Math.min(start, end),
            end: Math.max(start, end),
        });
    }
    return regions;
}

function structureSelectionExpression(state, input, selection) {
    if (!selection) return null;
    const side = selection?.side || 'target';
    const alignment = input?.alignments?.[selection?.index];
    if (!alignment || !Number.isFinite(selection.start) || !Number.isFinite(selection.length)) return null;
    const start = selection.start;
    const end = selection.start + Math.max(0, selection.length - 1);
    if (!Number.isFinite(end) || end < start) return null;
    return atomGroupExpressionForFoldseekRange(state, side, selection.index, start, end);
}

function lociForSelection(state, input, selection) {
    const side = selection?.side || 'target';
    return lociFromStructureExpression(
        state[side]?.structure,
        structureSelectionExpression(state, input, selection),
    );
}

function buildAlignmentMaps(query, target, input, sourceStructures = {}) {
    const alignmentMaps = {
        query: buildSideAlignmentMaps(query, input, 'query', sourceStructures.query),
        target: buildSideAlignmentMaps(target, input, 'target', sourceStructures.target),
    };
    return {
        alignmentMaps,
        structureResidues: {
            query: structureResidueAlignmentMap(alignmentMaps.query),
            target: structureResidueAlignmentMap(alignmentMaps.target),
        },
    };
}

function buildSideAlignmentMaps(structureRef, input, side, sourceStructureRef = structureRef) {
    const alignments = input?.alignments || [];
    const structureResidues = structureResiduesByChain(structureRef);

    return alignments.map((alignment, index) => {
        const sourceName = side === 'query' ? alignment.query : alignment.target;
        const sourceChain = getChainName(sourceName);
        const chain = structureChainForAlignment(input, side, sourceChain);
        const residues = structureResidues.get(chain) || [];
        const toStructure = new Map();

        const start = side === 'query' ? alignment.qStartPos : alignment.dbStartPos;
        const end = side === 'query' ? alignment.qEndPos : alignment.dbEndPos;
        if (input?.structureMode === 'interface') {
            const sourceResidues = structureResiduesByChain(sourceStructureRef).get(chain) || [];
            const displayLookup = residueNumberLookup(residues);
            const coordinates = parseInterfaceCa(alignment[side === 'query' ? 'qCa' : 'tCa']);

            // Interface qStartPos/dbStartPos address the extracted interface
            // sequence. Match each indexed CA to the source dimer, then use
            // its residue identity to locate the equivalent display residue.
            // This is the same mapping used by the final NGL implementation.
            coordinates.forEach((coordinate, offset) => {
                const sourceResidue = nearestStructureResidue(sourceResidues, coordinate);
                if (!sourceResidue) return;
                const residue = displayLookup.label.get(sourceResidue.labelResidue)
                    || displayLookup.auth.get(sourceResidue.authResidue);
                if (residue) toStructure.set(start + offset, residue);
            });
        } else {
            const lookup = residueNumberLookup(residues);
            for (const position of alignmentPositions(alignment, side)) {
                const residue = lookup.label.get(position) || lookup.auth.get(position);
                if (residue) toStructure.set(position, residue);
            }
        }
        return {
            index,
            side,
            sourceChain,
            chain,
            start: Math.min(start, end),
            end: Math.max(start, end),
            toStructure,
        };
    });
}

function parseInterfaceCa(value) {
    if (typeof value !== 'string' || !value) return [];
    const numbers = value.split(',').map(Number);
    const coordinates = [];
    for (let index = 0; index + 2 < numbers.length; index += 3) {
        if (numbers.slice(index, index + 3).every(Number.isFinite)) {
            coordinates.push(numbers.slice(index, index + 3));
        }
    }
    return coordinates;
}

function nearestStructureResidue(residues, [x, y, z]) {
    let nearest = null;
    let distanceSquared = Infinity;
    for (const residue of residues) {
        const dx = residue.x - x;
        const dy = residue.y - y;
        const dz = residue.z - z;
        const candidate = dx * dx + dy * dy + dz * dz;
        if (candidate < distanceSquared) {
            distanceSquared = candidate;
            nearest = residue;
        }
    }
    return nearest;
}

function structureResidueAlignmentMap(alignmentMaps) {
    const mapped = new Map();
    for (const map of alignmentMaps) {
        for (const [position, residue] of map.toStructure.entries()) {
            for (const key of structureResidueKeys(residue)) {
                if (!mapped.has(key)) {
                    mapped.set(key, {
                        chain: map.chain,
                        index: map.index,
                        residue: position,
                        structureResidue: residue,
                    });
                }
            }
        }
    }
    return mapped;
}

function structureChainForAlignment(input, side, sourceChain) {
    if (
        side === 'query'
        && input?.structureMode !== 'multimer'
        && input?.structureMode !== 'interface'
        && input?.queryChain
    ) {
        return input.queryChain;
    }
    return sourceChain;
}

function alignmentPositions(alignment, side) {
    const sequence = side === 'query' ? alignment?.qAln : alignment?.dbAln;
    let position = side === 'query' ? alignment?.qStartPos : alignment?.dbStartPos;
    if (!sequence || !Number.isFinite(position)) return [];

    const positions = [];
    for (const residue of sequence) {
        if (residue !== '-') {
            positions.push(position);
            position += 1;
        }
    }
    return positions;
}

function residueNumberLookup(residues) {
    const label = new Map();
    const auth = new Map();
    for (const residue of residues) {
        if (Number.isFinite(residue.labelResidue) && !label.has(residue.labelResidue)) {
            label.set(residue.labelResidue, residue);
        }
        if (Number.isFinite(residue.authResidue) && !auth.has(residue.authResidue)) {
            auth.set(residue.authResidue, residue);
        }
    }
    return { label, auth };
}

function atomGroupExpressionForFoldseekRange(state, side, index, start, end) {
    const map = state.alignmentMaps?.[side]?.[index];
    if (!map) return null;
    return expressionForResidues(residuesForMappedRange(map, start, end));
}

function alignmentChains(state, side) {
    return Array.from(new Set((state.alignmentMaps?.[side] || []).map(map => map.chain).filter(Boolean)));
}

function structureResiduesByChain(structureRef) {
    const structure = structureRef?.cell?.obj?.data;
    const residuesByChain = new Map();
    if (!structure) return residuesByChain;

    const seenResidues = new Set();
    const loc = StructureElement.Location.create(structure);

    for (const unit of structure.units) {
        if (!Unit.isAtomic(unit)) continue;
        loc.unit = unit;
        const size = OrderedSet.size(unit.elements);
        for (let i = 0; i < size; i++) {
            loc.element = OrderedSet.getAt(unit.elements, i);
            if (StructureProperties.atom.label_atom_id(loc) !== 'CA') continue;

            const authChain = StructureProperties.chain.auth_asym_id(loc);
            const labelChain = StructureProperties.chain.label_asym_id(loc);
            const authResidue = StructureProperties.residue.auth_seq_id(loc);
            const labelResidue = StructureProperties.residue.label_seq_id(loc);
            const key = `${labelChain}:${authChain}:${labelResidue}:${authResidue}`;
            if (seenResidues.has(key)) continue;
            seenResidues.add(key);
            const residue = {
                chain: labelChain || authChain,
                authChain,
                labelChain,
                labelResidue,
                authResidue,
                x: StructureProperties.atom.x(loc),
                y: StructureProperties.atom.y(loc),
                z: StructureProperties.atom.z(loc),
            };

            if (authChain) {
                if (!residuesByChain.has(authChain)) residuesByChain.set(authChain, []);
                residuesByChain.get(authChain).push(residue);
            }
            if (labelChain && labelChain !== authChain) {
                if (!residuesByChain.has(labelChain)) residuesByChain.set(labelChain, []);
                residuesByChain.get(labelChain).push(residue);
            }
        }
    }

    return residuesByChain;
}

async function buildFoldseekRepresentations(plugin, state, structure, side, input) {
    const mode = side === 'query' ? input.showQuery || 0 : input.showTarget || 0;
    const type = side === 'query' ? input.queryRepresentation || 'cartoon' : input.targetRepresentation || 'cartoon';
    const unalignedColor = input[`${side}UnalignedColor`] || (side === 'query' ? 0xa5cff5 : 0xffe699);
    const highlightColor = input[`${side}Color`] || (side === 'query' ? 0x1e88e5 : 0xffc107);
    const alpha = input?.[`${side}Alpha`];
    const base = await addUniformRepresentation(plugin, structure, {
        label: `${side}-base`,
        type,
        color: unalignedColor,
        typeParams: {
            ...(Number.isFinite(alpha) ? { alpha } : {}),
            ...(input?.representationQuality ? { qualityPreset: input.representationQuality } : {}),
        },
    });
    const stateEntry = {
        structure,
        mode,
        base,
        highlightColor,
        surfaces: [],
    };
    if (input?.structureMode === 'multimer' && side === 'query') {
        stateEntry.surfaces = await addQuerySurfaces(plugin, state, structure, input);
    }
    await applyFoldseekVisualState(plugin, state, stateEntry, input, side, mode);
    return stateEntry;
}

async function addQuerySurfaces(plugin, state, structure, input) {
    const defaultAlpha = input.chainSurfaceAlpha ?? 0.14;
    const promises = alignmentChains(state, 'query').map(async (chain, i) => {
        const typeParams = {
            alpha: defaultAlpha,
            visuals: ['structure-gaussian-surface-mesh'],
            quality: 'higher',
            smoothness: 1.5,
            density: 0.5,
            bumpFrequency: 0,
            bumpAmplitude: 0,
            transparentBackfaces: 'off',
            ignoreHydrogens: true,
            ignoreLight: true,
            doubleSided: false,
            flipSided: false,
            flatShaded: false,
            material: {
                metalness: 0,
                roughness: 1,
                bumpiness: 0,
            },
        };
        const label = `query-${chain}-chain-surface`;
        const surface = await addUniformRepresentation(
            plugin,
            structure,
            {
                label,
                expression: chainExpression(chain),
                type: 'gaussian-surface',
                color: ChainSurfaceColors[i % ChainSurfaceColors.length],
                typeParams,
            },
        );
        if (!surface) return null;
        setRepresentationNonPickable(surface);
        markNonSequenceMappable(state, surface);
        markNonHoverable(state, surface);
        return { ...surface, chain, level: 'chain' };
    });
    return (await Promise.all(promises)).filter(Boolean);
}

async function setSelectionMode(plugin, state, stateEntry, input, side, mode) {
    if (!stateEntry || stateEntry.mode === mode) return;
    stateEntry.mode = mode;
    await applyFoldseekVisualState(plugin, state, stateEntry, input, side, mode);
    focusVisibleStructure(plugin, stateEntry);
}

async function applyFoldseekVisualState(plugin, state, stateEntry, input, side, mode) {
    const ref = representationRef(stateEntry.base);
    if (!ref) return;

    const all = MS.struct.generator.all();
    const alignedExpression = mergeExpressions(
        (state.alignmentMaps?.[side] || []).map(map => atomGroupExpressionForFoldseekRange(state, side, map.index, map.start, map.end)),
    ) || all;
    const alignedChainsExpression = mergeExpressions(alignmentChains(state, side).map(chain => chainExpression(chain))) || all;
    const visibleExpression = mode === 1 || (mode !== 0 && side === 'query' && (input?.queryChain || input?.structureMode === 'multimer'))
        ? alignedChainsExpression
        : (mode === 0 ? alignedExpression : all);
    const hiddenExpression = mode === 2 && !(side === 'query' && (input?.queryChain || input?.structureMode === 'multimer'))
        ? null
        : MS.struct.modifier.exceptBy({ 0: all, by: visibleExpression });
    const overpaintLoci = lociFromStructureExpression(stateEntry.structure, alignedExpression);
    const hiddenLoci = hiddenExpression ? lociFromStructureExpression(stateEntry.structure, hiddenExpression) : null;
    stateEntry.visibleExpression = visibleExpression;

    await plugin.state.data.build()
        .to(ref)
        .applyOrUpdate(
            `${ref}-foldseek-overpaint`,
            StateTransforms.Representation.OverpaintStructureRepresentation3DFromBundle,
            {
                kind: 'element-loci',
                layers: overpaintLoci
                    ? [{ bundle: StructureElement.Bundle.fromLoci(overpaintLoci), color: stateEntry.highlightColor, clear: false }]
                    : [],
            },
            { tags: ['foldseek-visual-state'] },
        )
        .to(ref)
        .applyOrUpdate(
            `${ref}-foldseek-transparency`,
            StateTransforms.Representation.TransparencyStructureRepresentation3DFromBundle,
            {
                kind: 'element-loci',
                layers: hiddenLoci
                    ? [{ bundle: StructureElement.Bundle.fromLoci(hiddenLoci), value: 1 }]
                    : [],
            },
            { tags: ['foldseek-visual-state'] },
        )
        .commit({ doNotUpdateCurrent: true });
}

function focusVisibleStructure(plugin, stateEntry, options = {}) {
    const loci = lociFromStructureExpression(stateEntry?.structure, stateEntry?.visibleExpression);
    if (loci) {
        plugin.managers.camera.focusLoci(loci, {
            durationMs: options.durationMs ?? 250,
            extraRadius: 6,
            minRadius: 3,
        });
    } else {
        plugin.managers.camera.reset();
    }
}

function resetSceneState(state, input) {
    state.baseKey = sceneKey(input);
    state.query = null;
    state.target = null;
    state.arrows = null;
    state.chainLabels = null;
    state.tmAlignResults = null;
    state.focusKey = null;
    state.selectionKey = null;
    state.hoverSelectionKey = null;
    state.visibilityKey = null;
    state.hoverLoci = null;
    state.hoverKey = null;
    state.interfaceTargetBase = null;
    state.interfaceSeparation = [0, 0, 0];
    state.alignmentMaps = { query: [], target: [] };
    state.structureResidues = { query: new Map(), target: new Map() };
    state.interfaceRegions = { query: [], target: [] };
    state.interfaceSelections = { query: new Map(), target: new Map() };
    state.nonSequenceMappable = new WeakSet();
    state.nonHoverable = new WeakSet();
    state.structureSide = new WeakMap();
}

function baseSceneKey(input) {
    if (!input) return 'empty';
    return JSON.stringify({
        structureMode: input.structureMode || 'alignment',
        query: sourceKey(input.query),
        target: sourceKey(input.target),
        targetTransform: transformKey(input.targetTransform),
        alignments: (input.alignments || []).map(alignmentKey),
        superpositionAlignments: (input.superpositionAlignments || []).map(alignmentKey),
        queryIndex: input.queryIndex ?? null,
        queryChain: input.queryChain ?? null,
        queryRepresentation: input.queryRepresentation || 'cartoon',
        targetRepresentation: input.targetRepresentation || 'cartoon',
        queryAlpha: input.queryAlpha ?? null,
        targetAlpha: input.targetAlpha ?? null,
        representationQuality: input.representationQuality || null,
        queryColor: input.queryColor ?? null,
        targetColor: input.targetColor ?? null,
        queryUnalignedColor: input.queryUnalignedColor ?? null,
        targetUnalignedColor: input.targetUnalignedColor ?? null,
        chainSurfaceAlpha: input.chainSurfaceAlpha ?? null,
        arrowColor: input.arrowColor ?? null,
    });
}

function sourceKey(source) {
    if (!source) return null;
    return {
        format: source.format || '',
        label: source.label || '',
        data: source.data || '',
    };
}

function transformKey(transform) {
    if (!transform) return 'none';
    if (Array.isArray(transform)) return transform.join(',');
    if (typeof transform?.ref?.value === 'string') return transform.ref.value;
    if (Array.isArray(transform?.data)) return transform.data.join(',');
    return JSON.stringify(transform);
}

function alignmentKey(alignment) {
    return {
        id: alignment.id,
        query: alignment.query,
        target: alignment.target,
        db: alignment.db,
        qStartPos: alignment.qStartPos,
        qEndPos: alignment.qEndPos,
        dbStartPos: alignment.dbStartPos,
        dbEndPos: alignment.dbEndPos,
        qAln: alignment.qAln,
        dbAln: alignment.dbAln,
        complexu: alignment.complexu,
        complext: alignment.complext,
    };
}

function structureEventFromCurrent(state, current, type) {
    if (!isValidLoci(current?.loci)) return { type, residue: null };
    if (isNonHoverable(state, current)) return { type, residue: null };

    const side = structureSideForLoci(state, current.loci);
    const residueCandidates = side ? residueInfosFromLoci(current.loci) : [];
    if (!side || residueCandidates.length === 0) return { type, residue: null };

    const mapped = isNonSequenceMappable(state, current)
        ? null
        : mappedFoldseekResidue(state, side, residueCandidates);
    const residue = mapped?.structureResidue || residueCandidates[0];
    const chain = mapped?.chain || residue.chain;

    const event = {
        type,
        side,
        chain,
        authChain: residue.authChain,
        labelChain: residue.labelChain,
        residue: {
            chain,
            residue: residue.residue,
            oneLetter: residue.oneLetter,
            threeLetter: residue.threeLetter,
        },
        authResidue: residue.authResidue,
        labelResidue: residue.labelResidue,
        residues: residue.residues,
    };

    if (!mapped) {
        event.sequenceMappable = false;
        return event;
    }

    return {
        ...event,
        chain: mapped.chain,
        residue: {
            ...event.residue,
            chain: mapped.chain,
        },
        alignmentIndex: mapped.index,
        foldseekResidue: mapped.residue,
        residues: [mapped.residue],
    };
}

function structureSideForLoci(state, loci) {
    const structure = loci?.structure;
    return state.structureSide?.get(structure)
        || state.structureSide?.get(structure?.root)
        || null;
}

function registerStructureSide(state, side, structureRef) {
    const structure = structureRef?.cell?.obj?.data || structureRef;
    if (!structure) return;
    state.structureSide?.set(structure, side);
    if (structure.root) state.structureSide?.set(structure.root, side);
}

function mappedFoldseekResidue(state, side, residue) {
    const residues = Array.isArray(residue) ? residue : [residue];
    const mappedResidues = state.structureResidues?.[side];
    if (!mappedResidues) return null;

    for (const candidate of residues) {
        for (const key of structureResidueKeys(candidate)) {
            const mapped = mappedResidues.get(key);
            if (mapped) return mapped;
        }
    }
    return null;
}

function markNonSequenceMappable(state, item) {
    addRepresentationToSet(state.nonSequenceMappable, item, { includeComponent: true });
}

function markNonHoverable(state, item) {
    addRepresentationToSet(state.nonHoverable, item);
}

function isNonHoverable(state, current) {
    return Boolean(current?.repr && state.nonHoverable?.has(current.repr));
}

function isNonSequenceMappable(state, current) {
    return Boolean(
        (current?.repr && state.nonSequenceMappable?.has(current.repr))
        || (isValidLoci(current?.loci) && state.nonSequenceMappable?.has(current.loci.structure)),
    );
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

    const lociList = selections
        .map(selection => lociForSelection(state, input, selection))
        .filter(Boolean);

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
    const key = selectionKey(input?.hoverSelection, { state });
    if (state.hoverSelectionKey === key) return;
    state.hoverSelectionKey = key;

    const loci = input?.hoverSelection?.source === 'molstar'
        ? state.hoverLoci
        : lociForSelection(state, input, input?.hoverSelection);
    if (!loci) {
        plugin.managers.interactivity.lociHighlights.clearHighlights();
        return;
    }

    plugin.managers.interactivity.lociHighlights.highlightOnly({ loci }, false);
}

async function setTargetFocus(plugin, state, input) {
    // Interface mode has its own two-structure framing. A residual MSA focus
    // must not pull the camera back to the target after a display toggle.
    if (input?.structureMode === 'interface' && input?.structuresSeparated) return;
    const selection = input?.focusSelection;
    const key = selectionKey(selection, { focus: true });
    if (state.focusKey === key) return;
    state.focusKey = key;
    if (!selection) return;

    const loci = lociForSelection(state, input, selection);
    if (!loci) return;

    plugin.managers.camera.focusLoci(loci, {
        durationMs: 250,
        extraRadius: 6,
        minRadius: 3,
    });
}

async function rebuildScene(plugin, state, input) {
    await plugin.clear();
    await plugin.dataTransaction(async () => {
        resetSceneState(state, input);
        if (!input) return;

        let target = input.target ? await loadStructureFromData(plugin, input.target) : null;
        // Interface CA coordinates are expressed in the source target frame.
        // Keep that structure for residue matching before the display copy is
        // superposed onto the query.
        const interfaceTargetSource = target;
        const query = input.query ? await loadStructureFromData(plugin, input.query) : null;

        target = input?.structureMode === 'multimer'
            ? await prepareMultimerTarget(plugin, target, query, input, state)
            : await prepareSuperposedTarget(plugin, target, query, input, state);
        if (input?.structureMode === 'interface' && target && query) {
            // Keep TM-align and display layout as separate state transforms.
            // The latter can be updated independently when the toolbar toggle
            // is pressed, preserving the actual alignment transform.
            state.interfaceTargetBase = target;
            target = await transformStructureConformation(plugin, target, identityTransform());
        }
        registerStructureSide(state, 'target', target);
        registerStructureSide(state, 'query', query);
        const alignmentState = buildAlignmentMaps(query, target, input, {
            query,
            target: interfaceTargetSource || target,
        });
        state.alignmentMaps = alignmentState.alignmentMaps;
        state.structureResidues = alignmentState.structureResidues;
        if (input?.structureMode === 'interface') {
            prepareInterfaceState(state, input, { query, target: interfaceTargetSource });
        }

        if (target) {
            state.target = input?.structureMode === 'interface'
                ? await buildInterfaceRepresentations(plugin, state, target, 'target', input)
                : await buildFoldseekRepresentations(plugin, state, target, 'target', input);
        }

        if (query) {
            state.query = input?.structureMode === 'interface'
                ? await buildInterfaceRepresentations(plugin, state, query, 'query', input)
                : await buildFoldseekRepresentations(plugin, state, query, 'query', input);
        }
    });

    if (input?.structureMode === 'interface' && input?.structuresSeparated) {
        await setInterfaceSeparation(plugin, state, input, true, { animate: false });
    } else if (input?.structureMode === 'interface') {
        focusInterfaceStructures(plugin, state);
    } else {
        focusVisibleStructure(plugin, state.target || state.query);
    }
}

function interfaceSeparationTranslation(plugin, state, target, query) {
    const direction = screenStackDirection(plugin, target, query) || [0, -1, 0];
    // Separate the coloured interface patches, not the whole assemblies.
    // Long context tails are deliberately translucent and should not create a
    // large, data-dependent empty band between the two contact regions.
    const queryBounds = interfaceProjectionBounds(state.query, direction)
        || structureProjectionBounds(query, direction);
    const targetBounds = interfaceProjectionBounds(state.target, direction)
        || structureProjectionBounds(target, direction);
    const gap = queryBounds && targetBounds
        ? Math.max(
            0,
            (queryBounds.max - targetBounds.min) * InterfaceSeparationOverlapScale
                + InterfaceSeparationClearance,
        )
        : 24;
    return direction.map(value => value * gap);
}

function screenStackDirection(plugin, target, query) {
    const camera = plugin.canvas3d?.camera?.state;
    if (!camera) return null;

    // Once the PCA axes have been oriented, camera up is the screen Y axis.
    // Translating along it (or its negative) is therefore a planar vertical
    // stack, with no component towards or away from the camera.
    const up = Vec3.normalize(Vec3(), camera.up);
    if (Vec3.magnitude(up) < 0.001) return null;

    // Preserve the natural vertical arrangement around the aligned interface.
    // For example, if target-only barrels already project above the query,
    // translate the target upwards instead of carrying them through the query.
    const targetCenter = structureCenter(target);
    const queryCenter = structureCenter(query);
    if (targetCenter && queryCenter) {
        const targetAboveQuery = Vec3.dot(Vec3.sub(Vec3(), targetCenter, queryCenter), up);
        if (Math.abs(targetAboveQuery) > 0.01) {
            return targetAboveQuery > 0 ? up : Vec3.negate(up, up);
        }
    }
    return Vec3.negate(up, up);
}

async function orientInterfaceForSeparation(plugin, state) {
    const structures = [state.query?.structure, state.interfaceTargetBase || state.target?.structure]
        .map(ref => ref?.cell?.obj?.data)
        .filter(Boolean);
    if (structures.length === 0) return;

    // Mol*'s PCA orientation puts the longest principal axis along screen X.
    // Apply it before reading camera.up so the separation is always vertical
    // beside the longest plane, independent of the preceding user rotation.
    plugin.managers.camera.orientAxes(structures, 0);
    await new Promise(resolve => requestAnimationFrame(resolve));
}

function identityTransform() {
    return mat4FromRotationTranslation([0, 0, 0], [[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
}

function separationTransform(translation) {
    return mat4FromRotationTranslation(translation, [[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
}

async function setInterfaceSeparation(plugin, state, input, separated, { animate = true } = {}) {
    const target = state.target?.structure;
    if (!target) return;

    if (separated) await orientInterfaceForSeparation(plugin, state);

    const from = state.interfaceSeparation || [0, 0, 0];
    const to = separated
        ? interfaceSeparationTranslation(plugin, state, state.interfaceTargetBase || target, state.query?.structure)
        : [0, 0, 0];
    const steps = animate ? 10 : 1;
    for (let step = 1; step <= steps; step++) {
        const progress = step / steps;
        // Smoothstep eases into and out of the stacked position.
        const eased = progress * progress * (3 - 2 * progress);
        const translation = from.map((value, index) => value + (to[index] - value) * eased);
        await plugin.state.data.build()
            .to(target)
            .update({
                transform: {
                    name: 'matrix',
                    params: { data: separationTransform(translation), transpose: false },
                },
            })
            .commit({ doNotUpdateCurrent: true });
        if (animate && step < steps) await new Promise(resolve => setTimeout(resolve, 24));
    }
    state.interfaceSeparation = to;
    await setArrows(plugin, state, input, { force: true });
    // Let Mol* publish the final transformed bounds before deriving the camera
    // focus sphere; otherwise the camera can retain the overlay zoom.
    await new Promise(resolve => requestAnimationFrame(resolve));
    focusInterfaceStructures(plugin, state, { durationMs: 250 });
}

function focusInterfaceStructures(plugin, state, options = {}) {
    const all = MS.struct.generator.all();
    const loci = [state.query, state.target]
        .flatMap((entry) => {
            // In the default 1/3 view only the interface patches are visible;
            // focus those patches rather than invisible full-chain context.
            if (entry?.mode === 0 && entry.entries?.some(item => item.interfaceExpression)) {
                return entry.entries
                    .map(item => lociFromStructureExpression(entry.structure, item.interfaceExpression))
                    .filter(Boolean);
            }
            const loci = lociFromStructureExpression(entry?.structure, all);
            return loci ? [loci] : [];
        })
        .filter(Boolean);
    if (loci.length) {
        plugin.managers.camera.focusLoci(loci, {
            durationMs: options.durationMs ?? 0,
            extraRadius: 6,
            minRadius: 3,
        });
    } else {
        plugin.managers.camera.reset();
    }
}

function structureCenter(structureRef) {
    const structure = structureRef?.cell?.obj?.data;
    if (!structure?.units?.length) return null;

    const center = Vec3();
    let count = 0;
    for (const unit of structure.units) {
        const sphere = unit.lookup3d?.boundary?.sphere;
        if (!sphere) continue;
        Vec3.add(center, center, Vec3.transformMat4(Vec3(), sphere.center, unit.conformation.operator.matrix));
        count += 1;
    }
    return count > 0 ? Vec3.scale(center, center, 1 / count) : null;
}

function interfaceProjectionBounds(stateEntry, direction) {
    if (!stateEntry?.structure || !stateEntry.entries?.length) return null;
    const bounds = [];
    for (const entry of stateEntry.entries) {
        const loci = lociFromStructureExpression(stateEntry.structure, entry.interfaceExpression);
        const boundary = loci && StructureElement.Loci.getBoundary(loci);
        if (boundary?.box) bounds.push(projectBoxBounds(boundary.box, direction));
    }
    return mergeProjectionBounds(bounds);
}

function structureProjectionBounds(structureRef, direction) {
    const structure = structureRef?.cell?.obj?.data;
    if (!structure?.units?.length) return null;
    const bounds = [];
    for (const unit of structure.units) {
        const sphere = unit.lookup3d?.boundary?.sphere;
        if (!sphere) continue;
        const center = Vec3.transformMat4(Vec3(), sphere.center, unit.conformation.operator.matrix);
        const projection = Vec3.dot(center, direction);
        bounds.push({ min: projection - sphere.radius, max: projection + sphere.radius });
    }
    return mergeProjectionBounds(bounds);
}

function projectBoxBounds(box, direction) {
    let min = Infinity;
    let max = -Infinity;
    for (const x of [box.min[0], box.max[0]]) {
        for (const y of [box.min[1], box.max[1]]) {
            for (const z of [box.min[2], box.max[2]]) {
                const projection = direction[0] * x + direction[1] * y + direction[2] * z;
                min = Math.min(min, projection);
                max = Math.max(max, projection);
            }
        }
    }
    return { min, max };
}

function mergeProjectionBounds(bounds) {
    if (!bounds.length) return null;
    return {
        min: Math.min(...bounds.map(bound => bound.min)),
        max: Math.max(...bounds.map(bound => bound.max)),
    };
}

async function prepareSuperposedTarget(plugin, target, query, input, state) {
    if (!target || !query) return target;
    if (input.targetTransform) {
        return transformStructureConformation(plugin, target, input.targetTransform);
    }
    const superposition = await superposeTargetWithFoldseekAlignment(
        plugin,
        target,
        query,
        input.superpositionAlignments || input.alignments,
        input,
    );
    state.tmAlignResults = superposition.results;
    return superposition.structure;
}

async function superposeTargetWithFoldseekAlignment(plugin, target, query, alignments, input) {
    if (!alignments?.length || !alignments[0]?.qAln || !alignments[0]?.dbAln) {
        return { structure: target, results: null };
    }
    const queryPdb = makeAlignedCaPdb(query, rangesByChain(alignments, 'query', input));
    const targetPdb = makeAlignedCaPdb(target, rangesByChain(alignments, 'target', input));
    if (!queryPdb || !targetPdb) {
        return { structure: target, results: null };
    }
    const alnFasta = `>target\n${alignments[0].dbAln}\n\n>query\n${alignments[0].qAln}`;
    const tm = await tmalign(targetPdb, queryPdb, alnFasta);
    const { t, u } = parseTMMatrix(tm.matrix);
    return {
        structure: await transformStructureConformation(plugin, target, mat4FromRotationTranslation(t, u)),
        results: parseTMOutput(tm.output),
    };
}

function makeAlignedCaPdb(structureRef, ranges) {
    const structure = structureRef?.cell?.obj?.data;
    if (!structure || ranges.size === 0) return '';

    const rows = [];
    const loc = StructureElement.Location.create(structure);
    let serial = 1;
    const chainOrdinals = new Map();

    for (const unit of structure.units) {
        if (!Unit.isAtomic(unit)) continue;
        loc.unit = unit;

        const { elements } = unit;
        const size = OrderedSet.size(elements);
        for (let i = 0; i < size; i++) {
            loc.element = OrderedSet.getAt(elements, i);

            const atomName = StructureProperties.atom.label_atom_id(loc);
            if (atomName !== 'CA') continue;

            const authChain = StructureProperties.chain.auth_asym_id(loc) || '';
            const labelChain = StructureProperties.chain.label_asym_id(loc) || '';
            const chain = ranges.has(authChain) ? authChain : (ranges.has(labelChain) ? labelChain : null);
            if (!chain) continue;
            const chainRanges = ranges.get(chain);

            const ordinalKey = chain || authChain || labelChain || 'A';
            const ordinal = (chainOrdinals.get(ordinalKey) || 0) + 1;
            chainOrdinals.set(ordinalKey, ordinal);

            if (!alignedOrdinalInRanges(chainRanges, ordinal)) continue;

            rows.push(atomToPdbRow({
                serial,
                atomName,
                resName: StructureProperties.atom.auth_comp_id(loc) || StructureProperties.atom.label_comp_id(loc) || 'ALA',
                chain,
                resno: ordinal,
                x: StructureProperties.atom.x(loc),
                y: StructureProperties.atom.y(loc),
                z: StructureProperties.atom.z(loc),
            }));
            serial += 1;
        }
    }

    return rows.join('\n');
}

function alignedOrdinalInRanges(ranges, ordinal) {
    return ranges.some(([start, end]) => ordinal >= start && ordinal <= end);
}

async function prepareMultimerTarget(plugin, target, query, input, state) {
    if (!target) return target;
    if (input.targetTransform) {
        return transformStructureConformation(plugin, target, input.targetTransform);
    }
    return prepareSuperposedTarget(plugin, target, query, input, state);
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
    diffInput,

    async update(plugin, state, input, previous, change = null) {
        const plan = change || {
            rebuild: true,
            visibility: true,
            selection: true,
            hover: true,
            focus: true,
        };

        if (plan.rebuild && state.baseKey !== sceneKey(input)) {
            await rebuildScene(plugin, state, input);
        }
        if (!plan.rebuild && separationChanged(previous, input)) {
            await setInterfaceSeparation(plugin, state, input, Boolean(input?.structuresSeparated));
        }
        if (plan.visibility) {
            await plugin.dataTransaction(async () => {
                if (input?.structureMode === 'interface') {
                    await applyInterfaceVisibility(plugin, state, input);
                    await setArrows(plugin, state, input);
                    await setChainLabels(plugin, state, input);
                    return;
                }
                const queryMode = input?.showQuery || 0;
                const targetMode = input?.showTarget || 0;
                const key = standardVisibilityKey(input, queryMode, targetMode);
                if (state.visibilityKey === key) return;
                state.visibilityKey = key;
                if (state.query) await setSelectionMode(plugin, state, state.query, input, 'query', queryMode);
                if (state.target) await setSelectionMode(plugin, state, state.target, input, 'target', targetMode);
                await setArrows(plugin, state, input);
                await setChainLabels(plugin, state, input);
            });
        }
        if (plan.selection) await setStructureSelection(plugin, state, input);
        if (plan.hover) await setStructureHover(plugin, state, input);
        if (plan.focus) await setTargetFocus(plugin, state, input);
    },

    onHover(plugin, state, input, event) {
        return handleStructureHover(plugin, state, event);
    },

    onClick(plugin, state, input, event) {
        return structureEventFromCurrent(state, event?.current, 'structure-click');
    },

    resetView(plugin, state, input, options = {}) {
        focusVisibleStructure(plugin, state?.target || state?.query, options);
    },

    async makeCIF(plugin, state, input) {
        return makeCIF(state, input);
    },
};

import { OrderedSet } from 'molstar/lib/mol-data/int';
import { StructureElement, StructureProperties, Unit } from 'molstar/lib/mol-model/structure';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { getChainName } from './foldseekUtilities.js';
import {
    mergeExpressions,
    residueRangeExpression,
    residueRangeTest,
} from './selectionExpressions.js';

export function rangesByChain(alignments, side, chainResolver = null) {
    const ranges = new Map();
    for (const { chain, start, end } of alignmentRegions(alignments, side, chainResolver)) {
        if (!ranges.has(chain)) ranges.set(chain, []);
        ranges.get(chain).push([start, end]);
    }
    return ranges;
}

function chainsBySide(alignments, side, chainResolver = null) {
    return Array.from(new Set(alignmentRegions(alignments, side, chainResolver).map(({ chain }) => chain)));
}

export function alignmentRegions(alignments, side, chainResolver = null) {
    const regions = [];
    for (const alignment of alignments || []) {
        const name = side === 'query' ? alignment.query : alignment.target;
        const start = side === 'query' ? alignment.qStartPos : alignment.dbStartPos;
        const end = side === 'query' ? alignment.qEndPos : alignment.dbEndPos;
        if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
        regions.push({
            chain: resolveChain(chainResolver, getChainName(name)),
            start: Math.min(start, end),
            end: Math.max(start, end),
        });
    }
    return regions;
}

export function selectionExpressionForChains(alignments, side, chainResolver = null) {
    return mergeSelectionExpressions(chainsBySide(alignments, side, chainResolver).map(chain => atomGroupExpression(chain)));
}

export function chainColorEntries(input, side, palettes) {
    const palette = side === 'query' ? palettes.query : palettes.target;
    const seen = new Set();
    const entries = [];
    for (const { chain } of alignmentRegions(input.alignments, side)) {
        if (seen.has(chain)) continue;
        seen.add(chain);
        entries.push({
            chain,
            color: palette[entries.length % palette.length],
        });
    }
    return entries;
}

export function interfaceExpressionForChain(state, side, chain) {
    const expressions = (state.interfaceRegions?.[side] || [])
        .filter(region => region.chain === chain)
        .map(({ start, end }) => atomGroupExpression(chain, start, end));
    return mergeSelectionExpressions(expressions);
}

export function baseSelectionExpressionForMode(state, input, side, mode) {
    const chainResolver = stateChainResolver(state, side);
    if (input?.structureMode === 'interface' && mode === 0) {
        return selectionExpressionForInterface(state, side)
            || selectionExpressionForChains(input.alignments, side, chainResolver)
            || MS.struct.generator.all();
    }
    return alignedSelectionExpression(state, input, side) || MS.struct.generator.all();
}

function selectionExpressionForMode(state, input, side, mode) {
    const queryChain = activeQueryChainExpression(input, side);
    if (mode === 0) {
        return baseSelectionExpressionForMode(state, input, side, mode);
    }
    if (mode === 1) {
        if (queryChain) return queryChain;
        return selectionExpressionForChains(input.alignments, side, stateChainResolver(state, side)) || MS.struct.generator.all();
    }
    return MS.struct.generator.all();
}

function activeQueryChainExpression(input, side) {
    if (side !== 'query' || !input?.queryChain) return null;
    return atomGroupExpression(input.queryChain);
}

export function backgroundExpressionForMode(state, input, side, mode) {
    if (mode === 0) return null;

    const visible = selectionExpressionForMode(state, input, side, mode);
    const base = alignedSelectionExpression(state, input, side);
    if (!base) return visible;

    return MS.struct.modifier.exceptBy({
        0: visible,
        by: base,
    });
}

export function alignedSelectionExpression(state, input, side) {
    return mergeSelectionExpressions(
        alignmentRegions(input?.alignments, side, stateChainResolver(state, side)).map(({ chain, start, end }) => (
            atomGroupExpressionForAlignmentRange(state, side, chain, start, end, start)
        )),
    );
}

export function structureSelectionExpression(state, input, selection) {
    const side = selection?.side || 'target';
    const alignment = input?.alignments?.[selection?.index];
    if (!alignment || !Number.isFinite(selection.start) || !Number.isFinite(selection.length)) return null;
    const start = selection.start;
    const end = selection.start + Math.max(0, selection.length - 1);
    if (!Number.isFinite(end) || end < start) return null;
    const chain = resolvedChainForState(state, side, getChainName(alignment[side]));
    const alignmentStart = side === 'query' ? alignment.qStartPos : alignment.dbStartPos;

    if (input?.structureMode === 'interface') {
        const residues = (state.interfaceResidueMap?.[side]?.[chain] || []).filter(entry => (
            (entry.labelResidue >= start && entry.labelResidue <= end)
            || (entry.authResidue >= start && entry.authResidue <= end)
        ));
        return atomGroupExpressionForResidueMap(chain, residues);
    }

    return atomGroupExpressionForAlignmentRange(state, side, chain, start, end, alignmentStart);
}

export function resolvedChainForState(state, side, chain) {
    return resolveChain(stateChainResolver(state, side), chain);
}

export function stateChainResolver(state, side) {
    return (chain) => state?.chainOverrides?.[side]?.[chain] || chain;
}

function resolveChain(chainResolver, chain) {
    return typeof chainResolver === 'function' ? chainResolver(chain) : chain;
}

export function atomGroupExpression(chain, start, end) {
    return residueRangeExpression(chain, start, end);
}

export function structureChains(structureRef) {
    const structure = structureRef?.cell?.obj?.data;
    if (!structure) return [];

    const entries = [];
    const seenEntries = new Set();
    const loc = StructureElement.Location.create(structure);
    for (const unit of structure.units) {
        if (!Unit.isAtomic(unit)) continue;
        loc.unit = unit;
        const size = OrderedSet.size(unit.elements);
        for (let i = 0; i < size; i++) {
            loc.element = OrderedSet.getAt(unit.elements, i);
            const auth = StructureProperties.chain.auth_asym_id(loc) || '';
            const label = StructureProperties.chain.label_asym_id(loc) || '';
            const key = `${auth}:${label}`;
            if (seenEntries.has(key)) continue;
            seenEntries.add(key);
            entries.push({ auth, label });
        }
    }

    const authChains = uniqueChains(entries.map(entry => entry.auth).filter(Boolean));
    const labelChains = uniqueChains(entries.map(entry => entry.label).filter(Boolean));
    if (labelChains.length > authChains.length) return labelChains;
    if (authChains.length > 0) return authChains;
    if (labelChains.length > 0) return labelChains;
    return [];
}

function uniqueChains(values) {
    const seen = new Set();
    const chains = [];
    for (const value of values) {
        if (seen.has(value)) continue;
        seen.add(value);
        chains.push(value);
    }
    return chains;
}

export function mergeSelectionExpressions(expressions) {
    return mergeExpressions(expressions);
}

export function computeResidueMaps(query, target, input, chainOverrides = {}) {
    return {
        query: structureResidueMap(query, chainsBySide(input.alignments, 'query', stateChainResolver({ chainOverrides }, 'query'))),
        target: structureResidueMap(target, chainsBySide(input.alignments, 'target', stateChainResolver({ chainOverrides }, 'target'))),
    };
}

function residueRanges(residues) {
    if (residues.length === 0) return [];
    const ranges = [];
    let start = residues[0];
    let prev = start;
    for (let i = 1; i < residues.length; i++) {
        if (residues[i] === prev + 1) {
            prev = residues[i];
            continue;
        }
        ranges.push([start, prev]);
        start = residues[i];
        prev = residues[i];
    }
    ranges.push([start, prev]);
    return ranges;
}

export function computeInterfaceRegions(query, target, input) {
    if (input?.structureMode !== 'interface') {
        return {
            regions: { query: [], target: [] },
            residueMap: { query: {}, target: {} },
        };
    }
    const queryChains = chainsBySide(input.alignments, 'query');
    const targetChains = chainsBySide(input.alignments, 'target');
    const queryInterface = interfaceRegions(query, queryChains, input.interfaceCutoff);
    const targetInterface = interfaceRegions(target, targetChains, input.interfaceCutoff);
    return {
        regions: {
            query: queryInterface.regions,
            target: targetInterface.regions,
        },
        residueMap: {
            query: structureResidueMap(query, queryChains),
            target: structureResidueMap(target, targetChains),
        },
    };
}

function selectionExpressionForInterface(state, side) {
    return mergeSelectionExpressions(
        (state.interfaceRegions?.[side] || []).map(({ chain, start, end }) => atomGroupExpression(chain, start, end)),
    );
}

function atomGroupExpressionForResidueMap(chain, residues) {
    if (!residues.length) return null;

    const labelResidues = residues
        .map(entry => entry.labelResidue)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
    const authResidues = residues
        .filter(entry => !Number.isFinite(entry.labelResidue))
        .map(entry => entry.authResidue)
        .filter(Number.isFinite)
        .sort((a, b) => a - b);
    const expressions = [
        ...residueRanges(labelResidues).map(([start, end]) => atomGroupExpressionForProperty(chain, MS.struct.atomProperty.macromolecular.label_seq_id(), start, end)),
        ...residueRanges(authResidues).map(([start, end]) => atomGroupExpressionForProperty(chain, MS.struct.atomProperty.macromolecular.auth_seq_id(), start, end)),
    ];
    return mergeSelectionExpressions(expressions);
}

function atomGroupExpressionForAlignmentRange(state, side, chain, start, end, alignmentStart) {
    const residueMap = state.residueMap?.[side]?.[chain] || [];
    const residues = residuesForFoldseekRange(residueMap, start, end, alignmentStart);
    return atomGroupExpressionForResidueMap(chain, residues);
}

function residuesForFoldseekRange(residueMap, start, end, alignmentStart) {
    if (!Number.isFinite(alignmentStart)) return [];
    const from = Math.max(0, start - alignmentStart);
    const to = end - alignmentStart;
    return to >= 0 ? residueMap.slice(from, to + 1) : [];
}

function atomGroupExpressionForProperty(chain, residueProperty, start, end) {
    const { or } = MS.core.logic;
    const { eq } = MS.core.rel;
    const { macromolecular } = MS.struct.atomProperty;
    return MS.struct.generator.atomGroups({
        'chain-test': or([
            eq([macromolecular.auth_asym_id(), chain]),
            eq([macromolecular.label_asym_id(), chain]),
        ]),
        'residue-test': residueRangeTest(residueProperty, start, end),
    });
}

function interfaceRegions(structureRef, chains, cutoff = 10) {
    const structure = structureRef?.cell?.obj?.data;
    if (!structure) return { regions: [] };

    const chainSet = new Set(chains);
    const residuesByChain = new Map();
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
            const chain = chainSet.has(authChain) ? authChain : (chainSet.has(labelChain) ? labelChain : null);
            if (!chain) continue;

            if (!residuesByChain.has(chain)) residuesByChain.set(chain, []);
            residuesByChain.get(chain).push({
                residue: StructureProperties.residue.label_seq_id(loc) || StructureProperties.residue.auth_seq_id(loc),
                x: StructureProperties.atom.x(loc),
                y: StructureProperties.atom.y(loc),
                z: StructureProperties.atom.z(loc),
            });
        }
    }

    const cutoffSq = cutoff * cutoff;
    const hits = new Map(Array.from(chainSet).map(chain => [chain, new Set()]));
    for (const [chain, residues] of residuesByChain.entries()) {
        const otherResidues = [];
        for (const [otherChain, entries] of residuesByChain.entries()) {
            if (otherChain !== chain) otherResidues.push(...entries);
        }

        for (const residue of residues) {
            if (otherResidues.some(other => squaredDistance(residue, other) <= cutoffSq)) {
                hits.get(chain)?.add(residue.residue);
            }
        }
    }

    const regions = [];
    for (const [chain, residues] of hits.entries()) {
        const ordered = Array.from(residues).sort((a, b) => a - b);
        for (const [start, end] of residueRanges(ordered)) {
            regions.push({ chain, start, end });
        }
    }
    return { regions };
}

function structureResidueMap(structureRef, chains) {
    const structure = structureRef?.cell?.obj?.data;
    if (!structure) return {};

    const chainSet = new Set(chains);
    const residuesByChain = new Map(Array.from(chainSet).map(chain => [chain, []]));
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
            const chain = chainSet.has(authChain) ? authChain : (chainSet.has(labelChain) ? labelChain : null);
            if (!chain) continue;

            const authResidue = StructureProperties.residue.auth_seq_id(loc);
            const labelResidue = StructureProperties.residue.label_seq_id(loc);
            const key = `${chain}:${labelResidue}:${authResidue}`;
            if (seenResidues.has(key)) continue;
            seenResidues.add(key);
            residuesByChain.get(chain)?.push({ labelResidue, authResidue });
        }
    }

    return Object.fromEntries(residuesByChain);
}

function squaredDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
}

import {
    caResiduesByChain,
    expressionForResidues,
    nearestResidue,
    parseCaCoordinates,
    residuesForMappedRange,
    structureResidueKeys,
} from './molstarStructure.js';
import { getChainName } from './foldseekData.js';

export function rangesByChain(alignments, side, input = null) {
    const ranges = new Map();
    for (const { chain, start, end } of alignmentRegions(alignments, side, input)) {
        if (!ranges.has(chain)) ranges.set(chain, []);
        ranges.get(chain).push([start, end]);
    }
    return ranges;
}

export function buildAlignmentMaps(query, target, input, sourceStructures = {}) {
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

export function atomGroupExpressionForFoldseekRange(state, side, index, start, end) {
    const map = state.alignmentMaps?.[side]?.[index];
    return map ? expressionForResidues(residuesForMappedRange(map, start, end)) : null;
}

export function alignmentChains(state, side) {
    return Array.from(new Set((state.alignmentMaps?.[side] || []).map(map => map.chain).filter(Boolean)));
}

function alignmentRegions(alignments, side, input) {
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

function buildSideAlignmentMaps(structureRef, input, side, sourceStructureRef = structureRef) {
    const structureResidues = caResiduesByChain(structureRef);
    const sourceStructureResidues = input?.structureMode === 'interface'
        ? caResiduesByChain(sourceStructureRef)
        : null;

    return (input?.alignments || []).map((alignment, index) => {
        const sourceChain = getChainName(side === 'query' ? alignment.query : alignment.target);
        const chain = structureChainForAlignment(input, side, sourceChain);
        const residues = structureResidues.get(chain) || [];
        const toStructure = new Map();
        const start = side === 'query' ? alignment.qStartPos : alignment.dbStartPos;
        const end = side === 'query' ? alignment.qEndPos : alignment.dbEndPos;

        if (input?.structureMode === 'interface') {
            const displayLookup = residueNumberLookup(residues);
            const coordinates = parseCaCoordinates(alignment[side === 'query' ? 'qCa' : 'tCa']);
            const sourceResidues = sourceStructureResidues.get(chain) || [];
            coordinates.forEach((coordinate, offset) => {
                const sourceResidue = nearestResidue(sourceResidues, coordinate);
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
        return { index, side, sourceChain, chain, start: Math.min(start, end), end: Math.max(start, end), toStructure };
    });
}

function structureResidueAlignmentMap(alignmentMaps) {
    const mapped = new Map();
    for (const map of alignmentMaps) {
        for (const [position, residue] of map.toStructure.entries()) {
            for (const key of structureResidueKeys(residue)) {
                if (!mapped.has(key)) mapped.set(key, { chain: map.chain, index: map.index, residue: position, structureResidue: residue });
            }
        }
    }
    return mapped;
}

function structureChainForAlignment(input, side, sourceChain) {
    return side === 'query'
        && input?.structureMode !== 'multimer'
        && input?.structureMode !== 'interface'
        && input?.queryChain
        ? input.queryChain
        : sourceChain;
}

function alignmentPositions(alignment, side) {
    const sequence = side === 'query' ? alignment?.qAln : alignment?.dbAln;
    let position = side === 'query' ? alignment?.qStartPos : alignment?.dbStartPos;
    if (!sequence || !Number.isFinite(position)) return [];
    const positions = [];
    for (const residue of sequence) {
        if (residue !== '-') positions.push(position++);
    }
    return positions;
}

function residueNumberLookup(residues) {
    const label = new Map();
    const auth = new Map();
    for (const residue of residues) {
        if (Number.isFinite(residue.labelResidue) && !label.has(residue.labelResidue)) label.set(residue.labelResidue, residue);
        if (Number.isFinite(residue.authResidue) && !auth.has(residue.authResidue)) auth.set(residue.authResidue, residue);
    }
    return { label, auth };
}

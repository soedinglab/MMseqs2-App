import { OrderedSet } from 'molstar/lib/mol-data/int';
import { StructureElement, StructureProperties, Unit } from 'molstar/lib/mol-model/structure';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { getChainName } from './foldseekUtilities.js';

export function rangesByChain(alignments, side) {
    const ranges = new Map();
    for (const { chain, start, end } of alignmentRegions(alignments, side)) {
        if (!ranges.has(chain)) ranges.set(chain, []);
        ranges.get(chain).push([start, end]);
    }
    return ranges;
}

function chainsBySide(alignments, side) {
    return Array.from(new Set(alignmentRegions(alignments, side).map(({ chain }) => chain)));
}

function selectionExpressionForRanges(alignments, side) {
    return mergeSelectionExpressions(
        alignmentRegions(alignments, side).map(({ chain, start, end }) => atomGroupExpression(chain, start, end)),
    );
}

export function alignmentRegions(alignments, side) {
    const regions = [];
    for (const alignment of alignments || []) {
        const name = side === 'query' ? alignment.query : alignment.target;
        const start = side === 'query' ? alignment.qStartPos : alignment.dbStartPos;
        const end = side === 'query' ? alignment.qEndPos : alignment.dbEndPos;
        if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
        regions.push({
            chain: getChainName(name),
            start: Math.min(start, end),
            end: Math.max(start, end),
        });
    }
    return regions;
}

export function selectionExpressionForChains(alignments, side) {
    return mergeSelectionExpressions(chainsBySide(alignments, side).map(chain => atomGroupExpression(chain)));
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
    if (input?.structureMode === 'interface' && mode === 0) {
        return selectionExpressionForInterface(state, side)
            || selectionExpressionForChains(input.alignments, side)
            || MS.struct.generator.all();
    }
    return selectionExpressionForRanges(input.alignments, side) || MS.struct.generator.all();
}

function selectionExpressionForMode(state, input, side, mode) {
    if (mode === 0) {
        return baseSelectionExpressionForMode(state, input, side, mode);
    }
    if (mode === 1) {
        return selectionExpressionForChains(input.alignments, side) || MS.struct.generator.all();
    }
    return MS.struct.generator.all();
}

export function backgroundExpressionForMode(state, input, side, mode) {
    if (mode === 0) return null;

    const visible = selectionExpressionForMode(state, input, side, mode);
    const base = baseSelectionExpressionForMode(state, input, side, 0);
    if (!base) return visible;

    return MS.struct.modifier.exceptBy({
        0: visible,
        by: base,
    });
}

export function structureSelectionExpression(state, input, selection) {
    const side = selection?.side || 'target';
    const alignment = input?.alignments?.[selection?.index];
    if (!alignment || !Number.isFinite(selection.start) || !Number.isFinite(selection.length)) return null;
    const start = selection.start;
    const end = selection.start + Math.max(0, selection.length - 1);
    if (!Number.isFinite(end) || end < start) return null;
    const chain = getChainName(alignment[side]);

    if (input?.structureMode === 'interface') {
        const residueMap = (state.interfaceResidueMap?.[side] || []).filter(entry => entry.chain === chain);
        let residues = residueMap.filter(entry => entry.alignmentResidue >= start && entry.alignmentResidue <= end);
        if (residues.length === 0) {
            residues = residueMap.filter(entry => entry.authResidue >= start && entry.authResidue <= end);
        }
        return atomGroupExpressionForResidueMap(chain, residues);
    }

    return atomGroupExpression(chain, start, end);
}

export function atomGroupExpression(chain, start, end) {
    const { and, or } = MS.core.logic;
    const { eq, gre, lte } = MS.core.rel;
    const { macromolecular } = MS.struct.atomProperty;
    const tests = {
        'chain-test': or([
            eq([macromolecular.auth_asym_id(), chain]),
            eq([macromolecular.label_asym_id(), chain]),
        ]),
    };
    if (Number.isFinite(start) || Number.isFinite(end)) {
        tests['residue-test'] = or([
            residueRangeTest(macromolecular.auth_seq_id(), start, end),
            residueRangeTest(macromolecular.label_seq_id(), start, end),
        ]);
    }
    return MS.struct.generator.atomGroups(tests);
}

export function mergeSelectionExpressions(expressions) {
    const valid = expressions.filter(Boolean);
    if (valid.length === 0) return null;
    if (valid.length === 1) return valid[0];
    return MS.struct.combinator.merge(valid.map(expression => MS.struct.modifier.union([expression])));
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
            residueMap: { query: [], target: [] },
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

function residueRangeTest(property, start, end) {
    const { and } = MS.core.logic;
    const { gre, lte } = MS.core.rel;
    const tests = [];
    if (Number.isFinite(start)) tests.push(gre([property, start]));
    if (Number.isFinite(end)) tests.push(lte([property, end]));
    return tests.length === 1 ? tests[0] : and(tests);
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
    if (!structure) return [];

    const chainSet = new Set(chains);
    const residuesByChain = new Map(Array.from(chainSet).map(chain => [chain, new Map()]));
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
            const alignmentResidue = labelResidue || authResidue;
            if (Number.isFinite(alignmentResidue)) {
                residuesByChain.get(chain)?.set(alignmentResidue, {
                    chain,
                    alignmentResidue,
                    labelResidue,
                    authResidue,
                });
            }
        }
    }

    const residueMap = [];
    for (const residues of residuesByChain.values()) {
        residueMap.push(...Array.from(residues.values()).sort((a, b) => a.alignmentResidue - b.alignmentResidue));
    }
    return residueMap;
}

function squaredDistance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dz = a.z - b.z;
    return dx * dx + dy * dy + dz * dz;
}

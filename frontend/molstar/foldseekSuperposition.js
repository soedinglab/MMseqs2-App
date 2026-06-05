import { OrderedSet } from 'molstar/lib/mol-data/int';
import { StructureElement, StructureProperties, Unit } from 'molstar/lib/mol-model/structure';
import { tmalign, parse as parseTMOutput, parseMatrix as parseTMMatrix } from 'tmalign-wasm';
import { rangesByChain } from './foldseekSelections.js';
import { mat4FromRotationTranslation, transformStructureConformation } from './transforms.js';

export async function superposeTargetWithFoldseekAlignment(plugin, target, query, alignments, chainOverrides = {}) {
    if (!alignments?.length || !alignments[0]?.qAln || !alignments[0]?.dbAln) {
        return { structure: target, results: null };
    }

    const queryPdb = makeAlignedCaPdb(query, rangesByChain(alignments, 'query', chainResolver(chainOverrides.query)), true);
    const targetPdb = makeAlignedCaPdb(target, rangesByChain(alignments, 'target', chainResolver(chainOverrides.target)), false);
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

function chainResolver(overrides = {}) {
    return (chain) => overrides?.[chain] || chain;
}

function makeAlignedCaPdb(structureRef, ranges, useRangeStart) {
    const structure = structureRef?.cell?.obj?.data;
    if (!structure || ranges.size === 0) return '';

    const rows = [];
    const loc = StructureElement.Location.create(structure);
    let serial = 1;
    const chainOrdinals = new Map();
    const fallbackRanges = hasSingleStructureChain(structure) && ranges.size === 1
        ? ranges.values().next().value
        : null;

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
            const match = matchingChainRanges(ranges, authChain, labelChain, fallbackRanges);
            if (!match) continue;

            const ordinalKey = match.chain || authChain || labelChain || 'A';
            const ordinal = (chainOrdinals.get(ordinalKey) || 0) + 1;
            chainOrdinals.set(ordinalKey, ordinal);

            const resno = matchingResidueNumber(match.ranges, ordinal, useRangeStart);
            if (!Number.isFinite(resno)) continue;

            rows.push(atomToPdbRow({
                serial,
                atomName,
                resName: StructureProperties.atom.auth_comp_id(loc) || StructureProperties.atom.label_comp_id(loc) || 'ALA',
                chain: match.chain || authChain || labelChain || 'A',
                resno,
                x: StructureProperties.atom.x(loc),
                y: StructureProperties.atom.y(loc),
                z: StructureProperties.atom.z(loc),
            }));
            serial += 1;
        }
    }

    return rows.join('\n');
}

function matchingChainRanges(ranges, authChain, labelChain, fallbackRanges) {
    if (authChain && ranges.has(authChain)) {
        return { chain: authChain, ranges: ranges.get(authChain) };
    }
    if (labelChain && ranges.has(labelChain)) {
        return { chain: labelChain, ranges: ranges.get(labelChain) };
    }
    if (fallbackRanges) {
        const chain = ranges.keys().next().value || authChain || labelChain || 'A';
        return { chain, ranges: fallbackRanges };
    }
    return null;
}

function matchingResidueNumber(ranges, ordinal, useRangeStart) {
    const range = useRangeStart
        ? ranges.find(([start, end]) => ordinal >= start && ordinal <= end)
        : ranges.find(([start, end]) => ordinal >= 1 && ordinal <= (end - start + 1));
    return range ? ordinal : undefined;
}

function hasSingleStructureChain(structure) {
    const chains = new Set();
    const loc = StructureElement.Location.create(structure);
    for (const unit of structure.units) {
        if (!Unit.isAtomic(unit)) continue;
        loc.unit = unit;
        const size = OrderedSet.size(unit.elements);
        for (let i = 0; i < size; i++) {
            loc.element = OrderedSet.getAt(unit.elements, i);
            const auth = StructureProperties.chain.auth_asym_id(loc) || '';
            const label = StructureProperties.chain.label_asym_id(loc) || '';
            chains.add(`${auth}:${label}`);
            if (chains.size > 1) return false;
        }
    }
    return chains.size <= 1;
}

function atomToPdbRow(atom) {
    const atomName = formatAtomName(atom.atomName, atom.element || atom.atomName?.[0] || 'C');
    return [
        (atom.group || 'ATOM').padEnd(6).slice(0, 6),
        String(atom.serial).padStart(5),
        ' ',
        atomName,
        atom.altId || ' ',
        atom.resName.slice(0, 3).padStart(3),
        ' ',
        String(atom.chain).slice(0, 1).padStart(1),
        String(atom.resno).padStart(4),
        atom.insCode || ' ',
        '   ',
        atom.x.toFixed(3).padStart(8),
        atom.y.toFixed(3).padStart(8),
        atom.z.toFixed(3).padStart(8),
        (Number.isFinite(atom.occupancy) ? atom.occupancy : 1).toFixed(2).padStart(6),
        (Number.isFinite(atom.bFactor) ? atom.bFactor : 0).toFixed(2).padStart(6),
        '          ',
        String(atom.element || '').trim().slice(0, 2).padStart(2),
        '  ',
    ].join('');
}

function formatAtomName(atomName, element) {
    const name = String(atomName || '').slice(0, 4);
    if (name.length >= 4) return name;
    const symbol = String(element || '').trim();
    return symbol.length <= 1 ? ` ${name.padEnd(3)}` : name.padEnd(4);
}

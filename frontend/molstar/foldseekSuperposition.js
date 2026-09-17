import { OrderedSet } from 'molstar/lib/mol-data/int';
import { StructureElement, StructureProperties, Unit } from 'molstar/lib/mol-model/structure';
import { tmalign, parse as parseTMOutput, parseMatrix as parseTMMatrix } from 'tmalign-wasm';
import { atomToPdbRow, caChainIds, mat4FromRotationTranslation, normalizeChainId, transformStructureConformation } from './molstarStructure.js';
import { rangesByChain } from './foldseekAlignmentMapping.js';

export async function prepareSuperposedTarget(plugin, target, query, input, state) {
    if (!target || !query) return target;
    if (input.targetTransform) return transformStructureConformation(plugin, target, input.targetTransform);

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

export async function prepareMultimerTarget(plugin, target, query, input, state) {
    if (!target) return target;
    return input.targetTransform
        ? transformStructureConformation(plugin, target, input.targetTransform)
        : prepareSuperposedTarget(plugin, target, query, input, state);
}

async function superposeTargetWithFoldseekAlignment(plugin, target, query, alignments, input) {
    if (!alignments?.length || !alignments[0]?.qAln || !alignments[0]?.dbAln) {
        return { structure: target, results: null };
    }
    const queryPdb = makeAlignedCaPdb(query, rangesByChain(alignments, 'query', input));
    const targetPdb = makeAlignedCaPdb(target, rangesByChain(alignments, 'target', input));
    if (!queryPdb || !targetPdb) return { structure: target, results: null };

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

    const chainIds = caChainIds(structureRef);
    const soleSpans = ranges.size === 1 && chainIds.size === 1 ? [...ranges.values()][0] : null;

    const rows = [];
    const loc = StructureElement.Location.create(structure);
    let serial = 1;
    const chainOrdinals = new Map();
    const seen = new Set();
    for (const unit of structure.units) {
        if (!Unit.isAtomic(unit)) continue;
        loc.unit = unit;
        for (let index = 0; index < OrderedSet.size(unit.elements); index++) {
            loc.element = OrderedSet.getAt(unit.elements, index);
            if (StructureProperties.atom.label_atom_id(loc) !== 'CA') continue;

            const authChain = normalizeChainId(StructureProperties.chain.auth_asym_id(loc));
            const labelChain = normalizeChainId(StructureProperties.chain.label_asym_id(loc));
            const chain = ranges.has(authChain) ? authChain : (ranges.has(labelChain) ? labelChain : null);
            const spans = chain ? ranges.get(chain) : soleSpans;
            if (!spans) continue;

            const identity = `${labelChain}:${authChain}:${StructureProperties.residue.label_seq_id(loc)}:${StructureProperties.residue.auth_seq_id(loc)}`;
            if (seen.has(identity)) continue;
            seen.add(identity);

            const chainKey = chain || authChain || labelChain;
            const ordinal = (chainOrdinals.get(chainKey) || 0) + 1;
            chainOrdinals.set(chainKey, ordinal);
            if (!spans.some(([start, end]) => ordinal >= start && ordinal <= end)) continue;

            rows.push(atomToPdbRow({
                serial: serial++,
                atomName: 'CA',
                resName: StructureProperties.atom.auth_comp_id(loc) || StructureProperties.atom.label_comp_id(loc) || 'ALA',
                chain: chainKey,
                resno: ordinal,
                x: StructureProperties.atom.x(loc),
                y: StructureProperties.atom.y(loc),
                z: StructureProperties.atom.z(loc),
            }));
        }
    }
    return rows.join('\n');
}

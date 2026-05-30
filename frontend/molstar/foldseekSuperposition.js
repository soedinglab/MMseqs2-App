import { OrderedSet } from 'molstar/lib/mol-data/int';
import { Mat4 } from 'molstar/lib/mol-math/linear-algebra';
import { StructureElement, StructureProperties, Unit } from 'molstar/lib/mol-model/structure';
import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms';
import { tmalign, parse as parseTMOutput, parseMatrix as parseTMMatrix } from 'tmalign-wasm';
import { rangesByChain } from './foldseekSelections.js';

export async function transformStructure(plugin, structure, matrix) {
    return plugin.state.data.build()
        .to(structure.ref)
        .insert(StateTransforms.Model.TransformStructureConformation, {
            transform: {
                name: 'matrix',
                params: { data: matrix, transpose: false },
            },
        })
        .commit();
}

export async function superposeTargetWithFoldseekAlignment(plugin, target, query, alignments) {
    if (!alignments?.length || !alignments[0]?.qAln || !alignments[0]?.dbAln) {
        return { structure: target, results: null };
    }

    const queryPdb = makeAlignedCaPdb(query, rangesByChain(alignments, 'query'));
    const targetPdb = makeAlignedCaPdb(target, rangesByChain(alignments, 'target'));
    if (!queryPdb || !targetPdb) {
        return { structure: target, results: null };
    }

    const alnFasta = `>target\n${alignments[0].dbAln}\n\n>query\n${alignments[0].qAln}`;
    const tm = await tmalign(targetPdb, queryPdb, alnFasta);
    const { t, u } = parseTMMatrix(tm.matrix);

    return {
        structure: await transformStructure(plugin, target, makeMat4(t, u)),
        results: parseTMOutput(tm.output),
    };
}

function makeAlignedCaPdb(structureRef, ranges) {
    const structure = structureRef?.cell?.obj?.data;
    if (!structure || ranges.size === 0) return '';

    const rows = [];
    const loc = StructureElement.Location.create(structure);
    let serial = 1;

    for (const unit of structure.units) {
        if (!Unit.isAtomic(unit)) continue;
        loc.unit = unit;

        const { elements } = unit;
        const size = OrderedSet.size(elements);
        for (let i = 0; i < size; i++) {
            loc.element = OrderedSet.getAt(elements, i);

            const atomName = StructureProperties.atom.label_atom_id(loc);
            if (atomName !== 'CA') continue;

            const chain = StructureProperties.chain.auth_asym_id(loc) || StructureProperties.chain.label_asym_id(loc) || 'A';
            const chainRanges = ranges.get(chain) || (ranges.size === 1 ? ranges.values().next().value : null);
            if (!chainRanges) continue;

            const resno = StructureProperties.residue.auth_seq_id(loc) || StructureProperties.residue.label_seq_id(loc);
            if (!chainRanges.some(([start, end]) => resno >= start && resno <= end)) continue;

            rows.push(atomToPdbRow({
                serial,
                atomName,
                resName: StructureProperties.atom.auth_comp_id(loc) || StructureProperties.atom.label_comp_id(loc) || 'ALA',
                chain,
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

function makeMat4(t, u) {
    return Mat4.ofRows([
        [u[0][0], u[0][1], u[0][2], t[0]],
        [u[1][0], u[1][1], u[1][2], t[1]],
        [u[2][0], u[2][1], u[2][2], t[2]],
        [0, 0, 0, 1],
    ]);
}

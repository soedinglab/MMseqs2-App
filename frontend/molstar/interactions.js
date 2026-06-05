import { OrderedSet } from 'molstar/lib/mol-data/int';
import { StructureElement, StructureProperties } from 'molstar/lib/mol-model/structure';

export const OneToThree = {
    A: 'ALA',
    R: 'ARG',
    N: 'ASN',
    D: 'ASP',
    C: 'CYS',
    E: 'GLU',
    Q: 'GLN',
    G: 'GLY',
    H: 'HIS',
    I: 'ILE',
    L: 'LEU',
    K: 'LYS',
    M: 'MET',
    F: 'PHE',
    P: 'PRO',
    S: 'SER',
    T: 'THR',
    W: 'TRP',
    Y: 'TYR',
    V: 'VAL',
    U: 'SEC',
    O: 'PYL',
    X: 'ALA',
};

export const ThreeToOne = {};
for (const [one, three] of Object.entries(OneToThree)) {
    if (!ThreeToOne[three]) ThreeToOne[three] = one;
}

export function isValidLoci(loci) {
    return StructureElement.Loci.is(loci) && !StructureElement.Loci.isEmpty(loci);
}

export function lociFromExpression(structureRef, expression) {
    const structure = structureRef?.cell?.obj?.data || structureRef;
    if (!structure || !expression) return null;
    const loci = StructureElement.Loci.fromExpression(structure, expression);
    return StructureElement.Loci.isEmpty(loci) ? null : loci;
}

export function structureElementLocationFromLoci(loci) {
    if (!isValidLoci(loci)) return null;
    const entry = loci.elements?.[0];
    if (!entry || OrderedSet.size(entry.indices) === 0) return null;

    const loc = StructureElement.Location.create(loci.structure);
    loc.unit = entry.unit;
    loc.element = OrderedSet.getAt(entry.indices, 0);
    return loc;
}

export function residueInfoFromLoci(loci) {
    const loc = structureElementLocationFromLoci(loci);
    if (!loc) return null;

    const authResidue = StructureProperties.residue.auth_seq_id(loc);
    const labelResidue = StructureProperties.residue.label_seq_id(loc);
    const threeLetter = StructureProperties.residue.label_comp_id(loc)
        || StructureProperties.residue.auth_comp_id(loc)
        || '';
    const authChain = StructureProperties.chain.auth_asym_id(loc) || '';
    const labelChain = StructureProperties.chain.label_asym_id(loc) || '';
    const chain = authChain || labelChain;

    return {
        chain,
        authChain,
        labelChain,
        residue: labelResidue || authResidue,
        authResidue,
        labelResidue,
        oneLetter: ThreeToOne[threeLetter] || '',
        threeLetter,
        residues: Array.from(new Set([labelResidue, authResidue].filter(Number.isFinite))),
    };
}

export function structuresMatch(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    if (a.root && a.root === b) return true;
    if (a.root && b.root && a.root === b.root) return true;
    return false;
}

export function focusCurrentLoci(plugin, current, options = {}) {
    const loci = current?.loci;
    if (!isValidLoci(loci)) return;
    plugin.managers.camera.focusLoci(loci, {
        durationMs: 250,
        extraRadius: 6,
        minRadius: 3,
        ...options,
    });
}

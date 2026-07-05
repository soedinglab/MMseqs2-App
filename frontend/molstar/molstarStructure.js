import { OrderedSet } from 'molstar/lib/mol-data/int';
import { Mat4 } from 'molstar/lib/mol-math/linear-algebra';
import { StructureElement, StructureProperties } from 'molstar/lib/mol-model/structure';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms';
import { Color } from 'molstar/lib/mol-util/color';
import { MarkerAction } from 'molstar/lib/mol-util/marker-action';

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

const ThreeToOne = {};
for (const [one, three] of Object.entries(OneToThree)) {
    if (!ThreeToOne[three]) ThreeToOne[three] = one;
}

const CartoonQualityPresets = {
    viewer: {
        quality: 'highest',
        linearSegments: 18,
        radialSegments: 36,
    },
    thumbnail: {
        quality: 'higher',
        linearSegments: 10,
        radialSegments: 16,
    },
};

export async function loadStructureFromData(plugin, source, label = source?.label) {
    const raw = await plugin.builders.data.rawData(
        { data: source.data, label },
        { state: { isGhost: true } },
    );
    const trajectory = await plugin.builders.structure.parseTrajectory(raw, source.format || 'pdb');
    const model = await plugin.builders.structure.createModel(trajectory);
    return plugin.builders.structure.createStructure(model);
}

export function detectStructureFormat(raw) {
    const text = raw?.trimStart?.() || '';
    return text[0] === '#' || text.startsWith('data_') ? 'mmcif' : 'pdb';
}

export function normalizedPdbSourceFromText(raw, label, options = {}) {
    const data = raw?.trimStart?.() || '';
    const format = detectStructureFormat(data);
    return {
        data: format === 'pdb' ? normalizeWhitespacePdb(data, options) : data,
        label,
        format,
    };
}

function normalizeWhitespacePdb(text, options = {}) {
    return text
        .split(/\r?\n/)
        .map(line => {
            const trimmed = line.trim();
            if (!trimmed) return '';
            if (options.dropConect && trimmed.startsWith('CONECT')) return '';
            if (!trimmed.startsWith('ATOM') && !trimmed.startsWith('HETATM')) {
                return trimmed;
            }
            if (hasFixedAtomColumns(line)) return line.trimEnd();
            return formatWhitespaceAtom(trimmed.split(/\s+/));
        })
        .filter(Boolean)
        .join('\n');
}

function hasFixedAtomColumns(line) {
    return line.length >= 54
        && Number.isFinite(Number.parseInt(line.slice(22, 26), 10))
        && Number.isFinite(Number.parseFloat(line.slice(30, 38)))
        && Number.isFinite(Number.parseFloat(line.slice(38, 46)))
        && Number.isFinite(Number.parseFloat(line.slice(46, 54)));
}

function formatWhitespaceAtom(parts) {
    if (parts.length < 9) return null;
    const hasChain = !/^-?\d+$/.test(parts[4]);
    const resSeqIndex = hasChain ? 5 : 4;
    const coordIndex = hasChain ? 6 : 5;
    const serial = Number.parseInt(parts[1], 10) || 1;
    const atomName = parts[2] || 'CA';
    const resName = parts[3] || 'UNK';
    const chain = hasChain ? parts[4] : 'A';
    const resSeq = Number.parseInt(parts[resSeqIndex], 10);
    const x = Number.parseFloat(parts[coordIndex]);
    const y = Number.parseFloat(parts[coordIndex + 1]);
    const z = Number.parseFloat(parts[coordIndex + 2]);
    const occupancy = Number.parseFloat(parts[coordIndex + 3]);
    const bFactor = Number.parseFloat(parts[coordIndex + 4]);
    if (!Number.isFinite(resSeq) || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;

    const element = (parts[coordIndex + 5] || atomName.replace(/[^A-Za-z]/g, '').slice(0, 2)).toUpperCase();
    return atomToPdbRow({
        group: parts[0] === 'HETATM' ? 'HETATM' : 'ATOM',
        serial,
        atomName,
        resName,
        chain,
        resno: resSeq,
        x,
        y,
        z,
        occupancy,
        bFactor,
        element,
        charge: parts[coordIndex + 6] || '',
    });
}

function formatAtomName(name, element) {
    const value = String(name || '').slice(0, 4);
    return element.length === 1 && value.length < 4
        ? ` ${value.padEnd(3)}`
        : value.padStart(4);
}

export function atomToPdbRow(atom) {
    const atomName = formatAtomName(atom.atomName || 'CA', atom.element || atom.atomName?.[0] || 'C');
    return [
        (atom.group || 'ATOM').padEnd(6).slice(0, 6),
        String(atom.serial).padStart(5).slice(-5),
        ' ',
        atomName,
        atom.altId || ' ',
        String(atom.resName || 'ALA').padStart(3).slice(-3),
        ' ',
        String(atom.chain || 'A').slice(0, 1),
        String(atom.resno).padStart(4).slice(-4),
        atom.insCode || ' ',
        '   ',
        atom.x.toFixed(3).padStart(8),
        atom.y.toFixed(3).padStart(8),
        atom.z.toFixed(3).padStart(8),
        (Number.isFinite(atom.occupancy) ? atom.occupancy : 1).toFixed(2).padStart(6),
        (Number.isFinite(atom.bFactor) ? atom.bFactor : 0).toFixed(2).padStart(6),
        '          ',
        String(atom.element || '').trim().slice(0, 2).padStart(2),
        String(atom.charge || '').padStart(2).slice(-2),
    ].join('');
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

function residueInfoFromLocation(loc) {
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
        threeLetter,
        oneLetter: ThreeToOne[threeLetter] || '',
        residues: [labelResidue || authResidue],
    };
}

function structureElementLocationFromLoci(loci) {
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
    return loc ? residueInfoFromLocation(loc) : null;
}

export function residueInfosFromLoci(loci) {
    if (!isValidLoci(loci)) return [];

    const residues = [];
    const seen = new Set();
    StructureElement.Loci.forEachLocation(loci, (loc) => {
        const residue = residueInfoFromLocation(loc);
        const key = [
            residue.authChain,
            residue.labelChain,
            residue.authResidue,
            residue.labelResidue,
        ].join(':');
        if (seen.has(key)) return;
        seen.add(key);
        residues.push(residue);
    });
    return residues;
}

export function structuresMatch(a, b) {
    if (!a || !b) return false;
    if (a === b) return true;
    return a.root === b.root && a.elementCount === b.elementCount;
}

export function focusCurrentLoci(plugin, current, options = {}) {
    if (isValidLoci(current?.loci)) {
        plugin.managers.camera.focusLoci(current.loci, {
            durationMs: 250,
            extraRadius: 6,
            minRadius: 3,
            ...options,
        });
    }
}

export function cartoonParams(overrides = {}) {
    const { qualityPreset = 'viewer', ...typeOverrides } = overrides;
    const quality = CartoonQualityPresets[qualityPreset] || CartoonQualityPresets.viewer;
    return {
        ...quality,
        ignoreLight: false,
        sizeFactor: 0.25,
        visuals: ['polymer-trace', 'polymer-gap'],
        helixProfile: 'rounded',
        nucleicProfile: 'rounded',
        material: {
            metalness: 0,
            roughness: 1,
            bumpiness: 0,
        },
        ...typeOverrides,
    };
}

export function ballAndStickParams(overrides = {}) {
    return {
        quality: 'higher',
        sizeFactor: 0.28,
        sizeAspectRatio: 0.7,
        aromaticBonds: true,
        material: {
            metalness: 0,
            roughness: 0.5,
            bumpiness: 0,
        },
        ...overrides,
    };
}

export function representationTypeParams(type, overrides = {}) {
    if (type === 'cartoon') return cartoonParams(overrides);
    if (type === 'ball-and-stick') return ballAndStickParams(overrides);
    return {
        quality: 'higher',
        ignoreLight: false,
        ...overrides,
    };
}

export async function addUniformRepresentation(plugin, structure, options) {
    const {
        label,
        expression = MS.struct.generator.all(),
        type = 'cartoon',
        color,
        typeParams = {},
        tag = `${label}-representation`,
        initialState,
    } = options;
    if (!expression) return null;

    const component = await plugin.builders.structure.tryCreateComponentFromExpression(
        structure,
        expression,
        label,
        { label },
    );
    if (!component) return null;

    return {
        component,
        representation: await plugin.builders.structure.representation.addRepresentation(component, {
            type,
            color: 'uniform',
            colorParams: { value: Color(color) },
            typeParams: representationTypeParams(type, typeParams),
        }, {
            tag,
            ...(initialState ? { initialState } : {}),
        }),
    };
}

export function chainExpression(chain) {
    const test = chainTest(chain);
    return test ? MS.struct.generator.atomGroups({
        'chain-test': test,
        'residue-test': residueAtomTest(),
    }) : null;
}

export function residueExpression(chain, residue) {
    const tests = {
        'residue-test': MS.core.logic.and([residueAtomTest(), residueEqTest(residue)]),
    };
    const chainExpr = chainTest(chain);
    if (chainExpr) tests['chain-test'] = chainExpr;
    return MS.struct.generator.atomGroups(tests);
}

export function mergeExpressions(expressions) {
    const valid = expressions.filter(Boolean);
    if (valid.length === 0) return null;
    if (valid.length === 1) return valid[0];
    return MS.struct.combinator.merge(valid.map(expression => MS.struct.modifier.union([expression])));
}

export function expressionForResidues(residues) {
    if (!residues?.length) return null;

    const groups = new Map();
    for (const residue of residues) {
        const useLabel = residue.labelChain && Number.isFinite(residue.labelResidue);
        const chainProperty = useLabel
            ? MS.struct.atomProperty.macromolecular.label_asym_id()
            : MS.struct.atomProperty.macromolecular.auth_asym_id();
        const residueProperty = useLabel
            ? MS.struct.atomProperty.macromolecular.label_seq_id()
            : MS.struct.atomProperty.macromolecular.auth_seq_id();
        const chainId = useLabel ? residue.labelChain : residue.authChain;
        const residueId = useLabel ? residue.labelResidue : residue.authResidue;
        if (!chainId || !Number.isFinite(residueId)) continue;

        const key = `${useLabel ? 'label' : 'auth'}:${chainId}`;
        if (!groups.has(key)) groups.set(key, { chainId, chainProperty, residueProperty, residues: [] });
        groups.get(key).residues.push(residueId);
    }

    return mergeExpressions(Array.from(groups.values()).flatMap(group => (
        residueRanges(group.residues.sort((a, b) => a - b))
            .map(([start, end]) => atomGroupExpressionForProperty(group.chainId, group.chainProperty, group.residueProperty, start, end))
    )));
}

export function residuesForMappedRange(map, start, end) {
    const residues = [];
    for (let position = start; position <= end; position++) {
        const residue = map.toStructure.get(position);
        if (residue) residues.push(residue);
    }
    return residues;
}

export function structureResidueKeys(residue, chain = null) {
    const keys = [];
    if (chain) {
        if (Number.isFinite(residue.labelResidue)) keys.push(`${chain}:label:${residue.labelResidue}`);
        if (Number.isFinite(residue.authResidue)) keys.push(`${chain}:auth:${residue.authResidue}`);
        return keys;
    }
    if (residue.labelChain && Number.isFinite(residue.labelResidue)) {
        keys.push(`${residue.labelChain}:label:${residue.labelResidue}`);
    }
    if (residue.authChain && Number.isFinite(residue.authResidue)) {
        keys.push(`${residue.authChain}:auth:${residue.authResidue}`);
    }
    return keys;
}

export function residueRanges(residues) {
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

function residueRangeTest(property, start, end) {
    const { and } = MS.core.logic;
    const { gre, lte } = MS.core.rel;
    const tests = [];
    if (Number.isFinite(start)) tests.push(gre([property, start]));
    if (Number.isFinite(end)) tests.push(lte([property, end]));
    return tests.length === 1 ? tests[0] : and(tests);
}

function chainTest(chain) {
    if (!chain) return null;
    const { or } = MS.core.logic;
    const { eq } = MS.core.rel;
    const { macromolecular } = MS.struct.atomProperty;
    return or([
        eq([macromolecular.auth_asym_id(), chain]),
        eq([macromolecular.label_asym_id(), chain]),
    ]);
}

function residueEqTest(residue) {
    const { or } = MS.core.logic;
    const { eq } = MS.core.rel;
    const { macromolecular } = MS.struct.atomProperty;
    return or([
        eq([macromolecular.auth_seq_id(), residue]),
        eq([macromolecular.label_seq_id(), residue]),
    ]);
}

function residueAtomTest() {
    return MS.core.logic.not([MS.struct.atomProperty.macromolecular.isHet()]);
}

function atomGroupExpressionForProperty(chain, chainProperty, residueProperty, start, end) {
    const { eq } = MS.core.rel;
    return MS.struct.generator.atomGroups({
        'chain-test': eq([chainProperty, chain]),
        'residue-test': residueRangeTest(residueProperty, start, end),
    });
}

function structureRef(structure) {
    return structure?.ref || structure;
}

export function representationRef(item) {
    return item?.representation?.ref
        || item?.representation?.cell?.transform?.ref
        || item?.representation?.cell?.ref
        || item?.ref
        || item?.cell?.transform?.ref
        || null;
}

export function representationObject(item) {
    return item?.representation?.cell?.obj?.data?.repr
        || item?.representation?.obj?.data?.repr
        || item?.representation?.data?.repr
        || item?.repr
        || null;
}

export function componentStructure(item) {
    return item?.component?.cell?.obj?.data
        || item?.component?.obj?.data
        || item?.component?.data
        || null;
}

export function componentRef(item) {
    return item?.component?.ref
        || item?.component?.cell?.transform?.ref
        || item?.component?.cell?.ref
        || null;
}

export async function deleteComponent(plugin, item) {
    const ref = componentRef(item);
    if (ref) await plugin.state.data.build().delete(ref).commit();
}

export function addRepresentationToSet(set, item, options = {}) {
    const repr = representationObject(item);
    if (repr) set?.add(repr);
    if (options.includeComponent) {
        const component = componentStructure(item);
        if (component) set?.add(component);
    }
}

export function setRepresentationNonPickable(item) {
    representationObject(item)?.setState?.({
        pickable: false,
        markerActions: MarkerAction.None,
    });
}

export async function transformStructureConformation(plugin, structure, matrix, options = {}) {
    if (!matrix) return structure;
    const params = {
        transform: {
            name: 'matrix',
            params: { data: matrix, transpose: false },
        },
    };
    const stateOptions = options.tags ? { tags: options.tags } : undefined;
    const builder = plugin.state.data.build().to(structureRef(structure));
    const update = options.method === 'apply'
        ? builder.apply(StateTransforms.Model.TransformStructureConformation, params, stateOptions)
        : builder.insert(StateTransforms.Model.TransformStructureConformation, params, stateOptions);
    return update.commit();
}

export function mat4FromRotationTranslation(t, u) {
    return Mat4.ofRows([
        [u[0][0], u[0][1], u[0][2], t[0]],
        [u[1][0], u[1][1], u[1][2], t[1]],
        [u[2][0], u[2][1], u[2][2], t[2]],
        [0, 0, 0, 1],
    ]);
}

function matrixParamsFromCommaStrings(tmat, umat) {
    const t = String(tmat || '').split(',').map(Number);
    const u = String(umat || '').split(',').map(Number);
    if (t.length < 3 || u.length < 9 || t.some(Number.isNaN) || u.some(Number.isNaN)) return null;
    return {
        t,
        u: [
            [u[0], u[1], u[2]],
            [u[3], u[4], u[5]],
            [u[6], u[7], u[8]],
        ],
    };
}

export function mat4FromCommaStrings(tmat, umat) {
    const params = matrixParamsFromCommaStrings(tmat, umat);
    return params ? mat4FromRotationTranslation(params.t, params.u) : null;
}

export function mockPDB(ca, seq, chain, start = 1) {
    const atoms = ca.split(',');
    const pdb = [];
    let j = 1;
    for (let i = 0; i < atoms.length; i += 3, j++) {
        const resno = start + j - 1;
        const [x, y, z] = atoms.slice(i, i + 3).map(element => Number.parseFloat(element));
        const residue = seq !== '' && atoms.length / 3 === seq.length ? seq[i / 3] : 'A';
        pdb.push(atomToPdbRow({
            serial: j,
            atomName: 'CA',
            resName: OneToThree[residue] || 'ALA',
            chain,
            resno,
            x,
            y,
            z,
            element: 'C',
        }));
    }
    return pdb.join('\n');
}

import { OrderedSet } from 'molstar/lib/mol-data/int';
import { Mat4 } from 'molstar/lib/mol-math/linear-algebra';
import { QueryContext, StructureElement, StructureProperties, StructureSelection } from 'molstar/lib/mol-model/structure';
import { to_mmCIF } from 'molstar/lib/mol-model/structure/export/mmcif';
import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms';
import { compile } from 'molstar/lib/mol-script/runtime/query/compiler';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { Color } from 'molstar/lib/mol-util/color';
import { mockPDB } from './foldseekUtilities.js';

const QueryColor = 0x1e88e5;
const TargetColor = 0xffc107;
const QueryLightColor = 0xa5cff5;
const TargetLightColor = 0xffe699;
const MotifRadius = 0.28;

function processStructure(raw) {
    const text = raw?.trimStart?.() || '';
    const format = text[0] === '#' || text.startsWith('data_') ? 'mmcif' : 'pdb';
    return {
        // Folddisco PDB ATOM rows are whitespace-token valid, but Mol* reads
        // coordinates from fixed columns. Re-emit strict columns before parsing.
        data: format === 'pdb'
            ? normalizePdbText(text)
            : text,
        format,
    };
}

function normalizePdbText(text) {
    return text
        .split(/\r?\n/)
        .map(normalizePdbLine)
        .filter(Boolean)
        .join('\n');
}

function normalizePdbLine(line) {
    const recordLine = line.trimStart();
    if (recordLine.startsWith('ATOM') || recordLine.startsWith('HETATM')) {
        const atom = parseAtomLine(recordLine);
        return atom ? formatPdbAtomLine(atom) : null;
    }
    if (recordLine.startsWith('TER') || recordLine.startsWith('MODEL') || recordLine.startsWith('ENDMDL') || recordLine.startsWith('END')) {
        return recordLine.padEnd(80, ' ');
    }
    if (recordLine.startsWith('HELIX') || recordLine.startsWith('SHEET') || recordLine.startsWith('SEQRES')) {
        return recordLine.padEnd(80, ' ');
    }
    return null;
}

function parseAtomLine(line) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 9) return null;
    const hasChain = !/^-?\d+$/.test(parts[4]);
    const coordOffset = hasChain ? 6 : 5;
    const atom = {
        record: parts[0] === 'HETATM' ? 'HETATM' : 'ATOM',
        serial: Number.parseInt(parts[1], 10),
        name: parts[2],
        altLoc: '',
        resName: parts[3],
        chain: hasChain ? parts[4] : 'A',
        resSeq: Number.parseInt(hasChain ? parts[5] : parts[4], 10),
        iCode: '',
        x: Number.parseFloat(parts[coordOffset]),
        y: Number.parseFloat(parts[coordOffset + 1]),
        z: Number.parseFloat(parts[coordOffset + 2]),
        occupancy: Number.parseFloat(parts[coordOffset + 3]),
        bFactor: Number.parseFloat(parts[coordOffset + 4]),
        element: parts[coordOffset + 5] || '',
        charge: parts[coordOffset + 6] || '',
    };
    if (!atom.name || !atom.resName || !Number.isFinite(atom.resSeq) || !coordinatesAreFinite(atom)) return null;
    return atom;
}

function coordinatesAreFinite(atom) {
    return Number.isFinite(atom.x) && Number.isFinite(atom.y) && Number.isFinite(atom.z);
}

function formatPdbAtomLine(atom) {
    const serial = Number.isFinite(atom.serial) ? atom.serial : 1;
    const occupancy = Number.isFinite(atom.occupancy) ? atom.occupancy : 1;
    const bFactor = Number.isFinite(atom.bFactor) ? atom.bFactor : 0;
    const element = (atom.element || atom.name.replace(/[^A-Za-z]/g, '').slice(0, 2)).toUpperCase();
    return [
        atom.record.padEnd(6).slice(0, 6),
        String(serial).padStart(5).slice(-5),
        ' ',
        formatAtomName(atom.name, element),
        (atom.altLoc || ' ').slice(0, 1),
        atom.resName.padStart(3).slice(-3),
        ' ',
        (atom.chain || 'A').slice(0, 1),
        String(atom.resSeq).padStart(4).slice(-4),
        (atom.iCode || ' ').slice(0, 1),
        '   ',
        atom.x.toFixed(3).padStart(8),
        atom.y.toFixed(3).padStart(8),
        atom.z.toFixed(3).padStart(8),
        occupancy.toFixed(2).padStart(6),
        bFactor.toFixed(2).padStart(6),
        '          ',
        element.padStart(2).slice(-2),
        (atom.charge || '  ').padStart(2).slice(-2),
    ].join('');
}

function formatAtomName(name, element) {
    const value = String(name || '').slice(0, 4);
    return element.length === 1 && value.length < 4
        ? ` ${value.padEnd(3)}`
        : value.padStart(4);
}

async function loadStructure(plugin, source, label) {
    const raw = await plugin.builders.data.rawData(
        { data: source.data, label },
        { state: { isGhost: true } },
    );
    const trajectory = await plugin.builders.structure.parseTrajectory(raw, source.format);
    const model = await plugin.builders.structure.createModel(trajectory);
    return plugin.builders.structure.createStructure(model);
}

function transformParams(alignment) {
    const t = String(alignment?.tmat || '').split(',').map(Number);
    const u = String(alignment?.umat || '').split(',').map(Number);
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

function makeMat4({ t, u }) {
    return Mat4.ofRows([
        [u[0][0], u[0][1], u[0][2], t[0]],
        [u[1][0], u[1][1], u[1][2], t[1]],
        [u[2][0], u[2][1], u[2][2], t[2]],
        [0, 0, 0, 1],
    ]);
}

async function transformStructure(plugin, structure, params) {
    if (!params) return structure;
    return plugin.state.data.build()
        .to(structure.ref)
        .insert(StateTransforms.Model.TransformStructureConformation, {
            transform: {
                name: 'matrix',
                params: { data: makeMat4(params), transpose: false },
            },
        })
        .commit();
}

function representationTypeParams(type, alpha = 1) {
    if (type === 'ball-and-stick') {
        return {
            alpha,
            sizeFactor: MotifRadius,
            sizeAspectRatio: 0.7,
            aromaticBonds: true,
            material: { metalness: 0, roughness: 0.5, bumpiness: 0.1 },
        };
    }
    return {
        alpha,
        quality: 'higher',
        sizeFactor: 0.2,
        helixProfile: 'rounded',
        nucleicProfile: 'rounded',
        linearSegments: 10,
        radialSegments: 16,
        material: { metalness: 0, roughness: 0.55, bumpiness: 0.1 },
    };
}

async function addRepresentation(plugin, structure, label, expression, color, alpha = 1, type = 'cartoon') {
    if (!expression) return null;
    const component = await plugin.builders.structure.tryCreateComponentFromExpression(
        structure,
        expression,
        label,
        { label },
    );
    if (!component) return null;

    return plugin.builders.structure.representation.addRepresentation(component, {
        type,
        color: 'uniform',
        colorParams: { value: Color(color) },
        typeParams: representationTypeParams(type, alpha),
    });
}

function parseMotif(value = '') {
    const residues = [];
    const chains = new Set();
    const seen = new Set();
    for (const raw of String(value).split(',')) {
        const item = raw.trim();
        if (!item || item === '_') continue;
        const [chain, numeric] = splitAlphaNum(item);
        const residue = Number(numeric);
        if (!chain || !Number.isFinite(residue)) continue;
        const key = `${chain}:${residue}`;
        if (seen.has(key)) continue;
        seen.add(key);
        residues.push({ chain, residue });
        chains.add(chain);
    }
    return { residues, chains: Array.from(chains) };
}

function splitAlphaNum(str) {
    const value = String(str || '');
    const len = value.length;
    let i = 0;
    while (i < len) {
        const cc = value.charCodeAt(i);
        if (cc >= 48 && cc <= 57) break;
        i++;
    }
    let j = i;
    while (j < len) {
        const cc = value.charCodeAt(j);
        if (cc < 48 || cc > 57) break;
        j++;
    }
    return [value.slice(0, i), value.slice(i, j)];
}

function atomGroupExpression(chain, residue) {
    const { or } = MS.core.logic;
    const { eq } = MS.core.rel;
    const { macromolecular } = MS.struct.atomProperty;
    return MS.struct.generator.atomGroups({
        'chain-test': or([
            eq([macromolecular.auth_asym_id(), chain]),
            eq([macromolecular.label_asym_id(), chain]),
        ]),
        'residue-test': or([
            eq([macromolecular.auth_seq_id(), residue]),
            eq([macromolecular.label_seq_id(), residue]),
        ]),
    });
}

function chainExpression(chain) {
    const { or } = MS.core.logic;
    const { eq } = MS.core.rel;
    const { macromolecular } = MS.struct.atomProperty;
    return MS.struct.generator.atomGroups({
        'chain-test': or([
            eq([macromolecular.auth_asym_id(), chain]),
            eq([macromolecular.label_asym_id(), chain]),
        ]),
    });
}

function mergeExpressions(expressions) {
    const valid = expressions.filter(Boolean);
    if (valid.length === 0) return null;
    if (valid.length === 1) return valid[0];
    return MS.struct.combinator.merge(valid.map(expression => MS.struct.modifier.union([expression])));
}

function motifExpression(motif) {
    return mergeExpressions(parseMotif(motif).residues.map(({ chain, residue }) => atomGroupExpression(chain, residue)));
}

function chainSetExpression(motif) {
    return mergeExpressions(parseMotif(motif).chains.map(chainExpression));
}

function nonChainSetExpression(motif) {
    const chains = chainSetExpression(motif);
    if (!chains) return null;
    return MS.struct.modifier.exceptBy({
        0: MS.struct.generator.all(),
        by: chains,
    });
}

async function deleteReprGroup(plugin, state) {
    for (const ref of state.reprRefs || []) {
        await plugin.state.data.build().delete(ref).commit();
    }
    state.reprRefs = [];
}

async function addRepr(plugin, state, structure, label, expression, color, alpha, type) {
    const repr = await addRepresentation(plugin, structure, label, expression, color, alpha, type);
    const ref = repr?.ref || repr?.cell?.transform?.ref;
    if (ref) state.reprRefs.push(ref);
}

function targetMotifSource(alignment) {
    if (!alignment?.tCa) return null;
    return {
        data: mockPDB(alignment.tCa, '', 'A'),
        format: 'pdb',
        label: 'targetMotifStructure',
    };
}

async function applyRepresentations(plugin, state, input) {
    const key = `${input.showQuery}:${input.showTarget}:${input.alignment?.queryresidues}:${input.alignment?.targetresidues}`;
    if (state.reprKey === key) return;
    state.reprKey = key;
    await deleteReprGroup(plugin, state);

    const queryMotif = motifExpression(input.alignment?.queryresidues);
    const targetMotif = state.targetMotif ? MS.struct.generator.all() : motifExpression(input.alignment?.targetresidues);
    const queryChains = chainSetExpression(input.alignment?.queryresidues);
    const targetChains = chainSetExpression(input.alignment?.targetresidues);

    if (input.showQuery === 2) {
        await addRepr(plugin, state, state.query, 'query-rest', nonChainSetExpression(input.alignment?.queryresidues), QueryLightColor, 0.3, 'cartoon');
    }
    if (input.showQuery >= 1) {
        await addRepr(plugin, state, state.query, 'query-matched', queryChains, QueryLightColor, 0.8, 'cartoon');
    }
    await addRepr(plugin, state, state.query, 'query-motif', queryMotif, QueryColor, 1, 'ball-and-stick');

    if (input.showTarget === 2) {
        await addRepr(plugin, state, state.target, 'target-rest', nonChainSetExpression(input.alignment?.targetresidues), TargetLightColor, 0.3, 'cartoon');
    }
    if (input.showTarget >= 1) {
        await addRepr(plugin, state, state.target, 'target-matched', targetChains, TargetLightColor, 0.8, 'cartoon');
    }
    await addRepr(plugin, state, state.targetMotif || state.target, 'target-motif', targetMotif, TargetColor, 1, 'ball-and-stick');
}

async function rebuildScene(plugin, state, input) {
    await plugin.clear();
    state.query = null;
    state.target = null;
    state.targetMotif = null;
    state.reprRefs = [];
    state.reprKey = null;

    state.query = await loadStructure(plugin, processStructure(input.queryPdb), 'queryStructure');
    const targetSource = processStructure(input.targetPdb);
    const targetTransform = transformParams(input.alignment);
    state.target = await loadStructure(plugin, targetSource, 'targetStructure');
    state.target = await transformStructure(plugin, state.target, targetTransform);
    const motifSource = targetMotifSource(input.alignment);
    if (motifSource) {
        state.targetMotif = await loadStructure(plugin, motifSource, 'targetMotifStructure');
        state.targetMotif = await transformStructure(plugin, state.targetMotif, targetTransform);
    }
    await applyRepresentations(plugin, state, input);
    const loci = lociFromExpression(state.query, motifExpression(input.alignment?.queryresidues));
    if (loci) plugin.managers.camera.focusLoci(loci, { durationMs: 100, extraRadius: 10, minRadius: 5 });
    else plugin.managers.camera.reset();
}

function lociFromExpression(structureRef, expression) {
    const structure = structureRef?.cell?.obj?.data;
    if (!structure || !expression) return null;
    const query = compile(expression);
    const selection = query(new QueryContext(structure));
    const loci = StructureSelection.toLociWithSourceUnits(selection);
    return StructureElement.Loci.isEmpty(loci) ? null : loci;
}

function structureEvent(state, current, type) {
    if (!StructureElement.Loci.is(current?.loci) || StructureElement.Loci.isEmpty(current.loci)) {
        return { type, hasLoci: false };
    }
    const root = current.loci.structure?.root || current.loci.structure;
    const side = state.query?.cell?.obj?.data?.root === root || state.query?.cell?.obj?.data === root
        ? 'query'
        : 'target';
    const entry = current.loci.elements?.[0];
    if (!entry) return { type, side, hasLoci: true };
    const loc = StructureElement.Location.create(current.loci.structure);
    loc.unit = entry.unit;
    loc.element = OrderedSet.getAt(entry.indices, 0);
    return {
        type,
        side,
        hasLoci: true,
        chain: StructureProperties.chain.auth_asym_id(loc) || StructureProperties.chain.label_asym_id(loc) || '',
        residue: StructureProperties.residue.auth_seq_id(loc) || StructureProperties.residue.label_seq_id(loc),
        residueName: StructureProperties.residue.label_comp_id(loc) || StructureProperties.residue.auth_comp_id(loc) || '',
    };
}

function setCurrentHover(plugin, current) {
    const loci = current?.loci;
    if (!StructureElement.Loci.is(loci) || StructureElement.Loci.isEmpty(loci)) {
        plugin.managers.interactivity.lociHighlights.clearHighlights();
        return;
    }
    plugin.managers.interactivity.lociHighlights.highlightOnly({ loci }, false);
}

function makeCIF(state) {
    const blocks = [];
    const query = state.query?.cell?.obj?.data;
    const target = state.target?.cell?.obj?.data;
    if (query) blocks.push(to_mmCIF('query', query, false, { copyAllCategories: false }));
    if (target) blocks.push(to_mmCIF('target', target, false, { copyAllCategories: false }));
    return blocks.join('\n');
}

export const folddiscoResult = {
    async mount() {
        return {};
    },

    async update(plugin, state, input) {
        const key = `${input.alignment?.dbkey || input.alignment?.target}:${input.alignment?.queryresidues}:${input.alignment?.targetresidues}`;
        if (state.loadKey !== key) {
            state.loadKey = key;
            state.queryPdbSource = input.queryPdb;
            state.targetPdbSource = input.targetPdb;
            await rebuildScene(plugin, state, input);
            return;
        }
        if (state.queryPdbSource !== input.queryPdb || state.targetPdbSource !== input.targetPdb) {
            state.queryPdbSource = input.queryPdb;
            state.targetPdbSource = input.targetPdb;
            await rebuildScene(plugin, state, input);
            return;
        }
        await applyRepresentations(plugin, state, input);
    },

    onHover(plugin, state, input, event) {
        setCurrentHover(plugin, event?.current);
        return structureEvent(state, event?.current, 'structure-hover');
    },

    resetView(plugin, state, input) {
        const loci = lociFromExpression(state.query, motifExpression(input.alignment?.queryresidues));
        if (loci) plugin.managers.camera.focusLoci(loci, { durationMs: 250, extraRadius: 10, minRadius: 5 });
        else plugin.managers.camera.reset();
    },

    async makeCIF(plugin, state) {
        return makeCIF(state);
    },

    async dispose(plugin) {
        await plugin?.clear?.();
    },
};

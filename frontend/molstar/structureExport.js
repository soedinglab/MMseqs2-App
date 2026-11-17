import { Segmentation } from 'molstar/lib/mol-data/int';
import { CIF } from 'molstar/lib/mol-io/reader/cif';
import { StructureElement, StructureProperties, Unit } from 'molstar/lib/mol-model/structure';
import { to_mmCIF } from 'molstar/lib/mol-model/structure/export/mmcif';
import { computeUnitDSSP, DefaultDSSPComputationProps } from 'molstar/lib/mol-model-props/computed/secondary-structure/dssp';

// Writing several structures into one mmCIF data block.
// Readers keep only the first data block of a file, so every structure has to arrive as rows of the same
// loops. Chains and entities are renamed where they would collide, and secondary structure that the source
// file did not declare is assigned with DSSP so it survives the export.

const CHAIN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const RESIDUE_ID_ITEMS = [
    'label_comp_id',
    'label_seq_id',
    'pdbx_PDB_ins_code',
    'label_asym_id',
    'label_entity_id',
    'auth_comp_id',
    'auth_seq_id',
    'auth_asym_id',
];

// mmCIF spells the insertion code item pdbx_beg_PDB_ins_code rather than beg_pdbx_PDB_ins_code.
function residueIdItem(prefix, item) {
    return item === 'pdbx_PDB_ins_code' ? `pdbx_${prefix}_PDB_ins_code` : `${prefix}_${item}`;
}

const RANGE_ITEMS = [
    ...RESIDUE_ID_ITEMS.map(item => residueIdItem('beg', item)),
    ...RESIDUE_ID_ITEMS.map(item => residueIdItem('end', item)),
];

const STRUCT_CONF_ITEMS = [
    'conf_type_id',
    'id',
    ...RANGE_ITEMS,
    'pdbx_PDB_helix_class',
    'pdbx_PDB_helix_length',
];

const STRUCT_SHEET_RANGE_ITEMS = [
    'sheet_id',
    'id',
    ...RANGE_ITEMS,
];

/**
 * @param {{name: string, structure: object}[]} items  molstar structures, in the coordinates they are shown in
 * @returns {Promise<string>} one mmCIF data block, or '' when there is nothing to write
 */
export async function structuresToCif(items) {
    const present = (items || []).filter(item => item?.structure);
    if (present.length === 0) return '';

    const taken = { auth: new Set(), label: new Set() };
    const entities = [];
    const entityPolys = [];
    const entityPolySeqs = [];
    const atomSite = { items: null, rows: [] };
    const helices = [];
    const sheets = [];
    let entityOffset = 0;

    for (const [index, { name, structure }] of present.entries()) {
        const frame = await parseFrame(to_mmCIF(name, structure, false, { copyAllCategories: false }));
        if (!frame) continue;

        const sites = readCategory(frame, 'atom_site');
        if (!sites || sites.rows.length === 0) continue;

        const authRenames = renameCollisions(distinct(sites, 'auth_asym_id'), taken.auth);
        const labelRenames = labelAsymRenames(sites.rows, taken.label);
        const entity = readCategory(frame, 'entity');
        const nonPolymers = new Set((entity?.rows || []).filter(row => row.type !== 'polymer').map(row => row.id));
        const { sequences, renumber } = polymerSequencesOf(
            sites.rows,
            readCategory(frame, 'entity_poly_seq')?.rows || [],
            nonPolymers,
        );
        const entityIds = new Map();
        const entityId = (id) => {
            if (!isPresent(id)) return id;
            if (!entityIds.has(id)) entityIds.set(id, String(entityOffset + entityIds.size + 1));
            return entityIds.get(id);
        };
        // A label chain id is renamed together with the entity it belongs to on the same row.
        const rename = (item, value, row) => {
            if (item.endsWith('auth_asym_id')) return authRenames.get(value) ?? value;
            if (item.endsWith('label_asym_id')) {
                const entityItem = item.replace(/label_asym_id$/, 'label_entity_id');
                return labelRenames.get(asymKey(value, row[entityItem])) ?? value;
            }
            if (item.endsWith('label_entity_id')) return entityId(value);
            if (item.endsWith('label_seq_id')) {
                const entityItem = item.replace(/label_seq_id$/, 'label_entity_id');
                // Only polymer residues have a place in a sequence.
                if (nonPolymers.has(row[entityItem])) return '.';
                return renumber.get(row[entityItem])?.get(value) ?? value;
            }
            return value;
        };

        if (!atomSite.items) atomSite.items = sites.items;
        for (const row of sites.rows) {
            const values = atomSite.items.map(item => {
                const value = row[item];
                if (item === 'id') return String(atomSite.rows.length + 1);
                if (item === 'pdbx_PDB_model_num') return '1';
                return rename(item, value, row);
            });
            atomSite.rows.push(values);
        }

        const declared = {
            helices: readCategory(frame, 'struct_conf')?.rows || [],
            sheets: readCategory(frame, 'struct_sheet_range')?.rows || [],
        };
        const assigned = declared.helices.length || declared.sheets.length
            ? declared
            : await assignSecondaryStructure(structure);

        for (const row of assigned.helices) {
            helices.push(STRUCT_CONF_ITEMS.map(item => {
                if (item === 'id') return `HELX_P${helices.length + 1}`;
                if (item === 'conf_type_id') return row[item] || 'HELX_P';
                return rename(item, row[item], row);
            }));
        }
        for (const row of assigned.sheets) {
            sheets.push(STRUCT_SHEET_RANGE_ITEMS.map(item => {
                // Sheet ids restart in every file.
                if (item === 'sheet_id') return `${index + 1}${row[item] || 'A'}`;
                return rename(item, row[item], row);
            }));
        }

        const declaredPolys = readCategory(frame, 'entity_poly')?.rows || [];
        for (const [id, alias] of entityIds) {
            const source = entity?.rows.find(row => row.id === id);
            const type = source?.type || 'polymer';
            entities.push([alias, type, `${name} ${source?.pdbx_description || ''}`.trim()]);
            if (type !== 'polymer') continue;

            const sequence = sequences.get(id) || [];
            const strands = [...new Set(sites.rows
                .filter(row => row.label_entity_id === id)
                .map(row => authRenames.get(row.auth_asym_id) ?? row.auth_asym_id))];
            const declaredType = declaredPolys.find(row => row.entity_id === id)?.type;
            entityPolys.push([alias, declaredType || polymerType(sequence.map(([, monomer]) => monomer)), strands.join(',')]);
            for (const [num, monomer] of sequence) entityPolySeqs.push([alias, num, monomer, 'n']);
        }
        entityOffset += entityIds.size;
    }

    if (!atomSite.items) return '';
    return [
        'data_merged',
        '#',
        ...writeLoop('entity', ['id', 'type', 'pdbx_description'], entities),
        ...writeLoop('entity_poly', ['entity_id', 'type', 'pdbx_strand_id'], entityPolys),
        ...writeLoop('entity_poly_seq', ['entity_id', 'num', 'mon_id', 'hetero'], entityPolySeqs),
        ...writeLoop('struct_conf', STRUCT_CONF_ITEMS, helices),
        ...writeLoop('struct_sheet_range', STRUCT_SHEET_RANGE_ITEMS, sheets),
        ...writeLoop('atom_site', atomSite.items, atomSite.rows),
        '',
    ].join('\n');
}

function isPresent(value) {
    return value !== undefined && value !== '' && value !== '.' && value !== '?';
}

function asymKey(asym, entity) {
    return `${asym}|${entity}`;
}

// New label chain ids, keyed by asymKey(label_asym_id, label_entity_id).
function labelAsymRenames(rows, taken) {
    const pairs = [];
    const seen = new Set();
    for (const row of rows) {
        const key = asymKey(row.label_asym_id, row.label_entity_id);
        if (!isPresent(row.label_asym_id) || seen.has(key)) continue;
        seen.add(key);
        pairs.push({ key, asym: row.label_asym_id });
    }
    const own = new Set(pairs.map(pair => pair.asym));
    const renames = new Map();
    const names = chainNames();
    for (const { key, asym } of pairs) {
        if (!taken.has(asym)) {
            taken.add(asym);
            continue;
        }
        let next = names.next();
        while (!next.done && (taken.has(next.value) || own.has(next.value))) next = names.next();
        if (next.done) continue;
        taken.add(next.value);
        renames.set(key, next.value);
    }
    return renames;
}

/**
 * Each polymer entity's sequence as [num, mon_id] pairs: the declared one when the export kept it, otherwise
 * the residues seen in the entity's chains.
 * */
function polymerSequencesOf(atomRows, declaredRows, nonPolymers) {
    const sequences = new Map();
    const renumber = new Map();
    for (const row of declaredRows) {
        if (!sequences.has(row.entity_id)) sequences.set(row.entity_id, []);
        sequences.get(row.entity_id).push([row.num, row.mon_id]);
    }
    const observed = new Map();
    for (const row of atomRows) {
        const entity = row.label_entity_id;
        if (sequences.has(entity) || nonPolymers.has(entity) || !isPresent(row.label_seq_id)) continue;
        if (!observed.has(entity)) observed.set(entity, new Map());
        const residues = observed.get(entity);
        if (!residues.has(row.label_seq_id)) residues.set(row.label_seq_id, row.label_comp_id);
    }
    for (const [entity, residues] of observed) {
        const ordered = [...residues.entries()].sort((a, b) => Number(a[0]) - Number(b[0]));
        renumber.set(entity, new Map(ordered.map(([seq], i) => [seq, String(i + 1)])));
        sequences.set(entity, ordered.map(([, monomer], i) => [String(i + 1), monomer]));
    }
    return { sequences, renumber };
}

const RIBONUCLEOTIDES = new Set(['A', 'C', 'G', 'U', 'I']);
const DEOXYRIBONUCLEOTIDES = new Set(['DA', 'DC', 'DG', 'DT', 'DI', 'DU']);

function polymerType(monomers) {
    if (monomers.length > 0 && monomers.every(monomer => RIBONUCLEOTIDES.has(monomer))) return 'polyribonucleotide';
    if (monomers.length > 0 && monomers.every(monomer => DEOXYRIBONUCLEOTIDES.has(monomer))) return 'polydeoxyribonucleotide';
    return 'polypeptide(L)';
}

async function parseFrame(text) {
    const parsed = await CIF.parse(text).run();
    return parsed.isError ? null : parsed.result.blocks[0];
}

/** A category as its item names and its rows keyed by item name. */
function readCategory(frame, name) {
    const category = frame.categories[name];
    if (!category || category.rowCount === 0) return null;
    const items = category.fieldNames;
    const fields = items.map(item => category.getField(item));
    const rows = [];
    for (let i = 0; i < category.rowCount; i++) {
        const row = {};
        items.forEach((item, k) => { row[item] = fields[k].str(i); });
        rows.push(row);
    }
    return { items, rows };
}

function distinct(category, item) {
    return [...new Set(category.rows.map(row => row[item]).filter(Boolean))];
}

/** Keep each chain's name unless an earlier structure already used it. */
function renameCollisions(chains, taken) {
    const renames = new Map();
    const names = chainNames();
    for (const chain of chains) {
        if (!taken.has(chain)) {
            taken.add(chain);
            continue;
        }
        let next = names.next();
        while (!next.done && (taken.has(next.value) || chains.includes(next.value))) next = names.next();
        if (next.done) continue;
        taken.add(next.value);
        renames.set(chain, next.value);
    }
    return renames;
}

function* chainNames() {
    for (const a of CHAIN_ALPHABET) yield a;
    for (const a of CHAIN_ALPHABET) {
        for (const b of CHAIN_ALPHABET) yield a + b;
    }
}

/** Helix and strand ranges from DSSP, as struct_conf and struct_sheet_range rows. */
async function assignSecondaryStructure(structure) {
    const helices = [];
    const sheets = [];
    for (const unit of structure.units) {
        if (!Unit.isAtomic(unit)) continue;
        let secondaryStructure;
        try {
            secondaryStructure = await computeUnitDSSP(unit, DefaultDSSPComputationProps);
        } catch (e) {
            continue;
        }
        for (const range of elementRanges(unit, secondaryStructure)) {
            const row = {
                ...residueId(structure, unit, range.start, 'beg'),
                ...residueId(structure, unit, range.end, 'end'),
            };
            if (range.kind === 'helix') {
                helices.push({ ...row, conf_type_id: 'HELX_P', pdbx_PDB_helix_class: '1', pdbx_PDB_helix_length: String(range.length) });
            } else {
                sheets.push({ ...row, sheet_id: 'A', id: String(sheets.length + 1) });
            }
        }
    }
    return { helices, sheets };
}

function elementRanges(unit, secondaryStructure) {
    const { key, elements, getIndex } = secondaryStructure;
    const segments = unit.model.atomicHierarchy.residueAtomSegments;
    const residues = Segmentation.transientSegments(segments, unit.elements);
    const ranges = [];
    let current = null;
    const close = () => {
        if (current && (current.kind === 'helix' || current.kind === 'sheet')) ranges.push(current);
        current = null;
    };
    while (residues.hasNext) {
        const residueIndex = residues.move().index;
        const position = getIndex(residueIndex);
        const elementKey = position >= 0 ? key[position] : -1;
        const kind = elementKey >= 0 ? elements[elementKey]?.kind : 'none';
        if (current && current.key === elementKey && current.kind === kind) {
            current.end = residueIndex;
            current.length++;
            continue;
        }
        close();
        current = { key: elementKey, kind, start: residueIndex, end: residueIndex, length: 1 };
    }
    close();
    return ranges;
}

function residueId(structure, unit, residueIndex, prefix) {
    const atom = unit.model.atomicHierarchy.residueAtomSegments.offsets[residueIndex];
    const location = StructureElement.Location.create(structure, unit, atom);
    const value = (item) => {
        switch (item) {
            case 'label_comp_id': return StructureProperties.atom.label_comp_id(location);
            case 'label_seq_id': return String(StructureProperties.residue.label_seq_id(location));
            case 'pdbx_PDB_ins_code': return StructureProperties.residue.pdbx_PDB_ins_code(location) || '';
            case 'label_asym_id': return StructureProperties.chain.label_asym_id(location);
            case 'label_entity_id': return StructureProperties.chain.label_entity_id(location);
            case 'auth_comp_id': return StructureProperties.atom.auth_comp_id(location);
            case 'auth_seq_id': return String(StructureProperties.residue.auth_seq_id(location));
            case 'auth_asym_id': return StructureProperties.chain.auth_asym_id(location);
            default: return '';
        }
    };
    const row = {};
    for (const item of RESIDUE_ID_ITEMS) row[residueIdItem(prefix, item)] = value(item);
    return row;
}

function writeLoop(category, items, rows) {
    if (rows.length === 0) return [];
    return [
        'loop_',
        ...items.map(item => `_${category}.${item}`),
        ...rows.map(values => values.map(quoteValue).join(' ')),
        '#',
    ];
}

/** Loop values are whitespace separated, so one holding a space has to be quoted back. */
function quoteValue(value) {
    if (value === undefined || value === null || value === '') return '.';
    const text = String(value);
    if (!/[\s'"]/.test(text) && !/^[_#$;]/.test(text) && !/^(data_|loop_|save_|global_|stop_)/i.test(text)) return text;
    if (!text.includes("'")) return `'${text}'`;
    if (!text.includes('"')) return `"${text}"`;
    return `'${text.replace(/'/g, '')}'`;
}

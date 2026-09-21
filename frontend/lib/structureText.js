// Residue reader for PDB and mmCIF text, backed by molstar's structure model.
//
// molstar's commonjs tree is named so Node can run this unbundled; the bundlers alias it to ESM.

import { OrderedSet } from 'molstar/lib/commonjs/mol-data/int.js';
import { CIF, CifCategory, CifField } from 'molstar/lib/commonjs/mol-io/reader/cif.js';
import { CifWriter } from 'molstar/lib/commonjs/mol-io/writer/cif.js';
import { parsePDB } from 'molstar/lib/commonjs/mol-io/reader/pdb/parser.js';
import { trajectoryFromMmCIF } from 'molstar/lib/commonjs/mol-model-formats/structure/mmcif.js';
import { trajectoryFromPDB } from 'molstar/lib/commonjs/mol-model-formats/structure/pdb.js';
import { getProteinOneLetterCode } from 'molstar/lib/commonjs/mol-model/sequence/constants.js';
import {
    Queries,
    Structure,
    StructureElement,
    StructureProperties,
    StructureQuery,
    StructureSelection,
    Unit,
} from 'molstar/lib/commonjs/mol-model/structure.js';
import { to_mmCIF } from 'molstar/lib/commonjs/mol-model/structure/export/mmcif.js';
import { Task } from 'molstar/lib/commonjs/mol-task/index.js';

function isCif(text) {
    const head = text.trimStart();
    return head.startsWith('data_') || head.startsWith('#') || head.includes('_atom_site.');
}

// molstar reads PDB by fixed column and mis-reads a shifted line without raising
function repairAtomLine(line) {
    if (!line.startsWith('ATOM')) return line;
    let out = line;
    if (out.length > 60 && out[60] !== ' ') out = out.slice(0, 30) + out.slice(31);
    if (out.length > 20 && out[20] !== ' ') out = out.slice(0, 17) + out.slice(18);
    return out;
}

async function cifFrame(text) {
    const parsed = await CIF.parse(text).run();
    return parsed.isError ? null : parsed.result.blocks[0];
}

async function firstModelStructure(trajectory) {
    if (!trajectory || trajectory.frameCount === 0) return null;
    return Structure.ofModel(await Task.resolveInContext(trajectory.getFrameAtIndex(0)));
}

async function buildStructure(text) {
    if (isCif(text)) {
        const frame = await cifFrame(text);
        return frame ? firstModelStructure(await trajectoryFromMmCIF(frame).run()) : null;
    }
    const repaired = text.split('\n').map(repairAtomLine).join('\n');
    const parsed = await parsePDB(repaired).run();
    return parsed.isError ? null : firstModelStructure(await trajectoryFromPDB(parsed.result).run());
}

// One motif check reads the same text several times over.
let cachedText = null;
let cachedStructure = null;

async function parseStructure(text) {
    if (typeof text !== 'string' || text.trim() === '') return null;
    if (text === cachedText) return cachedStructure;
    const structure = await buildStructure(text);
    cachedText = text;
    cachedStructure = structure;
    return structure;
}

/** Visits atoms in file order; molstar groups its units by entity, which reorders the chains. */
function eachAtom(structure, visit) {
    const location = StructureElement.Location.create(structure);
    const atoms = [];
    for (const unit of structure.units) {
        if (!Unit.isAtomic(unit)) continue;
        location.unit = unit;
        for (let i = 0, il = OrderedSet.size(unit.elements); i < il; i++) {
            location.element = OrderedSet.getAt(unit.elements, i);
            atoms.push([StructureProperties.atom.sourceIndex(location), unit, location.element]);
        }
    }

    atoms.sort((a, b) => a[0] - b[0]);
    for (const [, unit, element] of atoms) {
        location.unit = unit;
        location.element = element;
        visit(location);
    }
}

function chainOf(location) {
    return StructureProperties.chain.auth_asym_id(location)
        || StructureProperties.chain.label_asym_id(location);
}

function insCodeOf(location) {
    return StructureProperties.residue.pdbx_PDB_ins_code(location) || '';
}

/** Insertion codes distinguish residues that share a number (antibody numbering does this). */
function residueKey(location) {
    return `${chainOf(location)}|${StructureProperties.residue.auth_seq_id(location)}`
        + `|${insCodeOf(location)}`;
}

// pulchra drops the chain column, so callers that reconstruct a backbone have to put it back.
export function setChainId(text, chain) {
    if (typeof text !== 'string' || !chain) return text;
    return text.split('\n').map((line) => (
        line.startsWith('ATOM') || line.startsWith('HETATM')
            ? line.slice(0, PDB_CHAIN_ID[0]) + chain + line.slice(PDB_CHAIN_ID[1])
            : line
    )).join('\n');
}

/**
 * Every residue in a PDB or mmCIF string, in file order, deduplicated by (chain, residue number,
 * insertion code).
 *
 * @param {string} text
 * @returns {Promise<{chain: string, resno: string, resName: string, insCode?: string, hetero: boolean}[]>}
 */
export async function listResidues(text) {
    const structure = await parseStructure(text);
    if (!structure) return [];

    const residues = [];
    const seen = new Set();
    eachAtom(structure, (location) => {
        const key = residueKey(location);
        if (seen.has(key)) return;
        seen.add(key);
        const insCode = insCodeOf(location);
        residues.push({
            chain: chainOf(location),
            resno: String(StructureProperties.residue.auth_seq_id(location)),
            resName: StructureProperties.atom.label_comp_id(location),
            ...(insCode ? { insCode } : {}),
            hetero: StructureProperties.residue.group_PDB(location) === 'HETATM',
        });
    });
    return residues;
}

export async function residueTokenSet(text) {
    const tokens = new Set();
    for (const r of await listResidues(text)) {
        tokens.add(`${r.chain}${r.resno}`);
        tokens.add(String(r.resno));
    }
    return tokens;
}

// Chain-grouped CA traces.

/** An alternate location repeats an atom per conformer; either would double the trace. */
const KEPT_ALT_LOC = new Set(['', 'A']);

/** molstar's table has no PHL, and pdbAssembly's OneToThree maps O back to it. */
const LOCAL_ONE_LETTER = { PHL: 'O', XAA: 'X' };

function oneLetter(resName) {
    const compId = resName?.toUpperCase() ?? '';
    return LOCAL_ONE_LETTER[compId] ?? getProteinOneLetterCode(compId);
}

/** Every readable C-alpha coordinate, in file order and the query structure's residue numbering. */
export async function listCaResidues(text) {
    const structure = await parseStructure(text);
    if (!structure) return [];

    const rows = [];
    const seen = new Set();
    eachAtom(structure, (location) => {
        if (StructureProperties.atom.label_atom_id(location) !== 'CA') return;
        // HETATM is not part of the chain trace.
        if (StructureProperties.residue.group_PDB(location) !== 'ATOM') return;
        if (!KEPT_ALT_LOC.has(StructureProperties.atom.label_alt_id(location))) return;

        const key = residueKey(location);
        if (seen.has(key)) return;
        seen.add(key);
        const insCode = insCodeOf(location);
        rows.push({
            chain: chainOf(location),
            resName: StructureProperties.atom.label_comp_id(location),
            resno: String(StructureProperties.residue.auth_seq_id(location)),
            xyz: [
                StructureProperties.atom.x(location),
                StructureProperties.atom.y(location),
                StructureProperties.atom.z(location),
            ],
            ...(insCode ? { insCode } : {}),
        });
    });
    return rows;
}

/**
 * The CA trace of each chain, in file order.
 *
 * @param {string} text  PDB or mmCIF
 * @returns {Promise<{chain: string, residueCount: number, ca: string, seq: string}[]>}
 *   `ca` is comma-separated x,y,z triplets and `seq` one-letter codes — exactly the pair a search hit
 *   arrives as, so mockPDB(ca, seq, chain) works on either without a second code path.
 */
export async function listChains(text) {
    const rows = await listCaResidues(text);

    const byChain = new Map();
    for (const row of rows) {
        const chain = row.chain || 'A';
        if (!byChain.has(chain)) byChain.set(chain, { chain, xyz: [], seq: [] });
        const entry = byChain.get(chain);
        entry.xyz.push(...row.xyz);
        entry.seq.push(oneLetter(row.resName));
    }

    return [...byChain.values()].map(e => ({
        chain: e.chain,
        residueCount: e.seq.length,
        ca: e.xyz.map(v => v.toFixed(3)).join(','),
        seq: e.seq.join(''),
    }));
}

/**
 * An mmCIF holding only the named chains' polymer residues.
 *
 * @param {string} text  PDB or mmCIF
 * @param {string[]} chains  auth or label asym ids
 * @returns {Promise<string>} mmCIF
 */
export async function extractChains(text, chains, { name = 'extracted' } = {}) {
    const wanted = new Set(chains ?? []);
    if (wanted.size === 0) throw new Error('no chain was named');

    const structure = await parseStructure(text);
    if (!structure) throw new Error('the structure could not be read');

    const query = Queries.generators.atoms({
        chainTest: ctx => wanted.has(StructureProperties.chain.auth_asym_id(ctx.element))
            || wanted.has(StructureProperties.chain.label_asym_id(ctx.element)),
        entityTest: ctx => StructureProperties.entity.type(ctx.element) === 'polymer',
    });
    const subset = StructureSelection.unionStructure(StructureQuery.run(query, structure));
    if (subset.elementCount === 0) {
        throw new Error(`no polymer residues in chain ${[...wanted].join(', ')}`);
    }
    // Copying the source categories would carry entries referring to the chains just removed.
    return to_mmCIF(name, subset, false, { copyAllCategories: false });
}

// Chain names a motif token can address.

const CHAIN_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

/**
 * Can a motif token name a residue of this chain unambiguously?
 */
export function isNameableChain(chain) {
    return /^[A-Za-z]+$/.test(chain);
}

/** Alphabetic names, shortest first: A…Z, a…z, then AA, AB, … — 2756 of them before this runs dry. */
function* alphabeticNames() {
    for (const c of CHAIN_ALPHABET) yield c;
    for (const a of CHAIN_ALPHABET) for (const b of CHAIN_ALPHABET) yield a + b;
}

// Which items hold a chain id, per naming scheme.
const CHAIN_ITEMS = {
    auth: /(auth_asym_id|pdbx?_strand_id)$/,
    label: /(label_asym_id|asym_id_list|^_struct_asym\.id$|\.asym_id$)/,
};

/** Items whose value is a comma-separated list of chain ids rather than one. */
const CHAIN_LIST_ITEM = /(asym_id_list|strand_id)$/;

/** `_atom_site.auth_asym_id` is what listResidues and listChains read; without it they read label. */
function effectiveScheme(frame) {
    return frame.categories.atom_site?.fieldNames.includes('auth_asym_id') ? 'auth' : 'label';
}

/**
 * Give an alphabetic name to each chain a motif cannot address, and leave every other chain alone.
 * @param {string[]} chains
 * @returns {Map<string, string>} original -> alias, for the chains that were renamed
 */
export function planChainRenames(chains) {
    // Every chain that keeps its name is off limits as an alias, whatever its length.
    const taken = new Set(chains.filter(isNameableChain));
    const renames = new Map();
    const pending = [];

    // First pass: keep the initial letter where it is free, so A1 stays recognisably A.
    for (const chain of chains) {
        if (isNameableChain(chain)) continue;
        const first = chain[0];
        if (CHAIN_ALPHABET.includes(first) && !taken.has(first)) {
            taken.add(first);
            renames.set(chain, first);
        } else {
            pending.push(chain);
        }
    }

    // Second pass: the rest in name order, two-letter names once the single letters are used up.
    const names = alphabeticNames();
    for (const chain of pending) {
        let next = names.next();
        while (!next.done && taken.has(next.value)) next = names.next();
        if (next.done) break;                        // 2756 chains renamed: give up rather than guess
        taken.add(next.value);
        renames.set(chain, next.value);
    }
    return renames;
}

function renameChainsPdb(text, renames) {
    // A PDB chain field is a single column, so a long name cannot have come from one. Kept for
    // completeness: renaming single-character chains is still a legitimate request.
    return text.split('\n').map((line) => {
        const record = line.slice(0, 6);
        if (record !== 'ATOM  ' && record !== 'HETATM' && !line.startsWith('TER')) return line;
        if (line.length <= 21) return line;
        const alias = renames.get(line[21]);
        return alias ? `${line.slice(0, 21)}${alias}${line.slice(22)}` : line;
    }).join('\n');
}

/** Rewrite the chain-bearing columns of a parsed frame; null when nothing matched. */
function renameCifFrame(frame, renames, matches) {
    const categories = { ...frame.categories };
    let changed = false;

    for (const catName of frame.categoryNames) {
        const category = frame.categories[catName];
        const targets = category.fieldNames.filter(n => matches.test(`_${catName}.${n}`));
        if (targets.length === 0) continue;

        const fields = {};
        for (const fieldName of category.fieldNames) {
            const field = category.getField(fieldName);
            if (!targets.includes(fieldName)) {
                fields[fieldName] = field;
                continue;
            }
            const isList = CHAIN_LIST_ITEM.test(`_${catName}.${fieldName}`);
            const values = [];
            for (let i = 0; i < category.rowCount; i++) {
                const value = field.str(i);
                const next = isList
                    ? value.split(',').map(p => renames.get(p.trim()) ?? p).join(',')
                    : renames.get(value) ?? value;
                if (next !== value) changed = true;
                values.push(next);
            }
            fields[fieldName] = CifField.ofStrings(values);
        }
        categories[catName] = CifCategory.ofFields(catName, fields);
    }

    if (!changed) return null;
    return { header: frame.header, categoryNames: frame.categoryNames, categories };
}

/** Write a parsed frame back out, every category and row as it was read. */
function writeCifFrame(frame) {
    const encoder = CifWriter.createEncoder({ binary: false });
    encoder.startDataBlock(frame.header);

    for (const catName of frame.categoryNames) {
        const category = frame.categories[catName];
        const builder = CifWriter.fields();
        for (const fieldName of category.fieldNames) {
            const field = category.getField(fieldName);
            builder.str(fieldName, row => field.str(row));
        }
        const fields = builder.getFields();
        encoder.writeCategory({
            name: catName,
            instance: () => ({ fields, source: [{ data: undefined, rowCount: category.rowCount }] }),
        });
    }
    return encoder.getData();
}

/**
 * Rewrite a structure's chain names. An mmCIF is re-emitted from its parsed categories, so rows and
 * values survive but the original byte layout does not.
 *
 * @param {string} text
 * @param {Map<string, string>|object} renames  original -> alias
 * @param {{scheme?: 'auth'|'label'|'effective'}} [opts]  which mmCIF naming scheme to rewrite.
 *   Default 'effective': the one a reader would surface, which is `auth` when the file has auth
 *   columns and `label` when it does not
 * @returns {Promise<string>} the same structure with those chains renamed; unchanged if nothing matched
 */
export async function renameChains(text, renames, { scheme = 'effective' } = {}) {
    const map = renames instanceof Map ? renames : new Map(Object.entries(renames ?? {}));
    if (typeof text !== 'string' || map.size === 0) return text;
    if (!isCif(text)) return renameChainsPdb(text, map);

    const frame = await cifFrame(text);
    if (!frame) return text;

    const matches = CHAIN_ITEMS[scheme === 'effective' ? effectiveScheme(frame) : scheme];
    const renamed = renameCifFrame(frame, map, matches);
    return renamed ? writeCifFrame(renamed) : text;
}

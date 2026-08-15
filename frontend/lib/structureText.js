// Dependency-free residue reader for PDB and mmCIF text.

/** Fixed-column PDB fields, 0-indexed half-open ranges (the spec numbers them from 1). */
const PDB_RES_NAME = [17, 20];
const PDB_CHAIN_ID = [21, 22];
const PDB_RES_SEQ = [22, 26];
const PDB_I_CODE = [26, 27];

function isCif(text) {
    const head = text.trimStart();
    return head.startsWith('data_') || head.startsWith('#') || head.includes('_atom_site.');
}

/**
 * Repair the column drift found in structures coming back from FoldDisco hits, where an extra
 * character is present at the residue-name and coordinate fields, pushing every later fixed column
 * one place right. Detected the way the page detects it: a non-blank at index 20 or 60, positions
 * that are padding in a well-formed record.
 */
function repairAtomLine(line) {
    if (!line.startsWith('ATOM')) return line;
    let out = line;
    if (out.length > 60 && out[60] !== ' ') out = out.slice(0, 30) + out.slice(31);
    if (out.length > 20 && out[20] !== ' ') out = out.slice(0, 17) + out.slice(18);
    return out;
}

/**
 * mmCIF values may be quoted ('A 1' or "A 1"). Splitting on whitespace alone would shift every
 * later column on such a row, so quoted runs are kept whole.
 */
function splitCifRowSpans(line) {
    const out = [];
    let i = 0;
    while (i < line.length) {
        while (i < line.length && /\s/.test(line[i])) i++;
        if (i >= line.length) break;
        const quote = line[i] === "'" || line[i] === '"' ? line[i] : null;
        if (quote) {
            const end = line.indexOf(quote, i + 1);
            if (end === -1) { out.push({ value: line.slice(i + 1), start: i, end: line.length }); break; }
            out.push({ value: line.slice(i + 1, end), start: i, end: end + 1 });
            i = end + 1;
        } else {
            let j = i;
            while (j < line.length && !/\s/.test(line[j])) j++;
            out.push({ value: line.slice(i, j), start: i, end: j });
            i = j;
        }
    }
    return out;
}

function splitCifRow(line) {
    return splitCifRowSpans(line).map(s => s.value);
}

function listResiduesCif(text) {
    const residues = [];
    const seen = new Set();
    const lines = text.split('\n');

    let i = 0;
    while (i < lines.length) {
        if (lines[i].trim() !== 'loop_') { i++; continue; }
        i++;

        const headers = [];
        while (i < lines.length && lines[i].trim().startsWith('_')) {
            headers.push(lines[i].trim().split(/\s+/)[0]);
            i++;
        }
        // Skips _chem_comp and friends; only the atom_site loop describes residues.
        if (headers.length === 0 || !headers[0].startsWith('_atom_site.')) continue;

        const nameIdx = headers.indexOf('_atom_site.label_comp_id');
        const groupIdx = headers.indexOf('_atom_site.group_PDB');
        // auth_* is what NGL surfaces as chainname/resno. Some minimal writers emit only the label_
        // scheme, so fall back to it rather than return nothing.
        const authChain = headers.indexOf('_atom_site.auth_asym_id');
        const authSeq = headers.indexOf('_atom_site.auth_seq_id');
        const chain = authChain >= 0 ? authChain : headers.indexOf('_atom_site.label_asym_id');
        const seq = authSeq >= 0 ? authSeq : headers.indexOf('_atom_site.label_seq_id');
        if (chain < 0 || seq < 0) return residues;
        const maxIdx = Math.max(chain, seq, nameIdx, groupIdx);

        for (; i < lines.length; i++) {
            const t = lines[i].trim();
            if (t === '' || t === 'loop_' || t.startsWith('_') || t.startsWith('#')
                || t.startsWith('data_')) {
                break;
            }
            const cols = splitCifRow(t);
            if (cols.length <= maxIdx) continue;
            // '.' and '?' are mmCIF's null markers; a residue cannot be addressed by them.
            if (cols[seq] === '.' || cols[seq] === '?') continue;
            const key = `${cols[chain]}|${cols[seq]}`;
            if (seen.has(key)) continue;
            seen.add(key);
            residues.push({
                chain: cols[chain],
                resno: cols[seq],
                resName: nameIdx >= 0 ? cols[nameIdx] : '',
                hetero: groupIdx >= 0 ? cols[groupIdx] === 'HETATM' : false,
            });
        }
        break;
    }
    return residues;
}

function listResiduesPdb(text) {
    const residues = [];
    const seen = new Set();

    for (const raw of text.split('\n')) {
        const record = raw.slice(0, 6);
        if (record !== 'ATOM  ' && record !== 'HETATM') continue;
        const line = repairAtomLine(raw);

        const chain = line.slice(...PDB_CHAIN_ID).trim();
        const resno = line.slice(...PDB_RES_SEQ).trim();
        if (!/^-?\d+$/.test(resno)) continue;      // drifted or truncated beyond repair
        const iCode = line.slice(...PDB_I_CODE).trim();

        // Insertion codes distinguish residues that share a number (antibody numbering does this).
        const key = `${chain}|${resno}|${iCode}`;
        if (seen.has(key)) continue;
        seen.add(key);
        residues.push({
            chain,
            resno,
            resName: line.slice(...PDB_RES_NAME).trim(),
            insCode: iCode || undefined,
            hetero: record === 'HETATM',
        });
    }
    return residues;
}

/**
 * Every residue in a PDB or mmCIF string, in file order, deduplicated by (chain, residue number).
 *
 * @param {string} text
 * @returns {{chain: string, resno: string, resName: string, insCode?: string, hetero: boolean}[]}
 */
export function listResidues(text) {
    if (typeof text !== 'string' || text.trim() === '') return [];
    return isCif(text) ? listResiduesCif(text) : listResiduesPdb(text);
}

export function residueTokenSet(text) {
    const tokens = new Set();
    for (const r of listResidues(text)) {
        tokens.add(`${r.chain}${r.resno}`);
        tokens.add(String(r.resno));
    }
    return tokens;
}

// Chain-grouped CA traces.

const PDB_ATOM_NAME = [12, 16];
const PDB_X = [30, 38];
const PDB_Y = [38, 46];
const PDB_Z = [46, 54];

/** Three-letter to one-letter, with X for anything unrecognised — mockPDB's own table, inverted. */
const THREE_TO_ONE = {
    ALA: 'A', ARG: 'R', ASN: 'N', ASP: 'D', CYS: 'C', GLU: 'E', GLN: 'Q', GLY: 'G', HIS: 'H',
    ILE: 'I', LEU: 'L', LYS: 'K', MET: 'M', PHE: 'F', PRO: 'P', SER: 'S', THR: 'T', TRP: 'W',
    TYR: 'Y', VAL: 'V', SEC: 'U', PHL: 'O', XAA: 'X',
};

function fixed(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n.toFixed(3) : null;
}

function caRowsPdb(text) {
    const rows = [];
    for (const raw of text.split('\n')) {
        if (raw.slice(0, 6) !== 'ATOM  ') continue;      // HETATM is not part of the chain trace
        const line = repairAtomLine(raw);
        if (line.slice(...PDB_ATOM_NAME).trim() !== 'CA') continue;
        const xyz = [
            fixed(line.slice(...PDB_X)), fixed(line.slice(...PDB_Y)), fixed(line.slice(...PDB_Z)),
        ];
        if (xyz.some(v => v === null)) continue;
        rows.push({
            chain: line.slice(...PDB_CHAIN_ID).trim() || 'A',
            resName: line.slice(...PDB_RES_NAME).trim(),
            resno: line.slice(...PDB_RES_SEQ).trim(),
            xyz,
        });
    }
    return rows;
}

function caRowsCif(text) {
    const rows = [];
    const lines = text.split('\n');
    let i = 0;
    while (i < lines.length) {
        if (lines[i].trim() !== 'loop_') { i++; continue; }
        i++;
        const headers = [];
        while (i < lines.length && lines[i].trim().startsWith('_')) {
            headers.push(lines[i].trim().split(/\s+/)[0]);
            i++;
        }
        if (headers.length === 0 || !headers[0].startsWith('_atom_site.')) continue;

        const idx = {
            group: headers.indexOf('_atom_site.group_PDB'),
            atom: headers.indexOf('_atom_site.label_atom_id'),
            comp: headers.indexOf('_atom_site.label_comp_id'),
            alt: headers.indexOf('_atom_site.label_alt_id'),
            x: headers.indexOf('_atom_site.Cartn_x'),
            y: headers.indexOf('_atom_site.Cartn_y'),
            z: headers.indexOf('_atom_site.Cartn_z'),
            model: headers.indexOf('_atom_site.pdbx_PDB_model_num'),
        };
        const authChain = headers.indexOf('_atom_site.auth_asym_id');
        const authSeq = headers.indexOf('_atom_site.auth_seq_id');
        idx.chain = authChain >= 0 ? authChain : headers.indexOf('_atom_site.label_asym_id');
        idx.seq = authSeq >= 0 ? authSeq : headers.indexOf('_atom_site.label_seq_id');
        if (idx.atom < 0 || idx.x < 0 || idx.chain < 0) return rows;
        const maxIdx = Math.max(...Object.values(idx));

        let firstModel = null;
        for (; i < lines.length; i++) {
            const t = lines[i].trim();
            if (t === '' || t === 'loop_' || t.startsWith('_') || t.startsWith('#')
                || t.startsWith('data_')) {
                break;
            }
            const cols = splitCifRow(t);
            if (cols.length <= maxIdx) continue;
            if (idx.group >= 0 && cols[idx.group] !== 'ATOM') continue;
            if (cols[idx.atom] !== 'CA') continue;
            // An NMR ensemble repeats every atom per model, and an alternate location repeats it per
            // conformer; either would double the trace.
            if (idx.model >= 0) {
                if (firstModel === null) firstModel = cols[idx.model];
                if (cols[idx.model] !== firstModel) continue;
            }
            if (idx.alt >= 0 && cols[idx.alt] !== '.' && cols[idx.alt] !== '?'
                && cols[idx.alt] !== 'A') continue;

            const xyz = [fixed(cols[idx.x]), fixed(cols[idx.y]), fixed(cols[idx.z])];
            if (xyz.some(v => v === null)) continue;
            rows.push({
                chain: cols[idx.chain],
                resName: idx.comp >= 0 ? cols[idx.comp] : '',
                resno: idx.seq >= 0 ? cols[idx.seq] : '',
                xyz,
            });
        }
        break;
    }
    return rows;
}

/**
 * The CA trace of each chain, in file order.
 *
 * @param {string} text  PDB or mmCIF
 * @returns {{chain: string, residueCount: number, ca: string, seq: string}[]}
 *   `ca` is comma-separated x,y,z triplets and `seq` one-letter codes — exactly the pair a search hit
 *   arrives as, so mockPDB(ca, seq, chain) works on either without a second code path.
 */
export function listChains(text) {
    if (typeof text !== 'string' || text.trim() === '') return [];
    const rows = isCif(text) ? caRowsCif(text) : caRowsPdb(text);

    const byChain = new Map();
    for (const row of rows) {
        const chain = row.chain || 'A';
        if (!byChain.has(chain)) byChain.set(chain, { chain, xyz: [], seq: [] });
        const entry = byChain.get(chain);
        entry.xyz.push(...row.xyz);
        entry.seq.push(THREE_TO_ONE[row.resName?.toUpperCase()] ?? 'X');
    }

    return [...byChain.values()].map(e => ({
        chain: e.chain,
        residueCount: e.seq.length,
        ca: e.xyz.join(','),
        seq: e.seq.join(''),
    }));
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
    auth: /(auth_asym_id|pdb_strand_id)$/,
    label: /(label_asym_id|asym_id_list|^_struct_asym\.id$|\.asym_id$)/,
};

/** Items whose value is a comma-separated list of chain ids rather than one. */
const CHAIN_LIST_ITEM = /asym_id_list$/;

/** `_atom_site.auth_asym_id` is what listResidues and listChains read; without it they read label. */
function effectiveScheme(text) {
    return /_atom_site\.auth_asym_id/.test(text) ? 'auth' : 'label';
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

/** Replace one span of a line, keeping the field's original width so a column-aligned file stays so. */
function spliceField(line, span, value) {
    return line.slice(0, span.start) + value.padEnd(span.end - span.start, ' ') + line.slice(span.end);
}

function renameChainsCif(text, renames, scheme) {
    const matches = CHAIN_ITEMS[scheme];
    const lines = text.split('\n');

    /** One value, or a comma-separated list of them. */
    const rewrite = (item, value) => {
        if (CHAIN_LIST_ITEM.test(item)) {
            const parts = value.split(',');
            const out = parts.map(p => renames.get(p.trim()) ?? p);
            return out.some((p, i) => p !== parts[i]) ? out.join(',') : null;
        }
        return renames.get(value) ?? null;
    };

    for (let i = 0; i < lines.length;) {
        const trimmed = lines[i].trim();

        // Key-value form: `_struct_site_gen.auth_asym_id  A1`
        if (trimmed.startsWith('_') && trimmed !== 'loop_') {
            const spans = splitCifRowSpans(lines[i]);
            if (spans.length >= 2 && matches.test(spans[0].value)) {
                const alias = rewrite(spans[0].value, spans[1].value);
                if (alias) lines[i] = spliceField(lines[i], spans[1], alias);
            }
            i++;
            continue;
        }

        if (trimmed !== 'loop_') { i++; continue; }
        i++;

        const headers = [];
        while (i < lines.length && lines[i].trim().startsWith('_')) {
            headers.push(lines[i].trim().split(/\s+/)[0]);
            i++;
        }
        const columns = headers
            .map((h, idx) => (matches.test(h) ? idx : -1))
            .filter(idx => idx >= 0);
        if (columns.length === 0) continue;

        for (; i < lines.length; i++) {
            const t = lines[i].trim();
            if (t === '' || t === 'loop_' || t.startsWith('_') || t.startsWith('#')
                || t.startsWith('data_')) {
                break;
            }
            const spans = splitCifRowSpans(lines[i]);
            // Rightmost first, so an earlier splice cannot move a later span's offsets.
            for (const column of [...columns].reverse()) {
                if (spans.length <= column) continue;
                const alias = rewrite(headers[column], spans[column].value);
                if (alias) lines[i] = spliceField(lines[i], spans[column], alias);
            }
        }
    }
    return lines.join('\n');
}

/**
 * Rewrite a structure's chain names.
 *
 * @param {string} text
 * @param {Map<string, string>|object} renames  original -> alias
 * @param {{scheme?: 'auth'|'label'|'effective'}} [opts]  which mmCIF naming scheme to rewrite.
 *   Default 'effective': the one a reader would surface, which is `auth` when the file has auth
 *   columns and `label` when it does not — the same choice listResidues and listChains make, so the
 *   names a motif was built from are the names that get rewritten.
 * @returns {string} the same structure with those chains renamed; unchanged if nothing matched
 */
export function renameChains(text, renames, { scheme = 'effective' } = {}) {
    const map = renames instanceof Map ? renames : new Map(Object.entries(renames ?? {}));
    if (typeof text !== 'string' || map.size === 0) return text;
    if (!isCif(text)) return renameChainsPdb(text, map);
    return renameChainsCif(text, map, scheme === 'effective' ? effectiveScheme(text) : scheme);
}

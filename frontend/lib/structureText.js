// Dependency-free residue reader for PDB and mmCIF text.
//
// Exists so that "which residues does this structure contain?" can be answered outside a browser.
// In the page that question is answered by NGL's `eachResidue`, but NGL cannot load under Node (it
// throws `window is not defined` even with a window shim), and pulling a full structure library in
// to enumerate (chain, resno) pairs would be far more weight than the question deserves.
//
// The identifiers produced here are the ones NGL exposes as `chainname` and `resno`, because the
// motif format is built from exactly those: mmCIF's auth_asym_id / auth_seq_id, and a PDB's chainID
// / resSeq columns. Matching NGL's choice is what lets a motif validated here mean the same thing
// as one validated in the page.
//
// lib/accession.js's parseCifResidueChainMap is the precedent for the mmCIF half.

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
 *
 * This mirrors StructureViewerMotif.vue's processPdb, including the order — the coordinate fix goes
 * first, because the residue-name fix shifts everything after column 17 leftwards and would move
 * the coordinate column out from under the second test.
 *
 * One deliberate difference: the length guards. processPdb reads line[20] on any line starting with
 * ATOM, and on a truncated record that index is undefined, which is `!= ' '` and triggers a repair
 * on a line that has no such field to repair. Lines too short to hold the field are left alone here.
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
function splitCifRow(line) {
    const out = [];
    let i = 0;
    while (i < line.length) {
        while (i < line.length && /\s/.test(line[i])) i++;
        if (i >= line.length) break;
        const quote = line[i] === "'" || line[i] === '"' ? line[i] : null;
        if (quote) {
            const end = line.indexOf(quote, i + 1);
            if (end === -1) { out.push(line.slice(i + 1)); break; }
            out.push(line.slice(i + 1, end));
            i = end + 1;
        } else {
            let j = i;
            while (j < line.length && !/\s/.test(line[j])) j++;
            out.push(line.slice(i, j));
            i = j;
        }
    }
    return out;
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

/**
 * The residue identifiers a motif token may name: `chain + resno` and bare `resno`, matching how
 * FoldDiscoSearch.vue's isMotifValid compares tokens against NGL's `${chainname}${resno}` and
 * `${resno}`.
 */
export function residueTokenSet(text) {
    const tokens = new Set();
    for (const r of listResidues(text)) {
        tokens.add(`${r.chain}${r.resno}`);
        tokens.add(String(r.resno));
    }
    return tokens;
}

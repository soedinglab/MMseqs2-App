// Fetch a structure by accession from a third-party service.
//
// Extracted from LoadAcessionButton.vue so the search-page API and the button share one
// definition — the same reason resultSort.js exists. The button imports from here.
//
// Note these are cross-origin fetches to services unrelated to the MMseqs2 server
// (files.rcsb.org, alphafold.ebi.ac.uk, bfvd.steineggerlab.workers.dev, yanglab.qd.sdu.edu.cn),
// so they fail independently of it.

// Default import, then destructure: axios is CommonJS, and while webpack resolves
// `import { create } from 'axios'` fine, Node's ESM loader cannot detect that named export and
// throws `SyntaxError: Named export 'create' not found`. This form works under both, which is what
// lets the headless layer reuse fetchAccession instead of reimplementing it.
import axios from 'axios';
const { create } = axios;

/** Always available. */
export const BASE_SOURCES = [
    { text: 'PDB (rcsb.org)', value: 'PDB' },
    { text: 'AlphaFoldDB (ebi.ac.uk)', value: 'AlphaFoldDB' },
    { text: 'BFVD (bfvd.foldseek.com)', value: 'BFVD' },
];

/** Opt-in per page via the button's `extraEnabled` prop. */
export const EXTRA_SOURCES = {
    AlphaFill: { text: 'AlphaFill (alphafill.eu)', value: 'AlphaFill' },
    QBioLip: { text: 'Q-BioLiP (yanglab.qd.sdu.edu.cn)', value: 'QBioLip' },
};

export function sourcesFor(extraEnabled = []) {
    const out = [...BASE_SOURCES];
    for (const key of extraEnabled) {
        if (key in EXTRA_SOURCES) out.push(EXTRA_SOURCES[key]);
    }
    return out;
}

/**
 * Resolve one accession to `{ name, text }`, or reject with the accession.
 *
 * `AlphaFoldDB` is a *fuzzy search*, not a lookup: it queries `text:*ACC OR text:ACC*` and takes
 * the first hit, so the entry returned can differ from the one asked for. Callers that care should
 * compare the returned `name` against what they requested.
 */
export function fetchAccession(accession, source) {
    return new Promise((resolve, reject) => {
        const axios = create();
        const upper = String(accession).toUpperCase();
        const fail = () => reject(accession);

        if (source === 'PDB') {
            axios.get('https://files.rcsb.org/download/' + upper + '.cif')
                .then(r => resolve({ name: upper + '.cif', text: r.data }))
                .catch(fail);
        } else if (source === 'BFVD') {
            axios.get('https://bfvd.steineggerlab.workers.dev/pdb/' + upper + '.pdb')
                .then(r => resolve({ name: upper + '.pdb', text: r.data }))
                .catch(fail);
        } else if (source === 'AlphaFill') {
            axios.get('https://alphafill.eu/v1/aff/' + upper)
                .then(r => resolve({ name: upper + '.cif', text: r.data }))
                .catch(fail);
        } else if (source === 'AlphaFoldDB') {
            axios.get('https://alphafold.ebi.ac.uk/api/search?q=(text:*' + accession
                    + ' OR text:' + accession + '*)&type=main&start=0&rows=1')
                .then(resp => {
                    const docs = resp.data.docs;
                    if (!docs || docs.length === 0) { fail(); return; }
                    const cif = docs[0].entryId + '-model_v' + docs[0].latestVersion + '.pdb';
                    axios.get('https://alphafold.ebi.ac.uk/files/' + cif)
                        .then(r => resolve({ name: cif, text: r.data }))
                        .catch(fail);
                })
                .catch(fail);
        } else {
            fail();
        }
    });
}

// ---------------------------------------------------------------------------------------------
// Q-BioLiP — binding sites for a PDB id. Two-step: search, then load a chosen site.
// ---------------------------------------------------------------------------------------------

/** map label_asym_id to auth_asym_id */
export function parseCifResidueChainMap(cifText) {
    const map = new Map();
    const lines = cifText.split('\n');

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

        const labelIdx = headers.indexOf('_atom_site.label_asym_id');
        const authIdx = headers.indexOf('_atom_site.auth_asym_id');
        const seqIdx = headers.indexOf('_atom_site.auth_seq_id');
        if (labelIdx < 0 || authIdx < 0 || seqIdx < 0) return map;
        const maxIdx = Math.max(labelIdx, authIdx, seqIdx);

        for (; i < lines.length; i++) {
            const t = lines[i].trim();
            if (t === '' || t === 'loop_' || t.startsWith('_') || t.startsWith('#')
                || t.startsWith('data_')) {
                break;  // end of atom_site
            }
            const cols = t.split(/\s+/);
            if (cols.length <= maxIdx) continue;
            const auth = cols[authIdx];
            const seq = cols[seqIdx];
            const keyLabel = `${cols[labelIdx]}|${seq}`;
            const keyAuth = `${auth}|${seq}`;
            if (!map.has(keyLabel)) map.set(keyLabel, auth);
            if (!map.has(keyAuth)) map.set(keyAuth, auth);
        }
        break;
    }
    return map;
}

/**
 * Convert Q-BioLiP binding-site notation to the internal motif format.
 * With a residueMap each residue's chain is resolved to the structure's auth chain and residues
 * absent from the structure are dropped. Without a map the reported chain letters are kept as-is.
 */
export function qbiolipBsToMotif(bs, residueMap) {
    if (!bs) return '';
    const parts = bs.trim().split(/\s+/);
    let currentChain = '';
    const residues = [];
    for (const part of parts) {
        let resToken;
        if (part.includes(':')) {
            const colonIdx = part.indexOf(':');
            currentChain = part.slice(0, colonIdx);
            resToken = part.slice(colonIdx + 1);
        } else {
            resToken = part;
        }
        if (!resToken) continue;
        // strip leading one-letter amino acid code, keep residue number
        const resno = resToken.replace(/^[A-Za-z]/, '');
        if (!resno) continue;

        if (!residueMap) { residues.push(`${currentChain}${resno}`); continue; }
        const seqMatch = resno.match(/-?\d+/);
        const authChain = seqMatch ? residueMap.get(`${currentChain}|${seqMatch[0]}`) : undefined;
        if (authChain === undefined) continue;   // not present in the loaded structure
        residues.push(`${authChain}${resno}`);
    }
    return residues.join(',');
}

export async function searchBindingSites(pdbId) {
    const axios = create();
    const response = await axios.post(
        'https://yanglab.qd.sdu.edu.cn/cgi-bin/Q-BioLiP/qbio1.cgi',
        new URLSearchParams({ PDB_ID: String(pdbId).trim().toUpperCase() }),
        { headers: { Accept: 'application/json' } },
    );
    return Array.isArray(response.data) ? response.data : [];
}

/** Load a chosen binding site's structure and derive its auth-chain-mapped motif. */
export async function fetchBindingSite(item) {
    const axios = create();
    const assembly = item.Receptor.assembly;
    const response = await axios.get(
        `https://yanglab.qd.sdu.edu.cn/Q-BioLiP/DATA/rec_cif/${assembly}.cif`);
    const cifText = response.data;
    // Q-BioLiP reports label_asym_id chains; the app uses auth_asym_id.
    const residueMap = parseCifResidueChainMap(cifText);
    return { name: `${assembly}.cif`, text: cifText,
        motif: qbiolipBsToMotif(item.Complex && item.Complex.bs, residueMap) };
}

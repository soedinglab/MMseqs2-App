// Fetch a structure by accession from a third-party service.
//
// Uses the platform fetch rather than a HTTP library: every browser this app supports has it, Node 18
// has it, and it was the one import that stopped `mcp/` from being publishable without a runtime
// dependency. The two helpers restore what was relied on — a rejection on a non-2xx status, and a
// parsed body — with the difference that the call site states which body it expects.

async function request(url, { method = 'GET', body = null, headers = {} } = {}) {
    const response = await fetch(url, { method, body, headers });
    if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText || 'error'} from ${url}`);
    }
    return response;
}

const getText = (url, opts) => request(url, opts).then(r => r.text());
const getJson = (url, opts) => request(url, opts).then(r => r.json());

export const BASE_SOURCES = [
    { text: 'PDB (rcsb.org)', value: 'PDB' },
    { text: 'AlphaFoldDB (ebi.ac.uk)', value: 'AlphaFoldDB' },
    { text: 'BFVD (bfvd.foldseek.com)', value: 'BFVD' },
];

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
 */
export function fetchAccession(accession, source) {
    return new Promise((resolve, reject) => {
        const upper = String(accession).toUpperCase();
        const fail = () => reject(accession);

        if (source === 'PDB') {
            getText('https://files.rcsb.org/download/' + upper + '.cif')
                .then(text => resolve({ name: upper + '.cif', text }))
                .catch(fail);
        } else if (source === 'BFVD') {
            getText('https://bfvd.steineggerlab.workers.dev/pdb/' + upper + '.pdb')
                .then(text => resolve({ name: upper + '.pdb', text }))
                .catch(fail);
        } else if (source === 'AlphaFill') {
            getText('https://alphafill.eu/v1/aff/' + upper)
                .then(text => resolve({ name: upper + '.cif', text }))
                .catch(fail);
        } else if (source === 'AlphaFoldDB') {
            getJson('https://alphafold.ebi.ac.uk/api/search?q=(text:*' + accession
                    + ' OR text:' + accession + '*)&type=main&start=0&rows=1')
                .then(data => {
                    const docs = data.docs;
                    if (!docs || docs.length === 0) { fail(); return; }
                    const cif = docs[0].entryId + '-model_v' + docs[0].latestVersion + '.pdb';
                    getText('https://alphafold.ebi.ac.uk/files/' + cif)
                        .then(text => resolve({ name: cif, text }))
                        .catch(fail);
                })
                .catch(fail);
        } else {
            fail();
        }
    });
}

/**
 * Index a receptor mmCIF so a Q-BioLiP binding-site residue can be resolved to this file's own
 * chain and residue number.
 *
 * @returns {Map<string, {chain: string, seq: string}>} keyed `chain|seq` under both schemes
 */
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
        const labelSeqIdx = headers.indexOf('_atom_site.label_seq_id');
        const authIdx = headers.indexOf('_atom_site.auth_asym_id');
        const seqIdx = headers.indexOf('_atom_site.auth_seq_id');
        if (labelIdx < 0 || authIdx < 0 || seqIdx < 0) return map;
        const maxIdx = Math.max(labelIdx, authIdx, seqIdx, labelSeqIdx);

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
            const here = { chain: auth, seq };

            // Auth keys are written first and never overwritten, so an auth match always wins over a
            // label match on the same key.
            const keyAuth = `${auth}|${seq}`;
            if (!map.has(keyAuth)) map.set(keyAuth, here);
            const keyAuthChainLabelSeq = `${cols[labelIdx]}|${seq}`;
            if (!map.has(keyAuthChainLabelSeq)) map.set(keyAuthChainLabelSeq, here);
        }
        break;
    }

    // Label-scheme keys in a second pass, so they can never displace an auth-scheme key.
    labelSeqPass(cifText, map);
    return map;
}

/** The label_asym_id|label_seq_id keys, added only where nothing auth-keyed already claims them. */
function labelSeqPass(cifText, map) {
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
        const labelSeqIdx = headers.indexOf('_atom_site.label_seq_id');
        const authIdx = headers.indexOf('_atom_site.auth_asym_id');
        const seqIdx = headers.indexOf('_atom_site.auth_seq_id');
        if (labelSeqIdx < 0 || labelIdx < 0 || authIdx < 0 || seqIdx < 0) return;
        const maxIdx = Math.max(labelIdx, labelSeqIdx, authIdx, seqIdx);

        for (; i < lines.length; i++) {
            const t = lines[i].trim();
            if (t === '' || t === 'loop_' || t.startsWith('_') || t.startsWith('#')
                || t.startsWith('data_')) {
                break;
            }
            const cols = t.split(/\s+/);
            if (cols.length <= maxIdx) continue;
            if (cols[labelSeqIdx] === '.' || cols[labelSeqIdx] === '?') continue;
            for (const key of [`${cols[labelIdx]}|${cols[labelSeqIdx]}`,
                `${cols[authIdx]}|${cols[labelSeqIdx]}`]) {
                if (!map.has(key)) map.set(key, { chain: cols[authIdx], seq: cols[seqIdx] });
            }
        }
        break;
    }
}

/**
 * Resolve Q-BioLiP binding-site notation against a receptor, residue by residue.
 *
 * @returns {{residues: string[], dropped: {chain: string, resno: string}[], translated: number}}
 */
export function qbiolipBsResidues(bs, residueMap) {
    const residues = [];
    const dropped = [];
    let translated = 0;
    if (!bs) return { residues, dropped, translated };

    let currentChain = '';
    for (const part of bs.trim().split(/\s+/)) {
        let resToken = part;
        if (part.includes(':')) {
            const colonIdx = part.indexOf(':');
            currentChain = part.slice(0, colonIdx);
            resToken = part.slice(colonIdx + 1);
        }
        if (!resToken) continue;
        // strip leading one-letter amino acid code, keep residue number
        const resno = resToken.replace(/^[A-Za-z]/, '');
        if (!resno) continue;

        if (!residueMap) { residues.push(`${currentChain}${resno}`); continue; }
        const seqMatch = resno.match(/-?\d+/);
        const found = seqMatch ? residueMap.get(`${currentChain}|${seqMatch[0]}`) : undefined;
        if (found === undefined) { dropped.push({ chain: currentChain, resno }); continue; }
        if (found.seq !== seqMatch[0]) translated++;
        residues.push(`${found.chain}${found.seq}`);
    }
    return { residues, dropped, translated };
}

/**
 * Convert Q-BioLiP binding-site notation to the internal motif format.
 */
export function qbiolipBsToMotif(bs, residueMap) {
    return qbiolipBsResidues(bs, residueMap).residues.join(',');
}

export async function searchBindingSites(pdbId) {
    // A URLSearchParams body sets the form content type by itself, as the previous client did.
    const data = await getJson('https://yanglab.qd.sdu.edu.cn/cgi-bin/Q-BioLiP/qbio1.cgi', {
        method: 'POST',
        body: new URLSearchParams({ PDB_ID: String(pdbId).trim().toUpperCase() }),
        headers: { Accept: 'application/json' },
    });
    return Array.isArray(data) ? data : [];
}

/**
 * Load a chosen binding site's structure and express its residues in that file's own numbering.
 */
export async function fetchBindingSite(item) {
    const assembly = item.Receptor.assembly;
    const cifText = await getText(
        `https://yanglab.qd.sdu.edu.cn/Q-BioLiP/DATA/rec_cif/${assembly}.cif`);
    // Q-BioLiP reports label_asym_id chains, and — depending on the entry — either numbering scheme.
    const residueMap = parseCifResidueChainMap(cifText);
    const resolved = qbiolipBsResidues(item.Complex && item.Complex.bs, residueMap);
    return {
        name: `${assembly}.cif`,
        text: cifText,
        motif: resolved.residues.join(','),
        dropped: resolved.dropped,
        translated: resolved.translated,
    };
}

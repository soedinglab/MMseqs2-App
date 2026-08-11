// Motif validation for FoldDisco.
//
// A motif is a comma-separated list of residue tokens: `A123` (chain + residue number), `123` (bare
// residue number), or `A123:W` (with a substitution). This is a port of FoldDiscoSearch.vue's
// isMotifValid, and follows it on both halves of the check:
//
//   1. token syntax — at most one ':', a letter after it, a chain+number identifier before it
//   2. existence  — every token must name a residue that is actually in the query structure
//
// The second half is the point. A syntactically perfect token for a residue the query does not
// contain produces a job that searches for nothing, and the backend accepts it without complaint
// (NewFoldDiscoJobRequest validates the database list and nothing else), so it has to be caught
// before submission.
//
// Where the page walks NGL's `eachResidue`, this walks lib/structureText.js's listResidues, which
// produces the same (chainname, resno) identifiers without needing a browser.

import { residueTokenSet } from '../../../frontend/lib/structureText.js';

/** The page treats a motif of more than 32 distinct residues as invalid. */
export const MOTIF_MAX_RESIDUES = 32;

const SUBSTITUTION = /[A-Za-z]/;
// Matches splitAlphaNum(), which is what MotifSelection.vue parses these tokens with: a run of
// letters (chain, possibly multi-character — splitAlphaNum('AA12') is ['AA','12','']) then digits.
//
// Negative residue numbers are rejected on purpose, and this is a real (if narrow) divergence from
// the page worth knowing about. Structures do contain them — PDB 6iuf, reachable as a hit in the
// FoldDisco validation ticket, starts chain A at residue -3 — and isMotifValid would accept "A-3",
// because NGL reports chainname 'A' + resno -3 and the token matches by string concatenation. But
// splitAlphaNum('A-3') returns ['A-','3',''], reading the minus as part of the chain name, so the
// same token is misread wherever a motif is parsed back into residues. Submitting it would produce
// a job built on a residue nobody named; refusing is the safer half of an inconsistency that
// predates this code.
const RESIDUE_TOKEN = /^[A-Za-z]*\d+$/;

/**
 * @param {string} motif
 * @param {string} [structureText] query PDB/mmCIF; without it only syntax is checked
 * @returns {{valid: boolean, reason?: string, residues: string[], missing: string[]}}
 */
export function checkMotif(motif, structureText) {
    if (typeof motif !== 'string' || motif.trim() === '') {
        return { valid: false, reason: 'motif is empty', residues: [], missing: [] };
    }

    const residues = [];
    for (const raw of motif.split(',')) {
        const token = raw.trim();
        if (token === '') continue;

        const chunks = token.split(':');
        if (chunks.length > 2) {
            return { valid: false, reason: `"${token}" has more than one ":"`, residues, missing: [] };
        }
        if (chunks.length === 2 && !SUBSTITUTION.test(chunks[1])) {
            return {
                valid: false,
                reason: `"${token}" has a substitution that is not a letter`,
                residues, missing: [],
            };
        }
        if (!RESIDUE_TOKEN.test(chunks[0])) {
            return {
                valid: false,
                reason: `"${token}" is not a residue token (expected e.g. "A123", "123" or "A123:W")`,
                residues, missing: [],
            };
        }
        residues.push(chunks[0]);
    }

    const distinct = [...new Set(residues)];
    if (distinct.length === 0) {
        return { valid: false, reason: 'motif has no residues', residues: [], missing: [] };
    }
    if (distinct.length > MOTIF_MAX_RESIDUES) {
        return {
            valid: false,
            reason: `motif has ${distinct.length} residues; the maximum is ${MOTIF_MAX_RESIDUES}`,
            residues: distinct, missing: [],
        };
    }

    if (structureText === undefined) return { valid: true, residues: distinct, missing: [] };

    const present = residueTokenSet(structureText);
    if (present.size === 0) {
        return {
            valid: false,
            reason: 'no residues could be read from the query structure',
            residues: distinct, missing: distinct,
        };
    }
    const missing = distinct.filter(t => !present.has(t));
    if (missing.length) {
        return {
            valid: false,
            reason: `${missing.length} residue(s) are not in the query structure: ` +
                    `${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ', …' : ''}`,
            residues: distinct, missing,
        };
    }
    return { valid: true, residues: distinct, missing: [] };
}

export function assertMotif(motif, structureText) {
    const { valid, reason } = checkMotif(motif, structureText);
    if (!valid) throw new Error(`invalid FoldDisco motif: ${reason}`);
}

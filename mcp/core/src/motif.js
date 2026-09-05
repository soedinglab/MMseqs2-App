// FoldDisco motif parsing, validation and chain normalization.

import {
    residueTokenSet, listResidues, listChains, planChainRenames, renameChains, isNameableChain,
} from '../../../frontend/lib/structureText.js';
import { splitAlphaNum } from '../../../frontend/lib/parseResults.js';

export const MOTIF_MAX_RESIDUES = 32;

const SUBSTITUTION = /[A-Za-z]/;
const RESIDUE_TOKEN = /^[A-Za-z]*\d+$/;

function residueIndex(structureText) {
    const byChain = new Set();
    const anyChain = new Set();
    const chains = new Set();
    for (const r of listResidues(structureText)) {
        byChain.add(`${r.chain}|${r.resno}`);
        anyChain.add(String(r.resno));
        chains.add(r.chain);
    }
    return { byChain, anyChain, chains };
}

/** Validate motif syntax and, when provided, referenced structure residues. */
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

    const { byChain, anyChain, chains } = residueIndex(structureText);
    if (byChain.size === 0) {
        return {
            valid: false,
            reason: 'no residues could be read from the query structure',
            residues: distinct, missing: distinct,
        };
    }

    const unnameable = [...chains].filter(c => c && !isNameableChain(c));
    const byConcatenation = residueTokenSet(structureText);
    const missing = [];
    const ambiguous = [];
    for (const token of distinct) {
        const [chain, resno] = splitAlphaNum(token);
        if (chain ? byChain.has(`${chain}|${resno}`) : anyChain.has(resno)) continue;
        if (byConcatenation.has(token)) ambiguous.push(token);
        else missing.push(token);
    }

    if (missing.length) {
        return {
            valid: false,
            reason: `${missing.length} residue(s) are not in the query structure: ` +
                    `${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ', …' : ''}`,
            residues: distinct, missing,
            ...(ambiguous.length ? { ambiguous } : {}),
            ...(unnameable.length ? { unnameableChains: unnameable } : {}),
        };
    }

    const result = { valid: true, residues: distinct, missing: [] };
    const warnings = [];
    if (ambiguous.length) {
        warnings.push(
            `${ambiguous.length} token(s) name a residue only by concatenation: `
            + `${ambiguous.slice(0, 8).join(', ')}${ambiguous.length > 8 ? ', …' : ''}. `
            + 'Splitting letters from digits reads them as a different residue, which does not exist '
            + 'here — the search may return nothing.');
        result.ambiguous = ambiguous;
    }
    if (unnameable.length) {
        warnings.push(
            `chain(s) ${unnameable.join(', ')} in this structure have names that are not purely `
            + 'alphabetic, so a motif token cannot separate chain from residue number unambiguously');
        result.unnameableChains = unnameable;
    }
    if (warnings.length) result.warnings = warnings;
    return result;
}

export function assertMotif(motif, structureText) {
    const { valid, reason } = checkMotif(motif, structureText);
    if (!valid) throw new Error(`invalid FoldDisco motif: ${reason}`);
}

/** Convert a FoldDisco hit's matched residues into a motif. */
export function motifFromTargetResidues(targetResidues) {
    return String(targetResidues ?? '')
        .replace(/^_,(_,)*|(,_)*,_$/g, '')
        .replace(/,_,(_,)*/g, ',');
}

/** Give a structure addressable chain names and rewrite its motif. */
export function normalizeChainNames(structureText, { motif = null } = {}) {
    const chains = listChains(structureText).map(c => c.chain);
    const renames = planChainRenames(chains);
    if (renames.size === 0) {
        return { text: structureText, motif, renames: {}, changed: false };
    }

    // Match longer chain names first to avoid prefix collisions.
    const originals = [...renames.keys()].sort((a, b) => b.length - a.length);
    const rewriteToken = (token) => {
        const [identifier, substitution] = token.split(':');
        const original = originals.find(c => identifier.startsWith(c)
            && /^\d+$/.test(identifier.slice(c.length)));
        if (!original) return token;
        const renamed = `${renames.get(original)}${identifier.slice(original.length)}`;
        return substitution === undefined ? renamed : `${renamed}:${substitution}`;
    };

    const text = renameChains(structureText, renames);

    const after = new Set(listChains(text).map(c => c.chain));
    const unapplied = [...renames.entries()].filter(([, alias]) => !after.has(alias));
    if (unapplied.length) {
        return {
            text: structureText,
            motif,
            renames: {},
            changed: false,
            reason: `chain(s) ${unapplied.map(([from]) => from).join(', ')} could not be renamed in `
                + 'this file, so the structure and the motif were left alone rather than made to '
                + 'disagree',
        };
    }

    return {
        text,
        motif: typeof motif === 'string' && motif.trim() !== ''
            ? motif.split(',').map(t => rewriteToken(t.trim())).filter(Boolean).join(',')
            : motif,
        renames: Object.fromEntries(renames),
        changed: true,
    };
}

const SUGGEST = 'https://api.ncbi.nlm.nih.gov/datasets/v2alpha/taxonomy/taxon_suggest/';

const RANK_FILTER = '?tax_rank_filter=higher_taxon';

export const TAX_CANDIDATE_CAP = 8;

const NUMERIC = /^[0-9]+$/;
// A name starts with a letter. Anything else that is not a plain id — "9606;10090", "12-15" — is a
// malformed id list, and belongs in the local validator's refusal rather than in a lookup.
const NAME = /^[A-Za-z][A-Za-z0-9 .'’\-()[\]]*$/;

function coded(code, message) {
    const err = new Error(message);
    err.code = code;
    return err;
}

/** One name to one taxon, or a refusal that names the alternatives. */
async function resolveName(name, { fetchImpl, signal }) {
    let data;
    try {
        const res = await fetchImpl(SUGGEST + encodeURIComponent(name) + RANK_FILTER, { signal });
        if (!res.ok) throw new Error(`${res.status}`);
        data = await res.json();
    } catch (err) {
        throw coded('TAXON_LOOKUP_FAILED',
            `could not look up ${JSON.stringify(name)}: ${err.message}. Pass a numeric taxon id instead`);
    }

    const list = (data?.sci_name_and_ids ?? []).filter(e => e?.tax_id);
    if (!list.length) {
        throw coded('TAXON_NOT_FOUND',
            `no taxon matches ${JSON.stringify(name)} — lookup is by scientific name, not common name, `
            + 'so try "Homo sapiens" rather than "human", or pass a numeric id');
    }

    const exact = list.filter(e => String(e.sci_name).toLowerCase() === name.toLowerCase());
    const pick = exact.length === 1 ? exact[0] : (list.length === 1 ? list[0] : null);
    if (!pick) {
        const shown = list.slice(0, TAX_CANDIDATE_CAP)
            .map(e => `${e.sci_name} (${e.tax_id}${e.rank ? `, ${String(e.rank).toLowerCase()}` : ''})`)
            .join('; ');
        const more = list.length > TAX_CANDIDATE_CAP ? ` … ${list.length} in all` : '';
        throw coded('TAXON_AMBIGUOUS',
            `${JSON.stringify(name)} matches no scientific name exactly. Candidates: ${shown}${more}. `
            + 'Pass the numeric id you mean');
    }
    return { taxId: String(pick.tax_id), sciName: pick.sci_name, rank: pick.rank ?? null };
}

/**
 * Turn a filter that may contain names into one of ids. Numeric tokens never touch the network, so a
 * caller passing ids behaves exactly as before.
 *
 * @returns {Promise<{filter: string, resolved: object[]}>}
 */
export async function resolveTaxFilter(raw, { fetchImpl = globalThis.fetch, signal } = {}) {
    const value = String(raw ?? '').trim();
    if (!value) return { filter: '', resolved: [] };

    const ids = [];
    const resolved = [];
    for (const token of value.split(',')) {
        const trimmed = token.trim();
        // An empty token is kept, not skipped: "9606," and "9606,!" are malformed, and silently
        // repairing them would drop an exclusion the caller meant to write.
        if (!trimmed) { ids.push(''); continue; }
        const negated = trimmed.startsWith('!');
        const body = (negated ? trimmed.slice(1) : trimmed).trim();
        if (NUMERIC.test(body) || !NAME.test(body)) {
            ids.push(negated ? `!${body}` : body);
            continue;
        }
        const hit = await resolveName(body, { fetchImpl, signal });
        resolved.push({ name: body, ...hit, ...(negated ? { negated: true } : {}) });
        ids.push(negated ? `!${hit.taxId}` : hit.taxId);
    }
    return { filter: ids.join(','), resolved };
}

/** Whether a filter needs the network at all. */
export function taxFilterHasNames(raw) {
    return String(raw ?? '').split(',')
        .map(t => t.trim().replace(/^!/, '').trim())
        .some(t => t && !NUMERIC.test(t) && NAME.test(t));
}

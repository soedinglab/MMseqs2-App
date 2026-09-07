// Taxonomy subtree expansion over a kraken-style report.
// Extracted here so the API can expand a subtree whether or not the diagram
// has ever been rendered, and so both use the same definition.

/** Row for a taxon id, or null. Ids are compared as strings — the report stores them that way. */
export function findTaxonRow(report, taxonId) {
    if (!Array.isArray(report)) return null;
    const wanted = String(taxonId);
    return report.find(r => String(r.taxon_id) === wanted) || null;
}

/**
 * Ids of `taxonId` and every descendant, in report order.
 * Returns raw taxon_id values (strings, as stored) to match what SankeyDiagram emits;
 * callers coerce with Number() exactly as handleSankeySelect does.
 */
export function expandDescendants(report, taxonId) {
    if (!Array.isArray(report)) return [];
    const wanted = String(taxonId);
    const out = [];
    let depth = null;

    for (const row of report) {
        if (depth === null) {
            if (String(row.taxon_id) === wanted) {
                depth = Number(row.depth);
                out.push(row.taxon_id);
            }
            continue;
        }
        if (Number(row.depth) > depth) out.push(row.taxon_id);
        else break;   // back up to a sibling or shallower node — subtree is done
    }
    return depth === null ? [] : out;
}

/** Compact listing for discovery: what can actually be filtered on. */
export function summarizeTaxonomy(report, { minCladeReads = 0, maxRows = 200 } = {}) {
    if (!Array.isArray(report)) return [];
    return report
        .filter(r => Number(r.clade_reads) >= minCladeReads)
        .slice(0, maxRows)
        .map(r => ({
            taxId: Number(r.taxon_id),
            name: r.name,
            rank: r.rank,
            depth: Number(r.depth),
            cladeReads: Number(r.clade_reads),
            proportion: Number(r.proportion),
        }));
}

/** Resolve a name (case-insensitive, exact) to its taxon id. Convenience for callers. */
export function findTaxonByName(report, name) {
    if (!Array.isArray(report) || !name) return null;
    const wanted = String(name).trim().toLowerCase();
    const row = report.find(r => String(r.name).trim().toLowerCase() === wanted);
    return row ? Number(row.taxon_id) : null;
}

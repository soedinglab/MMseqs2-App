// Golden-file parity: the headless getTable() must produce the same table as the mounted page.
//
// `*.expected.json` is a frozen capture of the browser page API, taken by calling
// window.resultsApi.getTable() on the live validation tickets before that API was removed
// (see claude-plan/headless-agent-layer/checklist.md 1.7). `*.raw.json` is
// the backend response those pages were showing, trimmed two ways, each verified not to change the
// table output before being applied:
//   - databases other than the one under test keep their entry but lose their alignments, so
//     dbIndex — and therefore row ids like "2#0" — still match what the page reported
//   - per-hit coordinate payloads (tCa/tSeq/qAln/dbAln, tmat/umat) are dropped; the table path
//     never reads them, and they were 97% of the bytes
//
// Fields that exist only on a mounted page are excluded rather than asserted, and listed explicitly
// below so that "we do not produce this" stays a decision on the record instead of a silent gap.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseResults, parseResultsFoldDisco } from '../../../frontend/lib/parseResults.js';
import { ResultTable } from '../src/results.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const fixture = name => JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', name), 'utf8'));

/** Row fields that read mounted-component state. */
const PAGE_ONLY_ROW_FIELDS = ['selected', 'visible', 'cluster'];
/** Envelope fields that describe the open tab or the page's own chrome. */
const PAGE_ONLY_TABLE_FIELDS = ['activeDatabase', 'filtersApplied', 'clustered', 'page', 'motif', 'query', 'type'];

/**
 * Reduce either envelope — the Foldseek page aliases a single database's rows to the top level,
 * the FoldDisco page does not — to the per-database view both share.
 */
function normalize(table) {
    const d = table.databases?.[0] ?? table;
    const rows = (d.rows ?? table.rows ?? []).map(row => {
        const copy = { ...row };
        for (const f of PAGE_ONLY_ROW_FIELDS) delete copy[f];
        return copy;
    });
    const view = {
        db: d.db, dbIndex: d.dbIndex, sortKey: d.sortKey, sortOrder: d.sortOrder,
        total: d.total, offset: d.offset, returned: d.returned,
        hasDescription: d.hasDescription, hasTaxonomy: d.hasTaxonomy,
        rows,
    };
    for (const f of PAGE_ONLY_TABLE_FIELDS) delete view[f];
    return view;
}

function runCases({ rawFile, expectedFile, parse, tool }) {
    const raw = fixture(rawFile);
    const expected = fixture(expectedFile);
    const parsed = parse(raw);

    for (const { opts, table } of expected) {
        const label = `${tool} getTable(${JSON.stringify(opts)})`;
        test(label, () => {
            const headless = new ResultTable(parsed, { ticket: 'fixture', queryIdx: 0, tool }).getTable(opts);
            assert.deepEqual(normalize(headless), normalize(table));
        });
    }
}

runCases({
    rawFile: 'foldseek-bfmd.raw.json',
    expectedFile: 'foldseek-bfmd.expected.json',
    parse: parseResults,
    tool: 'foldseek',
});

runCases({
    rawFile: 'folddisco-pdb.raw.json',
    expectedFile: 'folddisco-pdb.expected.json',
    parse: parseResultsFoldDisco,
    tool: 'folddisco',
});

// Taxonomy filtering has no page counterpart to capture — the browser applies it as a visibility
// mask over an already-rendered table rather than as a filter over the data — so it is asserted
// against the ticket's own taxonomy report instead: the number of hits kept for a clade must equal
// that clade's clade_reads.
test('taxonFilter total matches the taxonomy report clade_reads', () => {
    const parsed = parseResults(fixture('foldseek-bfmd.raw.json'));
    const table = new ResultTable(parsed, { ticket: 'fixture', tool: 'foldseek' });
    const report = parsed.results.find(r => r.db === 'bfmd').taxonomyreports?.[0] ?? [];

    const leaf = report.find(r => r.rank === 'species' && r.clade_reads > 1 && r.taxon_reads === r.clade_reads);
    assert.ok(leaf, 'fixture should contain a species whose clade is exactly its own reads');

    const filtered = table.getTable({ db: 'bfmd', limit: 1000, taxonFilter: { taxId: leaf.taxon_id } });
    assert.equal(filtered.total, leaf.clade_reads);
    assert.ok(filtered.taxonFiltered);
    for (const row of filtered.rows) assert.equal(String(row.taxId), String(leaf.taxon_id));

    const unfiltered = table.getTable({ db: 'bfmd', limit: 1 });
    assert.ok(filtered.total < unfiltered.total, 'filtering should remove hits');
});

test('taxonFilter with includeDescendants pulls in a whole subtree', () => {
    const parsed = parseResults(fixture('foldseek-bfmd.raw.json'));
    const table = new ResultTable(parsed, { ticket: 'fixture', tool: 'foldseek' });
    const report = parsed.results.find(r => r.db === 'bfmd').taxonomyreports?.[0] ?? [];

    const inner = report.find(r => r.clade_reads > r.taxon_reads && r.depth > 0);
    assert.ok(inner, 'fixture should contain a clade with descendants');

    const withKids = table.getTable({ db: 'bfmd', limit: 1000, taxonFilter: { taxId: inner.taxon_id } });
    const without = table.getTable({
        db: 'bfmd', limit: 1000,
        taxonFilter: { taxId: inner.taxon_id, includeDescendants: false },
    });
    assert.equal(withKids.total, inner.clade_reads);
    assert.equal(without.total, inner.taxon_reads);
});

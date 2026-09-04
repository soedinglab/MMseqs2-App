// Current result-table summary, taxonomy, and FoldDisco motif contracts over captured server data.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseResults, parseResultsFoldDisco } from '../../../frontend/lib/parseResults.js';
import { ResultTable } from '../src/results.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const fixture = name => JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', name), 'utf8'));

const FOLDSEEK = new ResultTable(parseResults(fixture('foldseek-bfmd.raw.json')), { ticket: 'fs', tool: 'foldseek' });
const FOLDDISCO = new ResultTable(parseResultsFoldDisco(fixture('folddisco-pdb.raw.json')), { ticket: 'fd', tool: 'folddisco' });

test('sortKeySource is always default headlessly, and says so', () => {
    // With no UI state, a built-in ranking is a default rather than a user choice.
    for (const db of FOLDSEEK.getTableSummary({ db: 'bfmd' }).databases) {
        assert.equal(db.sortKeySource, 'default');
    }
});

test('metrics cover the sort key with best, median and worst', () => {
    const [db] = FOLDSEEK.getTableSummary({ db: 'bfmd', topN: 0 }).databases;
    const stats = db.metrics[db.sortKey];
    assert.ok(stats.best >= stats.median && stats.median >= stats.worst,
        `expected best >= median >= worst for a descending sort, got ${JSON.stringify(stats)}`);

    const all = FOLDSEEK.getTable({ db: 'bfmd', limit: db.total, fields: ['score'] }).rows;
    assert.equal(stats.best, all[0].score);
    assert.equal(stats.worst, all.at(-1).score);
});

test('topN sizes the sample, and topN:0 omits it', () => {
    assert.equal(FOLDSEEK.getTableSummary({ db: 'bfmd', topN: 2 }).databases[0].top.length, 2);
    assert.equal(FOLDSEEK.getTableSummary({ db: 'bfmd', topN: 0 }).databases[0].top, undefined);
});

test('the merged pool is independent of topN, but the returned length follows it', () => {
    const three = FOLDSEEK.getTableSummary({ db: '*', topN: 3, merged: true });
    const none = FOLDSEEK.getTableSummary({ db: '*', topN: 0, merged: true });

    assert.equal(three.merged.pooledPerDatabase, 100);
    assert.equal(three.merged.ranked, none.merged.ranked, 'the pool must not depend on topN');
    assert.deepEqual(three.merged.topN[0], none.merged.topN[0], 'nor must the ordering');
    assert.equal(three.merged.returned, 3);
    assert.equal(three.merged.topN.length, 3);
    assert.equal(FOLDSEEK.getTableSummary({ db: '*', merged: true, mergedLimit: 7 }).merged.returned, 7);
});

test('a merged ranking is ordered by the sort key', () => {
    const { merged } = FOLDSEEK.getTableSummary({ db: '*', merged: true, mergedLimit: 20 });
    const values = merged.topN.map(r => Number(r[merged.sortKey === 'idf' ? 'idfscore' : merged.sortKey]));
    for (let i = 1; i < values.length; i++) {
        assert.ok(merged.sortOrder < 0 ? values[i - 1] >= values[i] : values[i - 1] <= values[i]);
    }
});

test('an e-value merge carries the comparability caveat', () => {
    const table = new ResultTable(parseResults(fixture('foldseek-bfmd.raw.json')), { ticket: 'fs', tool: 'foldseek' });
    table.raw.mode = 'eval-forced';
    const summary = table.getTableSummary({ db: '*', merged: true });
    if (summary.merged.sortKey === 'eval') assert.match(summary.merged.caveat, /search-space/);
    else assert.equal(summary.merged.caveat, undefined, 'no caveat for a comparable key');
});

test('taxonFilter resolves a taxon name within the database tree', () => {
    const report = FOLDSEEK.raw.results.find(r => r.db === 'bfmd').taxonomyreports[0];
    const named = report.find(r => r.depth > 0 && r.clade_reads > 1);

    const byName = FOLDSEEK.getTable({ db: 'bfmd', limit: 1, taxonFilter: { taxon: named.name } });
    const byId = FOLDSEEK.getTable({ db: 'bfmd', limit: 1, taxonFilter: { taxon: named.taxon_id } });
    assert.equal(byName.total, byId.total, 'a name and its id must select the same hits');
    assert.equal(byName.total, named.clade_reads);
});

test('an unknown taxon name fails with a reason rather than filtering to nothing', () => {
    const out = FOLDSEEK.getTable({ db: 'bfmd', taxonFilter: { taxon: 'Not A Real Taxon' } });
    assert.match(out.databases[0].error, /no taxon named "Not A Real Taxon"/);
});

test('taxonFilter accepts an array, unioning the clades', () => {
    const report = FOLDSEEK.raw.results.find(r => r.db === 'bfmd').taxonomyreports[0];
    const leaves = report.filter(r => r.taxon_reads === r.clade_reads && r.clade_reads > 0).slice(0, 2);
    if (leaves.length < 2) return;

    const both = FOLDSEEK.getTable({ db: 'bfmd', limit: 0, taxonFilter: { taxon: leaves.map(l => l.taxon_id) } });
    const first = FOLDSEEK.getTable({ db: 'bfmd', limit: 0, taxonFilter: { taxon: leaves[0].taxon_id } });
    const second = FOLDSEEK.getTable({ db: 'bfmd', limit: 0, taxonFilter: { taxon: leaves[1].taxon_id } });
    assert.equal(both.total, first.total + second.total);
});

test('taxId stays accepted as an alias for taxon', () => {
    const report = FOLDSEEK.raw.results.find(r => r.db === 'bfmd').taxonomyreports[0];
    const node = report.find(r => r.depth > 0 && r.clade_reads > 1);
    assert.equal(
        FOLDSEEK.getTable({ db: 'bfmd', limit: 1, taxonFilter: { taxId: node.taxon_id } }).total,
        FOLDSEEK.getTable({ db: 'bfmd', limit: 1, taxonFilter: { taxon: node.taxon_id } }).total,
    );
});

test('getTaxonomy lists the tree, and reports absence rather than erroring', () => {
    const tax = FOLDSEEK.getTaxonomy('bfmd', { maxRows: 5 });
    assert.equal(tax.available, true);
    assert.ok(tax.totalNodes > 5);
    assert.equal(tax.taxa.length, 5);
    for (const t of tax.taxa) assert.ok(t.taxId !== undefined && t.name);

    const none = FOLDDISCO.getTaxonomy('pdb_folddisco');
    assert.equal(none.available, false);
    assert.match(none.reason, /no taxonomy data/);
});

test('taxonFilter total matches the taxonomy report clade_reads', () => {
    const report = FOLDSEEK.raw.results.find(r => r.db === 'bfmd').taxonomyreports?.[0] ?? [];
    const leaf = report.find(r => r.rank === 'species' && r.clade_reads > 1 && r.taxon_reads === r.clade_reads);
    assert.ok(leaf, 'fixture should contain a species whose clade is exactly its own reads');

    const filtered = FOLDSEEK.getTable({ db: 'bfmd', limit: 1000, taxonFilter: { taxId: leaf.taxon_id } });
    assert.equal(filtered.total, leaf.clade_reads);
    assert.ok(filtered.taxonFiltered);
    for (const row of filtered.rows) assert.equal(String(row.taxId), String(leaf.taxon_id));

    const unfiltered = FOLDSEEK.getTable({ db: 'bfmd', limit: 1 });
    assert.ok(filtered.total < unfiltered.total, 'filtering should remove hits');
});

test('taxonFilter with includeDescendants pulls in a whole subtree', () => {
    const report = FOLDSEEK.raw.results.find(r => r.db === 'bfmd').taxonomyreports?.[0] ?? [];
    const inner = report.find(r => r.clade_reads > r.taxon_reads && r.depth > 0);
    assert.ok(inner, 'fixture should contain a clade with descendants');

    const withKids = FOLDSEEK.getTable({ db: 'bfmd', limit: 1000, taxonFilter: { taxId: inner.taxon_id } });
    const without = FOLDSEEK.getTable({
        db: 'bfmd', limit: 1000,
        taxonFilter: { taxId: inner.taxon_id, includeDescendants: false },
    });
    assert.equal(withKids.total, inner.clade_reads);
    assert.equal(without.total, inner.taxon_reads);
});

test('the summary reports motif patterns, and they account for every hit', () => {
    const [db] = FOLDDISCO.getTableSummary({ db: 'pdb_folddisco', topN: 0 }).databases;
    const { patterns, note, queryResidues } = db.motifPatterns;

    assert.ok(patterns.length > 0);
    assert.match(note, /"1" matched/);
    assert.equal(patterns.reduce((a, p) => a + p.hits, 0), db.total,
        'the patterns partition the hits');
    for (let i = 1; i < patterns.length; i++) {
        assert.ok(patterns[i - 1].hits >= patterns[i].hits, 'most frequent first');
    }
    assert.ok(queryResidues !== undefined);
});

test('motifFilter keeps exactly the hits the aggregate counted', () => {
    const [db] = FOLDDISCO.getTableSummary({ db: 'pdb_folddisco', topN: 0 }).databases;
    for (const { pattern, hits } of db.motifPatterns.patterns.slice(0, 3)) {
        const filtered = FOLDDISCO.getTable({ db: 'pdb_folddisco', limit: 1, motifFilter: pattern });
        assert.equal(filtered.total, hits, `pattern ${pattern}`);
        assert.equal(filtered.taxonFiltered, false);
        for (const row of filtered.rows) assert.equal(row.motifPattern, pattern);
    }
});

test('motifFilter accepts several patterns', () => {
    const [db] = FOLDDISCO.getTableSummary({ db: 'pdb_folddisco', topN: 0 }).databases;
    const two = db.motifPatterns.patterns.slice(0, 2);
    if (two.length < 2) return;
    const filtered = FOLDDISCO.getTable({ db: 'pdb_folddisco', limit: 0, motifFilter: two.map(p => p.pattern) });
    assert.equal(filtered.total, two[0].hits + two[1].hits);
});

test('a pattern nothing matches gives an empty table, not an error', () => {
    const out = FOLDDISCO.getTable({ db: 'pdb_folddisco', motifFilter: '01010101010101' });
    assert.equal(out.ok, true);
    assert.equal(out.total, 0);
});

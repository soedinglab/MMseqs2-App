// Phase 2B — the capabilities the browser page API had and this layer did not (api-parity.md).
//
// `*-summary-expected.json` is a frozen capture taken the same way 1.7.2 was: real
// window.resultsApi.getTableSummary() calls in a browser, before that API was removed. Page-only
// fields are excluded by name, as in parity.test.js.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseResults, parseResultsFoldDisco } from '../../../frontend/lib/parseResults.js';
import { ResultTable } from '../src/results.js';
import { foldMasonFasta, foldMasonCoordinates, foldMasonEntries, foldMasonColumns } from '../src/msa.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const fixture = name => JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', name), 'utf8'));

const FOLDSEEK = new ResultTable(parseResults(fixture('foldseek-bfmd.raw.json')), { ticket: 'fs', tool: 'foldseek' });
const FOLDDISCO = new ResultTable(parseResultsFoldDisco(fixture('folddisco-pdb.raw.json')), { ticket: 'fd', tool: 'folddisco' });

/** `visibleCount`/`selectedCount` read the mounted table; `sortKeySource` differs by design. */
const PAGE_ONLY = ['visibleCount', 'selectedCount', 'sortKeySource'];

function normalizeDb(db) {
    const copy = { ...db };
    for (const f of PAGE_ONLY) delete copy[f];
    delete copy.motifPatterns;      // headless addition; the page has it as a separate call
    return copy;
}

// -------------------------------------------------------------------------------------------
// 2B.1 — getTableSummary
// -------------------------------------------------------------------------------------------

test('getTableSummary reproduces the browser summary', () => {
    for (const { opts, summary } of fixture('fs-summary-expected.json')) {
        const mine = FOLDSEEK.getTableSummary(opts);
        assert.equal(mine.ok, true, JSON.stringify(opts));
        assert.deepEqual(
            mine.databases.map(normalizeDb),
            summary.databases.map(normalizeDb),
            `getTableSummary(${JSON.stringify(opts)})`,
        );
    }
});

test('getTableSummary reproduces the browser summary for FoldDisco', () => {
    for (const { opts, summary } of fixture('fd-summary-expected.json')) {
        const mine = FOLDDISCO.getTableSummary(opts);
        assert.deepEqual(mine.databases.map(normalizeDb), summary.databases.map(normalizeDb));
    }
});

test('sortKeySource is always default headlessly, and says so', () => {
    // The page reports 'active' for its open tab. There is no open tab here, so claiming 'active'
    // would present a built-in default as a choice someone made.
    for (const db of FOLDSEEK.getTableSummary({ db: 'bfmd' }).databases) {
        assert.equal(db.sortKeySource, 'default');
    }
});

test('metrics cover the sort key with best, median and worst', () => {
    const [db] = FOLDSEEK.getTableSummary({ db: 'bfmd', topN: 0 }).databases;
    const stats = db.metrics[db.sortKey];
    assert.ok(stats.best >= stats.median && stats.median >= stats.worst,
        `expected best >= median >= worst for a descending sort, got ${JSON.stringify(stats)}`);

    // The same three values read off the sorted rows, which is what the sort cache holds.
    const all = FOLDSEEK.getTable({ db: 'bfmd', limit: 0 ? 0 : db.total, fields: ['score'] }).rows;
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

    // The page returns up to 100 regardless, handing a caller who asked for 3 a hundred rows.
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
    // eval is not comparable across databases: the denominators differ by search-space size.
    const table = new ResultTable(parseResults(fixture('foldseek-bfmd.raw.json')), { ticket: 'fs', tool: 'foldseek' });
    table.raw.mode = 'eval-forced';                        // only to reach the branch deterministically
    const summary = table.getTableSummary({ db: '*', merged: true });
    if (summary.merged.sortKey === 'eval') assert.match(summary.merged.caveat, /search-space/);
    else assert.equal(summary.merged.caveat, undefined, 'no caveat for a comparable key');
});

// -------------------------------------------------------------------------------------------
// 2B.2 — taxonomy
// -------------------------------------------------------------------------------------------

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

// -------------------------------------------------------------------------------------------
// 2B.3 — FoldDisco motif patterns
// -------------------------------------------------------------------------------------------

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

// -------------------------------------------------------------------------------------------
// 2B.4 / 2B.5 — FoldMason entry data and column extras
// -------------------------------------------------------------------------------------------

const GPU = fixture('msa-gpu-metrics.json');
const FM = {
    entries: GPU.sequences.map((aa, i) => ({
        name: `entry${i}`, aa, ss: aa, ca: '1.0,2.0,3.0,4.0,5.0,6.0',
    })),
    scores: GPU.expected.quality,
};

test('fasta keeps gaps, so every record is as long as the alignment', () => {
    const out = foldMasonFasta(FM, { limit: 2 });
    assert.equal(out.returned, 2);
    assert.equal(out.totalEntries, FM.entries.length);
    assert.equal(out.truncated, true);
    const records = out.fasta.trim().split('\n');
    assert.equal(records[0], '>entry0');
    assert.equal(records[1].length, GPU.sequences[0].length);
    assert.equal(out.bytes, Buffer.byteLength(out.fasta));
});

test('fasta can be scoped by entry list or paged', () => {
    assert.deepEqual(
        foldMasonFasta(FM, { entries: [0, 2] }).fasta.match(/>[^\n]+/g),
        ['>entry0', '>entry2'],
    );
    const paged = foldMasonFasta(FM, { offset: 13, limit: 500 });
    assert.equal(paged.returned, 2);
    assert.equal(paged.truncated, false, 'the last page is not truncated');
});

test('fasta serves the 3di alignment too', () => {
    assert.equal(foldMasonFasta(FM, { representation: '3di', limit: 1 }).alphabet, 'ss');
    assert.match(foldMasonFasta(FM, { representation: 'dna' }).error, /unknown representation/);
});

test('coordinates default to one entry and keep residue and column counts apart', () => {
    const one = foldMasonCoordinates(FM);
    assert.equal(one.returned, 1, 'coordinates must not be handed over wholesale by default');
    assert.equal(one.entries[0].residueCount, 2, 'two triplets');
    assert.equal(one.entries[0].alignedLength, GPU.sequences[0].length);
    assert.notEqual(one.entries[0].residueCount, one.entries[0].alignedLength);
    assert.equal(typeof one.entries[0].ca, 'string', 'left as triplets, not parsed');

    assert.equal(foldMasonCoordinates(FM, { entries: [0, 1, 2] }).returned, 3);
});

test('the entry roster reports lengths and which representations exist', () => {
    const roster = foldMasonEntries(FM);
    assert.equal(roster.totalEntries, FM.entries.length);
    assert.equal(roster.columns, GPU.sequences[0].length);
    const first = roster.entries[0];
    assert.equal(first.alignedLength, GPU.sequences[0].length);
    assert.equal(first.residueCount, GPU.sequences[0].replace(/-/g, '').length);
    assert.deepEqual(first.has, ['aa', 'ss', 'ca']);
});

test('minOccupancy masks sparse columns and reports how many', () => {
    const all = foldMasonColumns(FM, { metrics: ['occupancy'], limit: 0 });
    const masked = foldMasonColumns(FM, { metrics: ['occupancy'], limit: 0, minOccupancy: 0.9 });

    assert.ok(masked.returned < all.returned);
    assert.equal(masked.minOccupancy, 0.9);
    assert.equal(masked.maskedByOccupancy, all.returned - masked.returned);
    for (const row of masked.rows) assert.ok(row.occupancy >= 0.9);
});

test('includeLetters adds capped residue composition', () => {
    const plain = foldMasonColumns(FM, { metrics: ['consensus'], limit: 1 });
    assert.equal(plain.rows[0].consensus.letters, undefined);

    const withLetters = foldMasonColumns(FM, { metrics: ['consensus'], limit: 0, includeLetters: true });
    const busiest = withLetters.rows.reduce((a, b) =>
        (b.consensus.letters?.length ?? 0) > (a.consensus.letters?.length ?? 0) ? b : a);

    assert.ok(busiest.consensus.letters.length <= 5, 'capped at 5 like the page');
    assert.ok(busiest.consensus.nonGapCount > 0);
    const fractions = busiest.consensus.letters.map(l => l.logoFraction);
    for (let i = 1; i < fractions.length; i++) assert.ok(fractions[i - 1] >= fractions[i]);

    const wider = foldMasonColumns(FM, { metrics: ['consensus'], limit: 0, includeLetters: true, maxLetters: 20 });
    const same = wider.rows.find(r => r.column === busiest.column);
    assert.ok(same.consensus.letters.length >= busiest.consensus.letters.length);
});

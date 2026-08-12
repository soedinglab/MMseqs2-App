// The headless MSA column surface: metric selection, range compression, and the region finder.
//
// Built on the same GPU-captured fixture the port itself is checked against, so these exercise the
// real alignment rather than a synthetic one, and the numbers they assert are GPU numbers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { foldMasonColumns, foldMasonColumnSummary, compressRanges, COLUMN_METRICS } from '../src/msa.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GPU = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', 'msa-gpu-metrics.json'), 'utf8'));

/** A FoldMason-shaped result from the captured alignment. `scores` is per-column LDDT. */
function result({ withScores = true, withSs = false } = {}) {
    const entries = GPU.sequences.map((aa, i) => ({
        name: `entry${i}`, aa, ...(withSs ? { ss: aa } : {}),
    }));
    // Synthetic but shaped like the real thing: a high-LDDT run, a -1 (absent) stretch, then a
    // low-LDDT tail, so the region finder has something with structure to find.
    const scores = withScores
        ? GPU.expected.quality.map((_, c) => (c >= 40 && c < 60 ? 0.9 : c >= 60 && c < 65 ? -1 : 0.2))
        : undefined;
    return { entries, ...(scores ? { scores } : {}) };
}

test('compressRanges collapses runs and leaves singletons alone', () => {
    assert.deepEqual(compressRanges([1, 2, 3, 4, 5, 6, 8]), ['1-6', '8']);
    assert.deepEqual(compressRanges([]), []);
    assert.deepEqual(compressRanges([7]), ['7']);
    assert.deepEqual(compressRanges([0, 2, 4]), ['0', '2', '4']);
    assert.deepEqual(compressRanges([0, 1]), ['0-1']);
});

test('columns report the same numbers the GPU produced', () => {
    const table = foldMasonColumns(result(), { precision: null });
    assert.equal(table.totalColumns, GPU.expected.quality.length);
    assert.equal(table.returned, table.totalColumns);
    assert.equal(table.entryCount, GPU.sequences.length);

    for (const row of table.rows) {
        // Quality is f32 on the GPU and f64 here, so it agrees to ~1e-7 rather than exactly;
        // conservation is integral and must be identical.
        assert.ok(Math.abs(row.quality - GPU.expected.quality[row.column]) < 1e-5, `column ${row.column}`);
        assert.equal(row.conservation.score, GPU.expected.conservationScore[row.column]);
    }
});

test('metrics selects what a row carries', () => {
    const only = foldMasonColumns(result(), { metrics: ['lddt', 'conservation'], limit: 3 });
    assert.deepEqual(only.metrics, ['lddt', 'conservation']);
    for (const row of only.rows) {
        assert.deepEqual(Object.keys(row).sort(), ['column', 'conservation', 'lddt']);
    }

    const all = foldMasonColumns(result(), { limit: 1 });
    assert.deepEqual(all.metrics, COLUMN_METRICS, 'everything is available for this alignment');
});

test('an unknown metric is refused with the list of real ones', () => {
    const out = foldMasonColumns(result(), { metrics: ['lddt', 'bogus'] });
    assert.match(out.error, /unknown metric\(s\): bogus/);
    assert.deepEqual(out.available, COLUMN_METRICS);
});

test('columns can be scoped by explicit indices or by range', () => {
    const picked = foldMasonColumns(result(), { columns: [0, 5, 148] });
    assert.deepEqual(picked.rows.map(r => r.column), [0, 5, 148]);

    const paged = foldMasonColumns(result(), { offset: 10, limit: 4 });
    assert.deepEqual(paged.rows.map(r => r.column), [10, 11, 12, 13]);
    assert.equal(paged.offset, 10);
    assert.equal(paged.returned, 4);
});

test('missing LDDT is null rather than -1', () => {
    const table = foldMasonColumns(result(), { metrics: ['lddt'], columns: [50, 62] });
    assert.equal(table.rows[0].lddt, 0.9);
    assert.equal(table.rows[1].lddt, null, '-1 means absent, not an LDDT of -1');
});

test('a result without scores simply has no lddt', () => {
    const table = foldMasonColumns(result({ withScores: false }), { limit: 1 });
    assert.ok(!table.metrics.includes('lddt'));
    assert.equal(table.rows[0].lddt, undefined);
});

test('3di is measured on ss, and reports no conservation', () => {
    const aa = foldMasonColumns(result({ withSs: true }), { representation: '3di', limit: 1 });
    assert.equal(aa.alphabetId, '3di');
    assert.ok(aa.metrics.includes('quality'));
    assert.ok(!aa.metrics.includes('conservation'), 'the shader stubs conservation for 3Di');

    const missing = foldMasonColumns(result({ withSs: false }), { representation: '3di' });
    assert.match(missing.error, /no "ss" sequences/);
});

test('an unknown representation is refused', () => {
    const out = foldMasonColumns(result(), { representation: 'dna' });
    assert.match(out.error, /unknown representation: dna/);
    assert.deepEqual(out.available, ['aa', '3di']);
});

test('the summary ranks regions on LDDT, best first', () => {
    // An explicit cut-off isolates the synthetic high-LDDT run at 40-59. With the default median
    // (0.2 for this fixture) columns 0-59 are all above the bar and form one region instead, which
    // is correct but says nothing about ordering.
    const isolated = foldMasonColumnSummary(result(), { threshold: 0.5 });
    assert.equal(isolated.rankedOn, 'lddt');
    assert.equal(isolated.regions.length, 1);
    assert.equal(isolated.regions[0].start, 40);
    assert.equal(isolated.regions[0].end, 59);
    assert.equal(isolated.regions[0].length, 20);

    const auto = foldMasonColumnSummary(result());
    assert.ok(auto.regions.length > 0, 'the median cut-off should always yield regions');
    assert.equal(auto.threshold.quantile, 0.5);
    for (let i = 1; i < auto.regions.length; i++) {
        assert.ok(auto.regions[i - 1].lddt >= auto.regions[i].lddt,
            'regions must be ordered by the ranking metric, not by position');
    }
});

test('the summary reports notable columns as ranges, with exact counts', () => {
    const summary = foldMasonColumnSummary(result());
    const { identity, fullyConserved, unconserved } = summary.notable.conservation;

    const identityColumns = GPU.expected.conservationScore.filter(s => s === 11).length;
    assert.equal(identity.count, identityColumns);
    for (const entry of [...identity.columns, ...fullyConserved.columns, ...unconserved.columns]) {
        assert.equal(typeof entry, 'string', 'ranges are strings so callers need not branch on type');
        assert.match(entry, /^\d+(-\d+)?$/);
    }
    // Ranges are shorter than the raw list they describe, which is the point.
    assert.ok(unconserved.columns.length < unconserved.count);
});

test('stats treat absent LDDT as missing rather than as a value', () => {
    const summary = foldMasonColumnSummary(result());
    assert.equal(summary.stats.lddt.missing, 5, 'columns 60-64 are -1');
    assert.equal(summary.stats.lddt.min, 0.2, 'the -1 values must not become the minimum');
    assert.equal(summary.stats.lddt.max, 0.9);
});

test('an absolute threshold is honoured, and an unreachable one yields no regions', () => {
    const reachable = foldMasonColumnSummary(result(), { threshold: 0.5 });
    assert.equal(reachable.threshold.value, 0.5);
    assert.ok(reachable.regions.length > 0);

    const unreachable = foldMasonColumnSummary(result(), { threshold: 0.99 });
    assert.deepEqual(unreachable.regions, [], 'an honest empty answer, not a relaxed threshold');
});

test('the summary falls back to another metric when the primary is unavailable', () => {
    const summary = foldMasonColumnSummary(result({ withScores: false }));
    assert.notEqual(summary.rankedOn, 'lddt');
    assert.match(summary.rankedOnNote, /lddt is not available/);
    assert.ok(summary.regions.length >= 0);
});

test('metrics selection narrows the summary too', () => {
    const summary = foldMasonColumnSummary(result(), { metrics: ['lddt', 'conservation'] });
    assert.deepEqual(Object.keys(summary.stats).sort(), ['conservation', 'lddt']);
    assert.deepEqual(Object.keys(summary.notable), ['conservation']);
    assert.equal(summary.quality, undefined);
});

test('topColumns are the best ones, descending', () => {
    const summary = foldMasonColumnSummary(result(), { topColumns: 5 });
    assert.equal(summary.topColumns.length, 5);
    for (let i = 1; i < summary.topColumns.length; i++) {
        assert.ok(summary.topColumns[i - 1].value >= summary.topColumns[i].value);
    }
    assert.ok(summary.topColumns.every(c => c.value !== null), 'absent values are not ranked');
});

test('the consensus string spans the whole alignment', () => {
    const summary = foldMasonColumnSummary(result());
    assert.equal(summary.consensus.length, GPU.expected.quality.length);
});

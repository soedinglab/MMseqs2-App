// The headless MSA column surface: metric selection, range compression, and the column-to-residue map.
//
// Built on the same GPU-captured fixture the port itself is checked against, so these exercise the
// real alignment rather than a synthetic one, and the numbers they assert are GPU numbers.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { foldMasonColumns, foldMasonSummary, compressRanges, COLUMN_METRICS } from '../src/msa.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GPU = JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', 'msa-gpu-metrics.json'), 'utf8'));

/** A FoldMason-shaped result from the captured alignment. `scores` is per-column LDDT. */
function result({ withScores = true, withSs = false } = {}) {
    const entries = GPU.sequences.map((aa, i) => ({
        name: `entry${i}`, aa, ...(withSs ? { ss: aa } : {}),
    }));
    // Synthetic but shaped like the real thing: a high-LDDT run, a -1 (absent) stretch, then a
    // low-LDDT tail.
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

test('the summary reports size, available metrics and each metric spread', () => {
    const summary = foldMasonSummary(result());
    assert.equal(summary.entryCount, GPU.sequences.length);
    assert.equal(summary.totalColumns, GPU.expected.quality.length);
    assert.deepEqual(summary.metrics, COLUMN_METRICS);
    assert.deepEqual(Object.keys(summary.stats).sort(),
        ['conservation', 'entropy', 'informationContent', 'lddt', 'occupancy', 'quality']);
    for (const [metric, stat] of Object.entries(summary.stats)) {
        assert.ok(stat.min <= stat.mean && stat.mean <= stat.max, `${metric} spread`);
    }
});

test('summary stats treat absent LDDT as missing rather than as a value', () => {
    const stats = foldMasonSummary(result()).stats;
    assert.equal(stats.lddt.missing, 5, 'columns 60-64 are -1');
    assert.equal(stats.lddt.min, 0.2, 'the -1 values must not become the minimum');
    assert.equal(stats.lddt.max, 0.9);
});

test('the summary carries no per-column data, whatever the alignment length', () => {
    const summary = foldMasonSummary(result());
    for (const key of ['rows', 'regions', 'topColumns', 'notable', 'consensus', 'threshold']) {
        assert.equal(summary[key], undefined, `${key} would grow with the alignment`);
    }
    // Four numbers per metric and a handful of scalars: the size cannot follow the column count.
    assert.ok(JSON.stringify(summary).length < 800, 'a summary must stay small enough to always send');
});

test('a summary of an alignment without scores simply reports no lddt', () => {
    const summary = foldMasonSummary(result({ withScores: false }));
    assert.ok(!summary.metrics.includes('lddt'));
    assert.equal(summary.stats.lddt, undefined);
    assert.ok(summary.stats.quality);
});

test('an unusable representation is refused by the summary too', () => {
    assert.match(foldMasonSummary(result(), { representation: 'dna' }).error, /unknown representation/);
    assert.match(foldMasonSummary(result({ withSs: false }), { representation: '3di' }).error, /no "ss"/);
});

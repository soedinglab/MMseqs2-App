// The metric registry, and the two places it must not drift from: the frontend's sorter, and what
// the parser actually did to the value.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    METRIC_SEMANTICS, SORT_KEY_FOR_FIELD, NUMERIC_METRIC_FIELDS,
    metricSemantics, defaultRankingSemantics, numericMetric,
} from '../src/metrics.js';
import { parseResults } from '../../../frontend/lib/parseResults.js';
import {
    defaultSortOrder, rowFieldForSortKey, buildSortCache,
    FOLDSEEK_SORT_KEYS, FOLDDISCO_SORT_KEYS,
} from '../../../frontend/lib/resultSort.js';

const MODES = ['3di', '3diaa', 'tmalign', 'lolalign'];

test('every registry entry carries a label, a direction, and a cross-database verdict', () => {
    for (const [key, entry] of Object.entries(METRIC_SEMANTICS)) {
        assert.ok(entry.label?.length > 0, `${key} needs a label`);
        assert.ok(['higher', 'lower'].includes(entry.direction), `${key} direction`);
        assert.equal(typeof entry.crossDatabaseComparable, 'boolean', `${key} comparability`);
        assert.deepEqual(Object.keys(entry).sort(), ['crossDatabaseComparable', 'direction', 'label'],
            `${key} should carry nothing else`);
    }
    // parserTransform is computed from the raw mode rather than stored per key.
    assert.equal(metricSemantics({ mode: '3diaa', field: 'eval' }).parserTransform, 'toExponential(2) -> String');
});

test('only the metrics whose value depends on the database are refused across databases', () => {
    const across = field => metricSemantics({ mode: '3diaa', field }).crossDatabaseComparable;
    assert.equal(across('eval'), false, 'an E-value scales with the search space');
    assert.equal(across('score'), true);
    assert.equal(metricSemantics({ mode: 'tmalign', field: 'eval' }).crossDatabaseComparable, true,
        'a TM-score does not depend on the database it was found in');
    assert.equal(metricSemantics({ mode: 'lolalign', field: 'eval' }).crossDatabaseComparable, true);
    assert.equal(metricSemantics({ tool: 'folddisco', field: 'idfscore' }).crossDatabaseComparable, false,
        'inverse feature frequency is weighted by the index it came from');
    assert.equal(metricSemantics({ tool: 'folddisco', field: 'rmsd' }).crossDatabaseComparable, true);
});

test('SORT_KEY_FOR_FIELD is the exact inverse of rowFieldForSortKey', () => {
    for (const [field, sortKey] of Object.entries(SORT_KEY_FOR_FIELD)) {
        const tool = ['idfscore', 'rmsd', 'nodecount'].includes(field) ? 'folddisco' : 'foldseek';
        assert.equal(rowFieldForSortKey(sortKey, tool), field, `${sortKey} -> ${field}`);
    }
    for (const key of FOLDSEEK_SORT_KEYS) {
        assert.ok(Object.values(SORT_KEY_FOR_FIELD).includes(key), `foldseek sort key ${key} is covered`);
    }
    for (const key of FOLDDISCO_SORT_KEYS) {
        assert.ok(Object.values(SORT_KEY_FOR_FIELD).includes(key), `folddisco sort key ${key} is covered`);
    }
});

test('direction agrees with the sorter for every plain mode', () => {
    for (const mode of MODES) {
        for (const field of ['eval', 'score']) {
            const s = metricSemantics({ mode, field });
            assert.equal(s.known, true, `${mode}.${field} must be registered`);
            assert.equal(s.sortOrderMatchesDirection, true,
                `${mode}.${field}: direction ${s.direction} vs default sort order ${s.defaultSortOrder}`);
        }
    }
    // The sorter's own rule, restated here so a change on either side fails this test.
    assert.equal(defaultSortOrder('eval', { mode: 'tmalign' }), -1);
    assert.equal(defaultSortOrder('eval', { mode: 'lolalign' }), -1);
    assert.equal(defaultSortOrder('eval', { mode: '3diaa' }), 1);
    assert.equal(metricSemantics({ mode: 'tmalign', field: 'eval' }).direction, 'higher');
    assert.equal(metricSemantics({ mode: '3diaa', field: 'eval' }).direction, 'lower');
});

test('the sort cache reduces eval the same way the direction claims', () => {
    const alignments = { 0: [{ eval: 1, score: 1 }, { eval: 5, score: 9 }] };
    assert.equal(buildSortCache(alignments, { mode: 'tmalign' }).eval[0], 5, 'higher is better');
    assert.equal(buildSortCache(alignments, { mode: '3diaa' }).eval[0], 1, 'lower is better');
});

test('a complex- prefixed mode keeps its meaning but is flagged where the sorter disagrees', () => {
    const complexTm = metricSemantics({ mode: 'complex-tmalign', field: 'eval' });
    assert.equal(complexTm.key, 'tmalign.eval');
    assert.equal(complexTm.direction, 'higher', 'it is still a TM-score');
    assert.equal(complexTm.defaultSortOrder, 1, 'but resultSort tests the raw mode string');
    assert.equal(complexTm.sortOrderMatchesDirection, false);
    assert.match(complexTm.note, /raw mode string/);
    assert.equal(complexTm.parserTransform, 'toExponential(2) -> String',
        'the parser takes the E-value branch for a complex- prefixed mode');

    const complex3di = metricSemantics({ mode: 'complex-3diaa', field: 'eval' });
    assert.equal(complex3di.sortOrderMatchesDirection, true);
    assert.equal(complex3di.note, undefined);
});

test('lolalign eval documents the parser chain rather than inverting it', () => {
    const s = metricSemantics({ mode: 'lolalign', field: 'eval' });
    assert.match(s.parserTransform, /x100/);
    assert.equal(s.label, 'LOL-score', "the page calls it that, so it is not mistaken for an E-value");
    assert.equal(s.crossDatabaseComparable, true);

    // What the parser really produces, so the documented chain is measured and not assumed.
    const parsed = parseResults({
        mode: 'lolalign',
        results: [{ db: 'pdb100', alignments: [[{ target: 'X', eval: 0.8765, prob: 0.5, score: 10 }]] }],
    });
    const value = parsed.results[0].alignments['0'][0].eval;
    assert.equal(typeof value, 'string');
    // The x100 happens after toExponential(2) has already stringified the value, so 0.8765 comes
    // back as 87.6 and not 87.65: three significant digits survive, and the fourth is gone before
    // the scaling. A consumer cannot recover it, which is why the transform is documented.
    assert.equal(value, '87.6');
    assert.notEqual(value, Number((0.8765 * 100).toFixed(2)).toString());
    assert.equal(numericMetric({ eval: value }, 'eval'), 87.6);
});

test('tmalign eval is fixed-point, 3diaa eval is exponential', () => {
    const tm = parseResults({
        mode: 'tmalign',
        results: [{ db: 'pdb100', alignments: [[{ target: 'X', eval: 0.87654, prob: 0.5, score: 10 }]] }],
    });
    assert.equal(tm.results[0].alignments['0'][0].eval, '0.877');
    assert.equal(metricSemantics({ mode: 'tmalign', field: 'eval' }).parserTransform, 'toFixed(3) -> String');

    const aa = parseResults({
        mode: '3diaa',
        results: [{ db: 'pdb100', alignments: [[{ target: 'X', eval: 0.0000123, prob: 0.5, score: 10 }]] }],
    });
    assert.equal(aa.results[0].alignments['0'][0].eval, '1.23e-5');
});

test('folddisco metrics keep their own direction and labels', () => {
    const idf = metricSemantics({ tool: 'folddisco', field: 'idfscore' });
    assert.equal(idf.direction, 'higher');
    assert.equal(idf.label, 'IDF-score');
    assert.equal(idf.parserTransform, 'toFixed(3) -> String');

    const rmsd = metricSemantics({ tool: 'folddisco', field: 'rmsd' });
    assert.equal(rmsd.direction, 'lower');
    assert.equal(rmsd.label, 'RMSD');
    assert.equal(rmsd.defaultSortOrder, 1);
    assert.equal(rmsd.sortOrderMatchesDirection, true);
});

test('an unregistered field says so instead of inventing semantics', () => {
    const s = metricSemantics({ mode: '3diaa', field: 'bogus' });
    assert.equal(s.known, false);
    assert.equal(s.key, 'shared.bogus');
    assert.equal(s.label, 'bogus');
    assert.equal(s.crossDatabaseComparable, null);
    assert.equal(s.sortOrderMatchesDirection, null);
});

test('default ranking mirrors what the result table would choose', () => {
    assert.deepEqual(
        (({ sortKey, sortOrder, field }) => ({ sortKey, sortOrder, field }))(
            defaultRankingSemantics({ mode: '3diaa' })),
        { sortKey: 'score', sortOrder: -1, field: 'score' });
    assert.deepEqual(
        (({ sortKey, field }) => ({ sortKey, field }))(
            defaultRankingSemantics({ mode: 'complex-3diaa', isComplex: true })),
        { sortKey: 'qtm', field: 'complexqtm' });
    assert.deepEqual(
        (({ sortKey, field }) => ({ sortKey, field }))(
            defaultRankingSemantics({ tool: 'folddisco' })),
        { sortKey: 'idf', field: 'idfscore' });
    assert.equal(defaultRankingSemantics({ tool: 'folddisco' }).semantics.known, true);
});

test('numericMetric recovers numbers from display strings and refuses junk', () => {
    assert.equal(numericMetric({ eval: '1.23e-05' }, 'eval'), 0.0000123);
    assert.equal(numericMetric({ prob: '0.99' }, 'prob'), 0.99);
    assert.equal(numericMetric({ idfscore: '12.340' }, 'idfscore'), 12.34);
    assert.equal(numericMetric({ score: 512 }, 'score'), 512);
    assert.equal(numericMetric({ eval: 0 }, 'eval'), 0, 'zero is a value, not absence');
    for (const junk of [null, undefined, '', 'n/a', NaN, Infinity, {}]) {
        assert.equal(numericMetric({ x: junk }, 'x'), null, String(junk));
    }
    assert.equal(numericMetric(undefined, 'eval'), null);
    assert.ok(NUMERIC_METRIC_FIELDS.includes('eval') && NUMERIC_METRIC_FIELDS.includes('rmsd'));
});

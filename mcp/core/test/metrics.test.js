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

const MODES = ['3diaa', '3diaa', 'tmalign', 'lolalign'];

test('every registry entry carries a label, a direction, and a cross-database verdict', () => {
    for (const [key, entry] of Object.entries(METRIC_SEMANTICS)) {
        assert.ok(entry.label?.length > 0, `${key} needs a label`);
        assert.ok(['higher', 'lower'].includes(entry.direction), `${key} direction`);
        assert.equal(typeof entry.crossDatabaseComparable, 'boolean', `${key} comparability`);
        assert.deepEqual(Object.keys(entry).sort(), ['crossDatabaseComparable', 'direction', 'label'],
            `${key} should carry nothing else`);
    }
});

test('the returned semantics are facts only — no parser prose, no echoed inputs', () => {
    const s = metricSemantics({ mode: 'lolalign', field: 'eval' });
    assert.deepEqual(Object.keys(s).sort(),
        ['crossDatabaseComparable', 'direction', 'known', 'label']);
    for (const echoed of ['field', 'mode', 'tool', 'key', 'parserTransform']) {
        assert.equal(s[echoed], undefined, `${echoed} is something the caller already has`);
    }
});

test('the default ranking is flat, and repeats nothing', () => {
    const r = defaultRankingSemantics({ mode: '3diaa' });
    assert.deepEqual(r, {
        field: 'score', label: 'Score', direction: 'higher', crossDatabaseComparable: true,
    });
    assert.equal(r.semantics, undefined, 'the facts are the ranking, not a nested object');
    assert.equal(r.known, undefined, 'a default ranking key is registered by construction');
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

test('direction agrees with the sorter for every mode and metric', () => {
    const cases = [
        ...MODES.flatMap(mode => ['eval', 'score', 'prob', 'seqId'].map(field => ({ mode, field }))),
        ...MODES.map(mode => ({ mode, field: 'complexqtm' })),
        ...MODES.map(mode => ({ mode, field: 'complexttm' })),
        ...['idfscore', 'rmsd', 'nodecount'].map(field => ({ tool: 'folddisco', field })),
    ];
    // The invariant lives here rather than as a field in every payload: "better" must be the way the
    // table already sorts, or one of the two is wrong.
    for (const { tool = 'foldseek', mode = '', field } of cases) {
        const s = metricSemantics({ tool, mode, field });
        assert.equal(s.known, true, `${mode || tool}.${field} must be registered`);
        const sortKey = SORT_KEY_FOR_FIELD[field];
        const order = defaultSortOrder(sortKey, { mode: mode.replace(/^complex-/, '') });
        assert.equal(order, s.direction === 'higher' ? -1 : 1,
            `${mode || tool}.${field}: ${s.direction} is better but the table sorts ${order}`);
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

test('the submission spelling of a complex mode resolves to the mode the result will carry', () => {
    // backend/server.go:388-389 strips "complex-" before building the job, and the result handler
    // returns job.Mode — so a complex tmalign search comes back as plain "tmalign".
    for (const mode of MODES) {
        const submitted = metricSemantics({ mode: `complex-${mode}`, field: 'eval' });
        const returned = metricSemantics({ mode, field: 'eval' });
        assert.deepEqual(submitted, returned, `complex-${mode} must resolve to ${mode}`);
    }
});

test('lolalign eval is scaled and rounded by the parser, and the coercion recovers it', () => {
    const s = metricSemantics({ mode: 'lolalign', field: 'eval' });
    assert.equal(s.label, 'LOL-score', 'the page calls it that, so it is not mistaken for an E-value');
    assert.equal(s.crossDatabaseComparable, true);

    // Measured, not described: this is the only place the scaling is pinned down.
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

    const aa = parseResults({
        mode: '3diaa',
        results: [{ db: 'pdb100', alignments: [[{ target: 'X', eval: 0.0000123, prob: 0.5, score: 10 }]] }],
    });
    assert.equal(aa.results[0].alignments['0'][0].eval, '1.23e-5');

    // A result never carries a "complex-" prefix, so the parser is never asked to. If one ever did,
    // this is what would happen — the exact-match test fails and a TM-score is formatted as an E-value.
    const hypothetical = parseResults({
        mode: 'complex-tmalign',
        results: [{ db: 'pdb100', alignments: [[{ target: 'X', eval: 0.87654, prob: 0.5, score: 10 }]] }],
    });
    assert.equal(hypothetical.results[0].alignments['0'][0].eval, '8.77e-1');
});

test('folddisco metrics keep their own direction and labels', () => {
    const idf = metricSemantics({ tool: 'folddisco', field: 'idfscore' });
    assert.equal(idf.direction, 'higher');
    assert.equal(idf.label, 'IDF-score');

    const rmsd = metricSemantics({ tool: 'folddisco', field: 'rmsd' });
    assert.equal(rmsd.direction, 'lower');
    assert.equal(rmsd.label, 'RMSD');
    assert.equal(defaultSortOrder('rmsd', {}), 1, 'lower is better, so the table sorts ascending');
});

test('an unregistered field says so instead of inventing semantics', () => {
    const s = metricSemantics({ mode: '3diaa', field: 'bogus' });
    assert.equal(s.known, false);
    assert.equal(s.label, 'bogus');
    assert.equal(s.crossDatabaseComparable, null);
});

test('default ranking names the field the server actually sorted on', () => {
    const pick = r => r.field;
    assert.equal(pick(defaultRankingSemantics({ mode: '3diaa' })), 'score');
    assert.equal(pick(defaultRankingSemantics({ mode: 'complex-3diaa', isComplex: true })), 'complexqtm');
    assert.equal(pick(defaultRankingSemantics({ tool: 'folddisco' })), 'idfscore');
    assert.equal(defaultRankingSemantics({ tool: 'folddisco' }).label, 'IDF-score');

    // tmalign and lolalign put a TM/LoL score in `eval` and the server orders by it. The frontend's
    // table defaults to `score` whatever the mode; a manifest that copied that described a sort the
    // exported file does not have.
    for (const [mode, label] of [['tmalign', 'TM-score'], ['lolalign', 'LOL-score']]) {
        const r = defaultRankingSemantics({ mode });
        assert.equal(r.field, 'eval', mode);
        assert.equal(r.label, label, mode);
        assert.equal(r.direction, 'higher', mode);
    }
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

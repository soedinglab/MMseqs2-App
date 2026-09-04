// The quality/conservation port, checked three ways:
//   1. against the shader source itself, so the one transcribed table cannot silently drift
//   2. against hand-computed columns, where the expected number is derived from the definition
//      rather than from this implementation
//   3. against the shader's edge cases, which is where a port is most likely to be subtly wrong

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

import { aminoAcidAlphabet, threeDIAlphabet } from 'msa-webgpu';
import {
    computeMetricsCpu, columnQuality, columnConservation,
    AMAS_PROP, AMAS_PROPERTY_BITS, AMAS_PROPERTY_MASK_ALL,
    AMAS_IDENTITY_BIT, AMAS_ALL_PROPERTIES_BIT, AMAS_NEGATIVE_SHIFT,
} from '../../../frontend/lib/msaTracks.js';

// The bundle carries the WGSL as plain strings. Its `exports` map blocks a deep path, so follow the
// package's own declared entry rather than hardcoding one.
const require = createRequire(import.meta.url);
const PKG_JSON = require.resolve('msa-webgpu/package.json');
const PKG = JSON.parse(fs.readFileSync(PKG_JSON, 'utf8'));
const SHADER_SOURCE = fs.readFileSync(
    path.join(path.dirname(PKG_JSON), PKG.exports?.['.']?.import ?? PKG.main),
    'utf8',
);

const AA = aminoAcidAlphabet;
const MATRIX = { qualityMatrix: AA.qualityMatrix, qualityMatrixSize: AA.metricConfig.qualityMatrixSize };
const IDX = Object.fromEntries(AA.symbols.slice(0, 20).map((s, i) => [s, i]));

/** Column counts from a list of residues, in the alphabet's bucket order. */
function counts(...residues) {
    const out = new Array(20).fill(0);
    for (const r of residues) out[IDX[r]]++;
    return out;
}

// -------------------------------------------------------------------------------------------
// 1. The transcribed table must match the shader it came from
// -------------------------------------------------------------------------------------------

test('the AMAS property table still matches msa-webgpu\'s shader', () => {
    // Re-parse `amas_property_bits`'s switch out of the installed package. If the library ever
    // changes a residue's properties, this fails instead of the port quietly disagreeing with the
    // GPU it is supposed to mirror.
    const fn = SHADER_SOURCE.slice(SHADER_SOURCE.indexOf('fn amas_property_bits'));
    const body = fn.slice(0, fn.indexOf('default:'));
    const cases = [...body.matchAll(/case (\d+)u: \{ return ([^;]+); \}/g)];

    assert.equal(cases.length, 20, 'expected 20 amino acids in the shader table');

    for (const [, indexText, expression] of cases) {
        const index = Number(indexText);
        const expected = expression
            .split('|')
            .map(part => part.trim().replace('AMAS_PROP_', ''))
            .reduce((bits, name) => {
                assert.ok(name in AMAS_PROP, `shader names a property this port does not have: ${name}`);
                return bits | AMAS_PROP[name];
            }, 0);
        assert.equal(AMAS_PROPERTY_BITS[index], expected,
            `properties for bucket ${index} (${AA.symbols[index]}) disagree with the shader`);
    }
});

test('the derived AMAS constants still match the shader', () => {
    assert.match(SHADER_SOURCE, /const AMAS_NEGATIVE_SHIFT: u32 = 10u;/);
    assert.equal(AMAS_NEGATIVE_SHIFT, 10);
    assert.match(SHADER_SOURCE, /const AMAS_IDENTITY_BIT: u32 = 1u << 20u;/);
    assert.equal(AMAS_IDENTITY_BIT, 1 << 20);
    assert.match(SHADER_SOURCE, /const AMAS_ALL_PROPERTIES_BIT: u32 = 1u << 21u;/);
    assert.equal(AMAS_ALL_PROPERTIES_BIT, 1 << 21);
    assert.equal(AMAS_PROPERTY_MASK_ALL, (1 << 10) - 1, 'ten properties, bits 0-9');
});

test('the thresholds the port hardcodes are the shader\'s own', () => {
    // 25% gaps disqualifies a column; residues in <=3% of rows are ignored.
    assert.match(SHADER_SOURCE, /gap_count \* 100u >= 25u \* uniforms\.msa_height/);
    assert.match(SHADER_SOURCE, /residue_threshold = \(uniforms\.msa_height \* 3u\) \/ 100u/);
    // Quality normalises by the better of the two self-scores, not by either one.
    assert.match(SHADER_SOURCE, /let denom = max\(self_i, self_j\);/);
});

test('the substitution matrix is the library\'s, not a copy', () => {
    // BLOSUM62's first row, as published, in ARNDCQEGHILKMFPSTWYV order.
    assert.deepEqual(
        Array.from(AA.qualityMatrix.slice(0, 20)),
        [4, -1, -2, -2, 0, -1, -1, 0, -2, -1, -1, -1, -1, -2, -1, 1, 0, -3, -2, 0],
    );
    assert.equal(AA.symbols.slice(0, 20).join(''), 'ARNDCQEGHILKMFPSTWYV');
});

// -------------------------------------------------------------------------------------------
// 2. Quality, against numbers derived from the definition
// -------------------------------------------------------------------------------------------

test('a fully conserved column scores its occupancy', () => {
    // Every pair is (A,A): ratio = 4/4 = 1, so quality = 1 * occupancy.
    assert.equal(columnQuality(counts('A', 'A', 'A', 'A'), { ...MATRIX, rows: 4 }), 1);
    assert.equal(columnQuality(counts('A', 'A'), { ...MATRIX, rows: 4 }), 0.5);
});

test('a mixed column scores the matrix ratio, weighted by pair counts', () => {
    // Two A and one W over three rows, occupancy 1. The loop is over ordered pairs of *types*,
    // each weighted by count_i * count_j:
    //   (A,A) 2*2 = 4 pairs, score 4 / max(4,4)      -> ratio  1
    //   (A,W) 2*1 = 2 pairs and (W,A) 1*2 = 2 pairs, score -3 / max(4,11) -> ratio -3/11
    //   (W,W) 1*1 = 1 pair,  score 11 / max(11,11)   -> ratio  1
    // so 9 pairs total and (4 - 12/11 + 1) / 9 = 43/99.
    const expected = ((4 * 1) + (4 * (-3 / 11)) + (1 * 1)) / 9;
    assert.ok(Math.abs(expected - 43 / 99) < 1e-12, 'the worked figure should be 43/99');

    const actual = columnQuality(counts('A', 'A', 'W'), { ...MATRIX, rows: 3 });
    assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} !== ${expected}`);
});

test('quality is zero for a column with fewer than two residues', () => {
    assert.equal(columnQuality(counts('A'), { ...MATRIX, rows: 4 }), 0);
    assert.equal(columnQuality(new Array(20).fill(0), { ...MATRIX, rows: 4 }), 0);
});

test('quality never goes negative', () => {
    // Cysteine against tryptophan is a poor pair; the shader clamps at zero.
    const q = columnQuality(counts('C', 'W', 'C', 'W'), { ...MATRIX, rows: 4 });
    assert.ok(q >= 0, `expected clamped, got ${q}`);
});

test('quality works for the 3Di alphabet too', () => {
    const di = threeDIAlphabet;
    const diCounts = new Array(20).fill(0);
    diCounts[0] = 3;
    const q = columnQuality(diCounts, {
        qualityMatrix: di.qualityMatrix,
        qualityMatrixSize: di.metricConfig.qualityMatrixSize,
        rows: 3,
    });
    assert.equal(q, 1, 'a fully conserved 3Di column at full occupancy');
});

// -------------------------------------------------------------------------------------------
// 3. Conservation, against the AMAS definition
// -------------------------------------------------------------------------------------------

test('a single residue type is identity, scored above the property maximum', () => {
    const { score, mask } = columnConservation(counts('A', 'A', 'A', 'A'), { rows: 4, gapCount: 0 });
    assert.equal(score, 11);
    assert.ok(mask & AMAS_IDENTITY_BIT);
});

test('residues sharing every property set the all-properties bit', () => {
    // I and L are both hydrophobic and aliphatic, and share the absence of the other eight.
    const { score, mask } = columnConservation(counts('I', 'L', 'I', 'L'), { rows: 4, gapCount: 0 });
    assert.equal(score, 10, 'two shared plus eight jointly absent');
    assert.ok(mask & AMAS_ALL_PROPERTIES_BIT);
    assert.ok(!(mask & AMAS_IDENTITY_BIT), 'two residue types is not identity');
});

test('conservation counts shared properties and shared absences', () => {
    const { score } = columnConservation(counts('A', 'S'), { rows: 2, gapCount: 0 });
    const shared = AMAS_PROPERTY_BITS[IDX.A] & AMAS_PROPERTY_BITS[IDX.S];
    const absent = ~AMAS_PROPERTY_BITS[IDX.A] & ~AMAS_PROPERTY_BITS[IDX.S] & AMAS_PROPERTY_MASK_ALL;
    const expected = popcountRef(shared) + popcountRef(absent);
    assert.equal(score, expected);
});

test('a column that is a quarter gaps is not conserved', () => {
    assert.deepEqual(columnConservation(counts('A', 'A', 'A'), { rows: 4, gapCount: 1 }), { score: 0, mask: 0 });
    // Just under the threshold, the same column does score.
    assert.equal(columnConservation(counts('A', 'A', 'A', 'A'), { rows: 5, gapCount: 1 }).score, 11);
});

test('rare residues are ignored once the alignment is large enough', () => {
    // 100 rows: the 3% threshold is 3, so a residue seen 3 times or fewer does not break identity.
    const c = counts(...Array(97).fill('A'), 'W', 'W', 'W');
    const { score, mask } = columnConservation(c, { rows: 100, gapCount: 0 });
    assert.equal(score, 10, 'the three W are below the threshold, leaving only A to constrain');
    assert.ok(!(mask & AMAS_IDENTITY_BIT), 'W was still observed, so this is not identity');

    // In a 4-row alignment the threshold is 0 and the same minority residue counts.
    const small = counts('A', 'A', 'A', 'W');
    assert.ok(columnConservation(small, { rows: 4, gapCount: 0 }).score < 10);
});

test('an empty column is not conserved', () => {
    assert.deepEqual(columnConservation(new Array(20).fill(0), { rows: 4, gapCount: 4 }), { score: 0, mask: 0 });
    assert.deepEqual(columnConservation(counts('A'), { rows: 0, gapCount: 0 }), { score: 0, mask: 0 });
});

// -------------------------------------------------------------------------------------------
// 4. Wiring into the fallback
// -------------------------------------------------------------------------------------------

const MSA = ['AAAW', 'AAIW', 'AA-W'];

test('the fallback still reports null without an alphabet, as the page does', () => {
    const m = computeMetricsCpu(MSA);
    assert.equal(m.quality, null);
    assert.equal(m.conservationScore, null);
    assert.equal(m.conservationMask, null);
    assert.ok(m.occupancy.length === 4, 'the metrics that never needed a matrix still work');
});

test('passing an alphabet fills in quality and conservation', () => {
    const m = computeMetricsCpu(MSA, { alphabet: AA });
    assert.equal(m.quality.length, 4);
    assert.equal(m.conservationScore.length, 4);
    assert.equal(m.conservationMask.length, 4);

    // Column 0 is AAA: identity, full occupancy, perfect quality.
    assert.equal(m.quality[0], 1);
    assert.equal(m.conservationScore[0], 11);
    // Column 2 is A/I/gap: a third gaps, so conservation is disqualified but quality is not.
    assert.equal(m.conservationScore[2], 0);
    assert.ok(m.quality[2] > 0 && m.quality[2] < 1);
});

test('3Di gets quality but not conservation, matching the shader stub', () => {
    const m = computeMetricsCpu(['ACD', 'ACD'], { symbols: threeDIAlphabet.symbols.slice(0, 20), alphabet: threeDIAlphabet });
    assert.ok(Array.isArray(m.quality));
    assert.equal(m.conservationScore, null, 'the shader stubs conservation to zero for 3Di');
});

test('quality agrees whether computed per column or through the fallback', () => {
    const m = computeMetricsCpu(MSA, { alphabet: AA });
    for (let c = 0; c < 4; c++) {
        assert.equal(m.quality[c], columnQuality(m.counts[c], { ...MATRIX, rows: MSA.length }));
    }
});

function popcountRef(n) {
    let count = 0;
    for (let i = 0; i < 32; i++) if (n & (1 << i)) count++;
    return count;
}
// The fixture preserves WGSL output so the CPU implementation can be checked without WebGPU.
test('the port reproduces real GPU output column for column', () => {
    const fixture = JSON.parse(fs.readFileSync(
        path.join(path.dirname(new URL(import.meta.url).pathname), 'fixtures', 'msa-gpu-metrics.json'), 'utf8'));

    assert.equal(fixture.capturedFrom.source, 'viewer', 'the fixture must be shader output');
    const cpu = computeMetricsCpu(fixture.sequences, { symbols: AA.symbols.slice(0, 20), alphabet: AA });

    // Integers, so these must agree exactly — including the bit-packed mask, which only matches if
    // the property table, the negative shift and both special-case bits are all right.
    assert.deepEqual(cpu.conservationScore, fixture.expected.conservationScore);
    assert.deepEqual(cpu.conservationMask, fixture.expected.conservationMask);

    // Quality is a float the GPU computes at f32 and this computes at f64, so it agrees to about
    // 1e-7 rather than exactly.
    assert.equal(cpu.quality.length, fixture.expected.quality.length);
    let maxDiff = 0;
    for (let c = 0; c < cpu.quality.length; c++) {
        maxDiff = Math.max(maxDiff, Math.abs(cpu.quality[c] - fixture.expected.quality[c]));
    }
    assert.ok(maxDiff < 1e-5, `quality drifted from GPU output by ${maxDiff.toExponential(3)}`);
});

test('the GPU fixture exercises the interesting branches, not just zeros', () => {
    const fixture = JSON.parse(fs.readFileSync(
        path.join(path.dirname(new URL(import.meta.url).pathname), 'fixtures', 'msa-gpu-metrics.json'), 'utf8'));
    const scores = new Set(fixture.expected.conservationScore);

    // A fixture of all zeros would pass the comparison above while testing nothing.
    assert.ok(scores.has(11), 'should include identity columns');
    assert.ok(scores.has(10), 'should include all-properties columns');
    assert.ok(scores.has(0), 'should include disqualified columns');
    assert.ok(scores.size >= 8, `expected a spread of scores, got ${[...scores].sort((a, b) => a - b).join(',')}`);
    assert.ok(fixture.expected.quality.some(q => q > 0 && q < 1), 'should include partially conserved columns');
});

// -------------------------------------------------------------------------------------------------
// Bucket order — which symbol each count belongs to
// -------------------------------------------------------------------------------------------------

test('the amino-acid bucket order is the alphabet\'s, and is not alphabetical', () => {
    // AMAS_PROPERTY_BITS and the substitution matrix are both indexed by bucket number, so the symbol
    // list that produces those counts has to be this one. Pinned because the two orders look
    // interchangeable at a glance and are not: the alphabetical list is the *3Di* core order, which
    // is how it came to be labelled as the shader's.
    assert.equal(AA.symbols.slice(0, 20).join(''), 'ARNDCQEGHILKMFPSTWYV');
    assert.equal(threeDIAlphabet.symbols.slice(0, 20).join(''), 'ACDEFGHIKLMNPQRSTVWY');
    assert.notEqual(AA.symbols.slice(0, 20).join(''), threeDIAlphabet.symbols.slice(0, 20).join(''));
});

test('an alphabet alone is enough — the symbols come from it', () => {
    const seqs = ['WWWW', 'YYYY', 'AAAA'];
    const derived = computeMetricsCpu(seqs, { alphabet: aminoAcidAlphabet });

    assert.equal(derived.symbols.join(''), 'ARNDCQEGHILKMFPSTWYV');
    // W and Y share hydrophobic, polar and aromatic; A shares only hydrophobic with them. All three
    // lack proline, aliphatic, positive, negative and charged — 1 shared plus 5 shared absences.
    assert.deepEqual(derived.conservationScore, [6, 6, 6, 6]);

    const explicit = computeMetricsCpu(seqs, {
        alphabet: aminoAcidAlphabet, symbols: aminoAcidAlphabet.symbols.slice(0, 20),
    });
    assert.deepEqual(derived.quality, explicit.quality);
    assert.deepEqual(derived.conservationScore, explicit.conservationScore);
});

test('a symbol list that disagrees with the alphabet loses to the alphabet', () => {
    // The failure this prevents is silent rather than loud: bucketing alphabetically while indexing
    // the matrix and the property table in the alphabet's order yields confident wrong numbers.
    const seqs = ['WWWW', 'YYYY', 'AAAA'];
    const alphabetical = ['A', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'K', 'L',
        'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'V', 'W', 'Y'];

    const mismatched = computeMetricsCpu(seqs, { alphabet: aminoAcidAlphabet, symbols: alphabetical });
    assert.equal(mismatched.symbols.join(''), 'ARNDCQEGHILKMFPSTWYV');
    assert.deepEqual(mismatched.conservationScore, [6, 6, 6, 6]);
});

test('without an alphabet the symbols are the caller\'s, and the matrix metrics stay null', () => {
    // The page's own fallback path: counts, consensus and entropy are self-consistent under any
    // bucket order, and the two metrics that are not are simply not computed.
    const m = computeMetricsCpu(['AC', 'AC'], { symbols: ['A', 'C'] });
    assert.deepEqual(m.symbols, ['A', 'C']);
    assert.equal(m.quality, null);
    assert.equal(m.conservationScore, null);
    assert.deepEqual(m.occupancy, [1, 1]);
});

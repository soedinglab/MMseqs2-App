// The fact helpers the summary and the artifact are both built from.
//
// Real fixtures where they exist; small synthesized results for the modes and groupings no captured
// fixture covers yet (complex search, malformed taxonomy depth).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    normalizeEntry, resultCounts, resultRowCap, completenessOf, databaseProvenance,
    taxonomyExport, serializeRow, motifPatternExport, isComplexResult,
    msaResidueMap, MsaColumnSelection,
} from '../src/index.js';
import { parseResults, parseResultsFoldDisco } from '../../../frontend/lib/parseResults.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const load = name => JSON.parse(fs.readFileSync(path.join(HERE, 'fixtures', name), 'utf8'));

const FOLDSEEK = parseResults(load('foldseek-bfmd.raw.json'));
const FOLDDISCO = parseResultsFoldDisco(load('folddisco-pdb.raw.json'));

const BFMD = FOLDSEEK.results.findIndex(r => r.db === 'bfmd');
const PDB_FD = FOLDDISCO.results.findIndex(r => r.db === 'pdb_folddisco');

/** A complex search: three delivered alignments the parser groups into two rows by complexid. */
function complexResult() {
    const chain = (target, complexid, extra = {}) => ({
        target, complexid, query: 'q', eval: 1e-4, prob: 0.9, score: 100, seqId: 0.5,
        complexqtm: 0.8, complexttm: 0.7, qLen: 10, dbLen: 10, ...extra,
    });
    return parseResults({
        type: 'complexsearch',
        mode: 'complex-3diaa',
        queries: [{ header: 'q', sequence: 'AAAA' }],
        results: [{
            db: 'pdb100',
            alignments: [[chain('1abc_A', 7), chain('1abc_B', 7), chain('2xyz_A', 9)]],
        }],
    });
}

// 2.3.1
test('entry normalization accepts an index, refuses nonsense, and collapses single-unit jobs', () => {
    assert.deepEqual(normalizeEntry('structuresearch', 0), { entry: 0, normalized: false });
    assert.deepEqual(normalizeEntry('structuresearch', 3), { entry: 3, normalized: false });
    assert.deepEqual(normalizeEntry('complexsearch', undefined), { entry: 0, normalized: false });

    assert.deepEqual(normalizeEntry('folddisco', 2), { entry: 0, normalized: true });
    assert.deepEqual(normalizeEntry('foldmasoneasymsa', 2), { entry: 0, normalized: true });
    assert.deepEqual(normalizeEntry('foldmasoneasymsa', 0), { entry: 0, normalized: false });

    for (const bad of [-1, 1.5, 2 ** 53, 'x', '2', NaN, Infinity, null === 0 ? 0 : {}]) {
        assert.throws(() => normalizeEntry('structuresearch', bad), e => e.code === 'INVALID_ENTRY',
            `${JSON.stringify(bad)} should be refused`);
    }
    // A single-unit job validates before it normalizes, so a typo is not silently swallowed.
    assert.throws(() => normalizeEntry('folddisco', -1), e => e.code === 'INVALID_ENTRY');
});

// 2.3.2
test('a monomer search has one delivered alignment per row', () => {
    const counts = resultCounts(FOLDSEEK, { tool: 'foldseek' });
    assert.equal(counts.grouping, 'none');
    assert.equal(counts.databases.length, 9);

    const bfmd = counts.databases[BFMD];
    assert.equal(bfmd.db, 'bfmd');
    assert.equal(bfmd.parsedRows, 150);
    assert.equal(bfmd.serverAlignments, 150);
    assert.equal(counts.parsedRows, 150, 'the other eight databases returned nothing');
    assert.equal(counts.serverAlignments, counts.parsedRows);
});

// 2.3.3
test('a complex search groups chains, so delivered alignments outnumber rows', () => {
    const parsed = complexResult();
    assert.equal(isComplexResult(parsed), true);

    const counts = resultCounts(parsed, { tool: 'foldseek' });
    assert.equal(counts.grouping, 'complexid');
    assert.equal(counts.serverAlignments, 3);
    assert.equal(counts.parsedRows, 2);
    assert.ok(counts.serverAlignments > counts.parsedRows);
});

test('folddisco rows are ungrouped and counted one for one', () => {
    const counts = resultCounts(FOLDDISCO, { tool: 'folddisco' });
    assert.equal(counts.grouping, 'none');
    assert.equal(counts.databases[PDB_FD].parsedRows, 1000);
    assert.equal(counts.databases[PDB_FD].serverAlignments, 1000);
});

// 2.3.4
test('row caps carry their provenance, because the two families prove different things', () => {
    assert.deepEqual(resultRowCap({ jobType: 'folddisco' }), { rowCap: 1000, capSource: 'worker-fixed' });
    assert.deepEqual(resultRowCap({ jobType: 'structuresearch' }),
        { rowCap: 1000, capSource: 'deployment-default' });
    assert.deepEqual(resultRowCap({ jobType: 'complexsearch' }),
        { rowCap: 1000, capSource: 'deployment-default' });
    assert.deepEqual(resultRowCap({ jobType: 'foldmasoneasymsa' }),
        { rowCap: null, capSource: 'not-applicable' });
    assert.deepEqual(resultRowCap({ jobType: 'structuresearch', configuredCap: 100 }),
        { rowCap: 100, capSource: 'configured' });
    assert.deepEqual(resultRowCap({ jobType: 'folddisco', configuredCap: 100 }),
        { rowCap: 1000, capSource: 'worker-fixed' }, 'a fixed worker cap is not configurable away');
    for (const bad of [0, -5, 1.5, 'many']) {
        assert.throws(() => resultRowCap({ jobType: 'structuresearch', configuredCap: bad }),
            e => e.code === 'INVALID_CONFIG');
    }
});

test('completeness is tri-state: a cap proves truncation, staying under one proves nothing', () => {
    assert.deepEqual(
        completenessOf({ jobType: 'folddisco', parsedRows: 1000 }),
        { complete: false, saturated: true, capSource: 'worker-fixed', rowCap: 1000 });
    assert.deepEqual(
        completenessOf({ jobType: 'structuresearch', parsedRows: 150 }),
        { complete: null, saturated: false, capSource: 'deployment-default', rowCap: 1000 });
    assert.deepEqual(
        completenessOf({ jobType: 'foldmasoneasymsa', parsedRows: 15 }),
        { complete: true, saturated: false, capSource: 'not-applicable', rowCap: null });
    assert.deepEqual(
        completenessOf({ jobType: 'structuresearch', parsedRows: 150, configuredCap: 100 }),
        { complete: false, saturated: true, capSource: 'configured', rowCap: 100 });
    assert.equal(completenessOf({ jobType: 'structuresearch', parsedRows: 999 }).complete, null,
        'one row short of the cap still proves nothing');
});

test('database provenance names the catalog when it is reachable and says so when it is not', () => {
    const catalog = [{ path: 'bfmd', name: 'BFMD', version: '1.0', status: 'COMPLETE', taxonomy: true }];
    const withCatalog = databaseProvenance(FOLDSEEK, catalog);
    assert.equal(withCatalog.catalogAvailable, true);
    assert.deepEqual(withCatalog.databases[BFMD], {
        dbIndex: BFMD, id: 'bfmd', safeName: `db-${BFMD}`, display: 'BFMD', version: '1.0',
        status: 'COMPLETE', taxonomy: true, hasTaxonomy: true, hasDescription: false,
    });

    const without = databaseProvenance(FOLDSEEK, null);
    assert.equal(without.catalogAvailable, false);
    assert.equal(without.databases[BFMD].version, null);
    assert.equal(without.databases[BFMD].display, null);
    assert.equal(without.databases[BFMD].hasTaxonomy, true, 'the parsed result still knows this much');
    for (const db of without.databases) {
        assert.match(db.safeName, /^db-\d+$/, 'no database id ever reaches a filename');
    }
});

// 2.3.5
test('taxonomy export keeps every node and derives a usable parent link', () => {
    const report = FOLDSEEK.results[BFMD].taxonomyreports[0];
    const { nodes, issues } = taxonomyExport(report);

    assert.equal(nodes.length, report.length, 'every node, not a capped listing');
    assert.deepEqual(issues, []);
    assert.equal(nodes[0].parentTaxId, null, 'the root has no parent');
    assert.equal(nodes[0].name, 'root');
    assert.equal(nodes[0].cladeReads, 147);

    const byId = new Map(nodes.map(n => [n.taxId, n]));
    for (const node of nodes.slice(1)) {
        assert.ok(node.parentTaxId !== null, `${node.name} needs a parent`);
        const parent = byId.get(node.parentTaxId);
        assert.ok(parent, `${node.name}'s parent must be in the export`);
        assert.ok(parent.depth < node.depth, `${node.name} must sit below its parent`);
    }

    // Walking up from any leaf must terminate at the root — the property a clade analysis needs.
    for (const leaf of nodes.filter(n => !nodes.some(o => o.parentTaxId === n.taxId))) {
        let hops = 0;
        let cursor = leaf;
        while (cursor.parentTaxId !== null && hops < 100) { cursor = byId.get(cursor.parentTaxId); hops++; }
        assert.equal(cursor.parentTaxId, null, `${leaf.name} should reach the root`);
    }
});

// 2.3.6
test('a malformed depth ladder is reported and still yields a parent', () => {
    const jumped = taxonomyExport([
        { taxon_id: '1', name: 'root', rank: 'no rank', depth: 0, clade_reads: 10, taxon_reads: 0, proportion: 100 },
        { taxon_id: '2', name: 'skipped', rank: 'genus', depth: 2, clade_reads: 5, taxon_reads: 5, proportion: 50 },
    ]);
    assert.equal(jumped.nodes.length, 2);
    assert.equal(jumped.nodes[1].parentTaxId, 1, 'nearest shallower node');
    assert.equal(jumped.issues.length, 1);
    assert.equal(jumped.issues[0].code, 'TAXONOMY_DEPTH_JUMP');
    assert.match(jumped.issues[0].detail, /jumps from depth 0 to 2/);

    const nonNumeric = taxonomyExport([
        { taxon_id: '1', name: 'root', depth: 0, clade_reads: 1, taxon_reads: 0, proportion: 1 },
        { taxon_id: '2', name: 'broken', depth: 'x', clade_reads: 1, taxon_reads: 0, proportion: 1 },
    ]);
    assert.equal(nonNumeric.issues[0].code, 'TAXONOMY_DEPTH_JUMP');
    assert.match(nonNumeric.issues[0].detail, /non-numeric depth/);
    assert.equal(nonNumeric.nodes.length, 2);

    assert.deepEqual(taxonomyExport(undefined), { nodes: [], issues: [] });
});

// 2.3.7
test('a serialized search row is complete, numeric, and free of coordinates', () => {
    const groupId = Object.keys(FOLDSEEK.results[BFMD].alignments)[0];
    const row = serializeRow(FOLDSEEK, BFMD, groupId, { tool: 'foldseek' });

    assert.equal(row.id, `${BFMD}#${groupId}`);
    assert.equal(row.dbIndex, BFMD);
    assert.equal(row.chainCount, 1);
    assert.equal(row.chains, undefined, 'a single-chain row is its own chain');

    for (const field of ['eval', 'prob', 'score', 'seqId', 'qLen', 'dbLen']) {
        assert.equal(typeof row[field], 'number', `${field} must be a number, not a display string`);
    }
    assert.ok(typeof row.taxId === 'number' || row.taxId === undefined);
    assert.equal(typeof row.target, 'string');

    // Every parsed field survives except the render-only and coordinate ones.
    const source = FOLDSEEK.results[BFMD].alignments[groupId][0];
    for (const key of Object.keys(source)) {
        if (['href', 'active', 'id'].includes(key)) continue;
        assert.ok(key in row, `${key} must survive serialization`);
    }
    for (const key of ['href', 'active']) {
        assert.equal(key in row, false, `${key} is a render field`);
    }
    // The parser's id is a DOM id ("result-4-0"); the row's id is the stable one a selection uses.
    assert.match(source.id, /^result-/);
    assert.equal(row.id, `${BFMD}#${groupId}`);
    for (const key of Object.keys(row)) {
        assert.ok(!['ca', 'tCa', 'qCa'].includes(key), `${key} must not carry coordinates`);
    }
});

test('a complex row keeps its per-chain facts', () => {
    const parsed = complexResult();
    const row = serializeRow(parsed, 0, '7', { tool: 'foldseek' });
    assert.equal(row.chainCount, 2);
    assert.equal(row.chains.length, 2);
    assert.deepEqual(row.chains.map(c => c.target), ['1abc_A', '1abc_B']);
    assert.equal(typeof row.complexqtm, 'number');
    assert.equal(typeof row.chains[1].eval, 'number');

    const single = serializeRow(parsed, 0, '9', { tool: 'foldseek' });
    assert.equal(single.chainCount, 1);
    assert.equal(single.chains, undefined);

    assert.throws(() => serializeRow(parsed, 0, '404', { tool: 'foldseek' }),
        e => e.code === 'ROW_NOT_FOUND');
});

test('a folddisco row names its motif pattern and keeps its matched residues numeric', () => {
    const groupId = Object.keys(FOLDDISCO.results[PDB_FD].alignments)[0];
    const row = serializeRow(FOLDDISCO, PDB_FD, groupId, { tool: 'folddisco' });

    assert.equal(typeof row.idfscore, 'number');
    assert.equal(typeof row.rmsd, 'number');
    assert.equal(typeof row.nodecount, 'number');
    assert.equal(typeof row.motifPattern, 'string');
    assert.equal(row.gaps, undefined, 'the parser calls it gaps; an exported row calls it what it is');
    assert.equal(typeof row.targetresidues, 'string');
    assert.equal(row.chainCount, undefined, 'folddisco hits are not chain groups');
});

// 2.3.8
test('motif patterns are aggregated over every hit, deterministically', () => {
    const entryData = FOLDDISCO.results[PDB_FD];
    const out = motifPatternExport(entryData);

    const total = out.patterns.reduce((a, p) => a + p.hits, 0);
    assert.equal(total, Object.keys(entryData.alignments).length);
    assert.equal(out.distinctPatterns, out.patterns.length);
    assert.ok(out.queryResidues && typeof out.queryResidues === 'object');
    for (let i = 1; i < out.patterns.length; i++) {
        const [a, b] = [out.patterns[i - 1], out.patterns[i]];
        assert.ok(a.hits > b.hits || (a.hits === b.hits && a.pattern < b.pattern),
            'ties break on the pattern so the file is byte-stable');
    }
});

// 2.3.9
test('the residue map states gaps and matches the multimer chain frame', () => {
    const alignment = {
        entries: [
            { name: '1abc_AB-_-_-_A_3_0-B_6_3', aa: 'MAC-MAC' },
            { name: 'AF-P00001-F1-model_v4', aa: 'MACWMAC' },
        ],
    };

    const dimer = msaResidueMap(alignment, 0);
    assert.equal(dimer.isMultimer, true);
    assert.equal(dimer.totalColumns, 7);
    assert.equal(dimer.residueCount, 6);
    assert.deepEqual(dimer.gaps, ['3'], 'the gap column is stated, not inferred from absence');
    assert.deepEqual(dimer.columns.map(c => c.column), [0, 1, 2, 4, 5, 6]);
    assert.deepEqual(dimer.columns.map(c => c.token), ['A1', 'A2', 'A3', 'B1', 'B2', 'B3']);
    assert.deepEqual(dimer.chains, ['A', 'B']);
    assert.equal(dimer.chainBoundaries.length, 2, 'chain boundaries come from the name suffix');

    const monomer = msaResidueMap(alignment, 1);
    assert.equal(monomer.isMultimer, false);
    assert.equal(monomer.residueCount, 7);
    assert.deepEqual(monomer.gaps, []);
    assert.deepEqual(monomer.chains, ['A']);
    assert.deepEqual(monomer.columns.map(c => c.token), ['A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7']);

    assert.throws(() => msaResidueMap(alignment, 9), /no entry 9/);
});

test('the residue map is the same convention MsaColumnSelection derives its motif from', () => {
    const alignment = {
        entries: [
            { name: '1abc_AB-_-_-_A_3_0-B_6_3', aa: 'MAC-MAC' },
            { name: 'AF-P00001-F1-model_v4', aa: 'MACWMAC' },
        ],
    };

    for (const entry of [0, 1]) {
        const map = msaResidueMap(alignment, entry);
        for (const columns of [[0], [0, 1, 2], [2, 3, 4], [0, 3, 6], [3], [0, 1, 2, 3, 4, 5, 6]]) {
            const selection = new MsaColumnSelection(null, alignment, { entry, columns });
            const expected = map.columns
                .filter(c => columns.includes(c.column))
                .map(c => c.token)
                .join(', ');
            assert.equal(selection.motif, expected,
                `entry ${entry}, columns ${columns.join('/')} must agree with the exported map`);
        }
    }

    // The map is what a plugin gets in the artifact: columns -> motif with no further arithmetic.
    const dimer = msaResidueMap(alignment, 0);
    const selection = new MsaColumnSelection(null, alignment, { entry: 0, columns: [2, 4] });
    assert.equal(selection.motif, 'A3, B1');
    assert.deepEqual(
        dimer.columns.filter(c => [2, 4].includes(c.column)).map(c => `${c.chain}${c.resno}`),
        ['A3', 'B1']);
});

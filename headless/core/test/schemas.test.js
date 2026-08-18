// The two public contracts: what a valid object looks like, and that a malformed one is refused
// field by field rather than accepted for lack of a check.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
    SUMMARY_SCHEMA, ARTIFACT_SCHEMA, validateResultSummary, validateArtifactManifest,
    unsafeRelativePath,
} from '../src/schemas.js';
import { defaultRankingSemantics } from '../src/metrics.js';

const RANKING = defaultRankingSemantics({ mode: '3diaa' });

function summary(patch = {}) {
    return {
        schema: SUMMARY_SCHEMA,
        ticket: 'T1',
        entry: 0,
        status: 'COMPLETE',
        jobType: 'structuresearch',
        mode: '3diaa',
        resultKind: 'search',
        submission: { databases: ['pdb100'], mode: '3diaa' },
        derivedFrom: null,
        databases: [{
            dbIndex: 0, id: 'pdb100', safeName: 'db-0', display: 'PDB', version: '2024', status: 'COMPLETE',
            taxonomy: true, hasTaxonomy: true, hasDescription: true,
            serverAlignments: 3, parsedRows: 3,
            topHit: { id: '0#1', target: '1STP', value: 512, taxName: 'Streptomyces avidinii' },
        }],
        counts: { serverAlignments: 3, parsedRows: 3, grouping: 'none' },
        completeness: { complete: null, saturated: false, capSource: 'deployment-default', rowCap: 1000 },
        ranking: RANKING,
        availability: {
            taxonomy: true, motifPatterns: false, msa: false, columns: false,
            coordinates: false, tree: false, queryStructure: true,
        },
        selections: [{
            name: 'draft', kind: 'rows', size: 2, entry: 0,
            createdAt: '2026-08-18T00:00:00.000Z', updatedAt: '2026-08-18T00:00:01.000Z',
        }],
        exportAvailable: true,
        ...patch,
    };
}

function manifest(patch = {}) {
    return {
        schema: ARTIFACT_SCHEMA,
        artifactId: 'a'.repeat(64),
        state: {
            serverNamespace: 'https://search.foldseek.com/api',
            ticket: 'T1', entry: 0, jobType: 'structuresearch', mode: '3diaa', resultKind: 'search',
        },
        derivedFrom: null,
        createdAt: '2026-08-18T00:00:00.000Z',
        builtBy: { package: 'mmseqs2-agent-core', version: '0.1.0' },
        counts: { serverAlignments: 3, parsedRows: 3, exportedRows: 3, grouping: 'none' },
        completeness: { complete: null, saturated: false, capSource: 'deployment-default', rowCap: 1000 },
        ranking: RANKING,
        metricSemantics: { score: RANKING.semantics },
        databases: [{
            dbIndex: 0, id: 'pdb100', safeName: 'db-0', display: 'PDB', version: null, status: 'COMPLETE',
            taxonomy: true, hasTaxonomy: true, hasDescription: false,
            serverAlignments: 3, parsedRows: 3,
        }],
        files: [
            { role: 'manifest', path: 'manifest.json', mime: 'application/json', bytes: 800, rows: null },
            { role: 'rows', path: 'search/db-0.rows.jsonl', mime: 'application/x-ndjson', bytes: 4096, rows: 3 },
        ],
        integrityIssues: [],
        ...patch,
    };
}

const paths = value => value.errors.map(e => e.path);

test('a valid summary and a valid manifest pass', () => {
    assert.deepEqual(validateResultSummary(summary()), { ok: true, errors: [] });
    assert.deepEqual(validateArtifactManifest(manifest()), { ok: true, errors: [] });
});

test('a not-ready summary is its own shape, and cannot smuggle result data', () => {
    const notReady = {
        schema: SUMMARY_SCHEMA, ticket: 'T1', entry: 0, status: 'RUNNING',
        jobType: 'structuresearch', code: 'RESULT_NOT_READY', next: 'get_ticket_status',
    };
    assert.equal(validateResultSummary(notReady).ok, true);

    const withData = validateResultSummary({ ...notReady, counts: { serverAlignments: 1, parsedRows: 1, grouping: 'none' } });
    assert.equal(withData.ok, false);
    assert.deepEqual(paths(withData), ['counts']);
    assert.equal(withData.errors[0].problem, 'unexpected field');

    const missingCode = validateResultSummary({ ...notReady, code: undefined });
    assert.equal(missingCode.ok, false);
});

test('a complete summary cannot omit a required field, one at a time', () => {
    const required = [
        'schema', 'ticket', 'entry', 'status', 'resultKind', 'submission', 'derivedFrom',
        'databases', 'counts', 'completeness', 'ranking', 'availability', 'selections', 'exportAvailable',
    ];
    for (const field of required) {
        const broken = summary();
        delete broken[field];
        const result = validateResultSummary(broken);
        assert.equal(result.ok, false, `${field} should be required`);
        assert.ok(paths(result).includes(field), `${field} should be named in the error path`);
    }
});

test('a manifest cannot omit a required field, one at a time', () => {
    const required = [
        'schema', 'artifactId', 'state', 'derivedFrom', 'createdAt', 'builtBy', 'counts',
        'completeness', 'ranking', 'metricSemantics', 'databases', 'files', 'integrityIssues',
    ];
    for (const field of required) {
        const broken = manifest();
        delete broken[field];
        const result = validateArtifactManifest(broken);
        assert.equal(result.ok, false, `${field} should be required`);
        assert.ok(paths(result).includes(field));
    }
});

test('wrong types, bad enums and unexpected keys are all refused', () => {
    assert.deepEqual(paths(validateResultSummary(summary({ entry: '0' }))), ['entry']);
    assert.deepEqual(paths(validateResultSummary(summary({ entry: -1 }))), ['entry']);
    assert.deepEqual(paths(validateResultSummary(summary({ entry: 1.5 }))), ['entry']);
    assert.deepEqual(paths(validateResultSummary(summary({ resultKind: 'msa' }))), ['resultKind']);
    assert.deepEqual(paths(validateResultSummary(summary({ schema: 'mmseqs2-agent/result-summary@2' }))), ['schema']);
    assert.deepEqual(paths(validateResultSummary(summary({ surprise: 1 }))), ['surprise']);
    assert.equal(validateResultSummary('not an object').ok, false);
    assert.equal(validateResultSummary(null).ok, false);
});

test('tri-state completeness accepts null but not a third value', () => {
    assert.equal(validateResultSummary(summary({
        completeness: { complete: null, saturated: false, capSource: 'not-applicable' },
    })).ok, true);
    assert.equal(validateResultSummary(summary({
        completeness: { complete: true, saturated: false, capSource: 'worker-fixed' },
    })).ok, true);

    const bad = validateResultSummary(summary({
        completeness: { complete: 'maybe', saturated: false, capSource: 'worker-fixed' },
    }));
    assert.deepEqual(paths(bad), ['completeness.complete']);

    const badSource = validateResultSummary(summary({
        completeness: { complete: null, saturated: false, capSource: 'guessed' },
    }));
    assert.deepEqual(paths(badSource), ['completeness.capSource']);
});

test('nested errors carry the full path', () => {
    const broken = manifest();
    delete broken.files[1].rows;
    assert.deepEqual(paths(validateArtifactManifest(broken)), ['files[1].rows']);

    const badDb = manifest();
    badDb.databases[0].taxonomy = 'yes';
    assert.deepEqual(paths(validateArtifactManifest(badDb)), ['databases[0].taxonomy']);

    const badState = manifest();
    badState.state.resultKind = 'nonsense';
    assert.deepEqual(paths(validateArtifactManifest(badState)), ['state.resultKind']);
});

test('an artifact id must be a full sha256 hex digest', () => {
    for (const id of ['A'.repeat(64), 'a'.repeat(63), 'a'.repeat(65), '../etc', 'zz']) {
        assert.deepEqual(paths(validateArtifactManifest(manifest({ artifactId: id }))), ['artifactId'], id);
    }
});

test('manifest file paths must be relative and free of traversal', () => {
    for (const path of ['/etc/passwd', '../outside.json', 'a/../b.json', 'C:\\x.json', 'msa\\aa.fasta',
        './rows.jsonl', 'a//b.json', '%2e%2e/x', '']) {
        const broken = manifest();
        broken.files[1].path = path;
        assert.equal(validateArtifactManifest(broken).ok, false, `${path} should be refused`);
    }
    assert.equal(unsafeRelativePath('search/db-0.rows.jsonl'), null);
    assert.equal(unsafeRelativePath('msa/coordinates.json.gz'), null);
});

test('integrity issues are limited to the defined codes', () => {
    assert.equal(validateArtifactManifest(manifest({
        integrityIssues: [{ code: 'ROSTER_MISMATCH', detail: 'entry 3 has no ca' }],
    })).ok, true);
    assert.deepEqual(
        paths(validateArtifactManifest(manifest({ integrityIssues: [{ code: 'WEIRD', detail: 'x' }] }))),
        ['integrityIssues[0].code'],
    );
});

test('foldmason shapes: no ranking, no databases, complete is true', () => {
    assert.equal(validateArtifactManifest(manifest({
        state: {
            serverNamespace: 'https://search.foldseek.com/api',
            ticket: 'T2', entry: 0, jobType: 'foldmasoneasymsa', mode: null, resultKind: 'foldmason',
        },
        counts: { serverAlignments: 0, parsedRows: 15, exportedRows: 15, grouping: 'none' },
        completeness: { complete: true, saturated: false, capSource: 'not-applicable', rowCap: null },
        ranking: null,
        metricSemantics: {},
        databases: [],
        files: [{ role: 'msa-entries', path: 'msa/entries.json', mime: 'application/json', bytes: 40, rows: 15 }],
    })).ok, true);
});

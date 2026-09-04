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
        queryIdx: 0,
        status: 'COMPLETE',
        mode: '3diaa',
        tool: 'foldseek',
        submission: { queryHash: 'abc123', queryBytes: 70123 },
        derivedFrom: null,
        databases: [{
            dbIndex: 0, id: 'pdb100', display: 'PDB', version: '2024', taxonomyTree: true, parsedRows: 3,
            topHit: { id: '0#1', target: '1STP', value: 512, taxName: 'Streptomyces avidinii' },
        }],
        counts: { serverAlignments: 3, parsedRows: 3, grouping: 'none' },
        completeness: { complete: null, saturated: false, rowCap: 1000 },
        ranking: RANKING,
        selections: [{
            name: 'draft', kind: 'rows', size: 2, entry: 0,
            createdAt: '2026-08-18T00:00:00.000Z', updatedAt: '2026-08-18T00:00:01.000Z',
        }],
        ...patch,
    };
}

function manifest(patch = {}) {
    return {
        schema: ARTIFACT_SCHEMA,
        artifactId: 'a'.repeat(64),
        state: {
            serverNamespace: 'https://search.foldseek.com/api',
            ticket: 'T1', queryIdx: 0, mode: '3diaa', tool: 'foldseek',
        },
        derivedFrom: null,
        createdAt: '2026-08-18T00:00:00.000Z',
        builtBy: { package: 'foldseek-server-lib', version: '0.1.0' },
        counts: { serverAlignments: 3, parsedRows: 3, exportedRows: 3, grouping: 'none' },
        completeness: { complete: null, saturated: false, rowCap: 1000 },
        ranking: RANKING,
        metricSemantics: { score: { label: 'Score', direction: 'higher', crossDatabaseComparable: true, sortOrder: -1 } },
        databases: [{
            dbIndex: 0, id: 'pdb100', safeName: 'db-0', display: 'PDB', version: null, status: 'COMPLETE',
            taxonomy: true, taxonomyTree: true, hasDescription: false, serverAlignments: 3, parsedRows: 3,
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
    assert.equal(validateArtifactManifest(manifest({
        state: { serverNamespace: 'https://search.foldseek.com/api', ticket: 'T2', queryIdx: 0,
            mode: null, tool: 'foldmason' },
        counts: { serverAlignments: 0, parsedRows: 15, exportedRows: 15, grouping: 'none' },
        completeness: { complete: true, saturated: false, rowCap: null },
        ranking: null,
        metricSemantics: {},
        databases: [],
        files: [{ role: 'msa-entries', path: 'msa/entries.json', mime: 'application/json', bytes: 40, rows: 15 }],
    })).ok, true);
});

test('summary lifecycle shapes require their fields and reject result data before completion', () => {
    const notReady = {
        schema: SUMMARY_SCHEMA, ticket: 'T1', queryIdx: 0, status: 'RUNNING', tool: 'foldseek',
        code: 'RESULT_NOT_READY', next: 'get_ticket_status',
    };
    assert.equal(validateResultSummary(notReady).ok, true);

    const withData = validateResultSummary({ ...notReady, counts: { serverAlignments: 1, parsedRows: 1, grouping: 'none' } });
    assert.equal(withData.ok, false);
    assert.deepEqual(paths(withData), ['counts']);
    assert.equal(withData.errors[0].problem, 'unexpected field');

    const missingCode = validateResultSummary({ ...notReady, code: undefined });
    assert.equal(missingCode.ok, false);

    for (const field of [
        'schema', 'ticket', 'status', 'submission', 'derivedFrom',
        'databases', 'counts', 'completeness', 'ranking', 'selections',
    ]) {
        const broken = summary();
        delete broken[field];
        const result = validateResultSummary(broken);
        assert.equal(result.ok, false, `${field} should be required`);
        assert.ok(paths(result).includes(field), `${field} should be named in the error path`);
    }
    for (const field of [
        'schema', 'artifactId', 'state', 'derivedFrom', 'createdAt', 'builtBy', 'counts',
        'completeness', 'ranking', 'metricSemantics', 'databases', 'files', 'integrityIssues',
    ]) {
        const broken = manifest();
        delete broken[field];
        const result = validateArtifactManifest(broken);
        assert.equal(result.ok, false, `${field} should be required`);
        assert.ok(paths(result).includes(field));
    }
});

test('summary values reject wrong types, enums, extra keys and invalid completeness', () => {
    const cases = [
        [{ queryIdx: '0' }, 'queryIdx'], [{ queryIdx: -1 }, 'queryIdx'],
        [{ queryIdx: 1.5 }, 'queryIdx'], [{ resultKind: 'msa' }, 'resultKind'],
        [{ ranking: { ...RANKING, label: undefined } }, 'ranking.label'],
        [{ schema: 'foldseek-server/result-summary@2' }, 'schema'], [{ surprise: 1 }, 'surprise'],
        [{ completeness: { complete: 'maybe', saturated: false } }, 'completeness.complete'],
        [{ completeness: { complete: null } }, 'completeness.saturated'],
    ];
    for (const [patch, expected] of cases) {
        assert.deepEqual(paths(validateResultSummary(summary(patch))), [expected]);
    }
    assert.equal(validateResultSummary('not an object').ok, false);
    assert.equal(validateResultSummary(null).ok, false);
    assert.equal(validateResultSummary(summary({
        completeness: { complete: null, saturated: false },
    })).ok, true);
    assert.equal(validateResultSummary(summary({
        completeness: { complete: true, saturated: false },
    })).ok, true);
});

test('manifest errors preserve nested paths and constrained identifiers', () => {
    const broken = manifest();
    delete broken.files[1].rows;
    assert.deepEqual(paths(validateArtifactManifest(broken)), ['files[1].rows']);

    const badDb = manifest();
    badDb.databases[0].taxonomy = 'yes';
    assert.deepEqual(paths(validateArtifactManifest(badDb)), ['databases[0].taxonomy']);

    const badState = manifest();
    badState.state.resultKind = 'nonsense';
    assert.deepEqual(paths(validateArtifactManifest(badState)), ['state.resultKind']);

    for (const id of ['A'.repeat(64), 'a'.repeat(63), 'a'.repeat(65), '../etc', 'zz']) {
        assert.deepEqual(paths(validateArtifactManifest(manifest({ artifactId: id }))), ['artifactId'], id);
    }

    assert.equal(validateArtifactManifest(manifest({
        integrityIssues: [{ code: 'ROSTER_MISMATCH', detail: 'entry 3 has no ca' }],
    })).ok, true);
    assert.deepEqual(paths(validateArtifactManifest(manifest({
        integrityIssues: [{ code: 'WEIRD', detail: 'x' }],
    }))), ['integrityIssues[0].code']);
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

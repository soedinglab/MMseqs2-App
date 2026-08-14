// Selecting columns of a FoldMason entry, and the motif they map to.
//
// The mapping is the part worth testing: an alignment column is not a residue number, and for a
// multimer it is not even a single numbering — the residue at column 4 may be B1 rather than A4. Both
// steps come from the page (getResidueIndices, and the chain map MSA.vue builds in beforeMount), so
// what these check is that the composition of the two lands on the same string the page would show.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createClient, MsaColumnSelection } from '../src/index.js';

const CG2ALL = 'https://cg2all.test/predict';

/** Six CA atoms: three for chain A, three for chain B once decoded. */
const CA6 = [
    '1.000,1.000,1.000', '2.000,2.000,2.000', '3.000,3.000,3.000',
    '4.000,4.000,4.000', '5.000,5.000,5.000', '6.000,6.000,6.000',
].join(',');

/**
 * Two entries over the same seven columns. The first is a dimer stored the way FoldMason stores one:
 * a single linear sequence, with the chain boundaries in the name's suffix (A ends at 3, B starts
 * after an offset of 3). Column 3 is a gap in it and a residue in the second entry, which is the case
 * that separates "column" from "residue".
 */
function alignment() {
    return {
        entries: [
            { name: '1abc_AB-_-_-_A_3_0-B_6_3', aa: 'MAC-MAC', ca: CA6 },
            { name: 'AF-P00001-F1-model_v4', aa: 'MACWMAC', ca: `${CA6},7.000,7.000,7.000` },
        ],
        scores: [0.9, 0.9, 0.8, -1, 0.7, 0.6, 0.5],
    };
}

function tmpDir() {
    return fs.mkdtemp(path.join(os.tmpdir(), 'mmseqs2-agent-msasel-'));
}

/** cg2all echoes what it was given: real reconstruction keeps chain and residue numbering. */
function stubFetch(routes = {}) {
    const calls = [];
    const impl = async (url, init = {}) => {
        calls.push({ url, method: init.method ?? 'GET', body: init.body });
        for (const [fragment, respond] of Object.entries(routes)) {
            if (url.includes(fragment)) return respond(url, init);
        }
        if (url === CG2ALL) {
            const sent = await init.body.get('file').text();
            return { ok: true, status: 200, text: async () => sent, json: async () => ({}) };
        }
        if (url.includes('/databases')) {
            return {
                ok: true,
                status: 200,
                json: async () => [{ path: 'pdb_folddisco', status: 'COMPLETE', motif: true, interface: false }],
                text: async () => '',
            };
        }
        if (url.includes('/result/foldmason/')) {
            return { ok: true, status: 200, json: async () => alignment(), text: async () => '' };
        }
        return { ok: true, status: 200, json: async () => ({ id: 'NEWTICKET', status: 'PENDING' }), text: async () => '' };
    };
    impl.calls = calls;
    return impl;
}

async function makeClient(fetchImpl = stubFetch()) {
    return createClient({
        baseUrl: 'https://example.test', cg2allUrl: CG2ALL, stateDir: await tmpDir(), fetchImpl,
    });
}

test('columns map to chain and original residue number across a multimer boundary', async () => {
    const client = await makeClient();
    const selection = await client.selectMsaColumns('MSA1', { entry: 0, columns: [0, 1, 4] });

    // Columns 0 and 1 are the first chain's residues 1 and 2; column 4 is past the boundary, so it is
    // chain B's residue 1 — not A4, which is what a naive column-to-resno map would produce.
    assert.equal(selection.motif, 'A1, A2, B1');
    assert.deepEqual(selection.residues, [1, 2, 4]);
});

test('a gap column contributes no residue, and says so', async () => {
    const client = await makeClient();
    const selection = await client.selectMsaColumns('MSA1', { entry: 0, columns: [0, 3, 4] });

    const described = selection.describe();
    assert.equal(described.residueCount, 2);
    assert.equal(described.gapColumns, 1);
    assert.equal(described.motif, 'A1, B1');
    assert.deepEqual(described.selectedColumns, ['0', '3-4']);
    assert.deepEqual(described.chains, ['A', 'B']);
});

test('the same columns read off another entry give that entry\'s residues', async () => {
    const client = await makeClient();
    const selection = await client.selectMsaColumns('MSA1', { entry: 0, columns: [0, 3, 4] });
    assert.equal(selection.motif, 'A1, B1');

    // The second entry has no gap at column 3 and no chain boundary, so the same region covers three
    // residues of one chain.
    selection.setEntry(1);
    assert.equal(selection.motif, 'A1, A4, A5');
    assert.equal(selection.describe().gapColumns, 0);
    assert.equal(selection.describe().isMultimer, false);
});

test('columns can be widened and narrowed after the fact', async () => {
    const client = await makeClient();
    const selection = await client.selectMsaColumns('MSA1', { entry: 1, columns: [1] });

    selection.addColumns([2, 0]);
    assert.deepEqual(selection.columns, [0, 1, 2]);
    assert.equal(selection.motif, 'A1, A2, A3');

    selection.removeColumns([0]);
    assert.deepEqual(selection.columns, [1, 2]);

    selection.setColumns([5, 5, 6]);
    assert.deepEqual(selection.columns, [5, 6], 'duplicates collapse and order is normalised');
});

test('an explicit motif overrides the derived one, and can be taken back', async () => {
    const client = await makeClient();
    const selection = await client.selectMsaColumns('MSA1', { entry: 1, columns: [0, 1, 2] });

    selection.setMotif('A1, A3');
    assert.equal(selection.motif, 'A1, A3');
    assert.equal(selection.describe().motifSource, 'override');

    selection.setMotif(null);
    assert.equal(selection.motif, 'A1, A2, A3');
    assert.equal(selection.describe().motifSource, undefined);
});

test('a column selection survives the process that made it', async () => {
    const stateDir = await tmpDir();
    const opts = { baseUrl: 'https://example.test', cg2allUrl: CG2ALL, stateDir };

    const first = createClient({ ...opts, fetchImpl: stubFetch() });
    const made = await first.selectMsaColumns('MSA1', { entry: 0, columns: [0, 1], name: 'core' });
    made.setMotif('A1');
    await made.save();

    const second = createClient({ ...opts, fetchImpl: stubFetch() });
    const restored = await second.loadMsaSelection('MSA1', 'core');
    assert.deepEqual(restored.columns, [0, 1]);
    assert.equal(restored.entryIndex, 0);
    assert.equal(restored.motif, 'A1', 'the override is part of the choice, so it is stored too');
    assert.ok(restored.savedAt);

    assert.deepEqual((await second.listSelections('MSA1')).map(s => [s.name, s.size]), [['core', 2]]);
    assert.equal(await second.loadMsaSelection('MSA1', 'nothing-here'), null);
});

test('an entry that is not there is refused by name', async () => {
    const client = await makeClient();
    await assert.rejects(
        () => client.selectMsaColumns('MSA1', { entry: 9, columns: [0] }),
        /no entry 9 in this alignment \(it has 2\)/);
});

test('a column selection sends to FoldDisco as the entry\'s own structure, with its motif', async () => {
    const fetchImpl = stubFetch();
    const client = await makeClient(fetchImpl);
    const selection = await client.selectMsaColumns('MSA1', { entry: 0, columns: [0, 1, 4] });

    const ticket = await selection.sendTo({ tool: 'folddisco', databases: ['pdb_folddisco'] });
    assert.equal(ticket.id, 'NEWTICKET');

    const submission = fetchImpl.calls.find(c => c.method === 'POST' && c.url.includes('/ticket/folddisco'));
    const form = Object.fromEntries(new URLSearchParams(submission.body));
    assert.equal(form.motif, 'A1, A2, B1', 'the motif the columns produced is what is searched for');
    // The submitted structure is the decoded dimer, so B1 is a residue that exists in it — which is
    // what submitFoldDisco validates before sending.
    const chains = new Set(form.q.split('\n').filter(l => l.startsWith('ATOM')).map(l => l[21]));
    assert.deepEqual([...chains].sort(), ['A', 'B']);
});

test('MsaColumnSelection can be built straight from a result object', () => {
    const selection = new MsaColumnSelection(null, alignment(), { entry: 1, columns: [0, 6] });
    assert.equal(selection.motif, 'A1, A7');
    assert.equal(selection.describe().totalColumns, 7);
});

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

import { createClient, MsaColumnSelection, expandRanges, SUBSTITUTION_CLASSES } from '../src/index.js';

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
    return fs.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-msasel-'));
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

test('the motif is derived and there is nothing to override it with', async () => {
    const client = await makeClient();
    const selection = await client.selectMsaColumns('MSA1', { entry: 1, columns: [0, 1, 2] });

    assert.equal(selection.motif, 'A1, A2, A3');
    assert.equal(selection.setMotif, undefined, 'the override is gone, not merely discouraged');
    assert.equal(selection.describe().motifSource, undefined);
});

test('a substitution is addressed by column and lands on that token alone', async () => {
    const client = await makeClient();
    const selection = await client.selectMsaColumns('MSA1', { entry: 0, columns: [0, 1, 4] });

    selection.setResidueAa([{ column: 1, aa: 'W' }]);
    assert.equal(selection.motif, 'A1, A2:W, B1', 'numbering and order are untouched');
    assert.deepEqual(selection.residues, [1, 2, 4], 'residue identity is still a function of the columns');

    // One line carries the whole correspondence: which column, which token, what is actually there,
    // and what was asked for instead.
    assert.equal(selection.describe().residueMapping, '0->A1, 1->A2(A):W, 4->B1');

    selection.setResidueAa([{ column: 1, aa: null }]);
    assert.equal(selection.motif, 'A1, A2, B1');
    assert.equal(selection.describe().residueMapping, '0->A1, 1->A2, 4->B1');
});

test('every substitution code is accepted with its meaning, and case is never normalised', async () => {
    const client = await makeClient();
    const selection = await client.selectMsaColumns('MSA1', { entry: 1, columns: [0] });

    for (const code of Object.keys(SUBSTITUTION_CLASSES)) {
        selection.setResidueAa([{ column: 0, aa: code }]);
        assert.deepEqual(selection.residueAa, [{ column: 0, aa: code }], `${code} survives verbatim`);
        assert.equal(selection.motif, `A1:${code}`);
        assert.equal(selection.describe().residueMapping, `0->A1(M):${code}`);
    }

    // The failure this guards: upper-casing would turn aromatic into alanine, negative into
    // asparagine, hydrophilic into histidine and positive into proline — searches that run and
    // answer a different question. The mapping distinguishes them by never rewriting the code.
    for (const [group, amino] of [['a', 'A'], ['n', 'N'], ['h', 'H'], ['p', 'P']]) {
        selection.setResidueAa([{ column: 0, aa: group }]);
        assert.equal(selection.describe().residueMapping, `0->A1(M):${group}`);
        selection.setResidueAa([{ column: 0, aa: amino }]);
        assert.equal(selection.describe().residueMapping, `0->A1(M):${amino}`);
    }

    // Pinning the residue that is already there is a legitimate thing to say, and the mapping shows
    // it as exactly that: A1 is M, and M is what was asked for.
    selection.setResidueAa([{ column: 0, aa: 'M' }]);
    assert.equal(selection.describe().residueMapping, '0->A1(M):M');
});

test('a substitution is refused when it has no column or no meaning', async () => {
    const client = await makeClient();
    const selection = await client.selectMsaColumns('MSA1', { entry: 1, columns: [0, 1] });

    assert.throws(() => selection.setResidueAa([{ column: 5, aa: 'W' }]),
        /column 5 is not in this selection/);
    assert.throws(() => selection.setResidueAa([{ column: 0, aa: 'WY' }]),
        /"WY" is not a substitution code/);
    for (const aa of ['z', 'B', 'J', 'O', '1', '-']) {
        assert.throws(() => selection.setResidueAa([{ column: 0, aa }]),
            err => err.code === 'INVALID_INPUT'
                && err.message.includes('ACDEFGHIKLMNPQRSTVWY')
                && err.message.includes('aromatic'),
            `${aa} should be refused, listing what is accepted`);
    }
    assert.throws(() => selection.setResidueAa([{ column: 0 }]), /needs an aa; pass null to clear/);
    assert.deepEqual(selection.residueAa, [], 'a refused call changes nothing');
});

test('an annotation on a gap column is kept and only drops out of the motif', async () => {
    const client = await makeClient();
    const selection = await client.selectMsaColumns('MSA1', { entry: 0, columns: [0, 3, 4] });

    selection.setResidueAa([{ column: 3, aa: 'Y' }]);
    assert.equal(selection.motif, 'A1, B1', 'column 3 is a gap here, so it contributes no token');
    assert.equal(selection.describe().residueMapping, '0->A1, 3->gap:Y, 4->B1',
        'the annotation is stated as inert rather than dropped from the reply');
    assert.equal(selection.describe().gapColumns, 1);

    // Entry 1 has a residue at column 3, so the same stored annotation becomes live. Nothing was
    // discarded in between: the selection is in column space, not entry space.
    selection.setEntry(1);
    assert.equal(selection.motif, 'A1, A4:Y, A5');
    assert.equal(selection.describe().residueMapping, '0->A1, 3->A4(W):Y, 4->A5');
    assert.deepEqual(selection.residueAa, [{ column: 3, aa: 'Y' }]);
});

test('deselecting a column takes its substitution with it', async () => {
    const client = await makeClient();
    const selection = await client.selectMsaColumns('MSA1', { entry: 1, columns: [0, 1, 2] });
    selection.setResidueAa([{ column: 1, aa: 'W' }, { column: 2, aa: 'h' }]);

    selection.removeColumns([1]);
    assert.deepEqual(selection.residueAa, [{ column: 2, aa: 'h' }]);
    assert.equal(selection.motif, 'A1, A3:h');

    selection.setColumns([0]);
    assert.deepEqual(selection.residueAa, []);
});

test('a column selection survives the process that made it, substitutions included', async () => {
    const stateDir = await tmpDir();
    const opts = { baseUrl: 'https://example.test', cg2allUrl: CG2ALL, stateDir };

    const first = createClient({ ...opts, fetchImpl: stubFetch() });
    const made = await first.selectMsaColumns('MSA1', { entry: 0, columns: [0, 1], name: 'core' });
    made.setResidueAa([{ column: 1, aa: 'a' }]);
    await made.save();

    const second = createClient({ ...opts, fetchImpl: stubFetch() });
    const restored = await second.loadMsaSelection('MSA1', 'core');
    assert.deepEqual(restored.columns, [0, 1]);
    assert.equal(restored.entryIndex, 0);
    assert.deepEqual(restored.residueAa, [{ column: 1, aa: 'a' }]);
    assert.equal(restored.motif, 'A1, A2:a', 'reload derives the same motif rather than replaying one');
    assert.ok(restored.savedAt);

    assert.deepEqual((await second.listSelections('MSA1')).map(s => [s.name, s.size]), [['core', 2]]);
    assert.equal(await second.loadMsaSelection('MSA1', 'nothing-here'), null);
});

test('a record written by the old version loads, and its stored motif is ignored', async () => {
    const client = await makeClient();
    await client.store.writeSelection('MSA1', 'legacy', {
        page: 'foldmason', queryIdx: 0, columns: [0, 1], motif: 'A1, A3',
    });

    const restored = await client.loadMsaSelection('MSA1', 'legacy');
    assert.equal(restored.motif, 'A1, A2', 'the columns decide, not the stale field');
    assert.deepEqual(restored.residueAa, []);
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
    assert.equal(ticket.derivedFrom.motifSource, 'columns');
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

test('a substituted motif is what gets submitted, and the backend check accepts it', async () => {
    const fetchImpl = stubFetch();
    const client = await makeClient(fetchImpl);
    const selection = await client.selectMsaColumns('MSA1', { entry: 0, columns: [0, 1, 4] });
    selection.setResidueAa([{ column: 4, aa: 'b' }]);

    // submitFoldDisco runs assertMotif against the structure it is about to send, so reaching a
    // ticket at all is the proof that the derived string is still a motif the server will take.
    const ticket = await selection.sendTo({ tool: 'folddisco', databases: ['pdb_folddisco'] });
    const submission = fetchImpl.calls.find(c => c.method === 'POST' && c.url.includes('/ticket/folddisco'));
    assert.equal(Object.fromEntries(new URLSearchParams(submission.body)).motif, 'A1, A2, B1:b');
    assert.deepEqual(ticket.derivedFrom.residueAa, [{ column: 4, aa: 'b' }]);
});

test('a caller cannot supply a motif when the source already carries one', async () => {
    const client = await makeClient();
    const selection = await client.selectMsaColumns('MSA1', { entry: 0, columns: [0, 1] });

    await assert.rejects(
        () => selection.sendTo({ tool: 'folddisco', databases: ['pdb_folddisco'], motif: 'A9' }),
        err => err.code === 'INVALID_INPUT' && /already carries a motif/.test(err.message));
});

test('the submitted motif re-derives from the exported artifact and its lineage alone', async () => {
    const json = body => () => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
    const fetchImpl = stubFetch({
        '/ticket/type/': json({ type: 'foldmasoneasymsa' }),
        '/ticket/MSA1': json({ id: 'MSA1', status: 'COMPLETE' }),
    });
    const client = await makeClient(fetchImpl);

    const selection = await client.selectMsaColumns('MSA1', { entry: 0, columns: [0, 1, 4], name: 'pick' });
    selection.setResidueAa([{ column: 4, aa: 'b' }]);
    await selection.save();
    const ticket = await selection.sendTo({ tool: 'folddisco', databases: ['pdb_folddisco'] });

    const submitted = Object.fromEntries(new URLSearchParams(
        fetchImpl.calls.find(c => c.method === 'POST' && c.url.includes('/ticket/folddisco')).body)).motif;

    // Everything below uses only the artifact on disk and the lineage record — no client, no server.
    const out = await client.exportResult('MSA1');
    const mapFile = out.files.find(f => f.role === 'msa-residue-map');
    const lines = await fs.readFile(
        path.join(path.dirname(out.localPath), mapFile.path), 'utf8');
    const map = lines.trim().split('\n').map(JSON.parse)[ticket.derivedFrom.entry];

    const wanted = new Set(expandRanges(ticket.derivedFrom.columns));
    const substitution = new Map((ticket.derivedFrom.residueAa ?? []).map(r => [r.column, r.aa]));
    const rebuilt = expandRanges(map.occupiedColumns)
        .map((column, i) => ({ column, token: map.tokens[i] }))
        .filter(pair => wanted.has(pair.column))
        .map(pair => (substitution.has(pair.column)
            ? `${pair.token}:${substitution.get(pair.column)}`
            : pair.token))
        .join(', ');

    assert.equal(rebuilt, submitted, 'the artifact reproduces the motif that was searched');
});

test('the mapping is capped, so a large selection cannot make the reply large', () => {
    const wide = { entries: [{ name: 'wide', aa: 'M'.repeat(200), ca: '1,1,1,'.repeat(200).slice(0, -1) }] };
    const selection = new MsaColumnSelection(null, wide,
        { columns: Array.from({ length: 200 }, (_, i) => i) });

    const described = selection.describe();
    assert.match(described.residueMapping, /^0->A1, /);
    assert.match(described.residueMapping, /, \+168 more$/, 'the first 32 and a count, not two hundred');
    assert.ok(described.residueMapping.length < 400);

    // The complete list is still there, compressed, which is what the selection actually is.
    assert.deepEqual(described.selectedColumns, ['0-199']);
    assert.equal(described.residueCount, 200);
});

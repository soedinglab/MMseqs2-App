// Queries read from a file. What the allowlist admits, and what it must not.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { Store, SubmittableQuery } from 'foldseek-server-lib';
import { createTools, runTool } from '../src/tools.js';
import { readConfigFromEnv } from '../src/server.js';

const PDB = 'ATOM      1  CA  MET A   1       1.000   2.000   3.000  1.00  0.00           C\n';

const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-inputs-'));

async function fixture({ allow = true } = {}) {
    const dir = await tmp();
    const submitted = [];
    const client = {
        store: new Store(await tmp()),
        query(spec, opts) { return new SubmittableQuery(client, spec, opts); },
        async submitFoldseekSearch(a) { submitted.push(['foldseek', a]); return { id: 'FS1', status: 'PENDING' }; },
        async submitMultimerSearch(a) { submitted.push(['multimer', a]); return { id: 'MM1', status: 'PENDING' }; },
        async submitFoldDisco(a) { submitted.push(['folddisco', a]); return { id: 'FD1', status: 'PENDING' }; },
        async submitFoldMason(a) { submitted.push(['foldmason', a]); return { id: 'FM1', status: 'PENDING' }; },
        async getDatabases() { return []; },
        // Mirrors loadAccessions: names carry the extension ensureStructureExtension would add.
        async loadAccessions(ids) {
            return { structures: ids.map(id => ({ name: `${id}.cif`, text: PDB })), failed: [] };
        },
    };
    const tools = createTools(client, { inputDirs: allow ? [dir] : [], touchDirs: [] });
    const write = async (name, text = PDB) => {
        const file = path.join(dir, name);
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, text);
        return file;
    };
    return { dir, tools, submitted, write, client };
}

test('a file inside the allowlist submits its contents, and the path is not passed on', async () => {
    const { tools, submitted, write } = await fixture();
    const file = await write('nested/query.cif', `${PDB}${PDB}`);

    const out = await runTool(tools, 'foldseek_search', { queryRef: file, databases: ['afdb50'] });
    assert.equal(out.ticketId, 'FS1');
    assert.deepEqual(out.loaded, { name: 'query.cif', bytes: PDB.length * 2 });

    const [[, args]] = submitted;
    assert.equal(args.query, `${PDB}${PDB}`);
    assert.equal(args.queryRef, undefined, 'the client never sees a local path');

    // Nor does anything that leaves the server: not the reply, not the arguments the client records.
    assert.equal(JSON.stringify(out).includes(path.dirname(file)), false);
    assert.equal(JSON.stringify(args).includes(path.dirname(file)), false);
    assert.equal(JSON.stringify(out).includes(PDB.trim()), false, 'and not the contents either');
});

test('every submit tool takes a path', async () => {
    const { tools, submitted, write } = await fixture();
    const a = await write('a.pdb');
    const b = await write('b.pdb');

    await runTool(tools, 'foldseek_search', { queryRef: a, databases: ['db'] });
    await runTool(tools, 'multimer_search', { queryRef: a, databases: ['db'] });
    await runTool(tools, 'folddisco_search', { queryRef: a, databases: ['db'], motif: 'A1' });
    const msa = await runTool(tools, 'foldmason_msa', { fileRefs: [a, b] });

    assert.deepEqual(submitted.map(([tool]) => tool), ['foldseek', 'multimer', 'folddisco', 'foldmason']);
    assert.equal(msa.ticketId, 'FM1');
    assert.deepEqual(submitted.at(-1)[1].files.map(f => f.name), ['a.pdb', 'b.pdb']);
    assert.equal(submitted.at(-1)[1].files[0].content, PDB);
});

test('a path outside the allowlist is refused, and so is a symlink pointing out', async () => {
    const { tools, write, dir } = await fixture();
    const outside = path.join(await tmp(), 'secret.pdb');
    await fs.writeFile(outside, PDB);
    await write('ok.pdb');
    await fs.symlink(outside, path.join(dir, 'link.pdb'));

    for (const bad of [outside, path.join(dir, 'link.pdb'), path.join(dir, '..', path.basename(outside))]) {
        const out = await runTool(tools, 'foldseek_search', { queryRef: bad, databases: ['db'] });
        assert.equal(out.code, 'INPUT_PATH_REFUSED', bad);
        assert.match(out.error, /did not resolve in any readable directory/, bad);
        // The refusal is also how a caller learns what is there, so one try is enough.
        assert.match(out.error, /holds .*ok\.pdb/, bad);
    }

    const asDir = await runTool(tools, 'foldseek_search', { queryRef: dir, databases: ['db'] });
    assert.equal(asDir.code, 'INPUT_PATH_REFUSED');
    assert.match(asDir.error, /not a regular file/);
});

test('with no allowlist the capability is off, and says which variable turns it on', async () => {
    const { tools, write } = await fixture({ allow: false });
    const file = await write('query.pdb');

    const out = await runTool(tools, 'foldseek_search', { queryRef: file, databases: ['db'] });
    assert.equal(out.code, 'INPUT_PATH_REFUSED');
    assert.match(out.error, /reading queries from files is off/);
    assert.match(out.error, /FOLDSEEK_SERVER_INPUT_DIRS/);
});

// --- foldmason inputs combine, because the structures come from different places ------------------

test('a foldmason alignment mixes refs and accessions, in a declared order', async () => {
    const { tools, write, submitted } = await fixture();
    await write('local-a.pdb');
    await write('local-b.pdb');

    const out = await runTool(tools, 'foldmason_msa', {
        files: [{ name: 'inline.pdb', content: PDB }],
        fileRefs: ['local-a.pdb', 'local-b.pdb'],
        accessions: ['1abc', { id: 'P0DTC2', source: 'AlphaFoldDB' }],
    });
    assert.equal(out.isError, undefined, JSON.stringify(out));

    // Entry index is what a column selection refers to, so the order is part of the contract.
    assert.deepEqual(submitted.at(-1)[1].files.map(f => f.name),
        ['inline.pdb', 'local-a.pdb', 'local-b.pdb', '1abc.cif', 'P0DTC2.cif']);
});

test('foldmason still refuses fewer than two structures, counted across every source', async () => {
    const { tools, write } = await fixture();
    await write('only.pdb');

    for (const args of [{ fileRefs: ['only.pdb'] }, { accessions: ['1abc'] },
        { files: [{ name: 'x.pdb', content: PDB }] }, {}]) {
        const out = await runTool(tools, 'foldmason_msa', args);
        assert.equal(out.isError, true, JSON.stringify(args));
        assert.match(out.error, /at least two structures/);
    }
});

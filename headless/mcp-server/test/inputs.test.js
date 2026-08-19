// Queries read from a file. What the allowlist admits, and what it must not.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { Store, SubmittableQuery } from 'mmseqs2-agent-core';
import { createTools, runTool } from '../src/tools.js';
import { readConfigFromEnv } from '../src/server.js';

const PDB = 'ATOM      1  CA  MET A   1       1.000   2.000   3.000  1.00  0.00           C\n';

const tmp = () => fs.mkdtemp(path.join(os.tmpdir(), 'mmseqs2-agent-inputs-'));

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
    };
    const tools = createTools(client, { inputDirs: allow ? [dir] : [] });
    const write = async (name, text = PDB) => {
        const file = path.join(dir, name);
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, text);
        return file;
    };
    return { dir, tools, submitted, write };
}

test('a file inside the allowlist submits its contents, and the path is not passed on', async () => {
    const { tools, submitted, write } = await fixture();
    const file = await write('nested/query.cif', `${PDB}${PDB}`);

    const out = await runTool(tools, 'foldseek_search', { queryPath: file, databases: ['afdb50'] });
    assert.equal(out.ticketId, 'FS1');
    assert.deepEqual(out.loaded, { name: 'query.cif', bytes: PDB.length * 2 });

    const [[, args]] = submitted;
    assert.equal(args.query, `${PDB}${PDB}`);
    assert.equal(args.queryPath, undefined, 'the client never sees a local path');

    // Nor does anything that leaves the server: not the reply, not the arguments the client records.
    assert.equal(JSON.stringify(out).includes(path.dirname(file)), false);
    assert.equal(JSON.stringify(args).includes(path.dirname(file)), false);
    assert.equal(JSON.stringify(out).includes(PDB.trim()), false, 'and not the contents either');
});

test('every submit tool takes a path', async () => {
    const { tools, submitted, write } = await fixture();
    const a = await write('a.pdb');
    const b = await write('b.pdb');

    await runTool(tools, 'foldseek_search', { queryPath: a, databases: ['db'] });
    await runTool(tools, 'multimer_search', { queryPath: a, databases: ['db'] });
    await runTool(tools, 'folddisco_search', { queryPath: a, databases: ['db'], motif: 'A1' });
    const msa = await runTool(tools, 'foldmason_msa', { filePaths: [a, b] });

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
        const out = await runTool(tools, 'foldseek_search', { queryPath: bad, databases: ['db'] });
        assert.equal(out.code, 'INPUT_PATH_REFUSED', bad);
        assert.match(out.error, /MMSEQS2_AGENT_INPUT_DIRS/);
    }

    const asDir = await runTool(tools, 'foldseek_search', { queryPath: dir, databases: ['db'] });
    assert.equal(asDir.code, 'INPUT_PATH_REFUSED');
    assert.match(asDir.error, /not a regular file/);
});

test('with no allowlist the capability is off, and says which variable turns it on', async () => {
    const { tools, write } = await fixture({ allow: false });
    const file = await write('query.pdb');

    const out = await runTool(tools, 'foldseek_search', { queryPath: file, databases: ['db'] });
    assert.equal(out.code, 'INPUT_PATH_REFUSED');
    assert.match(out.error, /reading queries from files is off/);
    assert.match(out.error, /MMSEQS2_AGENT_INPUT_DIRS/);
});

test('foldmason takes files or filePaths, never both and never neither', async () => {
    const { tools, write } = await fixture();
    const a = await write('a.pdb');

    const both = await runTool(tools, 'foldmason_msa', {
        files: [{ name: 'a.pdb', content: PDB }, { name: 'b.pdb', content: PDB }], filePaths: [a, a],
    });
    assert.equal(both.code, 'INVALID_INPUT');
    assert.match(both.error, /one of files or filePaths/);

    const neither = await runTool(tools, 'foldmason_msa', {});
    assert.equal(neither.code, 'INVALID_INPUT');
});

test('the allowlist is empty by default and colon separated when set', () => {
    const base = { MMSEQS2_AGENT_BASE_URL: 'https://example.test' };
    assert.deepEqual(readConfigFromEnv(base).inputDirs, []);
    assert.deepEqual(
        readConfigFromEnv({ ...base, MMSEQS2_AGENT_INPUT_DIRS: `/a${path.delimiter} /b ${path.delimiter}` }).inputDirs,
        ['/a', '/b']);
});

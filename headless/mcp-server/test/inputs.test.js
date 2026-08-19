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

async function fixture({ allow = true, urlHosts = [], fetchImpl = null } = {}) {
    const dir = await tmp();
    const submitted = [];
    const client = {
        fetchImpl: fetchImpl ?? (async () => ({ ok: true, status: 200, headers: new Headers(), text: async () => PDB })),
        store: new Store(await tmp()),
        query(spec, opts) { return new SubmittableQuery(client, spec, opts); },
        async submitFoldseekSearch(a) { submitted.push(['foldseek', a]); return { id: 'FS1', status: 'PENDING' }; },
        async submitMultimerSearch(a) { submitted.push(['multimer', a]); return { id: 'MM1', status: 'PENDING' }; },
        async submitFoldDisco(a) { submitted.push(['folddisco', a]); return { id: 'FD1', status: 'PENDING' }; },
        async submitFoldMason(a) { submitted.push(['foldmason', a]); return { id: 'FM1', status: 'PENDING' }; },
        async getDatabases() { return []; },
    };
    const tools = createTools(client, { inputDirs: allow ? [dir] : [], urlHosts });
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
        assert.match(out.error, /FOLDSEEK_SERVER_INPUT_DIRS/);
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
    assert.match(out.error, /FOLDSEEK_SERVER_INPUT_DIRS/);
});

test('foldmason takes exactly one of files, filePaths and fileUrls', async () => {
    const { tools, write } = await fixture();
    const a = await write('a.pdb');

    const both = await runTool(tools, 'foldmason_msa', {
        files: [{ name: 'a.pdb', content: PDB }, { name: 'b.pdb', content: PDB }], filePaths: [a, a],
    });
    assert.equal(both.code, 'INVALID_INPUT');
    assert.match(both.error, /exactly one of files, filePaths or fileUrls/);

    const neither = await runTool(tools, 'foldmason_msa', {});
    assert.equal(neither.code, 'INVALID_INPUT');
    assert.match(neither.error, /got none/);
});

test('the allowlist is empty by default and colon separated when set', () => {
    const base = { FOLDSEEK_SERVER_BASE_URL: 'https://example.test' };
    assert.deepEqual(readConfigFromEnv(base).inputDirs, []);
    assert.deepEqual(
        readConfigFromEnv({ ...base, FOLDSEEK_SERVER_INPUT_DIRS: `/a${path.delimiter} /b ${path.delimiter}` }).inputDirs,
        ['/a', '/b']);
});

// --- queryUrl: the server fetches, so the allowlist is the boundary -----------------------------

/** A stub whose responses the test dictates, recording what was requested. */
function urlFetch(routes) {
    const calls = [];
    const impl = async (url, init = {}) => {
        calls.push({ url, redirect: init.redirect });
        const respond = routes[url] ?? routes['*'];
        if (!respond) throw new Error(`unexpected fetch: ${url}`);
        return respond();
    };
    impl.calls = calls;
    return impl;
}

const ok = (body, headers = {}) => () => ({
    ok: true, status: 200, headers: new Headers(headers), text: async () => body,
});

test('an https url on an allowlisted host is fetched and submitted', async () => {
    const fetchImpl = urlFetch({ 'https://files.lab.test/1stp.cif': ok(`${PDB}${PDB}`) });
    const { tools, submitted } = await fixture({ urlHosts: ['files.lab.test'], fetchImpl });

    const out = await runTool(tools, 'foldseek_search',
        { queryUrl: 'https://files.lab.test/1stp.cif', databases: ['db'] });
    assert.equal(out.ticketId, 'FS1');
    assert.deepEqual(out.loaded, { name: '1stp.cif', bytes: PDB.length * 2 });
    assert.equal(fetchImpl.calls[0].redirect, 'manual', 'redirects are inspected, not followed blindly');

    const [[, args]] = submitted;
    assert.equal(args.query, `${PDB}${PDB}`);
    assert.equal(args.queryUrl, undefined, 'a url can carry a presigned signature, so it is not recorded');
    assert.equal(JSON.stringify(out).includes('files.lab.test'), false);
});

test('scheme, host and private addresses are each refused', async () => {
    const fetchImpl = urlFetch({ '*': ok(PDB) });
    const { tools } = await fixture({ urlHosts: ['files.lab.test', '127.0.0.1'], fetchImpl });

    const cases = {
        'http://files.lab.test/a.cif': /use https/,
        'file:///etc/passwd': /use https/,
        'https://evil.test/a.cif': /not in FOLDSEEK_SERVER_URL_HOSTS/,
        'https://169.254.169.254/latest/meta-data/': /not in FOLDSEEK_SERVER_URL_HOSTS/,
        'https://127.0.0.1/a.cif': /private address/,
        'not a url at all': /is not a URL/,
    };
    for (const [url, expected] of Object.entries(cases)) {
        const out = await runTool(tools, 'foldseek_search', { queryUrl: url, databases: ['db'] });
        assert.equal(out.code, 'INPUT_URL_REFUSED', url);
        assert.match(out.error, expected, url);
    }
    assert.equal(fetchImpl.calls.length, 0, 'nothing was requested — every refusal is before the fetch');
});

test('a redirect is re-checked at every hop', async () => {
    const redirect = to => () => ({
        ok: false, status: 302, headers: new Headers({ location: to }), text: async () => '',
    });

    // Hop one stays inside the allowlist; hop two leaves it and must be caught.
    const escaping = urlFetch({
        'https://files.lab.test/a.cif': redirect('https://files.lab.test/b.cif'),
        'https://files.lab.test/b.cif': redirect('https://169.254.169.254/'),
    });
    const away = await fixture({ urlHosts: ['files.lab.test'], fetchImpl: escaping });
    const out = await runTool(away.tools, 'foldseek_search',
        { queryUrl: 'https://files.lab.test/a.cif', databases: ['db'] });
    assert.equal(out.code, 'INPUT_URL_REFUSED');
    assert.match(out.error, /not in FOLDSEEK_SERVER_URL_HOSTS/);

    // A chain that never terminates is bounded rather than followed.
    const looping = urlFetch({ '*': redirect('https://files.lab.test/next') });
    const loop = await fixture({ urlHosts: ['files.lab.test'], fetchImpl: looping });
    const looped = await runTool(loop.tools, 'foldseek_search',
        { queryUrl: 'https://files.lab.test/a.cif', databases: ['db'] });
    assert.equal(looped.code, 'INPUT_URL_REFUSED');
    assert.match(looped.error, /too many redirects/);
    assert.ok(looping.calls.length <= 3);
});

test('the size cap holds whether or not content-length is honest', async () => {
    const big = 'A'.repeat(200);
    const { resolveInputUrl } = await import('foldseek-server-lib');
    const opts = { urlHosts: ['files.lab.test'], maxBytes: 100 };

    // Declared over the cap: refused before the body is touched.
    let touched = false;
    await assert.rejects(() => resolveInputUrl('https://files.lab.test/a.cif', {
        ...opts,
        fetchImpl: async () => ({
            ok: true, status: 200, headers: new Headers({ 'content-length': '200' }),
            text: async () => { touched = true; return big; },
        }),
    }), err => err.code === 'INPUT_URL_REFUSED' && /over 100/.test(err.message));
    assert.equal(touched, false);

    // Lying content-length: caught while counting the body.
    await assert.rejects(() => resolveInputUrl('https://files.lab.test/a.cif', {
        ...opts,
        fetchImpl: async () => ({
            ok: true, status: 200, headers: new Headers({ 'content-length': '10' }),
            text: async () => big,
        }),
    }), err => err.code === 'INPUT_URL_REFUSED');

    // A stream is counted as it arrives and cancelled, not buffered whole.
    let cancelled = false;
    await assert.rejects(() => resolveInputUrl('https://files.lab.test/a.cif', {
        ...opts,
        fetchImpl: async () => ({
            ok: true, status: 200, headers: new Headers(),
            body: { getReader: () => ({
                read: async () => ({ done: false, value: Buffer.from(big) }),
                cancel: async () => { cancelled = true; },
            }) },
        }),
    }), err => err.code === 'INPUT_URL_REFUSED');
    assert.equal(cancelled, true);
});

test('with no allowlist the capability is off and absent from the schema', async () => {
    const { tools } = await fixture({ urlHosts: [] });
    const props = tools.find(t => t.name === 'foldseek_search').inputSchema.properties;
    assert.equal('queryUrl' in props, false);

    const out = await runTool(tools, 'foldseek_search',
        { queryUrl: 'https://files.lab.test/a.cif', databases: ['db'] });
    assert.equal(out.code, 'INPUT_URL_REFUSED');
    assert.match(out.error, /FOLDSEEK_SERVER_URL_HOSTS/);
});

test('foldmason takes fileUrls too', async () => {
    const fetchImpl = urlFetch({
        'https://files.lab.test/a.pdb': ok(PDB), 'https://files.lab.test/b.pdb': ok(PDB),
    });
    const { tools, submitted } = await fixture({ urlHosts: ['files.lab.test'], fetchImpl });

    const out = await runTool(tools, 'foldmason_msa', {
        fileUrls: ['https://files.lab.test/a.pdb', 'https://files.lab.test/b.pdb'],
    });
    assert.equal(out.ticketId, 'FM1');
    assert.deepEqual(submitted.at(-1)[1].files.map(f => f.name), ['a.pdb', 'b.pdb']);
});

test('the url allowlist is comma separated, lower-cased, and empty by default', () => {
    const base = { FOLDSEEK_SERVER_BASE_URL: 'https://example.test' };
    assert.deepEqual(readConfigFromEnv(base).urlHosts, []);
    assert.deepEqual(
        readConfigFromEnv({ ...base, FOLDSEEK_SERVER_URL_HOSTS: 'Files.Lab.test, alphafold.ebi.ac.uk ,' }).urlHosts,
        ['files.lab.test', 'alphafold.ebi.ac.uk']);
});

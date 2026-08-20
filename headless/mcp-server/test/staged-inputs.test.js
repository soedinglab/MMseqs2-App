// POST /input over a real listener, and the ids it hands out used as query inputs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import nodeHttp from 'node:http';
import os from 'node:os';
import path from 'node:path';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { Store, SubmittableQuery, inputsRoot } from 'foldseek-server-lib';
import { createServer, readConfigFromEnv, listenHttp, parseSize } from '../src/server.js';
import { createTools, runTool } from '../src/tools.js';

const PDB = 'ATOM      1  CA  MET A   1       1.000   2.000   3.000  1.00  0.00           C\n';
const TOKEN = 'sekrit-token-value';

const tmp = () => fsp.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-upload-'));

/** A listener with the upload route enabled, and a client whose submissions are recorded. */
async function serving({ token = TOKEN, quotaBytes = 1024 * 1024, ttlSeconds = 3600 } = {}) {
    const stateDir = await tmp();
    const config = readConfigFromEnv({
        FOLDSEEK_SERVER_BASE_URL: 'https://example.test',
        FOLDSEEK_SERVER_STATE_DIR: stateDir,
    });
    const built = createServer({
        ...config,
        fetchImpl: async () => ({ ok: true, status: 200, headers: new Headers(), json: async () => ({ id: 'T1', status: 'PENDING' }), text: async () => '' }),
    });
    const http = await listenHttp(built.server, {
        host: '127.0.0.1',
        port: 0,
        client: built.client,
        staging: token ? { token, quotaBytes, ttlSeconds } : null,
    });
    const { port } = http.address();
    return { http, port, stateDir, store: new Store(stateDir), client: built.client };
}

/** node:http, not fetch: these tests need to set Host and send a raw body. */
function request({ port, method = 'POST', pathname = '/input', headers = {}, body = null }) {
    return new Promise((resolve, reject) => {
        const req = nodeHttp.request({ host: '127.0.0.1', port, method, path: pathname, headers }, (res) => {
            let text = '';
            res.on('data', d => { text += d; });
            res.on('end', () => resolve({
                status: res.statusCode,
                json: (() => { try { return JSON.parse(text); } catch { return null; } })(),
            }));
        });
        req.on('error', reject);
        req.end(body);
    });
}

const upload = (port, body, { token = TOKEN, name = null, host = null } = {}) => request({
    port,
    pathname: name ? `/input?name=${encodeURIComponent(name)}` : '/input',
    headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(host ? { host } : {}),
        'content-type': 'application/octet-stream',
    },
    body,
});

test('parseSize understands gigabytes, which the quota default needs', () => {
    assert.equal(parseSize('1g', { min: 1, max: 2 ** 40 }), 1024 ** 3);
    assert.equal(parseSize('64g', { min: 1, max: 2 ** 40 }), 64 * 1024 ** 3);
    assert.equal(parseSize('16k', { min: 1, max: 2 ** 40 }), 16384);
    assert.equal(parseSize('2m', { min: 1, max: 2 ** 40 }), 2 * 1024 ** 2);
    assert.throws(() => parseSize('1t', { min: 1, max: 2 ** 40, name: 'X' }), /not usable/);
});

test('the three staging variables default, and are range checked', () => {
    const base = { FOLDSEEK_SERVER_BASE_URL: 'https://example.test' };
    const defaults = readConfigFromEnv(base);
    assert.equal(defaults.inputToken, null, 'no token means no upload route');
    assert.equal(defaults.inputTtlSeconds, 3600);
    assert.equal(defaults.inputQuotaBytes, 1024 ** 3);

    const tuned = readConfigFromEnv({
        ...base,
        FOLDSEEK_SERVER_INPUT_TOKEN: 'abc',
        FOLDSEEK_SERVER_INPUT_TTL: '30m',
        FOLDSEEK_SERVER_INPUT_QUOTA: '4g',
    });
    assert.equal(tuned.inputToken, 'abc');
    assert.equal(tuned.inputTtlSeconds, 1800);
    assert.equal(tuned.inputQuotaBytes, 4 * 1024 ** 3);

    for (const [name, values] of Object.entries({
        FOLDSEEK_SERVER_INPUT_TTL: ['299', '8d'],
        FOLDSEEK_SERVER_INPUT_QUOTA: ['1023k', '65g'],
    })) {
        for (const value of values) {
            assert.throws(() => readConfigFromEnv({ ...base, [name]: value }),
                err => err.message.includes(name), `${name}=${value}`);
        }
    }
});

test('an upload returns an id, and the id submits without the bytes going through a tool call', async () => {
    const { http, port, store, client } = await serving();
    try {
        const res = await upload(port, PDB.repeat(20), { name: '1abc.cif' });
        assert.equal(res.status, 201);
        assert.match(res.json.inputId, /^in_[0-9a-f]{16}$/);
        assert.equal(res.json.bytes, PDB.length * 20);
        assert.equal(res.json.name, '1abc.cif');
        assert.ok(Date.parse(res.json.expiresAt) > Date.now());

        const submitted = [];
        client.submitFoldseekSearch = async (a) => { submitted.push(a); return { id: 'FS1', status: 'PENDING' }; };
        client.query = (spec, opts) => new SubmittableQuery(client, spec, opts);
        const tools = createTools(client, { staging: { ttlSeconds: 3600 } });

        const out = await runTool(tools, 'foldseek_search',
            { inputId: res.json.inputId, databases: ['db'] });
        assert.equal(out.ticketId, 'FS1');
        assert.deepEqual(out.loaded, { name: '1abc.cif', bytes: PDB.length * 20 });
        assert.equal(submitted[0].query, PDB.repeat(20));
        assert.equal(submitted[0].inputId, undefined, 'the id is a handle, not part of the submission');
        assert.equal(JSON.stringify(out).includes('in_'), false, 'and it is not echoed back');

        // Still there: one upload backs several searches.
        assert.ok(fs.existsSync(path.join(inputsRoot(store), res.json.inputId)));
        assert.equal((await runTool(tools, 'foldseek_search',
            { inputId: res.json.inputId, databases: ['db'] })).ticketId, 'FS1');
    } finally {
        http.close();
    }
});

test('the route refuses everything it should, and leaves nothing behind', async () => {
    const { http, port, store } = await serving({ quotaBytes: 4096 });
    try {
        assert.equal((await upload(port, PDB, { token: null })).status, 401);
        assert.equal((await upload(port, PDB, { token: 'wrong' })).status, 401);
        assert.equal((await upload(port, PDB, { token: `${TOKEN}extra` })).status, 401);
        assert.equal((await request({ port, method: 'GET' })).status, 405);
        assert.equal((await upload(port, PDB, { host: 'evil.example' })).status, 403);
        assert.equal((await upload(port, '')).status, 400, 'an empty body is not an input');

        const over = await upload(port, 'A'.repeat(5000));
        assert.equal(over.status, 507);
        assert.equal(over.json.code, 'INPUT_QUOTA_EXCEEDED');

        assert.deepEqual(fs.readdirSync(inputsRoot(store)).filter(n => n !== '.'), [],
            'no scratch directory and no input survived a refusal');
    } finally {
        http.close();
    }
});

test('with no token the route does not exist, rather than asking for one', async () => {
    const { http, port } = await serving({ token: null });
    try {
        // 404, not 401: an unconfigured deployment must not advertise a write endpoint.
        const res = await upload(port, PDB, { token: null });
        assert.notEqual(res.status, 401);
        assert.notEqual(res.status, 201);

        const withToken = await upload(port, PDB);
        assert.notEqual(withToken.status, 201);
    } finally {
        http.close();
    }
});

test('the MCP endpoint is unaffected by the route sharing its port', async () => {
    const { http, port } = await serving();
    const client = new Client({ name: 'upload-test', version: '0' }, { capabilities: {} });
    try {
        await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/`)));
        const { tools } = await client.listTools();
        assert.equal(tools.length, 11, 'still eleven tools');
        assert.ok(tools.find(t => t.name === 'foldseek_search'));

        // And an upload still works after MCP traffic on the same listener.
        assert.equal((await upload(port, PDB)).status, 201);
    } finally {
        await client.close().catch(() => {});
        http.close();
    }
});

test('the id arguments appear only when staging is enabled', () => {
    const off = createTools({ store: null }, {});
    const on = createTools({ store: null }, { staging: { ttlSeconds: 3600 } });
    const props = (tools, name) => tools.find(t => t.name === name).inputSchema.properties;

    for (const name of ['foldseek_search', 'multimer_search', 'folddisco_search']) {
        assert.equal('inputId' in props(off, name), false, name);
        assert.equal('inputId' in props(on, name), true, name);
    }
    assert.equal('inputIds' in props(off, 'foldmason_msa'), false);
    assert.equal('inputIds' in props(on, 'foldmason_msa'), true);
});

test('an unknown id is refused, and two ids feed one FoldMason job', async () => {
    const { http, port, client } = await serving();
    try {
        const a = (await upload(port, PDB, { name: 'a.pdb' })).json.inputId;
        const b = (await upload(port, PDB, { name: 'b.pdb' })).json.inputId;

        const submitted = [];
        client.submitFoldMason = async (x) => { submitted.push(x); return { id: 'FM1', status: 'PENDING' }; };
        client.submitFoldseekSearch = async () => ({ id: 'FS1', status: 'PENDING' });
        client.query = (spec, opts) => new SubmittableQuery(client, spec, opts);
        const tools = createTools(client, { staging: { ttlSeconds: 3600 } });

        const msa = await runTool(tools, 'foldmason_msa', { inputIds: [a, b] });
        assert.equal(msa.ticketId, 'FM1');
        assert.deepEqual(submitted[0].files.map(f => f.name), ['a.pdb', 'b.pdb']);

        const unknown = await runTool(tools, 'foldseek_search',
            { inputId: 'in_0000000000000000', databases: ['db'] });
        assert.equal(unknown.code, 'INPUT_ID_UNKNOWN');

        // validateOnly resolves the id and reports without submitting.
        const before = submitted.length;
        const checked = await runTool(tools, 'foldmason_msa', { inputIds: [a, b], validateOnly: true });
        assert.equal(submitted.length, before, 'nothing was queued');
        assert.ok(checked.ok !== undefined || checked.valid !== undefined || checked.files);
    } finally {
        http.close();
    }
});

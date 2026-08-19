// Which transport the flag selects, and that both serve the same surface.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import nodeHttp from 'node:http';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import {
    createServer, readConfigFromEnv, readTransportFromArgv, listenHttp, assertTransportAllows,
} from '../src/server.js';

const TOOLS = [
    'export_result', 'folddisco_search', 'foldmason_msa', 'foldseek_search',
    'get_result_summary', 'get_ticket_status', 'list_databases', 'multimer_search',
    'select_hits', 'select_msa_columns', 'send_to',
];

test('the flag selects the transport, and refuses a guessed address', () => {
    assert.deepEqual(readTransportFromArgv([]), { kind: 'stdio' });
    assert.deepEqual(readTransportFromArgv(['--gc']), { kind: 'stdio' });
    assert.deepEqual(readTransportFromArgv(['--http', '--host', '127.0.0.1', '--port', '8080']),
        { kind: 'http', host: '127.0.0.1', port: 8080 });

    for (const argv of [['--http'], ['--http', '--port', '8080'], ['--http', '--host', '127.0.0.1']]) {
        assert.throws(() => readTransportFromArgv(argv), /needs an explicit --host and --port/,
            argv.join(' '));
    }
    for (const port of ['0', '65536', 'eighty', '80.5']) {
        assert.throws(() => readTransportFromArgv(['--http', '--host', 'localhost', '--port', port]),
            /is not a port number/, port);
    }
});

test('an http handshake serves the same eleven tools and reads a resource', async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-http-'));
    const config = readConfigFromEnv({
        FOLDSEEK_SERVER_BASE_URL: 'https://example.test',
        FOLDSEEK_SERVER_STATE_DIR: stateDir,
    });
    // The fixture client, so no network is involved in the transport's own test.
    const built = createServer({ ...config, fetchImpl: fixtureFetch() });
    const http = await listenHttp(built.server, { host: '127.0.0.1', port: 0 });
    const { port } = http.address();

    const client = new Client({ name: 'http-test', version: '0' }, { capabilities: {} });
    try {
        await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/`)));

        const { tools } = await client.listTools();
        assert.deepEqual(tools.map(t => t.name).sort(), TOOLS);

        const { resourceTemplates } = await client.listResourceTemplates();
        assert.equal(resourceTemplates[0].uriTemplate, 'foldseek-artifact://{artifactId}/{path}');

        const exported = JSON.parse((await client.callTool({
            name: 'export_result', arguments: { ticketId: 'T1abcd' },
        })).content[0].text);
        const read = await client.readResource({ uri: exported.manifestUri });
        assert.equal(JSON.parse(read.contents[0].text).artifactId, exported.artifactId);
    } finally {
        await client.close().catch(() => {});
        http.close();
        await new Promise(resolve => http.once('close', resolve));
    }
});

test('a port that is already taken fails at startup rather than serving nothing', async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-http-'));
    const config = readConfigFromEnv({
        FOLDSEEK_SERVER_BASE_URL: 'https://example.test',
        FOLDSEEK_SERVER_STATE_DIR: stateDir,
    });
    const first = await listenHttp(createServer(config).server, { host: '127.0.0.1', port: 0 });
    const { port } = first.address();
    try {
        await assert.rejects(() => listenHttp(createServer(config).server, { host: '127.0.0.1', port }),
            err => err.code === 'EADDRINUSE');
    } finally {
        first.close();
    }
});

test('a path allowlist and a non-loopback bind are refused together', () => {
    const withDirs = { inputDirs: ['/data/structures'] };
    const without = { inputDirs: [] };

    // The unsafe combination: a remote caller would be naming files on the server's disk.
    for (const host of ['0.0.0.0', '192.168.1.10', 'structures.example.org', '::']) {
        assert.throws(() => assertTransportAllows(withDirs, { kind: 'http', host, port: 8080 }),
            err => /FOLDSEEK_SERVER_INPUT_DIRS/.test(err.message) && /not loopback/.test(err.message), host);
    }

    // Loopback HTTP is the same machine, so it is exactly as safe as stdio.
    for (const host of ['127.0.0.1', '127.0.0.53', '::1', 'localhost', 'LOCALHOST']) {
        assert.doesNotThrow(() => assertTransportAllows(withDirs, { kind: 'http', host, port: 8080 }), host);
    }
    assert.doesNotThrow(() => assertTransportAllows(withDirs, { kind: 'stdio' }));

    // With the capability off, any bind address is fine.
    assert.doesNotThrow(() => assertTransportAllows(without, { kind: 'http', host: '0.0.0.0', port: 80 }));
});

test('the path arguments are advertised only when they can work', async () => {
    const { createTools } = await import('../src/tools.js');
    const off = createTools({}, { inputDirs: [] });
    const on = createTools({}, { inputDirs: ['/data'] });

    const props = (tools, name) => tools.find(t => t.name === name).inputSchema.properties;
    for (const name of ['foldseek_search', 'multimer_search', 'folddisco_search']) {
        assert.equal('queryPath' in props(off, name), false, `${name} must not offer it when off`);
        assert.equal('queryPath' in props(on, name), true, name);
        assert.equal('query' in props(off, name), true, 'query text always works');
        assert.equal('accession' in props(off, name), true, 'and so does an accession');
    }
    assert.equal('filePaths' in props(off, 'foldmason_msa'), false);
    assert.equal('filePaths' in props(on, 'foldmason_msa'), true);
    assert.equal('files' in props(off, 'foldmason_msa'), true);
});

/** Enough of the backend to build one artifact. */
function fixtureFetch() {
    const rows = { db: ['bfmd'], results: [{ db: 'bfmd', alignments: [[]] }] };
    return async (url) => ({
        ok: true,
        status: 200,
        json: async () => (url.includes('/ticket/type/') ? { type: 'structuresearch' }
            : url.includes('/databases') ? [{ path: 'bfmd', name: 'BFMD', status: 'COMPLETE' }]
                : url.includes('/result/') ? rows
                    : { id: 'T1abcd', status: 'COMPLETE' }),
        text: async () => '',
    });
}

test('the rebinding guard refuses a Host header that is not the bound address', async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-http-'));
    const config = readConfigFromEnv({
        FOLDSEEK_SERVER_BASE_URL: 'https://example.test',
        FOLDSEEK_SERVER_STATE_DIR: stateDir,
    });
    const http = await listenHttp(createServer(config).server, { host: '127.0.0.1', port: 0 });
    const { port } = http.address();
    // node:http, not fetch: undici will not let a caller set Host, which is the whole subject here.
    const post = (hostHeader) => new Promise((resolve, reject) => {
        const req = nodeHttp.request({
            host: '127.0.0.1',
            port,
            method: 'POST',
            path: '/',
            headers: {
                'content-type': 'application/json',
                accept: 'application/json, text/event-stream',
                host: hostHeader,
            },
        }, (res) => {
            let body = '';
            res.on('data', d => { body += d; });
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.on('error', reject);
        req.end(JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'x', version: '0' } },
        }));
    });

    try {
        const bad = await post('evil.example');
        assert.equal(bad.status, 403);
        assert.match(bad.body, /Invalid Host header/);

        const good = await post(`127.0.0.1:${port}`);
        assert.equal(good.status, 200, 'the bound address is admitted');
    } finally {
        http.close();
    }
});

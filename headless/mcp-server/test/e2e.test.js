// End-to-end over real MCP: spawns bin/mmseqs2-agent-mcp.js as a child process and drives it with
// the SDK's own client over stdio. tools.test.js covers what the handlers do; this covers the parts
// only a real transport exercises — the handshake, the advertised schemas, JSON round-tripping, and
// that a startup failure is reported instead of hanging.
//
// Needs a reachable backend, so it is opt-in like the core live tests:
//   MMSEQS2_AGENT_LIVE_TESTS=1 \
//   MMSEQS2_AGENT_BASE_URL=https://search.foldseek.com \
//   node --test test/
//
// Read-only throughout: it inspects existing tickets and never submits a job.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { readConfigFromEnv } from '../src/server.js';

const LIVE = process.env.MMSEQS2_AGENT_LIVE_TESTS === '1';
const BASE_URL = process.env.MMSEQS2_AGENT_BASE_URL || 'http://localhost:3000';
const TICKET = process.env.MMSEQS2_AGENT_LIVE_TICKET || 'zXdtIy4ZBaW9CmHXTKyfeMdLSDBOlvftku3N5g';

const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'mmseqs2-agent-mcp.js');

async function connect(extraEnv = {}) {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mmseqs2-agent-e2e-'));
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: [BIN],
        env: { ...process.env, MMSEQS2_AGENT_BASE_URL: BASE_URL, MMSEQS2_AGENT_STATE_DIR: stateDir, ...extraEnv },
    });
    const client = new Client({ name: 'e2e-test', version: '0.0.0' }, { capabilities: {} });
    await client.connect(transport);
    return { client, stateDir };
}

/** Tool results arrive as a text content block holding JSON. */
function payload(result) {
    assert.equal(result.content?.[0]?.type, 'text', 'expected a text content block');
    return JSON.parse(result.content[0].text);
}

test('e2e: the server completes the MCP handshake and advertises its tools', { skip: !LIVE }, async () => {
    const { client } = await connect();
    try {
        const { tools } = await client.listTools();
        const names = tools.map(t => t.name);

        assert.deepEqual(names.sort(), [
            'export_result', 'folddisco_search', 'foldmason_msa', 'foldseek_search',
            'get_result_summary', 'get_ticket_status', 'list_databases', 'multimer_search',
            'select_hits', 'select_msa_columns', 'send_to',
        ]);
        for (const tool of tools) {
            assert.ok(tool.description?.length > 20, `${tool.name} needs a description`);
            assert.equal(tool.inputSchema.type, 'object', `${tool.name} schema must survive the wire`);
        }
    } finally {
        await client.close();
    }
});

test('e2e: list_databases returns real databases through the transport', { skip: !LIVE }, async () => {
    const { client } = await connect();
    try {
        const data = payload(await client.callTool({ name: 'list_databases', arguments: {} }));
        assert.ok(data.databases.length > 0);
        assert.ok(data.databases.every(d => typeof d.path === 'string'));
    } finally {
        await client.close();
    }
});

test('e2e: status, summary and export work on a real ticket', { skip: !LIVE }, async () => {
    const { client } = await connect();
    try {
        const status = payload(await client.callTool({
            name: 'get_ticket_status', arguments: { ticketId: TICKET },
        }));
        assert.equal(status.ticketId, TICKET);
        assert.ok(['PENDING', 'RUNNING', 'COMPLETE', 'ERROR', 'UNKNOWN'].includes(status.status));
        if (status.status !== 'COMPLETE') return;
        assert.equal(status.resultKind, 'search');

        const summary = payload(await client.callTool({
            name: 'get_result_summary', arguments: { ticketId: TICKET },
        }));
        assert.equal(summary.schema, 'mmseqs2-agent/result-summary@1');
        assert.ok(summary.counts.parsedRows > 0);
        assert.ok(summary.databases.some(d => d.topHit?.target));
        assert.ok(JSON.stringify(summary).length < 8000, 'a summary stays small on real data');

        const artifact = payload(await client.callTool({
            name: 'export_result', arguments: { ticketId: TICKET },
        }));
        assert.match(artifact.artifactId, /^[0-9a-f]{64}$/);
        assert.equal(artifact.counts.parsedRows, summary.counts.parsedRows,
            'the summary and the manifest agree on real data');

        // A real transport carries the links alongside the JSON, contents not included.
        const exported = await client.callTool({ name: 'export_result', arguments: { ticketId: TICKET } });
        const links = exported.content.filter(c => c.type === 'resource_link');
        assert.equal(links.length, artifact.files.length);
        assert.ok(links.every(l => l.text === undefined && l.blob === undefined));

        // A row file is over the read cap on real data, and the refusal says where to read it instead.
        const rows = artifact.files.find(f => f.role === 'rows');
        await assert.rejects(() => client.readResource({ uri: `${artifact.uri}${rows.path}` }),
            err => /RESOURCE_TOO_LARGE/.test(err.message) && /artifactRoot or localPath/.test(err.message));

        // And the handshake works: one read of localPath, and its id must equal the handle.
        assert.equal(artifact.localPathVerified, false);
        const local = JSON.parse(await fs.readFile(artifact.localPath, 'utf8'));
        assert.equal(local.artifactId, artifact.artifactId);
        assert.equal(rows.rows,
            (await fs.readFile(path.join(artifact.artifactRoot, rows.path), 'utf8')).trim().split('\n').length);
    } finally {
        await client.close();
    }
});

test('e2e: a tool failure comes back as an error result, not a broken connection', { skip: !LIVE }, async () => {
    const { client } = await connect();
    try {
        const result = await client.callTool({
            name: 'get_result_summary', arguments: { ticketId: 'NOSUCHTICKETATALL' },
        });
        assert.equal(result.isError, true);
        assert.ok(payload(result).error, 'the reason should survive to the caller');

        // The connection must still be usable afterwards.
        const after = payload(await client.callTool({ name: 'list_databases', arguments: {} }));
        assert.ok(after.databases.length > 0);
    } finally {
        await client.close();
    }
});

test('e2e: an unknown tool name is reported without killing the server', { skip: !LIVE }, async () => {
    const { client } = await connect();
    try {
        await assert.rejects(() => client.callTool({ name: 'not_a_tool', arguments: {} }));
        const { tools } = await client.listTools();
        assert.ok(tools.length > 0, 'the server should still be answering');
    } finally {
        await client.close();
    }
});

test('e2e: a ticket read through the transport lands in the local cache', { skip: !LIVE }, async () => {
    const { client, stateDir } = await connect();
    try {
        await client.callTool({ name: 'get_ticket_status', arguments: { ticketId: TICKET } });

        // On disk, under the sharded layout, in the state dir this server was given.
        const dir = path.join(stateDir, 'tickets', TICKET.slice(0, 2), TICKET.slice(2, 4), TICKET);
        assert.ok((await fs.readdir(dir)).includes('ticket.json'));
    } finally {
        await client.close();
    }
});

test('e2e: the server refuses to start without a base URL', { skip: !LIVE }, async () => {
    // No MMSEQS2_AGENT_BASE_URL: it must exit with a readable reason on stderr rather than serve
    // requests against some compiled-in default.
    const { spawn } = await import('node:child_process');
    const env = { ...process.env };
    delete env.MMSEQS2_AGENT_BASE_URL;

    const child = spawn(process.execPath, [BIN], { env, stdio: ['pipe', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', d => { stderr += d; });
    const code = await new Promise(resolve => child.on('exit', resolve));

    assert.notEqual(code, 0, 'a missing base URL must be a startup failure');
    assert.match(stderr, /MMSEQS2_AGENT_BASE_URL is required/);
});

// --- configuration: two durations, range-checked at startup, never silently clamped --------------

test('the TTLs default, take duration strings, and are refused outside their range', () => {
    const base = { MMSEQS2_AGENT_BASE_URL: 'https://example.test' };

    const defaults = readConfigFromEnv(base);
    assert.deepEqual(defaults.artifacts, { ttlSeconds: 1800, exposeLocalPaths: true });
    assert.equal(defaults.resultTtlSeconds, 86400);
    assert.equal(defaults.resourceMaxBytes, 16 * 1024);
    assert.equal(defaults.resultRowCap, null, 'the row cap is only set deliberately');

    // Derived data expires fast, fetched data slowly — thirty minutes against a day.
    assert.ok(defaults.artifacts.ttlSeconds < defaults.resultTtlSeconds);

    const tuned = readConfigFromEnv({
        ...base,
        MMSEQS2_AGENT_ARTIFACT_TTL: '90s',
        MMSEQS2_AGENT_RESULT_TTL: '7d',
        MMSEQS2_AGENT_LOCAL_PATHS: '0',
        MMSEQS2_AGENT_RESOURCE_MAX_BYTES: '2m',
        MMSEQS2_AGENT_RESULT_ROW_CAP: '500',
    });
    assert.deepEqual(tuned.artifacts, { ttlSeconds: 90, exposeLocalPaths: false });
    assert.equal(tuned.resultTtlSeconds, 7 * 86400);
    assert.equal(tuned.resourceMaxBytes, 2 * 1024 * 1024);
    assert.equal(tuned.resultRowCap, 500);

    for (const [raw, bytes] of [['4096', 4096], ['16k', 16384], ['1m', 1048576]]) {
        assert.equal(readConfigFromEnv({ ...base, MMSEQS2_AGENT_RESOURCE_MAX_BYTES: raw }).resourceMaxBytes,
            bytes, `${raw} should parse`);
    }

    for (const [raw, seconds] of [['600', 600], ['30m', 1800], ['2h', 7200], ['1d', 86400]]) {
        assert.equal(readConfigFromEnv({ ...base, MMSEQS2_AGENT_ARTIFACT_TTL: raw }).artifacts.ttlSeconds,
            seconds, `${raw} should parse`);
    }

    const outOfRange = {
        MMSEQS2_AGENT_ARTIFACT_TTL: ['59', '8d', '0', '-1', 'soon', '30.5m', '30 m', '1w', ''],
        MMSEQS2_AGENT_RESULT_TTL: ['30s', '31d'],
        MMSEQS2_AGENT_RESULT_ROW_CAP: ['0', '-5'],
        MMSEQS2_AGENT_RESOURCE_MAX_BYTES: ['1023', '33m', '16 k', '2g', 'lots'],
    };
    for (const [name, values] of Object.entries(outOfRange)) {
        for (const value of values) {
            if (value === '') continue;                 // empty means unset, which is the default
            assert.throws(() => readConfigFromEnv({ ...base, [name]: value }),
                err => err.message.includes(name) && /between \d+ and \d+/.test(err.message),
                `${name}=${value} should name the variable and its range`);
        }
    }
    assert.equal(readConfigFromEnv({ ...base, MMSEQS2_AGENT_ARTIFACT_TTL: '' }).artifacts.ttlSeconds, 1800);
    assert.throws(() => readConfigFromEnv({ ...base, MMSEQS2_AGENT_LOCAL_PATHS: 'maybe' }),
        /MMSEQS2_AGENT_LOCAL_PATHS/);
});

test('the eleven tools and the resource capability survive a real handshake, and stdout stays clean', async () => {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mmseqs2-agent-e2e-'));
    const transport = new StdioClientTransport({
        command: process.execPath,
        args: [BIN],
        env: {
            ...process.env,
            MMSEQS2_AGENT_BASE_URL: 'http://127.0.0.1:9',      // discard port: nothing will connect
            MMSEQS2_AGENT_STATE_DIR: stateDir,
        },
        stderr: 'pipe',
    });
    const client = new Client({ name: 'surface-test', version: '0' }, { capabilities: {} });

    try {
        await client.connect(transport);

        const { tools } = await client.listTools();
        assert.equal(tools.length, 11);
        assert.deepEqual(tools.map(t => t.name).sort(), [
            'export_result', 'folddisco_search', 'foldmason_msa', 'foldseek_search',
            'get_result_summary', 'get_ticket_status', 'list_databases', 'multimer_search',
            'select_hits', 'select_msa_columns', 'send_to',
        ]);

        // Resources are advertised even before anything has been exported.
        const { resources } = await client.listResources();
        assert.deepEqual(resources, []);
        const { resourceTemplates } = await client.listResourceTemplates();
        assert.equal(resourceTemplates[0].uriTemplate, 'mmseqs2-artifact://{artifactId}/{path}');

        // A tool that fails, and an unreadable resource: neither may break the stream.
        const failed = await client.callTool({ name: 'get_result_summary', arguments: { ticketId: 'T1abcd' } });
        assert.equal(failed.isError, true);
        await assert.rejects(() => client.readResource({ uri: 'mmseqs2-artifact://nope/manifest.json' }));

        // The connection is still usable, which is what "stdout stayed clean" means in practice: any
        // stray write would have desynchronised the framing by now.
        assert.equal((await client.listTools()).tools.length, 11);
    } finally {
        await client.close().catch(() => {});
        await fs.rm(stateDir, { recursive: true, force: true });
    }
});

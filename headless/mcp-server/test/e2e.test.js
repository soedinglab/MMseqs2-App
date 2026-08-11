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

        for (const expected of [
            'list_databases', 'foldseek_search', 'foldmason_msa', 'folddisco_search',
            'submit_ticket', 'get_ticket_status', 'get_result_table', 'get_foldmason_result',
            'get_queries', 'list_cached_tickets',
        ]) {
            assert.ok(names.includes(expected), `${expected} should be advertised`);
        }
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

test('e2e: get_ticket_status and get_result_table work on a real ticket', { skip: !LIVE }, async () => {
    const { client } = await connect();
    try {
        const status = payload(await client.callTool({
            name: 'get_ticket_status', arguments: { ticketId: TICKET },
        }));
        assert.equal(status.ticketId, TICKET);
        assert.ok(['PENDING', 'RUNNING', 'COMPLETE', 'ERROR', 'UNKNOWN'].includes(status.status));
        if (status.status !== 'COMPLETE') return;

        const table = payload(await client.callTool({
            name: 'get_result_table', arguments: { ticketId: TICKET, db: '*', limit: 2 },
        }));
        assert.equal(table.ok, true);
        assert.ok(table.databases.length > 0);
        for (const db of table.databases) {
            assert.ok(db.total >= db.returned);
            for (const row of db.rows ?? []) assert.ok(row.target);
        }
    } finally {
        await client.close();
    }
});

test('e2e: a tool failure comes back as an error result, not a broken connection', { skip: !LIVE }, async () => {
    const { client } = await connect();
    try {
        const result = await client.callTool({
            name: 'get_result_table', arguments: { ticketId: 'NOSUCHTICKETATALL' },
        });
        assert.equal(result.isError, true);
        assert.ok(payload(result).error, 'the reason should survive to the caller');

        // The connection must still be usable afterwards.
        const after = payload(await client.callTool({ name: 'list_cached_tickets', arguments: { limit: 1 } }));
        assert.ok(Array.isArray(after.tickets));
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
        const listed = payload(await client.callTool({ name: 'list_cached_tickets', arguments: { limit: 10 } }));
        assert.ok(listed.tickets.some(t => t.ticketId === TICKET), 'the ticket should now be cached');

        // And on disk, under the sharded layout, in the state dir this server was given.
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

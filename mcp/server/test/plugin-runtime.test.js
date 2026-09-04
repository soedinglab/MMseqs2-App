import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = (command, args, cwd) => execFileSync(command, args,
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

test('the plugin runtime is minimal, deterministic and serves the complete tool surface', async () => {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'foldseek-plugin-runtime-test-'));
    const first = path.join(temp, 'first.zip');
    const second = path.join(temp, 'second.zip');
    run('node', [path.join(SERVER, 'pack-plugin-runtime.mjs'), first], SERVER);
    run('node', [path.join(SERVER, 'pack-plugin-runtime.mjs'), second], SERVER);
    assert.deepEqual(await fs.readFile(first), await fs.readFile(second), 'two builds must be byte-identical');

    const listing = run('unzip', ['-Z1', first], SERVER).trim().split('\n');
    assert.deepEqual(listing, [
        'LICENSE',
        'THIRD_PARTY_NOTICES.md',
        'scripts/foldseek-server-mcp.js',
        'dist/server.mjs',
        'package.json',
    ]);

    const unpacked = path.join(temp, 'runtime');
    await fs.mkdir(unpacked);
    run('unzip', ['-q', first, '-d', unpacked], SERVER);
    const pkg = JSON.parse(await fs.readFile(path.join(unpacked, 'package.json'), 'utf8'));
    assert.equal(pkg.private, true);
    assert.equal(pkg.dependencies, undefined);
    const notices = await fs.readFile(path.join(unpacked, 'THIRD_PARTY_NOTICES.md'), 'utf8');
    assert.match(notices, /@modelcontextprotocol\/sdk/);
    assert.match(notices, /\bzod\b/);

    const state = path.join(temp, 'state');
    const transport = new StdioClientTransport({
        command: path.join(unpacked, 'scripts', 'foldseek-server-mcp.js'),
        env: { ...process.env, FOLDSEEK_SERVER_BASE_URL: 'http://127.0.0.1:9',
            FOLDSEEK_SERVER_STATE_DIR: state },
        stderr: 'pipe',
    });
    const client = new Client({ name: 'plugin-runtime-test', version: '0' }, { capabilities: {} });
    await client.connect(transport);
    try {
        const { tools } = await client.listTools();
        assert.deepEqual(tools.map((tool) => tool.name).sort(), [
            'export_result', 'folddisco_search', 'foldmason_msa', 'foldseek_search',
            'get_result_summary', 'get_ticket_status', 'list_databases', 'multimer_search',
            'select_hits', 'select_msa_columns', 'send_to',
        ]);
    } finally {
        await client.close().catch(() => {});
    }
});

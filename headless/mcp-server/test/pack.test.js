// The package as a consumer gets it: built, packed, installed outside the repo, driven over stdio.
//
// Slow and network-bound (npm install), so opt in:
//   MMSEQS2_AGENT_PACK_TEST=1 node --test test/pack.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const RUN = process.env.MMSEQS2_AGENT_PACK_TEST === '1';
const PKG = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = process.env.MMSEQS2_AGENT_BASE_URL || 'http://127.0.0.1:9';

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/** Build, pack, install into a throwaway prefix. Returns the installed bin path. */
async function install() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'mmseqs2-agent-pack-'));
    run('npm', ['run', 'build'], PKG);
    const tarball = run('npm', ['pack', '--pack-destination', dir], PKG).trim().split('\n').pop();
    await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({ name: 'consumer', private: true }));
    run('npm', ['install', '--no-audit', '--no-fund', path.join(dir, tarball)], dir);
    return { dir, bin: path.join(dir, 'node_modules', '.bin', 'mmseqs2-agent-mcp'), tarball };
}

async function connect(bin, env = {}) {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mmseqs2-agent-pack-state-'));
    const transport = new StdioClientTransport({
        command: bin,
        env: { ...process.env, MMSEQS2_AGENT_BASE_URL: BASE_URL, MMSEQS2_AGENT_STATE_DIR: stateDir, ...env },
        stderr: 'pipe',
    });
    const client = new Client({ name: 'pack-test', version: '0' }, { capabilities: {} });
    await client.connect(transport);
    return client;
}

test('the packed tarball installs outside the repo and serves the whole surface', { skip: !RUN }, async () => {
    const { dir, bin, tarball } = await install();
    assert.match(tarball, /^mmseqs2-agent-mcp-\d+\.\d+\.\d+\.tgz$/);

    // Nothing from the workspace came along: the SDK is the only dependency, core is inlined.
    const installed = JSON.parse(await fs.readFile(
        path.join(dir, 'node_modules', 'mmseqs2-agent-mcp', 'package.json'), 'utf8'));
    assert.deepEqual(Object.keys(installed.dependencies), ['@modelcontextprotocol/sdk']);
    assert.equal(installed.type, 'module');
    assert.equal(await fs.access(path.join(dir, 'node_modules', 'mmseqs2-agent-core'))
        .then(() => true).catch(() => false), false, 'core is not a package anyone resolves');

    const client = await connect(bin);
    try {
        const { tools } = await client.listTools();
        assert.equal(tools.length, 11);
        assert.deepEqual(tools.map(t => t.name).sort(), [
            'export_result', 'folddisco_search', 'foldmason_msa', 'foldseek_search',
            'get_result_summary', 'get_ticket_status', 'list_databases', 'multimer_search',
            'select_hits', 'select_msa_columns', 'send_to',
        ]);

        const { resourceTemplates } = await client.listResourceTemplates();
        assert.equal(resourceTemplates[0].uriTemplate, 'mmseqs2-artifact://{artifactId}/{path}');

        if (process.env.MMSEQS2_AGENT_BASE_URL) {
            const out = await client.callTool({ name: 'list_databases', arguments: {} });
            const data = JSON.parse(out.content[0].text);
            assert.ok(data.databases.length > 0, 'a real call works from the installed package');
        }
    } finally {
        await client.close().catch(() => {});
    }
});

test('dropping "type": "module" names the cause on stderr', { skip: !RUN }, async () => {
    const { dir, bin } = await install();
    const manifest = path.join(dir, 'node_modules', 'mmseqs2-agent-mcp', 'package.json');
    const broken = JSON.parse(await fs.readFile(manifest, 'utf8'));
    delete broken.type;
    await fs.writeFile(manifest, JSON.stringify(broken));

    // The trap this guards: a host shows only "Connection closed" and the operator has nothing to go on.
    const { spawn } = await import('node:child_process');
    const child = spawn(bin, [], {
        env: { ...process.env, MMSEQS2_AGENT_BASE_URL: BASE_URL },
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', d => { stderr += d; });
    const code = await new Promise(resolve => child.on('exit', resolve));

    assert.notEqual(code, 0);
    assert.match(stderr, /Cannot use import statement outside a module/);
    assert.match(stderr, /"type": "module"/, 'node names the fix');
});

test('core declares no dependencies, so nothing has to resolve it at runtime', async () => {
    const core = JSON.parse(await fs.readFile(path.join(PKG, '..', 'core', 'package.json'), 'utf8'));
    assert.equal(core.dependencies, undefined, 'msa-webgpu is bundled; axios was removed at the source');
    assert.equal(core.private, true, 'core cannot be published: it imports frontend/lib by relative path');

    const server = JSON.parse(await fs.readFile(path.join(PKG, 'package.json'), 'utf8'));
    assert.deepEqual(Object.keys(server.dependencies), ['@modelcontextprotocol/sdk']);
    assert.deepEqual(server.files, ['dist/', 'bin/', 'README.md', 'LICENSE'],
        'GPL: the licence travels with the distribution');
    assert.equal(server.scripts.prepublishOnly, 'node build.mjs', 'the bundle is built, never committed');
});

// The package as a consumer gets it: built, packed, installed outside the repo, driven over stdio.
//
// Slow and network-bound (npm install), so opt in:
//   FOLDSEEK_SERVER_PACK_TEST=1 node --test test/pack.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const RUN = process.env.FOLDSEEK_SERVER_PACK_TEST === '1';
const PKG = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = process.env.FOLDSEEK_SERVER_BASE_URL || 'http://127.0.0.1:9';

const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

/** Build, pack, install into a throwaway prefix. Returns the installed bin path. */
async function install() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-pack-'));
    run('npm', ['run', 'build'], PKG);
    const tarball = run('npm', ['pack', '--pack-destination', dir], PKG).trim().split('\n').pop();
    await fs.writeFile(path.join(dir, 'package.json'), JSON.stringify({ name: 'consumer', private: true }));
    run('npm', ['install', '--no-audit', '--no-fund', path.join(dir, tarball)], dir);
    return { dir, bin: path.join(dir, 'node_modules', '.bin', 'foldseek-server-mcp'), tarball };
}

async function connect(bin, env = {}) {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-pack-state-'));
    const transport = new StdioClientTransport({
        command: bin,
        env: { ...process.env, FOLDSEEK_SERVER_BASE_URL: BASE_URL, FOLDSEEK_SERVER_STATE_DIR: stateDir, ...env },
        stderr: 'pipe',
    });
    const client = new Client({ name: 'pack-test', version: '0' }, { capabilities: {} });
    await client.connect(transport);
    return client;
}

test('the packed tarball installs outside the repo and serves the whole surface', { skip: !RUN }, async () => {
    const { dir, bin, tarball } = await install();
    assert.match(tarball, /^foldseek-server-mcp-\d+\.\d+\.\d+\.tgz$/);
    assert.ok((await fs.stat(path.join(dir, tarball))).size < 512 * 1024,
        'the Desktop bundle must not ride along in the npm tarball');

    // Nothing from the workspace came along: the SDK is the only dependency, core is inlined.
    const installed = JSON.parse(await fs.readFile(
        path.join(dir, 'node_modules', 'foldseek-server-mcp', 'package.json'), 'utf8'));
    assert.deepEqual(Object.keys(installed.dependencies), ['@modelcontextprotocol/sdk']);
    assert.equal(installed.type, 'module');
    assert.equal(await fs.access(path.join(dir, 'node_modules', 'foldseek-server-lib'))
        .then(() => true).catch(() => false), false, 'the lib is not a package anyone resolves');

    // The npm page is the short README; the reference is repo-only.
    assert.match(await fs.readFile(path.join(dir, 'node_modules', 'foldseek-server-mcp', 'README.md'), 'utf8'),
        /^# foldseek-server-mcp/);
    assert.equal(await fs.access(path.join(dir, 'node_modules', 'foldseek-server-mcp', 'REFERENCE.md'))
        .then(() => true).catch(() => false), false, 'the reference does not ship');

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
        assert.equal(resourceTemplates[0].uriTemplate, 'foldseek-artifact://{artifactId}/{path}');

        if (process.env.FOLDSEEK_SERVER_BASE_URL) {
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
    const manifest = path.join(dir, 'node_modules', 'foldseek-server-mcp', 'package.json');
    const broken = JSON.parse(await fs.readFile(manifest, 'utf8'));
    delete broken.type;
    await fs.writeFile(manifest, JSON.stringify(broken));

    // The trap this guards: a host shows only "Connection closed" and the operator has nothing to go on.
    const { spawn } = await import('node:child_process');
    const child = spawn(bin, [], {
        env: { ...process.env, FOLDSEEK_SERVER_BASE_URL: BASE_URL },
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
    assert.equal(core.name, 'foldseek-server-lib');
    assert.equal(core.private, true, 'the lib cannot be published: it imports frontend/lib by relative path');

    const server = JSON.parse(await fs.readFile(path.join(PKG, 'package.json'), 'utf8'));
    assert.equal(server.name, 'foldseek-server-mcp', 'unscoped until the org exists');
    assert.deepEqual(Object.keys(server.dependencies), ['@modelcontextprotocol/sdk']);
    assert.deepEqual(server.files, ['dist/server.mjs', 'bin/', 'README.md', 'LICENSE'],
        'the bundle by name, not dist/: build:mcpb also writes there, and a 3 MB npm tarball is wrong');
    assert.equal(server.scripts.prepublishOnly, 'node build.mjs', 'the bundle is built, never committed');
});

// --- the Desktop bundle -------------------------------------------------------------------------

test('the mcpb manifest matches the tools it ships and asks for what has no default', async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(PKG, 'manifest.json'), 'utf8'));
    const { createTools } = await import('../src/tools.js');
    const actual = createTools({}).map(t => t.name).sort();

    assert.deepEqual(manifest.tools.map(t => t.name).sort(), actual, 'the listed tools must be the real ones');
    assert.equal(manifest.server.entry_point, 'bin/foldseek-server-mcp.js');

    // npm and the .mcpb ship the same server from two hand-kept version fields; a user comparing the
    // two would have no way to tell which is older.
    const pkg = JSON.parse(await fs.readFile(path.join(PKG, 'package.json'), 'utf8'));
    assert.equal(manifest.version, pkg.version, 'manifest.json and package.json must agree');
    assert.deepEqual(manifest.compatibility.platforms, ['darwin', 'win32'], 'mcpb is not a linux format');
    assert.match(manifest.compatibility.runtimes.node, /18/);

    // base_url defaults to the public deployment, which is the common case.
    assert.match(manifest.user_config.base_url.default, /^https:\/\//);
    assert.equal(manifest.user_config.state_dir.type, 'directory');
    assert.equal(manifest.user_config.input_dir.required, false,
        'reading local files stays opt-in here too');

    // No host reliably expands a placeholder inside a default — Claude Desktop passes the literal
    // through, which is how another extension ends up looking for "/${HOME}/Documents". Anything that
    // needs the home directory is resolved by the server at runtime, from an empty value.
    for (const [key, field] of Object.entries(manifest.user_config)) {
        if (!('default' in field)) continue;
        assert.equal(JSON.stringify(field.default).includes('${'), false,
            `${key} has a placeholder in its default, which the host will not expand`);
    }

    // Hosts derive a per-server log filename from these, so a path separator makes an unwritable
    // path and the launch dies in the logger — which is why nothing gets logged about it.
    for (const field of ['name', 'display_name']) {
        assert.doesNotMatch(manifest[field], /[/\\:]/,
            `${field} must be path-safe: it becomes part of a log filename`);
    }

    // Single-valued throughout: Claude Desktop could not build a launch config from a multi-value
    // field, whether it was referenced in env or in args, and logged nothing when it failed.
    for (const [key, field] of Object.entries(manifest.user_config)) {
        assert.notEqual(field.multiple, true, `${key} must not be multi-valued`);
    }

    // Collected but never passed on, whether through env or args.
    for (const key of Object.keys(manifest.user_config)) {
        assert.ok(JSON.stringify(manifest.server.mcp_config).includes(`\${user_config.${key}}`),
            `${key} is collected but never passed to the server`);
    }

    // Two ways this manifest has already broken Claude Desktop, both silent:
    //
    // 1. a `${user_config.x}` that can never resolve makes Desktop treat the extension as
    //    unconfigured, whatever `required` says, so it will not stay enabled;
    // 2. a multi-value field substituted into an env *string* cannot be built at all — the launch
    //    fails before the process is created. Lists belong in `args`, as every working extension does.
    const mcp = manifest.server.mcp_config;
    const inEnv = JSON.stringify(mcp.env ?? {});
    const inArgs = JSON.stringify(mcp.args ?? []);
    for (const [, key] of JSON.stringify(mcp).matchAll(/\$\{user_config\.([a-z_]+)\}/g)) {
        const field = manifest.user_config[key];
        assert.ok(field, `mcp_config references ${key}, which is not a user_config field`);
        // Two separate host behaviours, learned the hard way:
        //   - a reference with no default at all makes Desktop call the extension unconfigured;
        //   - a `required: true` field is only resolved from a *saved* value, never from its default,
        //     so the extension reports "No MCP config found" until someone opens the form and saves.
        // Between them, every referenced field needs a default and must not be required.
        assert.ok('default' in field, `${key} is referenced in mcp_config with no default`);
        assert.notEqual(field.required, true,
            `${key} is required, so Desktop will not resolve it from its default — the extension will ` +
            'not start until the form is saved by hand');
        if (field.multiple) {
            assert.ok(!inEnv.includes(`\${user_config.${key}}`),
                `${key} is multi-valued and cannot be substituted into env — put it in args`);
            assert.ok(inArgs.includes(`\${user_config.${key}}`), `${key} should be expanded in args`);
        }
    }

    // Whatever the manifest passes in args, the binary has to understand.
    const bin = await fs.readFile(path.join(PKG, 'bin', 'foldseek-server-mcp.js'), 'utf8');
    for (const arg of mcp.args ?? []) {
        if (arg.startsWith('--')) assert.ok(bin.includes(`'${arg}'`), `${arg} is passed but not parsed`);
    }
});

test('the published README documents every tool, variable and error code', async () => {
    const readme = await fs.readFile(path.join(PKG, 'README.md'), 'utf8');
    const { createTools } = await import('../src/tools.js');

    // It is the only documentation an npm consumer gets, so every name must appear in it. How it is
    // marked up is the writer's business.
    for (const tool of createTools({}, { inputDirs: ['/x'], urlHosts: ['x.test'] })) {
        assert.ok(readme.includes(tool.name), `${tool.name} is undocumented`);
        for (const field of Object.keys(tool.inputSchema.properties ?? {})) {
            assert.ok(readme.includes(`\`${field}\``), `${tool.name}.${field} is undocumented`);
        }
    }

    const { RETIRED_ENV } = await import('../src/server.js');
    const retired = new Set(Object.keys(RETIRED_ENV));
    const declared = new Set([...readme.matchAll(/FOLDSEEK_SERVER_[A-Z_]+/g)].map(m => m[0]));
    const read = new Set();
    for (const file of ['src/server.js', '../core/src/store.js']) {
        const source = await fs.readFile(path.join(PKG, file), 'utf8');
        for (const [name] of source.matchAll(/FOLDSEEK_SERVER_[A-Z_]+/g)) {
            if (/_(LIVE_TESTS|LIVE_TICKET|PACK_TEST)$/.test(name)) continue;
            // Retired names appear only to be refused, so they are read but not offered.
            if (retired.has(name)) continue;
            read.add(name);
            assert.ok(declared.has(name), `${name} is read but undocumented`);
        }
    }
    // And the other way: a documented variable nobody reads is a leftover, which the forward check
    // above cannot see.
    for (const name of declared) {
        assert.ok(read.has(name), `${name} is documented but never read`);
    }

    // The reference does not ship, so a bare relative link would be a dead end. A full URL is fine.
    for (const [link] of readme.matchAll(/[^\s(]*REFERENCE\.md/g)) {
        assert.match(link, /^https:\/\/github\.com\//, `${link} is not reachable from npm`);
    }
});

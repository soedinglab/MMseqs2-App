// Exercise the runtime shape used by release bundles: built files, production dependencies, no source.
// Network-bound because the isolated stage installs the MCP SDK, so opt in explicitly.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const RUN = process.env.FOLDSEEK_SERVER_RELEASE_TEST === '1';
const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASE_URL = process.env.FOLDSEEK_SERVER_BASE_URL || 'http://127.0.0.1:9';
const run = (cmd, args, cwd) => execFileSync(cmd, args,
    { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

async function stageRuntime() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-release-'));
    run('node', [path.join(SERVER, 'build.mjs')], SERVER);
    for (const item of ['manifest.json', 'package.json', 'README.md', 'LICENSE', 'bin']) {
        await fs.cp(path.join(SERVER, item), path.join(dir, item), { recursive: true });
    }
    await fs.mkdir(path.join(dir, 'dist'));
    await fs.copyFile(path.join(SERVER, 'dist', 'server.mjs'), path.join(dir, 'dist', 'server.mjs'));
    run('npm', ['install', '--omit=dev', '--no-audit', '--no-fund', '--no-package-lock'], dir);
    return { dir, bin: path.join(dir, 'bin', 'foldseek-server-mcp.js') };
}

async function connect(bin, env = {}) {
    const stateDir = await fs.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-release-state-'));
    const transport = new StdioClientTransport({
        command: bin,
        env: { ...process.env, FOLDSEEK_SERVER_BASE_URL: BASE_URL,
            FOLDSEEK_SERVER_STATE_DIR: stateDir, ...env },
        stderr: 'pipe',
    });
    const client = new Client({ name: 'release-test', version: '0' }, { capabilities: {} });
    await client.connect(transport);
    return client;
}

test('the staged release runtime serves the full MCP surface outside the repository',
    { skip: !RUN }, async () => {
        const { dir, bin } = await stageRuntime();
        const manifest = JSON.parse(await fs.readFile(path.join(dir, 'package.json'), 'utf8'));
        assert.equal(manifest.private, true, 'the package is not an npm distribution');
        assert.deepEqual(Object.keys(manifest.dependencies), ['@modelcontextprotocol/sdk']);
        for (const absent of ['src', 'test', 'CONTRIBUTING.md']) {
            assert.equal(await fs.access(path.join(dir, absent)).then(() => true).catch(() => false),
                false, `${absent} is development-only`);
        }

        const client = await connect(bin);
        try {
            const { tools } = await client.listTools();
            assert.deepEqual(tools.map(tool => tool.name).sort(), [
                'export_result', 'folddisco_search', 'foldmason_msa', 'foldseek_search',
                'get_result_summary', 'get_ticket_status', 'list_databases', 'multimer_search',
                'select_hits', 'select_msa_columns', 'send_to',
            ]);
            const { resourceTemplates } = await client.listResourceTemplates();
            assert.equal(resourceTemplates[0].uriTemplate,
                'foldseek-artifact://{artifactId}/{path}');
        } finally {
            await client.close().catch(() => {});
        }
    });

test('the release entry point reports a missing module mode on stderr', { skip: !RUN }, async () => {
    const { dir, bin } = await stageRuntime();
    const file = path.join(dir, 'package.json');
    const manifest = JSON.parse(await fs.readFile(file, 'utf8'));
    delete manifest.type;
    await fs.writeFile(file, JSON.stringify(manifest));

    const { spawn } = await import('node:child_process');
    const child = spawn(bin, [], {
        env: { ...process.env, FOLDSEEK_SERVER_BASE_URL: BASE_URL },
        stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk; });
    const code = await new Promise(resolve => child.on('exit', resolve));

    assert.notEqual(code, 0);
    assert.match(stderr, /Cannot use import statement|Unexpected token 'export'|To load an ES module/);
});

test('the release graph is private and declares its local core dependency', async () => {
    const core = JSON.parse(await fs.readFile(path.join(SERVER, '..', 'core', 'package.json'), 'utf8'));
    assert.equal(core.dependencies, undefined, 'shared frontend dependencies are bundled');
    assert.equal(core.name, 'foldseek-server-lib');
    assert.equal(core.private, true, 'core imports frontend modules by repository-relative paths');

    const server = JSON.parse(await fs.readFile(path.join(SERVER, 'package.json'), 'utf8'));
    assert.equal(server.name, 'foldseek-server-mcp');
    assert.equal(server.private, true, 'the server is distributed as release artifacts, not through npm');
    assert.deepEqual(Object.keys(server.dependencies), ['@modelcontextprotocol/sdk', 'foldseek-server-lib']);
    assert.equal(server.dependencies['foldseek-server-lib'], 'file:../core');
    assert.equal(server.files, undefined, 'there is no npm package allowlist');
    assert.equal(server.scripts.prepublishOnly, undefined, 'publishing is not a build path');

    const root = JSON.parse(await fs.readFile(path.resolve(SERVER, '../..', 'package.json'), 'utf8'));
    assert.equal(root.workspaces, undefined, 'MCP dependencies must not rewrite the application lockfile');
    await fs.access(path.join(SERVER, 'package-lock.json'));
});

test('the Desktop packer reuses the self-contained plugin runtime', async () => {
    const source = await fs.readFile(path.join(SERVER, 'pack-mcpb.mjs'), 'utf8');
    assert.match(source, /pack-plugin-runtime\.mjs/);
    assert.doesNotMatch(source, /npm[^\n]*install|node_modules/,
        'the MCPB must not stage an installed dependency tree');
});

test('the MCP runtime release workflow is manual-only', async () => {
    const workflow = await fs.readFile(path.resolve(SERVER, '../..', '.github/workflows/mcp-release.yml'), 'utf8');
    assert.match(workflow, /^\s*workflow_dispatch:/m);
    assert.doesNotMatch(workflow, /^\s+(?:push|schedule):/m);
});

test('the mcpb manifest matches the tools it ships and has usable configuration defaults', async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(SERVER, 'manifest.json'), 'utf8'));
    const { createTools } = await import('../src/tools.js');
    const actual = createTools({}).map(tool => tool.name).sort();

    assert.deepEqual(manifest.tools.map(tool => tool.name).sort(), actual);
    assert.equal(manifest.server.entry_point, 'scripts/foldseek-server-mcp.js');

    const pkg = JSON.parse(await fs.readFile(path.join(SERVER, 'package.json'), 'utf8'));
    assert.equal(manifest.version, pkg.version);
    assert.deepEqual(manifest.compatibility.platforms, ['darwin', 'win32']);
    assert.match(manifest.compatibility.runtimes.node, /18/);
    assert.match(manifest.user_config.base_url.default, /^https:\/\//);
    assert.equal(manifest.user_config.state_dir.type, 'directory');
    assert.equal(manifest.user_config.input_dir.required, false);

    for (const [key, field] of Object.entries(manifest.user_config)) {
        if ('default' in field) {
            assert.equal(JSON.stringify(field.default).includes('${'), false,
                `${key} has an unexpanded placeholder in its default`);
        }
        assert.notEqual(field.multiple, true, `${key} must be single-valued`);
        assert.ok(JSON.stringify(manifest.server.mcp_config).includes(`\${user_config.${key}}`),
            `${key} is collected but not passed to the server`);
    }

    for (const field of ['name', 'display_name']) {
        assert.doesNotMatch(manifest[field], /[/\\:]/,
            `${field} becomes part of a host log filename and must be path-safe`);
    }

    const mcp = manifest.server.mcp_config;
    const inEnv = JSON.stringify(mcp.env ?? {});
    const inArgs = JSON.stringify(mcp.args ?? []);
    for (const [, key] of JSON.stringify(mcp).matchAll(/\$\{user_config\.([a-z_]+)\}/g)) {
        const field = manifest.user_config[key];
        assert.ok(field, `mcp_config references unknown field ${key}`);
        assert.ok('default' in field, `${key} is referenced without a default`);
        assert.notEqual(field.required, true, `${key} cannot be required when its default starts the extension`);
        if (field.multiple) {
            assert.ok(!inEnv.includes(`\${user_config.${key}}`));
            assert.ok(inArgs.includes(`\${user_config.${key}}`));
        }
    }

    const bin = await fs.readFile(path.join(SERVER, 'bin', 'foldseek-server-mcp.js'), 'utf8');
    for (const arg of mcp.args ?? []) {
        if (arg.startsWith('--')) assert.ok(bin.includes(`'${arg}'`), `${arg} is passed but not parsed`);
    }
});

test('the user README documents every tool, variable and error code', async () => {
    const readme = await fs.readFile(path.join(SERVER, 'README.md'), 'utf8');
    const { createTools } = await import('../src/tools.js');

    for (const tool of createTools({}, { inputDirs: ['/x'], urlHosts: ['x.test'] })) {
        assert.ok(readme.includes(tool.name), `${tool.name} is undocumented`);
        for (const field of Object.keys(tool.inputSchema.properties ?? {})) {
            assert.ok(readme.includes(`\`${field}\``), `${tool.name}.${field} is undocumented`);
        }
    }

    const { RETIRED_ENV } = await import('../src/server.js');
    const retired = new Set(Object.keys(RETIRED_ENV));
    const declared = new Set([...readme.matchAll(/FOLDSEEK_SERVER_[A-Z_]+/g)].map(match => match[0]));
    const read = new Set();
    for (const file of ['src/server.js', '../core/src/store.js']) {
        const source = await fs.readFile(path.join(SERVER, file), 'utf8');
        for (const [name] of source.matchAll(/FOLDSEEK_SERVER_[A-Z_]+/g)) {
            if (/_(LIVE_TESTS|LIVE_TICKET|RELEASE_TEST)$/.test(name) || retired.has(name)) continue;
            read.add(name);
            assert.ok(declared.has(name), `${name} is read but undocumented`);
        }
    }
    for (const name of declared) assert.ok(read.has(name), `${name} is documented but never read`);

    assert.doesNotMatch(readme, /\bnpx\b|npm (?:publish|pack)|REFERENCE\.md/,
        'the user path must not imply an npm-registry distribution or link removed history');
});

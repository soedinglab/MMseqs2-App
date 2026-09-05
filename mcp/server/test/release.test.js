import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the release graph is private and isolated from the application lockfile', async () => {
    const core = JSON.parse(await fs.readFile(path.join(SERVER, '../core/package.json'), 'utf8'));
    const server = JSON.parse(await fs.readFile(path.join(SERVER, 'package.json'), 'utf8'));
    const root = JSON.parse(await fs.readFile(path.join(SERVER, '../../package.json'), 'utf8'));

    assert.equal(core.private, true);
    assert.equal(core.dependencies, undefined);
    assert.equal(server.private, true);
    assert.deepEqual(Object.keys(server.dependencies), ['@modelcontextprotocol/sdk', 'foldseek-server-lib']);
    assert.equal(server.dependencies['foldseek-server-lib'], 'file:../core');
    assert.equal(root.workspaces, undefined);
    await fs.access(path.join(SERVER, 'package-lock.json'));
});

test('the Desktop manifest exposes the same tools and a self-contained entry point', async () => {
    const manifest = JSON.parse(await fs.readFile(path.join(SERVER, 'manifest.json'), 'utf8'));
    const { createTools } = await import('../src/tools.js');
    assert.deepEqual(manifest.tools.map(tool => tool.name).sort(), createTools({}).map(tool => tool.name).sort());
    assert.equal(manifest.server.entry_point, 'scripts/foldseek-server-mcp.js');
    assert.equal(manifest.version,
        JSON.parse(await fs.readFile(path.join(SERVER, 'package.json'), 'utf8')).version);

    const packer = await fs.readFile(path.join(SERVER, 'pack-mcpb.mjs'), 'utf8');
    assert.match(packer, /pack-plugin-runtime\.mjs/);
    assert.match(packer, /foldseek-server-v\$\{packageJson\.version\}\.mcpb/);
    assert.doesNotMatch(packer, /npm[^\n]*install|node_modules/);

    assert.equal(manifest.user_config.shared_dir.default, '');
    assert.match(manifest.user_config.shared_dir.description, /under your home directory/);
});

test('the manual release builds both the plugin runtime and Desktop MCPB', async () => {
    const workflow = await fs.readFile(path.join(SERVER, '../../.github/workflows/mcp-release.yml'), 'utf8');
    assert.match(workflow, /^on:\n  workflow_dispatch:/m);
    assert.doesNotMatch(workflow, /^  (?:push|schedule):/m);
    assert.match(workflow, /npm run build:plugin-runtime --prefix mcp\/server/);
    assert.match(workflow, /npm run build:mcpb --prefix mcp\/server/);
    assert.match(workflow, /foldseek-server-plugin-runtime-v\$\{VERSION\}\.zip/);
    assert.match(workflow, /foldseek-server-v\$\{VERSION\}\.mcpb/);
});

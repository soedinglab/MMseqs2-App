#!/usr/bin/env node
// Build a Claude Desktop bundle from the same self-contained runtime used by the plugin.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(await fs.readFile(path.join(HERE, 'package.json'), 'utf8'));
const out = process.argv[2] ?? path.join(HERE, 'dist', `marv-api-v${packageJson.version}.mcpb`);
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'marv-api-mcpb-'));
try {
    const stage = path.join(temporary, 'extension');
    const runtime = path.join(temporary, 'runtime.zip');
    await fs.mkdir(stage);
    run('node', [path.join(HERE, 'pack-plugin-runtime.mjs'), runtime], HERE);
    run('unzip', ['-q', runtime, '-d', stage], HERE);
    await fs.copyFile(path.join(HERE, 'README.md'), path.join(stage, 'README.md'));

    // package.json owns the version; the checked-in manifest only has to be valid.
    const manifest = JSON.parse(await fs.readFile(path.join(HERE, 'manifest.json'), 'utf8'));
    manifest.version = packageJson.version;
    await fs.writeFile(path.join(stage, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

    await fs.mkdir(path.dirname(out), { recursive: true });
    run('npx', ['--yes', '@anthropic-ai/mcpb@2.1.2', 'pack', stage, out], HERE);
    process.stderr.write(`${out}  ${((await fs.stat(out)).size / 1024).toFixed(0)} KB\n`);
} finally {
    await fs.rm(temporary, { recursive: true, force: true });
}

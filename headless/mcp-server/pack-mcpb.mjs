#!/usr/bin/env node
// Build a Claude Desktop bundle. Unlike the npm tarball, a .mcpb must carry its own node_modules:
// Desktop ships Node, not a registry client.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2] ?? path.join(HERE, 'dist', 'foldseek-server.mcpb');
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

run('node', [path.join(HERE, 'build.mjs')], HERE);

const stage = await fs.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-mcpb-'));
for (const item of ['manifest.json', 'package.json', 'README.md', 'LICENSE', 'bin', 'dist']) {
    await fs.cp(path.join(HERE, item), path.join(stage, item), { recursive: true });
}
await fs.rm(path.join(stage, 'dist', 'foldseek-server.mcpb'), { force: true });

// A production-only tree, resolved fresh rather than copied out of the hoisted workspace.
run('npm', ['install', '--omit=dev', '--no-audit', '--no-fund', '--no-package-lock'], stage);

await fs.mkdir(path.dirname(out), { recursive: true });
run('npx', ['--yes', '@anthropic-ai/mcpb@2.1.2', 'pack', stage, out], HERE);
await fs.rm(stage, { recursive: true, force: true });
process.stderr.write(`${out}  ${((await fs.stat(out)).size / 1024).toFixed(0)} KB\n`);

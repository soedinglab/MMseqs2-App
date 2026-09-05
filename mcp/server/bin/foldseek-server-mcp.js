#!/usr/bin/env node
// MCP entry point: source in a checkout, bundled runtime in a release; diagnostics stay on stderr.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Hosts may pass the input allowlist as repeated argv values instead of one environment string.
const argv = process.argv.slice(2);
const at = argv.indexOf('--input-dir');
if (at !== -1) {
    const dirs = [];
    for (let i = at + 1; i < argv.length && !argv[i].startsWith('--'); i++) dirs.push(argv[i]);
    argv.splice(at, dirs.length + 1);
    if (dirs.length) process.env.FOLDSEEK_SERVER_INPUT_DIRS = dirs.join(path.delimiter);
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(HERE, '..', 'src', 'server.js');
const BUNDLE = path.join(HERE, '..', 'dist', 'server.mjs');
const { main, runGc } = await import(`file://${fs.existsSync(SOURCE) ? SOURCE : BUNDLE}`);

const run = argv.includes('--gc')
    ? () => runGc(process.env, { dryRun: argv.includes('--dry-run') })
    : () => main(process.env, argv);

run().catch((err) => {
    process.stderr.write(`foldseek-server-mcp: ${err.message}\n`);
    process.exit(1);
});

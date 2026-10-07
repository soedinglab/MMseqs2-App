#!/usr/bin/env node
// MCP entry point: source in a checkout, bundled runtime in a release; diagnostics stay on stderr.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(HERE, '..', 'src', 'server.js');
const BUNDLE = path.join(HERE, '..', 'dist', 'server.mjs');
const { main, runGc } = await import(`file://${fs.existsSync(SOURCE) ? SOURCE : BUNDLE}`);

const run = argv.includes('--gc')
    ? () => runGc(process.env, { dryRun: argv.includes('--dry-run') })
    : () => main(process.env, argv);

run().catch((err) => {
    process.stderr.write(`marv-mcp: ${err.message}\n`);
    process.exit(1);
});

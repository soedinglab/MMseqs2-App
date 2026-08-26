#!/usr/bin/env node
// Entry point for `claude mcp add foldseek -- node .../bin/foldseek-server-mcp.js`.
//
// Configuration is environment-only, no config file:
//   FOLDSEEK_SERVER_BASE_URL     required, the site origin (no default — see readConfigFromEnv)
//   FOLDSEEK_SERVER_APP          default "foldseek"
//   FOLDSEEK_SERVER_STATE_DIR    default ~/.foldseek-server
//   FOLDSEEK_SERVER_API_PATH     default /api, for a deployment using config.Server.PathPrefix
//   FOLDSEEK_SERVER_BASIC_AUTH_USER / _PASS
//   FOLDSEEK_SERVER_ARTIFACT_TTL default 30m     duration, 1m .. 7d
//   FOLDSEEK_SERVER_RESULT_TTL   default 24h     duration, 1m .. 30d
//   FOLDSEEK_SERVER_LOCAL_PATHS  default 1       0 withholds local paths from descriptors
//   FOLDSEEK_SERVER_RESOURCE_MAX_BYTES default 16k  cap on one resource read, 1k .. 32m
//   FOLDSEEK_SERVER_INPUT_DIRS   default empty   colon-separated dirs queryRef may read
//                                                 (or `--input-dir A B C`, for hosts that pass lists
//                                                  as arguments rather than environment strings)
//   FOLDSEEK_SERVER_INPUT_TTL    default 1h      dropped files, from last use
//   FOLDSEEK_SERVER_RESULT_ROW_CAP  default unset  (1 .. 1000000)
//
// Transport: stdio by default. `--http --host 127.0.0.1 --port 8080` serves Streamable HTTP instead;
// both host and port are required rather than guessed.
//
// Operator mode: `--gc [--dry-run]` expires artifacts and cached result payloads, printing one report
// to stderr instead of starting a server.
//
// Startup errors go to stderr and exit non-zero: stdout is the MCP transport, so writing anything
// human-readable there would corrupt the protocol stream.

// src/ when it exists, dist/server.mjs otherwise. A checkout therefore always runs the source just
// edited; the published package and the .mcpb ship no src/, so they run the bundle.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// `--input-dir A B C` fills FOLDSEEK_SERVER_INPUT_DIRS. Claude Desktop expands a multi-value config
// into argv entries and cannot substitute a list into an env string, so the list arrives here.
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

#!/usr/bin/env node
// Entry point for `claude mcp add mmseqs2-agent -- node .../bin/mmseqs2-agent-mcp.js`.
//
// Configuration is environment-only, no config file:
//   MMSEQS2_AGENT_BASE_URL     required, the site origin (no default — see readConfigFromEnv)
//   MMSEQS2_AGENT_APP          default "foldseek"
//   MMSEQS2_AGENT_STATE_DIR    default ~/.mmseqs2-agent
//   MMSEQS2_AGENT_API_PATH     default /api, for a deployment using config.Server.PathPrefix
//   MMSEQS2_AGENT_BASIC_AUTH_USER / _PASS
//   MMSEQS2_AGENT_ARTIFACT_TTL_SECONDS          default 7200   (300 .. 604800)
//   MMSEQS2_AGENT_ARTIFACT_STALE_BUILD_SECONDS  default 3600   (60 .. 86400)
//   MMSEQS2_AGENT_ARTIFACT_GC_MAX_DELETIONS     default 200    (1 .. 10000)
//   MMSEQS2_AGENT_ARTIFACT_LOCAL_PATHS          default 1
//   MMSEQS2_AGENT_RESULT_ROW_CAP                default unset  (1 .. 1000000)
//
// Operator mode: `--gc [--dry-run]` sweeps expired artifacts and prints the report to stderr instead
// of starting a server. Artifact deletion is deliberately not an MCP tool.
//
// Startup errors go to stderr and exit non-zero: stdout is the MCP transport, so writing anything
// human-readable there would corrupt the protocol stream.

import { main, runGc } from '../src/server.js';

const args = process.argv.slice(2);
const run = args.includes('--gc')
    ? () => runGc(process.env, { dryRun: args.includes('--dry-run') })
    : () => main();

run().catch((err) => {
    process.stderr.write(`mmseqs2-agent-mcp: ${err.message}\n`);
    process.exit(1);
});

#!/usr/bin/env node
// Entry point for `claude mcp add mmseqs2-agent -- node .../bin/mmseqs2-agent-mcp.js`.
//
// Configuration is environment-only, no config file:
//   MMSEQS2_AGENT_BASE_URL     required, the site origin (no default — see readConfigFromEnv)
//   MMSEQS2_AGENT_APP          default "foldseek"
//   MMSEQS2_AGENT_STATE_DIR    default ~/.mmseqs2-agent
//   MMSEQS2_AGENT_API_PATH     default /api, for a deployment using config.Server.PathPrefix
//   MMSEQS2_AGENT_BASIC_AUTH_USER / _PASS
//   MMSEQS2_AGENT_ARTIFACT_TTL default 30m     duration, 1m .. 7d
//   MMSEQS2_AGENT_RESULT_TTL   default 24h     duration, 1m .. 30d
//   MMSEQS2_AGENT_LOCAL_PATHS  default 1       0 withholds local paths from descriptors
//   MMSEQS2_AGENT_RESULT_ROW_CAP  default unset  (1 .. 1000000)
//
// Operator mode: `--gc [--dry-run]` expires artifacts and cached result payloads, printing one report
// to stderr instead of starting a server.
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

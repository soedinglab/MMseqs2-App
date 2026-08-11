#!/usr/bin/env node
// Entry point for `claude mcp add mmseqs2-agent -- node .../bin/mmseqs2-agent-mcp.js`.
//
// Configuration is environment-only, no config file:
//   MMSEQS2_AGENT_BASE_URL     required, the site origin (no default — see readConfigFromEnv)
//   MMSEQS2_AGENT_APP          default "foldseek"
//   MMSEQS2_AGENT_STATE_DIR    default ~/.mmseqs2-agent
//   MMSEQS2_AGENT_API_PATH     default /api, for a deployment using config.Server.PathPrefix
//   MMSEQS2_AGENT_BASIC_AUTH_USER / _PASS
//
// Startup errors go to stderr and exit non-zero: stdout is the MCP transport, so writing anything
// human-readable there would corrupt the protocol stream.

import { main } from '../src/server.js';

main().catch((err) => {
    process.stderr.write(`mmseqs2-agent-mcp: ${err.message}\n`);
    process.exit(1);
});

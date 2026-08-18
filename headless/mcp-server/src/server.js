// MCP wiring. Everything that decides what a tool *does* lives in tools.js; this file only moves
// JSON between the SDK and those handlers.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { createClient } from 'mmseqs2-agent-core';

import { createTools, runTool } from './tools.js';

/**
 * A range-checked integer from the environment. Out of range fails at startup naming the variable and
 * the range it accepts: silently clamping a TTL is how an operator ends up with a cache that behaves
 * nothing like the number they set.
 */
function intFromEnv(env, name, { fallback, min, max }) {
    const raw = env[name];
    if (raw === undefined || raw === '') return fallback;
    const value = Number(raw);
    if (!Number.isSafeInteger(value) || value < min || value > max) {
        throw new Error(`${name}=${JSON.stringify(raw)} is not usable — expected an integer ` +
                        `between ${min} and ${max}`);
    }
    return value;
}

function boolFromEnv(env, name, fallback) {
    const raw = env[name];
    if (raw === undefined || raw === '') return fallback;
    if (['1', 'true', 'yes', 'on'].includes(raw.toLowerCase())) return true;
    if (['0', 'false', 'no', 'off'].includes(raw.toLowerCase())) return false;
    throw new Error(`${name}=${JSON.stringify(raw)} is not usable — expected 1/0, true/false, yes/no`);
}

export function readConfigFromEnv(env = process.env) {
    const baseUrl = env.MMSEQS2_AGENT_BASE_URL;
    if (!baseUrl) {
        throw new Error(
            'MMSEQS2_AGENT_BASE_URL is required — set it to the site origin, e.g. ' +
            'http://localhost:3000 or https://search.foldseek.com. It has no default on purpose: ' +
            'a default would send structures to whichever server was compiled in.',
        );
    }
    const user = env.MMSEQS2_AGENT_BASIC_AUTH_USER;
    const pass = env.MMSEQS2_AGENT_BASIC_AUTH_PASS;
    return {
        baseUrl,
        app: env.MMSEQS2_AGENT_APP || 'foldseek',
        stateDir: env.MMSEQS2_AGENT_STATE_DIR || undefined,
        apiPath: env.MMSEQS2_AGENT_API_PATH || undefined,
        basicAuth: user ? { user, pass: pass ?? '' } : null,
        resultRowCap: intFromEnv(env, 'MMSEQS2_AGENT_RESULT_ROW_CAP',
            { fallback: null, min: 1, max: 1000000 }),
        artifacts: {
            ttlSeconds: intFromEnv(env, 'MMSEQS2_AGENT_ARTIFACT_TTL_SECONDS',
                { fallback: 7200, min: 300, max: 604800 }),
            staleBuildSeconds: intFromEnv(env, 'MMSEQS2_AGENT_ARTIFACT_STALE_BUILD_SECONDS',
                { fallback: 3600, min: 60, max: 86400 }),
            maxDeletions: intFromEnv(env, 'MMSEQS2_AGENT_ARTIFACT_GC_MAX_DELETIONS',
                { fallback: 200, min: 1, max: 10000 }),
            gcMinIntervalSeconds: intFromEnv(env, 'MMSEQS2_AGENT_ARTIFACT_GC_MIN_INTERVAL_SECONDS',
                { fallback: 600, min: 0, max: 86400 }),
            exposeLocalPaths: boolFromEnv(env, 'MMSEQS2_AGENT_ARTIFACT_LOCAL_PATHS', true),
        },
    };
}

export function createServer(config) {
    const client = createClient(config);
    const tools = createTools(client);

    const server = new Server(
        { name: 'mmseqs2-agent', version: '0.1.0' },
        { capabilities: { tools: {} } },
    );

    server.setRequestHandler(ListToolsRequestSchema, () => ({
        tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;

        // Two different kinds of wrong, reported two different ways. A tool that ran and failed —
        // an unusable database, a motif residue that is not in the query — is an isError *result*,
        // because the caller needs to read the reason and try something else. A tool that does not
        // exist is a protocol error: nothing ran, and no change of arguments would help.
        if (!tools.some(t => t.name === name)) {
            throw new McpError(ErrorCode.InvalidParams, `unknown tool: ${name}`);
        }

        const result = await runTool(tools, name, args);
        return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: !!result?.isError,
        };
    });

    return { server, client, tools };
}

export async function main(env = process.env) {
    const { server, client } = createServer(readConfigFromEnv(env));
    await server.connect(new StdioServerTransport());

    // After the transport is up, so a slow sweep never delays the handshake, and to stderr only —
    // stdout is the protocol stream.
    client.collectArtifacts()
        .then((report) => {
            if (report.deleted || report.errors) {
                process.stderr.write(`mmseqs2-agent: startup GC removed ${report.deleted} artifact(s), ` +
                                     `${report.errors} error(s)\n`);
            }
        })
        .catch(err => process.stderr.write(`mmseqs2-agent: startup GC failed: ${err.message}\n`));
}

/** Operator maintenance: sweep and report, without starting a server. */
export async function runGc(env = process.env, { dryRun = false } = {}) {
    const { client } = createServer(readConfigFromEnv(env));
    // An operator asked, so report the routine keeps too — the running server never writes those.
    const report = await client.collectArtifacts({ dryRun, auditKeeps: true });
    process.stderr.write(`${JSON.stringify(report, null, 2)}\n`);
    return report;
}

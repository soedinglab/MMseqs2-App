// MCP wiring. Everything that decides what a tool *does* lives in tools.js; this file only moves
// JSON between the SDK and those handlers.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema, ListToolsRequestSchema,
    ListResourcesRequestSchema, ListResourceTemplatesRequestSchema, ReadResourceRequestSchema,
    ErrorCode, McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { createClient } from 'mmseqs2-agent-core';

import { createTools, runTool } from './tools.js';
import { createResources } from './resources.js';

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

const DURATION_UNITS = { s: 1, m: 60, h: 3600, d: 86400 };

/**
 * A duration from the environment: `90s`, `30m`, `24h`, `7d`, or a bare integer of seconds. Range
 * given in seconds; a refusal names the variable and the range in the same units the operator wrote.
 */
export function parseDuration(raw, { min, max, name = 'duration' }) {
    const refuse = () => {
        throw new Error(`${name}=${JSON.stringify(raw)} is not usable — expected a duration like ` +
                        `30m, 24h, 7d or a plain number of seconds, between ${min} and ${max} seconds`);
    };
    if (typeof raw !== 'string') refuse();
    const match = /^(\d+)([smhd]?)$/.exec(raw.trim());
    if (!match) refuse();
    const value = Number(match[1]) * DURATION_UNITS[match[2] || 's'];
    if (!Number.isSafeInteger(value) || value < min || value > max) refuse();
    return value;
}

function durationFromEnv(env, name, { fallback, min, max }) {
    const raw = env[name];
    if (raw === undefined || raw === '') return fallback;
    return parseDuration(raw, { min, max, name });
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
            'http://localhost:3000 or https://search.foldseek.com.'
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
        resultTtlSeconds: durationFromEnv(env, 'MMSEQS2_AGENT_RESULT_TTL',
            { fallback: 86400, min: 60, max: 2592000 }),
        artifacts: {
            ttlSeconds: durationFromEnv(env, 'MMSEQS2_AGENT_ARTIFACT_TTL',
                { fallback: 1800, min: 60, max: 604800 }),
            exposeLocalPaths: boolFromEnv(env, 'MMSEQS2_AGENT_LOCAL_PATHS', true),
        },
    };
}

export function createServer(config) {
    const client = createClient(config);
    const tools = createTools(client);
    const resources = createResources(client);

    const server = new Server(
        { name: 'mmseqs2-agent', version: '0.1.0' },
        { capabilities: { tools: {}, resources: {} } },
    );

    server.setRequestHandler(ListToolsRequestSchema, () => ({
        tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
    }));

    server.setRequestHandler(ListResourcesRequestSchema, async () => ({
        resources: await resources.list(),
    }));

    server.setRequestHandler(ListResourceTemplatesRequestSchema, () => ({
        resourceTemplates: [resources.template],
    }));

    // A resource read has no structured error channel, so a refusal is a protocol error carrying the
    // stable code in its message.
    server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
        try {
            return { contents: [await resources.read(request.params.uri)] };
        } catch (err) {
            throw new McpError(ErrorCode.InvalidParams, err.message);
        }
    });

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

    return { server, client, tools, resources };
}

export async function main(env = process.env) {
    const { server, client } = createServer(readConfigFromEnv(env));
    await server.connect(new StdioServerTransport());

    // After the transport is up, so a slow sweep never delays the handshake, and to stderr only —
    // stdout is the protocol stream.
    client.collectGarbage()
        .then(({ artifacts, results }) => {
            if (artifacts.deleted || results.deleted || artifacts.errors || results.errors) {
                process.stderr.write(
                    `mmseqs2-agent: startup GC removed ${artifacts.deleted} artifact(s) and ` +
                    `${results.deleted} cached result(s), ` +
                    `${artifacts.errors + results.errors} error(s)\n`);
            }
        })
        .catch(err => process.stderr.write(`mmseqs2-agent: startup GC failed: ${err.message}\n`));
}

/** Operator maintenance: sweep and report, without starting a server. */
export async function runGc(env = process.env, { dryRun = false } = {}) {
    const { client } = createServer(readConfigFromEnv(env));
    // An operator asked, so report the routine keeps too — the running server never writes those.
    const report = await client.collectGarbage({ dryRun, auditKeeps: true });
    process.stderr.write(`${JSON.stringify(report, null, 2)}\n`);
    return report;
}

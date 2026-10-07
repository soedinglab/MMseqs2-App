// MCP transport and protocol wiring around the tool handlers.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
    CallToolRequestSchema, ListToolsRequestSchema,
    ErrorCode, McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

import { createOperations, ensureSharedDirs } from 'marv-core';

import { createTools, runTool } from './tools.js';
import { VERSION } from './version.js';

/** Parse a bounded integer without silently clamping it. */
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

/** `90s`, `30m`, `24h`, `7d`, or a bare integer of seconds. Range in seconds. */
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

export const RETIRED_ENV = {
    MARV_ARTIFACT_DIR: 'use MARV_SHARED_DIR, whose exports/ replaces it',
    MARV_INPUT_TOKEN: 'the upload route is gone; drop a file into the shared imports/ instead',
    MARV_INPUT_QUOTA: 'nothing is uploaded now, so there is no upload quota',
    MARV_INPUT_DIRS: 'put files in MARV_SHARED_DIR/imports instead',
};

export function readConfigFromEnv(env = process.env, { homeDir = os.homedir() } = {}) {
    // Refuse retired variables instead of silently changing storage behavior.
    for (const [gone, now] of Object.entries(RETIRED_ENV)) {
        if (env[gone]) throw new Error(`${gone} is no longer read — ${now}`);
    }

    const baseUrl = env.MARV_BASE_URL;
    if (!baseUrl) {
        throw new Error(
            'MARV_BASE_URL is required — set it to the site origin, e.g. ' +
            'http://localhost:3000 or https://search.foldseek.com.'
        );
    }
    const user = env.MARV_BASIC_AUTH_USER;
    const pass = env.MARV_BASIC_AUTH_PASS;
    return {
        baseUrl,
        stateDir: env.MARV_STATE_DIR || undefined,
        sharedDir: env.MARV_SHARED_DIR || path.join(homeDir, 'marv-shared'),
        apiPath: env.MARV_API_PATH || undefined,
        basicAuth: user ? { user, pass: pass ?? '' } : null,
        resultRowCap: intFromEnv(env, 'MARV_RESULT_ROW_CAP',
            { fallback: null, min: 1, max: 1000000 }),
        inputTtlSeconds: durationFromEnv(env, 'MARV_INPUT_TTL',
            { fallback: 3600, min: 300, max: 604800 }),
        resultTtlSeconds: durationFromEnv(env, 'MARV_RESULT_TTL',
            { fallback: 86400, min: 60, max: 2592000 }),
        artifacts: {
            ttlSeconds: durationFromEnv(env, 'MARV_ARTIFACT_TTL',
                { fallback: 1800, min: 60, max: 604800 }),
            exposeLocalPaths: boolFromEnv(env, 'MARV_LOCAL_PATHS', true),
        },
    };
}

export function createServer(config, transport = { kind: 'stdio' }) {
    const operations = createOperations(config);
    const tools = createTools(operations, {
        inputDir: readRoot(operations, transport),
    });
    const server = new Server(
        { name: 'Marv API', version: VERSION },
        { capabilities: { tools: {} } },
    );

    server.setRequestHandler(ListToolsRequestSchema, () => ({
        tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        if (!tools.some(t => t.name === name)) {
            throw new McpError(ErrorCode.InvalidParams, `unknown tool: ${name}`);
        }

        const result = await runTool(tools, name, args);
        return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
            isError: !!result?.isError,
        };
    });

    return { server, operations, tools };
}

/** Select stdio or an explicitly bound Streamable HTTP transport. */
export function readTransportFromArgv(argv = []) {
    const valueFlags = new Set(['--host', '--port']);
    const known = new Set(['--http', '--host', '--port', '--gc', '--dry-run']);
    for (let i = 0; i < argv.length; i++) {
        if (!known.has(argv[i])) throw new Error(`unknown option: ${argv[i]}`);
        if (valueFlags.has(argv[i])) i++;
    }
    if (!argv.includes('--http')) return { kind: 'stdio' };
    const value = (flag) => {
        const at = argv.indexOf(flag);
        return at === -1 ? undefined : argv[at + 1];
    };
    const host = value('--host');
    const rawPort = value('--port');
    if (!host || !rawPort) {
        throw new Error('--http needs an explicit --host and --port, e.g. ' +
                        '--http --host 127.0.0.1 --port 8080');
    }
    const port = Number(rawPort);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error(`--port ${JSON.stringify(rawPort)} is not a port number (1..65535)`);
    }
    return { kind: 'http', host, port };
}

const LOOPBACK = /^(127\.\d+\.\d+\.\d+|::1|localhost)$/i;

/** Expose shared imports only over stdio or loopback HTTP. */
export function readRoot(operations, transport = { kind: 'stdio' }) {
    const importsDir = operations.sharedDirs?.importsDir;
    const remote = transport.kind === 'http' && !LOOPBACK.test(transport.host);
    return importsDir && !remote ? importsDir : null;
}

/** Serve over Streamable HTTP. Returns the listening node http.Server. */
export async function listenHttp(server, { host, port }) {
    const { createServer: createHttpServer } = await import('node:http');
    let transport = null;

    const http = createHttpServer((req, res) => {
        if (!transport) { res.writeHead(503).end(); return; }
        transport.handleRequest(req, res).catch(() => {
            if (!res.headersSent) res.writeHead(500).end();
        });
    });
    await new Promise((resolve, reject) => {
        http.once('error', reject);
        http.listen(port, host, resolve);
    });

    // Protect the actual bound port, including an ephemeral one.
    const bound = http.address().port;
    const allowedHosts = [host, `${host}:${bound}`];
    transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        allowedHosts,
        enableDnsRebindingProtection: true,
    });
    await server.connect(transport);
    return http;
}

export async function main(env = process.env, argv = process.argv.slice(2)) {
    const transport = readTransportFromArgv(argv);
    const config = readConfigFromEnv(env);
    const { server, operations } = createServer(config, transport);

    // Create the shared folder before the host grants or uses it.
    if (operations.sharedDirs) {
        // Shared-folder failure does not block remote searches.
        await ensureSharedDirs(operations.sharedDirs.shared)
            .catch(err => process.stderr.write(`marv-api: ${err.message}\n`));
    }

    if (transport.kind === 'http') {
        await listenHttp(server, transport);
        process.stderr.write(
            `marv-api: streamable http on http://${transport.host}:${transport.port}\n`);
    } else {
        await server.connect(new StdioServerTransport());
        // Keep stdout reserved for the protocol.
        process.stderr.write('marv-api: stdio\n');
    }

    // Sweep after the handshake and report only to stderr.
    operations.collectGarbage()
        .then(({ artifacts, results, inputs }) => {
            const errors = artifacts.errors + results.errors + (inputs.errors ?? 0);
            // Report deletion from the user-visible drop folder.
            if (artifacts.deleted || results.deleted || inputs.deleted || errors) {
                process.stderr.write(
                    `marv-api: startup GC removed ${artifacts.deleted} artifact(s), ` +
                    `${results.deleted} cached result(s) and ${inputs.deleted ?? 0} dropped file(s), ` +
                    `${errors} error(s)\n`);
            }
        })
        .catch(err => process.stderr.write(`marv-api: startup GC failed: ${err.message}\n`));
}

/** Operator maintenance: sweep and report, without starting a server. */
export async function runGc(env = process.env, { dryRun = false } = {}) {
    const { operations } = createServer(readConfigFromEnv(env));
    // Operator runs include routine retained entries in the audit.
    const report = await operations.collectGarbage({ dryRun, auditKeeps: true });
    process.stderr.write(`${JSON.stringify(report, null, 2)}\n`);
    return report;
}

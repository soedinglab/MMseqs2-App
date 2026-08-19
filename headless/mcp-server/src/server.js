// MCP wiring. Everything that decides what a tool *does* lives in tools.js; this file only moves
// JSON between the SDK and those handlers.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
    CallToolRequestSchema, ListToolsRequestSchema,
    ListResourcesRequestSchema, ListResourceTemplatesRequestSchema, ReadResourceRequestSchema,
    ErrorCode, McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';

import { createClient, parseInputDirs, parseUrlHosts } from 'foldseek-server-lib';

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

const SIZE_UNITS = { b: 1, k: 1024, m: 1024 * 1024 };

/** `16k`, `2m`, or a plain integer of bytes. */
export function parseSize(raw, { min, max, name = 'size' }) {
    const refuse = () => {
        throw new Error(`${name}=${JSON.stringify(raw)} is not usable — expected a size like 16k, 2m ` +
                        `or a plain number of bytes, between ${min} and ${max} bytes`);
    };
    if (typeof raw !== 'string') refuse();
    const match = /^(\d+)([bkm]?)$/i.exec(raw.trim());
    if (!match) refuse();
    const value = Number(match[1]) * SIZE_UNITS[(match[2] || 'b').toLowerCase()];
    if (!Number.isSafeInteger(value) || value < min || value > max) refuse();
    return value;
}

function sizeFromEnv(env, name, { fallback, min, max }) {
    const raw = env[name];
    if (raw === undefined || raw === '') return fallback;
    return parseSize(raw, { min, max, name });
}

function boolFromEnv(env, name, fallback) {
    const raw = env[name];
    if (raw === undefined || raw === '') return fallback;
    if (['1', 'true', 'yes', 'on'].includes(raw.toLowerCase())) return true;
    if (['0', 'false', 'no', 'off'].includes(raw.toLowerCase())) return false;
    throw new Error(`${name}=${JSON.stringify(raw)} is not usable — expected 1/0, true/false, yes/no`);
}

export function readConfigFromEnv(env = process.env) {
    const baseUrl = env.FOLDSEEK_SERVER_BASE_URL;
    if (!baseUrl) {
        throw new Error(
            'FOLDSEEK_SERVER_BASE_URL is required — set it to the site origin, e.g. ' +
            'http://localhost:3000 or https://search.foldseek.com.'
        );
    }
    const user = env.FOLDSEEK_SERVER_BASIC_AUTH_USER;
    const pass = env.FOLDSEEK_SERVER_BASIC_AUTH_PASS;
    return {
        baseUrl,
        app: env.FOLDSEEK_SERVER_APP || 'foldseek',
        stateDir: env.FOLDSEEK_SERVER_STATE_DIR || undefined,
        apiPath: env.FOLDSEEK_SERVER_API_PATH || undefined,
        basicAuth: user ? { user, pass: pass ?? '' } : null,
        resultRowCap: intFromEnv(env, 'FOLDSEEK_SERVER_RESULT_ROW_CAP',
            { fallback: null, min: 1, max: 1000000 }),
        // Small on purpose: manifests fit, row files do not and belong on the file system.
        resourceMaxBytes: sizeFromEnv(env, 'FOLDSEEK_SERVER_RESOURCE_MAX_BYTES',
            { fallback: 16 * 1024, min: 1024, max: 32 * 1024 * 1024 }),
        // Both empty by default: the alternatives are an arbitrary-file reader and an open proxy.
        inputDirs: parseInputDirs(env.FOLDSEEK_SERVER_INPUT_DIRS),
        urlHosts: parseUrlHosts(env.FOLDSEEK_SERVER_URL_HOSTS),
        resultTtlSeconds: durationFromEnv(env, 'FOLDSEEK_SERVER_RESULT_TTL',
            { fallback: 86400, min: 60, max: 2592000 }),
        artifacts: {
            ttlSeconds: durationFromEnv(env, 'FOLDSEEK_SERVER_ARTIFACT_TTL',
                { fallback: 1800, min: 60, max: 604800 }),
            exposeLocalPaths: boolFromEnv(env, 'FOLDSEEK_SERVER_LOCAL_PATHS', true),
        },
    };
}

/** The protocol's own reference type: a pointer per exported file, contents not included. */
export function resourceLinks(result) {
    if (result?.isError || !Array.isArray(result?.files) || !result.uri) return [];
    return result.files.map(file => ({
        type: 'resource_link',
        uri: `${result.uri}${file.path}`,
        name: file.path,
        mimeType: file.mime,
        description: `${file.role}, ${file.bytes} bytes${file.rows === null ? '' : `, ${file.rows} rows`}`,
    }));
}

export function createServer(config) {
    const client = createClient(config);
    const tools = createTools(client, {
        inputDirs: config.inputDirs ?? [], urlHosts: config.urlHosts ?? [],
    });
    const resources = createResources(client, { maxBytes: config.resourceMaxBytes });

    const server = new Server(
        { name: 'foldseek-server', version: '0.1.0' },
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
        if (!tools.some(t => t.name === name)) {
            throw new McpError(ErrorCode.InvalidParams, `unknown tool: ${name}`);
        }

        const result = await runTool(tools, name, args);
        return {
            content: [
                { type: 'text', text: JSON.stringify(result, null, 2) },
                ...resourceLinks(result),
            ],
            isError: !!result?.isError,
        };
    });

    return { server, client, tools, resources };
}

/**
 * `--http --host H --port N` selects Streamable HTTP; stdio otherwise. Host and port must both be
 * given: binding a guessed address is how a local-only server ends up reachable.
 */
export function readTransportFromArgv(argv = []) {
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

/**
 * `queryPath` reads the *server's* filesystem. That is the same machine as the caller over stdio, and
 * over HTTP only when the bind address is loopback. Anywhere else the path either means nothing or
 * means a different file, so the combination is refused rather than served.
 */
export function assertTransportAllows({ inputDirs = [] }, transport) {
    if (!inputDirs.length || transport.kind !== 'http' || LOOPBACK.test(transport.host)) return;
    throw new Error(
        `FOLDSEEK_SERVER_INPUT_DIRS is set and --http binds ${transport.host}, which is not loopback. ` +
        'A path argument would read this host\'s files on behalf of a remote caller. Unset it, or ' +
        'bind 127.0.0.1.');
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

    // After binding, so the rebinding guard names the port actually in use rather than the one asked
    // for — they differ whenever port 0 hands out an ephemeral one.
    const bound = http.address().port;
    transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        allowedHosts: [host, `${host}:${bound}`],
        enableDnsRebindingProtection: true,
    });
    await server.connect(transport);
    return http;
}

export async function main(env = process.env, argv = process.argv.slice(2)) {
    const transport = readTransportFromArgv(argv);
    const config = readConfigFromEnv(env);
    assertTransportAllows(config, transport);
    const { server, client } = createServer(config);

    if (transport.kind === 'http') {
        await listenHttp(server, transport);
        process.stderr.write(
            `foldseek-server: streamable http on http://${transport.host}:${transport.port}\n`);
    } else {
        await server.connect(new StdioServerTransport());
        // Never stdout: that is the protocol stream in this mode.
        process.stderr.write('foldseek-server: stdio\n');
    }

    // After the transport is up, so a slow sweep never delays the handshake, and to stderr only —
    // stdout is the protocol stream.
    client.collectGarbage()
        .then(({ artifacts, results }) => {
            if (artifacts.deleted || results.deleted || artifacts.errors || results.errors) {
                process.stderr.write(
                    `foldseek-server: startup GC removed ${artifacts.deleted} artifact(s) and ` +
                    `${results.deleted} cached result(s), ` +
                    `${artifacts.errors + results.errors} error(s)\n`);
            }
        })
        .catch(err => process.stderr.write(`foldseek-server: startup GC failed: ${err.message}\n`));
}

/** Operator maintenance: sweep and report, without starting a server. */
export async function runGc(env = process.env, { dryRun = false } = {}) {
    const { client } = createServer(readConfigFromEnv(env));
    // An operator asked, so report the routine keeps too — the running server never writes those.
    const report = await client.collectGarbage({ dryRun, auditKeeps: true });
    process.stderr.write(`${JSON.stringify(report, null, 2)}\n`);
    return report;
}

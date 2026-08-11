// MCP wiring. Everything that decides what a tool *does* lives in tools.js; this file only moves
// JSON between the SDK and those handlers.

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
    CallToolRequestSchema, ListToolsRequestSchema, ErrorCode, McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { createClient } from 'mmseqs2-agent-core';

import { createTools, runTool } from './tools.js';

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
    const { server } = createServer(readConfigFromEnv(env));
    await server.connect(new StdioServerTransport());
}

// Opt-in tests that talk to a real backend. Excluded from the default run: they need a server, and
// the submitting half queues actual compute.
//
//   MMSEQS2_AGENT_LIVE_TESTS=1     enable the read-only half
//   MMSEQS2_AGENT_BASE_URL=...     site origin, default http://localhost:3000 (a `go run main.go -local`)
//   MMSEQS2_AGENT_LIVE_TICKET=...  a completed search ticket to read; defaults to the Foldseek
//                                  validation ticket, which only exists on search.foldseek.com
//   MMSEQS2_AGENT_LIVE_SUBMIT=1    also submit a real job and wait for it
//
// The submit flag is deliberately separate from the read flag rather than folded into it. Reading a
// completed ticket costs a request; submitting occupies a queue slot and a worker, which is not
// something a test run should do because someone exported one variable.
//
//   node --test test/                                   # skips all of this
//   MMSEQS2_AGENT_LIVE_TESTS=1 \
//   MMSEQS2_AGENT_BASE_URL=https://search.foldseek.com \
//   node --test test/                                   # read-only against production
//   MMSEQS2_AGENT_LIVE_TESTS=1 MMSEQS2_AGENT_LIVE_SUBMIT=1 \
//   MMSEQS2_AGENT_BASE_URL=http://localhost:3000 \
//   node --test test/                                   # full cycle against a local backend

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createClient } from '../src/index.js';

const LIVE = process.env.MMSEQS2_AGENT_LIVE_TESTS === '1';
const SUBMIT = process.env.MMSEQS2_AGENT_LIVE_SUBMIT === '1';
const BASE_URL = process.env.MMSEQS2_AGENT_BASE_URL || 'http://localhost:3000';
const TICKET = process.env.MMSEQS2_AGENT_LIVE_TICKET || 'zXdtIy4ZBaW9CmHXTKyfeMdLSDBOlvftku3N5g';

// Two CA-only residues: enough to be a valid submission without asking a server to do real work.
const TINY_QUERY = [
    'ATOM      1  CA  MET A   1      11.639   6.071  -5.147  1.00  0.00           C',
    'ATOM      2  CA  ALA A   2      12.719   5.518  -4.897  1.00  0.00           C',
].join('\n');

async function liveClient() {
    return createClient({
        baseUrl: BASE_URL,
        stateDir: await fs.mkdtemp(path.join(os.tmpdir(), 'mmseqs2-agent-live-')),
    });
}

test('live: the server lists databases with capability flags', { skip: !LIVE }, async () => {
    const client = await liveClient();
    const databases = await client.getDatabases();

    assert.ok(databases.length > 0, 'a usable deployment should offer at least one database');
    for (const db of databases) {
        assert.equal(typeof db.path, 'string');
        assert.ok(db.path.length > 0);
    }
});

test('live: a completed ticket reports its status and type', { skip: !LIVE }, async () => {
    const client = await liveClient();
    const { status } = await client.pollTicket(TICKET);
    assert.ok(['PENDING', 'RUNNING', 'COMPLETE', 'ERROR', 'UNKNOWN'].includes(status), status);

    const { type } = await client.getTicketType(TICKET);
    assert.ok(type, 'a ticket the server knows should have a job type');
});

test('live: fetching a result caches it, and the cache is then authoritative', { skip: !LIVE }, async () => {
    const client = await liveClient();
    const { status } = await client.pollTicket(TICKET);
    if (status !== 'COMPLETE') return;                 // nothing to read; not a failure

    const table = await client.getResult(TICKET, 0);
    assert.ok(table.databases.length > 0);

    const first = table.getTable({ db: table.databases[0], limit: 3 });
    assert.equal(first.ok, true);
    assert.ok(first.total > 0);
    assert.equal(first.rows.length, Math.min(3, first.total));
    for (const row of first.rows) assert.ok(row.target, 'every row names a target');

    // Second read must come from disk — same numbers, no network needed.
    const cached = await client.getResult(TICKET, 0);
    assert.deepEqual(
        cached.getTable({ db: table.databases[0], limit: 3 }),
        first,
    );
    const record = await client.store.readTicket(TICKET);
    assert.ok(record, 'reading a result should leave a ticket record behind');
});

test('live: a submitted job runs to completion and its results parse', { skip: !(LIVE && SUBMIT) }, async () => {
    const client = await liveClient();
    const databases = await client.getDatabases();
    const usable = databases.filter(d => !d.interface && !d.motif);
    assert.ok(usable.length > 0, 'no database on this deployment can serve a plain search');

    const ticket = await client.submitFoldseekSearch({
        query: TINY_QUERY,
        databases: [usable[0].path],
    });
    assert.ok(ticket.id, 'submission should return a ticket id');

    const seen = [];
    const done = await ticket.wait({ intervalMs: 1000, timeoutMs: 10 * 60_000, onStatus: s => seen.push(s) });
    assert.equal(done.status, 'COMPLETE');
    assert.ok(seen.length > 0, 'the status callback should have been called');

    const table = await done.getResult(0);
    const view = table.getTable({ db: usable[0].path, limit: 5 });
    assert.equal(view.ok, true);
    assert.equal(typeof view.total, 'number');
});

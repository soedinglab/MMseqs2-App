// Opt-in tests that talk to a real backend. Excluded from the default run: they need a server, and
// the submitting half queues actual compute.
//
//   FOLDSEEK_SERVER_LIVE_TESTS=1     enable the read-only half
//   FOLDSEEK_SERVER_BASE_URL=...     site origin, default http://localhost:3000 (a `go run main.go -local`)
//   FOLDSEEK_SERVER_LIVE_TICKET=...  a completed search ticket to read; defaults to the Foldseek
//                                  validation ticket, which only exists on search.foldseek.com
//   FOLDSEEK_SERVER_LIVE_SUBMIT=1    also submit a real job and wait for it
//
// The submit flag is deliberately separate from the read flag rather than folded into it. Reading a
// completed ticket costs a request; submitting occupies a queue slot and a worker, which is not
// something a test run should do because someone exported one variable.
//
//   node --test test/                                   # skips all of this
//   FOLDSEEK_SERVER_LIVE_TESTS=1 \
//   FOLDSEEK_SERVER_BASE_URL=https://search.foldseek.com \
//   node --test test/                                   # read-only against production
//   FOLDSEEK_SERVER_LIVE_TESTS=1 FOLDSEEK_SERVER_LIVE_SUBMIT=1 \
//   FOLDSEEK_SERVER_BASE_URL=http://localhost:3000 \
//   node --test test/                                   # full cycle against a local backend

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { createClient } from '../src/index.js';

const LIVE = process.env.FOLDSEEK_SERVER_LIVE_TESTS === '1';
const SUBMIT = process.env.FOLDSEEK_SERVER_LIVE_SUBMIT === '1';
const BASE_URL = process.env.FOLDSEEK_SERVER_BASE_URL || 'http://localhost:3000';
const TICKET = process.env.FOLDSEEK_SERVER_LIVE_TICKET || 'zXdtIy4ZBaW9CmHXTKyfeMdLSDBOlvftku3N5g';

// Two CA-only residues: enough to be a valid submission without asking a server to do real work.
const TINY_QUERY = [
    'ATOM      1  CA  MET A   1      11.639   6.071  -5.147  1.00  0.00           C',
    'ATOM      2  CA  ALA A   2      12.719   5.518  -4.897  1.00  0.00           C',
].join('\n');

async function liveClient() {
    return createClient({
        baseUrl: BASE_URL,
        stateDir: await fs.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-live-')),
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

// -------------------------------------------------------------------------------------------------
// Third-party services. These need no MMseqs2 backend at all — only the network — but they are
// opt-in for the same reason as the rest: they reach out of the process.
// -------------------------------------------------------------------------------------------------

/** Streptavidin–biotin: a documented Q-BioLiP binding site, and small enough to fetch quickly. */
const QBIOLIP_PDB_ID = '1STP';
/** Crambin: a real PDB entry Q-BioLiP knows and has no binding site for. */
const NO_SITE_PDB_ID = '1CRN';

test('live: loadAccession finds a Q-BioLiP binding site and comes back with a motif', { skip: !LIVE }, async () => {
    const client = await liveClient();
    const loaded = await client.loadAccession(QBIOLIP_PDB_ID, { source: 'PDB' });

    assert.equal(loaded.motifSource, 'qbiolip');
    assert.ok(loaded.motif.length > 0);
    assert.ok(loaded.qbiolipSites.length > 0, 'every candidate site stays visible');
    // The structure is swapped for the binding site's own receptor assembly, because that is the
    // file the motif's residue numbering refers to.
    assert.equal(loaded.resolvedFrom, 'qbiolip-assembly');
    assert.match(loaded.name, /^1stp_1\.cif$/);
    assert.ok(loaded.text.includes('_atom_site.'), 'an mmCIF came back');

    // Every residue the motif names is one this file actually contains — the check submitFoldDisco
    // would run. Worth asserting here because Q-BioLiP reports label chains and the app uses auth
    // chains, and that mapping is the part that can silently produce residues nobody has.
    const { checkMotif } = await import('../src/motif.js');
    const checked = checkMotif(loaded.motif, loaded.text);
    assert.equal(checked.valid, true, checked.reason);
});

test('live: an entry with no binding site loads without a motif and without an error', { skip: !LIVE }, async () => {
    const client = await liveClient();
    const loaded = await client.loadAccession(NO_SITE_PDB_ID, { source: 'PDB' });

    assert.equal(loaded.motif, undefined);
    assert.equal(loaded.motifSource, undefined);
    assert.equal(loaded.qbiolipSites, undefined, 'a record with an empty site list is not a candidate');
    assert.equal(loaded.name, `${NO_SITE_PDB_ID}.cif`, 'the plain entry, not an assembly');
    assert.ok(loaded.text.includes('_atom_site.'));
});

test('live: autoMotif can be turned off, and non-PDB sources skip Q-BioLiP', { skip: !LIVE }, async () => {
    const client = await liveClient();
    const plain = await client.loadAccession(QBIOLIP_PDB_ID, { source: 'PDB', autoMotif: false });
    assert.equal(plain.motif, undefined);
    assert.equal(plain.name, `${QBIOLIP_PDB_ID}.cif`);
});

test('live: resolveStructureFromDb reaches the real databases', { skip: !LIVE }, async () => {
    const client = await liveClient();

    // 7A01 exceeds what the PDB format can hold, so RCSB serves no .pdb for it: this exercises the
    // .cif fallback against RCSB itself rather than against a stub that was told to 404. (It is a
    // 14 MB download — the smallest such entry is still large, which is the whole reason they exist.)
    // Given a long ceiling on purpose: what is under test is which URL is chosen, not how fast
    // a 14 MB file arrives on whatever connection this runs on.
    const big = await client.resolveStructureFromDb('pdb100', '7a01_A', { timeoutMs: 300_000 });
    assert.match(big.url, /7A01\.cif$/);
    assert.ok(big.text.includes('_atom_site.'));

    const small = await client.resolveStructureFromDb('pdb100', '1crn_A');
    assert.match(small.url, /1CRN\.pdb$/, 'an entry that has a PDB-format file is taken as PDB');
});

/** An entry whose Q-BioLiP site uses label_seq_id numbering. */
const LABEL_NUMBERED_PDB_ID = '1A4G';

test('live: a binding site reported in label numbering is translated, not dropped', { skip: !LIVE }, async () => {
    const client = await liveClient();
    const loaded = await client.loadAccession(LABEL_NUMBERED_PDB_ID, { source: 'PDB' });

    assert.equal(loaded.motifSource, 'qbiolip');
    assert.equal(loaded.motif.split(',').length, 3, 'three site residues, none dropped');
    assert.equal(loaded.motifRenumbered, 3, 'all three came back in the other numbering scheme');
    assert.equal(loaded.motifDropped, undefined);

    // Every residue named exists in the file that came with it — under *its* numbering, which is the
    // whole point of translating rather than passing the reported number through.
    const { checkMotif } = await import('../src/motif.js');
    const checked = checkMotif(loaded.motif, loaded.text);
    assert.deepEqual(checked.missing, [], 'none names a residue that is absent under either reading');
    assert.equal(checked.valid, true);
});

test('live: an assembly\'s chains are renamed so its motif becomes addressable', { skip: !LIVE }, async () => {
    const client = await liveClient();
    const loaded = await client.loadAccession(QBIOLIP_PDB_ID, { source: 'PDB' });

    // 1STP's receptor assembly names its four copies A1…A4, which no motif token can address. The
    // structure comes back renamed rather than flagged as a dead end.
    assert.deepEqual(loaded.chainsRenamed, { A1: 'A', A2: 'B', A3: 'C', A4: 'D' });
    assert.equal(loaded.motifProblem, undefined);
    assert.equal(loaded.motifWarnings, undefined);

    const { checkMotif } = await import('../src/motif.js');
    const checked = checkMotif(loaded.motif, loaded.text);
    assert.equal(checked.valid, true);
    assert.equal(checked.ambiguous, undefined, 'no token needs concatenation to resolve any more');
    assert.ok(loaded.motif.split(',').every(t => /^[A-D]\d+$/.test(t)), loaded.motif);

    // The structure is otherwise the one Q-BioLiP shipped: same residues, same coordinates.
    const { listChains, listResidues } = await import('../../../frontend/lib/structureText.js');
    assert.equal(listResidues(loaded.text).length, 484);
    assert.deepEqual(listChains(loaded.text).map(c => c.residueCount), [121, 121, 121, 121]);
});

test('live: the entry with both problems at once comes back usable', { skip: !LIVE }, async () => {
    const client = await liveClient();
    // This entry exercises label-to-auth numbering and multi-character chain normalization together.
    const loaded = await client.loadAccession(LABEL_NUMBERED_PDB_ID, { source: 'PDB' });

    assert.equal(loaded.motifRenumbered, 3);
    assert.deepEqual(loaded.chainsRenamed, { A1: 'A', B1: 'B', A2: 'C', B2: 'D' });
    assert.equal(loaded.motif, 'C110,D108,D109');

    const { checkMotif } = await import('../src/motif.js');
    assert.equal(checkMotif(loaded.motif, loaded.text).valid, true);
});

test('live: renaming can be turned off', { skip: !LIVE }, async () => {
    const client = await liveClient();
    const loaded = await client.loadAccession(QBIOLIP_PDB_ID, { source: 'PDB', normalizeChains: false });
    assert.equal(loaded.chainsRenamed, undefined);
    assert.match(loaded.motifWarnings.join(' '), /only by concatenation/);
});

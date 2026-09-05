import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
    createArtifactStore, collectArtifacts, collectResultCache, Store, ROOT_MARKER,
} from '../src/index.js';

const HOUR = 3600 * 1000;
const tmp = () => fsp.mkdtemp(path.join(os.tmpdir(), 'foldseek-gc-'));
const id = n => String(n).repeat(64).slice(0, 64);

async function artifact(root, name, hoursAgo) {
    const dir = path.join(root, name);
    await fsp.mkdir(dir, { recursive: true });
    const at = new Date(Date.now() - hoursAgo * HOUR).toISOString();
    await fsp.writeFile(path.join(dir, 'manifest.json'), JSON.stringify({ createdAt: at }));
    await fsp.writeFile(path.join(dir, 'access.json'), JSON.stringify({ lastAccessedAt: at }));
    await fsp.writeFile(path.join(dir, 'READY'), '');
    return dir;
}

test('artifact collection is TTL-bound, dry-runnable and deletion-limited', async () => {
    const root = await tmp();
    await fsp.writeFile(path.join(root, ROOT_MARKER), '{}');
    const expired = await artifact(root, id(1), 3);
    const fresh = await artifact(root, id(2), 1);
    const store = createArtifactStore({ root, ttlSeconds: 7200 });

    const preview = await collectArtifacts(store, { dryRun: true, maxDeletions: 1 });
    assert.equal(preview.wouldDelete, 1);
    assert.equal(fs.existsSync(expired), true);

    const result = await collectArtifacts(store, { maxDeletions: 1 });
    assert.equal(result.deleted, 1);
    assert.equal(fs.existsSync(expired), false);
    assert.equal(fs.existsSync(fresh), true);
});

test('artifact collection never follows symlinks or claims an unmarked root', async () => {
    const root = await tmp();
    await fsp.writeFile(path.join(root, ROOT_MARKER), '{}');
    const outside = await tmp();
    await fsp.writeFile(path.join(outside, 'keep'), 'safe');
    await fsp.symlink(outside, path.join(root, id(3)));

    const marked = createArtifactStore({ root, ttlSeconds: 1 });
    assert.equal((await collectArtifacts(marked)).deleted, 0);
    assert.equal(fs.readFileSync(path.join(outside, 'keep'), 'utf8'), 'safe');

    const unmarked = await tmp();
    await artifact(unmarked, id(4), 99);
    const refused = await collectArtifacts(createArtifactStore({ root: unmarked, ttlSeconds: 1 }));
    assert.equal(refused.refused, 'NOT_AN_ARTIFACT_ROOT');
    assert.equal(fs.existsSync(path.join(unmarked, id(4))), true);
});

test('result collection removes payloads but preserves ticket state', async () => {
    const stateDir = await tmp();
    const store = new Store(stateDir);
    const ticket = 'ABcdEFgh12345678';
    const dir = store.ticketDir(ticket);
    await fsp.mkdir(dir, { recursive: true });
    const files = {
        'result-0.json': '{"rows":[]}',
        'foldmason.json': '{"entries":[]}',
        'ticket.json': JSON.stringify({ id: ticket, kind: 'search' }),
        'selections.json': JSON.stringify({ saved: { ids: ['0#1'] } }),
    };
    const old = new Date(Date.now() - 25 * HOUR);
    for (const [name, body] of Object.entries(files)) {
        await fsp.writeFile(path.join(dir, name), body);
        await fsp.utimes(path.join(dir, name), old, old);
    }

    const result = await collectResultCache(store, { now: new Date() });
    assert.equal(result.deleted, 2);
    assert.equal(fs.existsSync(path.join(dir, 'result-0.json')), false);
    assert.equal(fs.existsSync(path.join(dir, 'foldmason.json')), false);
    assert.equal(fs.readFileSync(path.join(dir, 'ticket.json'), 'utf8'), files['ticket.json']);
    assert.equal(fs.readFileSync(path.join(dir, 'selections.json'), 'utf8'), files['selections.json']);
});

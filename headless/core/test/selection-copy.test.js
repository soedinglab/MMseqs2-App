// Named selections as durable workflow state: what a name may be called, that a copy is independent,
// and that the name a forwarded job recorded stays readable after the client moves on.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { Store, assertSelectionName } from '../src/index.js';

const tmpDir = () => fsp.mkdtemp(path.join(os.tmpdir(), 'foldseek-server-selcopy-'));
const TICKET = 'zXdtIy4ZBaW9CmHXTKyfeMdLSDBOlvftku3N5g';

async function store() {
    return new Store(await tmpDir());
}

test('a copy is independent in both directions', async () => {
    const s = await store();
    await s.writeSelection(TICKET, 'draft', { page: 'foldseek', entry: 0, ids: ['0#1', '0#2'] });

    const copy = await s.copySelection(TICKET, 'draft', 'to-foldmason__001');
    assert.deepEqual(copy.ids, ['0#1', '0#2']);
    assert.equal(copy.name, 'to-foldmason__001');
    assert.notEqual(copy.createdAt, undefined);

    await s.writeSelection(TICKET, 'draft', { page: 'foldseek', entry: 0, ids: ['0#9'] });
    assert.deepEqual((await s.readSelection(TICKET, 'to-foldmason__001')).ids, ['0#1', '0#2'],
        'editing the source must not reach the copy');

    await s.writeSelection(TICKET, 'to-foldmason__001', { page: 'foldseek', entry: 0, ids: ['0#5'] });
    assert.deepEqual((await s.readSelection(TICKET, 'draft')).ids, ['0#9'],
        'and editing the copy must not reach the source');
});

test('nested members are deep-copied, not shared', async () => {
    const s = await store();
    await s.writeSelection(TICKET, 'draft', {
        page: 'foldseek', entry: 0, ids: ['0#1'], note: { tags: ['keep'] },
    });
    await s.copySelection(TICKET, 'draft', 'copy');

    const source = await s.readSelection(TICKET, 'draft');
    source.note.tags.push('mutated');
    await s.writeSelection(TICKET, 'draft', source);

    assert.deepEqual((await s.readSelection(TICKET, 'copy')).note.tags, ['keep']);
});

test('copying never overwrites, and never invents a source', async () => {
    const s = await store();
    await s.writeSelection(TICKET, 'draft', { page: 'foldseek', ids: ['0#1'] });
    await s.writeSelection(TICKET, 'taken', { page: 'foldseek', ids: ['0#2'] });

    await assert.rejects(() => s.copySelection(TICKET, 'draft', 'taken'),
        err => err.code === 'SELECTION_COLLISION');
    assert.deepEqual((await s.readSelection(TICKET, 'taken')).ids, ['0#2'], 'the destination is intact');

    await assert.rejects(() => s.copySelection(TICKET, 'nope', 'fresh'),
        err => err.code === 'SELECTION_NOT_FOUND');
    assert.equal(await s.readSelection(TICKET, 'fresh'), null);

    await assert.rejects(() => s.copySelection(TICKET, 'draft', 'draft'),
        err => err.code === 'SELECTION_COLLISION');
});

test('a column selection copies its columns, its entry and its motif override', async () => {
    const s = await store();
    await s.writeSelection(TICKET, 'default', {
        page: 'foldmason', entry: 2, columns: [12, 13, 14], motif: 'A31, A32',
    });

    const copy = await s.copySelection(TICKET, 'default', 'to-folddisco__001');
    assert.deepEqual(copy.columns, [12, 13, 14]);
    assert.equal(copy.entry, 2);
    assert.equal(copy.motif, 'A31, A32', 'the override is part of the choice, so it travels');
    assert.equal(copy.page, 'foldmason');
});

test('reserved and malformed names are refused, and cannot pollute the file', async () => {
    const s = await store();
    for (const name of ['__proto__', 'prototype', 'constructor', '', '.hidden', '-lead', 'a/b',
        '../escape', 'a b', 'a'.repeat(65), 'na%2fme', null, 42]) {
        assert.throws(() => assertSelectionName(name), err => err.code === 'SELECTION_NAME_INVALID',
            `${JSON.stringify(name)} should be refused`);
        await assert.rejects(() => s.writeSelection(TICKET, name, { ids: [] }),
            err => err.code === 'SELECTION_NAME_INVALID');
    }
    assert.equal(({}).polluted, undefined);
    assert.deepEqual(await s.listSelections(TICKET), []);

    for (const name of ['draft', 'default', 'to-foldmason__001', 'to-folddisco__002', 'a.b-c_D9']) {
        assert.equal(assertSelectionName(name), name);
    }
});

test('a __proto__ key already in the file is ignored rather than spread', async () => {
    const s = await store();
    await s.writeSelection(TICKET, 'draft', { page: 'foldseek', ids: ['0#1'] });

    // Hand-write a hostile file, as a tampered or hand-edited state dir could contain.
    const file = path.join(s.ticketDir(TICKET), 'selections.json');
    await fsp.writeFile(file, JSON.stringify({
        draft: { name: 'draft', page: 'foldseek', ids: ['0#1'] },
        __proto__: { name: '__proto__', polluted: true },
    }));

    const all = await s.readSelections(TICKET);
    assert.deepEqual(Object.keys(all), ['draft']);
    assert.equal(Object.getPrototypeOf(all), null, 'no prototype to pollute');
    assert.equal(({}).polluted, undefined);
    assert.equal((await s.listSelections(TICKET)).length, 1);
});

test('selections survive a fresh Store on the same directory', async () => {
    const dir = await tmpDir();
    const first = new Store(dir);
    await first.writeSelection(TICKET, 'to-foldmason__001', {
        page: 'foldmason', entry: 1, columns: [4, 5, 6], motif: 'B1, B2',
    });
    await first.writeSelection(TICKET, 'draft', { page: 'foldseek', entry: 0, ids: ['0#1', '0#2', '0#3'] });

    const second = new Store(dir);
    const listed = await second.listSelections(TICKET);
    assert.deepEqual(listed.map(l => [l.name, l.size]).sort(),
        [['draft', 3], ['to-foldmason__001', 3]]);
    assert.equal((await second.readSelection(TICKET, 'to-foldmason__001')).motif, 'B1, B2');
});

test('listing reports metadata and an exact size, never the membership', async () => {
    const s = await store();
    const ids = Array.from({ length: 1000 }, (_, i) => `0#${i}`);
    await s.writeSelection(TICKET, 'big', { page: 'foldseek', entry: 0, ids });

    const listed = await s.listSelections(TICKET);
    assert.equal(listed[0].size, 1000, 'exact, not capped');
    assert.equal(listed[0].ids, undefined);
    assert.equal(listed[0].columns, undefined);
    assert.equal(JSON.stringify(listed).includes('0#999'), false);
    assert.ok(JSON.stringify(listed).length < 250, 'a listing stays small whatever it describes');
});

test('the serial forwarding convention round-trips, and the used name stays readable', async () => {
    const s = await store();
    // The convention: edit `draft`, copy it to a serial name for each forwarding job, then leave that
    // name alone — it is what the job's derivedFrom.selection points at.
    await s.writeSelection(TICKET, 'draft', { page: 'foldseek', entry: 0, ids: ['0#1', '0#2'] });
    await s.copySelection(TICKET, 'draft', 'to-foldmason__001');

    await s.writeSelection(TICKET, 'draft', { page: 'foldseek', entry: 0, ids: ['0#1', '0#2', '0#7'] });
    await s.copySelection(TICKET, 'draft', 'to-foldmason__002');

    assert.deepEqual((await s.readSelection(TICKET, 'to-foldmason__001')).ids, ['0#1', '0#2'],
        'the first job\'s selection is still exactly what was submitted');
    assert.deepEqual((await s.readSelection(TICKET, 'to-foldmason__002')).ids, ['0#1', '0#2', '0#7']);
    assert.deepEqual((await s.listSelections(TICKET)).map(l => l.name).sort(),
        ['draft', 'to-foldmason__001', 'to-foldmason__002']);
});

test('hasSelection answers without reading membership', async () => {
    const s = await store();
    await s.writeSelection(TICKET, 'draft', { page: 'foldseek', ids: ['0#1'] });
    assert.equal(await s.hasSelection(TICKET, 'draft'), true);
    assert.equal(await s.hasSelection(TICKET, 'nope'), false);
    assert.equal(await s.hasSelection(TICKET, '__proto__'), false, 'not even by inheritance');
});

// Artifact files as resources. The reads that must work, and the ones that must not.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from 'mmseqs2-agent-core';
import { createResources, RESOURCE_TEMPLATE } from '../src/resources.js';
import { resourceLinks } from '../src/server.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, '..', '..', 'core', 'test', 'fixtures');
const load = name => JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'));

const FOLDMASON = {
    entries: [
        { name: 'a', aa: 'MACWMAC', ss: 'DDDDDDD', ca: '1,1,1,2,2,2,3,3,3,4,4,4,5,5,5,6,6,6,7,7,7' },
        { name: 'b', aa: 'MA-WMAC', ss: 'DDDDDDD' },
    ],
    scores: [0.9, 0.8, -1, 0.7, 0.6, 0.5, 0.4],
    statistics: { msaLDDT: 0.72 },
    tree: '(a,b);',
};

async function fixture({ type = 'structuresearch', result = load('foldseek-bfmd.raw.json'),
    maxBytes = undefined } = {}) {
    const stateDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'mmseqs2-agent-res-'));
    const fetchImpl = async (url) => ({
        ok: true, status: 200,
        json: async () => (url.includes('/ticket/type/') ? { type }
            : url.includes('/databases') ? []
                : url.includes('/result/foldmason/') ? FOLDMASON
                    : url.includes('/result/') ? result
                        : { id: 'T1', status: 'COMPLETE' }),
        text: async () => '',
    });
    const client = createClient({ baseUrl: 'https://example.test', stateDir, fetchImpl });
    return { client, resources: createResources(client, maxBytes ? { maxBytes } : {}) };
}

test('a built artifact is listed by its manifest, and the manifest reads back', async () => {
    const { client, resources } = await fixture();
    const descriptor = await client.exportResult('T1abcd');

    const listed = await resources.list();
    assert.equal(listed.length, 1);
    assert.equal(listed[0].uri, descriptor.manifestUri);
    assert.equal(listed[0].mimeType, 'application/json');
    assert.match(listed[0].name, /search T1abcd/);
    assert.match(listed[0].description, /file\(s\)/);

    const read = await resources.read(listed[0].uri);
    assert.equal(read.mimeType, 'application/json');
    const manifest = JSON.parse(read.text);
    assert.equal(manifest.artifactId, descriptor.artifactId);
    assert.equal(manifest.state.ticket, 'T1abcd');
});

test('every file the descriptor names reads back with the right kind of content', async () => {
    // Cap lifted: this test's subject is content type, not size.
    const { client, resources } = await fixture({ type: 'foldmasoneasymsa', maxBytes: 32 * 1024 * 1024 });
    const descriptor = await client.exportResult('T2abcd');

    for (const file of descriptor.files) {
        const read = await resources.read(`${descriptor.uri}${file.path}`);
        assert.equal(read.mimeType, file.mime, file.path);
        if (file.mime === 'application/gzip') {
            assert.equal(typeof read.blob, 'string', 'a gz file is a blob, not text');
            assert.equal(read.text, undefined);
            assert.equal(Buffer.from(read.blob, 'base64').length, file.bytes);
        } else {
            assert.equal(typeof read.text, 'string', file.path);
            assert.equal(read.blob, undefined);
            assert.equal(Buffer.byteLength(read.text), file.bytes, file.path);
        }
    }

    const jsonl = descriptor.files.find(f => f.mime === 'application/x-ndjson');
    const read = await resources.read(`${descriptor.uri}${jsonl.path}`);
    assert.equal(read.text.trim().split('\n').length, jsonl.rows, 'one row per line');
});

test('a path that is not in the manifest is refused, even when the file exists', async () => {
    const { client, resources } = await fixture();
    const descriptor = await client.exportResult('T1abcd');
    const dir = path.dirname(descriptor.localPath);

    // Real files inside the artifact, deliberately absent from the manifest's file table.
    await fsp.writeFile(path.join(dir, 'READY'), '');
    await fsp.writeFile(path.join(dir, 'secret.txt'), 'not for reading');
    assert.equal(fs.existsSync(path.join(dir, 'secret.txt')), true);

    for (const relPath of ['secret.txt', 'READY', 'access.json']) {
        await assert.rejects(() => resources.read(`${descriptor.uri}${relPath}`),
            err => err.code === 'INVALID_ARTIFACT_PATH', relPath);
    }
});

test('traversal, absolute and encoded paths are refused', async () => {
    const { client, resources } = await fixture();
    const descriptor = await client.exportResult('T1abcd');

    const attempts = [
        `${descriptor.uri}../../../etc/passwd`,
        `${descriptor.uri}..%2f..%2fetc%2fpasswd`,
        `${descriptor.uri}search/../../manifest.json`,
        `${descriptor.uri}%2e%2e/manifest.json`,
        'mmseqs2-artifact:///etc/passwd',
        'file:///etc/passwd',
        `file://${descriptor.localPath}`,
        'mmseqs2-artifact://not-an-id/manifest.json',
        `mmseqs2-artifact://${'A'.repeat(64)}/manifest.json`,
        `mmseqs2-artifact://${'a'.repeat(63)}/manifest.json`,
        'not a uri at all',
        '',
        null,
    ];
    for (const uri of attempts) {
        await assert.rejects(() => resources.read(uri),
            err => ['INVALID_ARTIFACT_PATH', 'ARTIFACT_NOT_FOUND'].includes(err.code),
            `${uri} must be refused`);
    }
});

test('an artifact that was collected reads as gone, not as an empty file', async () => {
    const { client, resources } = await fixture();
    const descriptor = await client.exportResult('T1abcd');
    await fsp.rm(path.dirname(descriptor.localPath), { recursive: true, force: true });

    await assert.rejects(() => resources.read(descriptor.manifestUri),
        err => err.code === 'ARTIFACT_NOT_FOUND');
    assert.deepEqual(await resources.list(), []);
});

test('the template says how a uri is built, and nothing is listed before an export', async () => {
    const { resources } = await fixture();
    assert.equal(RESOURCE_TEMPLATE.uriTemplate, 'mmseqs2-artifact://{artifactId}/{path}');
    assert.deepEqual(await resources.list(), []);
});

test('listing is newest first and bounded', async () => {
    const { client, resources } = await fixture();
    await client.exportResult('T1abcd');
    await client.exportResult('T1abcd', 1);
    await client.exportResult('T1abcd', 2);

    const listed = await resources.list();
    assert.equal(listed.length, 3);
    assert.equal((await resources.list({ limit: 2 })).length, 2);
});

test('the default cap admits a manifest and refuses a row file', async () => {
    const { client, resources } = await fixture();
    assert.equal(resources.maxBytes, 16 * 1024);
    const descriptor = await client.exportResult('T1abcd');

    const manifest = await resources.read(descriptor.manifestUri);
    assert.ok(Buffer.byteLength(manifest.text) < resources.maxBytes, 'the handshake file still reads');

    const rows = descriptor.files.find(f => f.role === 'rows' && f.bytes > resources.maxBytes);
    assert.ok(rows, 'the bfmd fixture has a row file over 16 KB');

    await assert.rejects(() => resources.read(`${descriptor.uri}${rows.path}`), (err) => {
        assert.equal(err.code, 'RESOURCE_TOO_LARGE');
        assert.ok(err.message.includes(rows.path), 'names the path');
        assert.ok(err.message.includes(String(rows.bytes)), 'and the size');
        assert.ok(err.message.includes(String(resources.maxBytes)), 'and the limit');
        assert.match(err.message, /artifactRoot or localPath/, 'and where to read it instead');
        assert.match(err.message, /MMSEQS2_AGENT_RESOURCE_MAX_BYTES/);
        assert.ok(err.message.length < 400, `refusal is ${err.message.length} bytes`);
        return true;
    });
});

test('the cap is configurable, and a gz is measured compressed', async () => {
    // 120 bytes straddles the fixture's gz: 106 on disk, 135 inflated.
    const cap = 120;
    const { client, resources } = await fixture({ type: 'foldmasoneasymsa', maxBytes: cap });
    const descriptor = await client.exportResult('T2abcd');

    const gz = descriptor.files.find(f => f.mime === 'application/gzip');
    assert.ok(gz.bytes <= cap && gz.uncompressedBytes > cap, 'the case worth checking');

    const read = await resources.read(`${descriptor.uri}${gz.path}`);
    assert.equal(Buffer.from(read.blob, 'base64').length, gz.bytes,
        'over the cap inflated, under it on disk, so it reads');

    const over = descriptor.files.find(f => f.bytes > cap);
    await assert.rejects(() => resources.read(`${descriptor.uri}${over.path}`),
        err => err.code === 'RESOURCE_TOO_LARGE');
});

// --- handles a script can use -------------------------------------------------------------------

test('the descriptor hands over a root, a path, and its own uncertainty', async () => {
    const { client } = await fixture();
    const descriptor = await client.exportResult('T1abcd');

    assert.equal(descriptor.localPath, path.join(descriptor.artifactRoot, 'manifest.json'));
    assert.equal(descriptor.localPathVerified, false, 'the server cannot know the caller shares this fs');

    // root + a manifest path composes to a real file, which is the whole point of publishing the root.
    for (const file of descriptor.files) {
        assert.ok(fs.existsSync(path.join(descriptor.artifactRoot, file.path)), file.path);
    }

    // Self-verifying: one read of localPath tells a caller whether paths work at all.
    const manifest = JSON.parse(await fsp.readFile(descriptor.localPath, 'utf8'));
    assert.equal(manifest.artifactId, descriptor.artifactId);

    assert.ok(JSON.stringify(descriptor).length < 2048, `${JSON.stringify(descriptor).length} bytes`);
});

test('a descriptor becomes one resource_link per file, carrying no contents', async () => {
    const { client, resources } = await fixture();
    const descriptor = await client.exportResult('T1abcd');

    const links = resourceLinks(descriptor);
    assert.equal(links.length, descriptor.files.length);

    for (const link of links) {
        assert.equal(link.type, 'resource_link');
        assert.ok(link.uri.startsWith(descriptor.uri));
        assert.ok(link.name && link.mimeType && link.description);
        assert.equal(link.text, undefined, 'a link, not the file');
        assert.equal(link.blob, undefined);
        await resources.read(link.uri).catch(err => assert.equal(err.code, 'RESOURCE_TOO_LARGE', link.name));
    }

    assert.deepEqual(resourceLinks({ isError: true, files: descriptor.files, uri: descriptor.uri }), [],
        'a failure links nothing');
    assert.deepEqual(resourceLinks({ ticketId: 'T1', status: 'PENDING' }), [],
        'and so does a tool with no files');
});

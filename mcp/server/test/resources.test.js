import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from 'foldseek-server-lib';
import { createResources } from '../src/resources.js';
import { resourceLinks } from '../src/server.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const RAW = JSON.parse(fs.readFileSync(
    path.join(HERE, '../../core/test/fixtures/foldseek-bfmd.raw.json'), 'utf8'));

async function fixture({ maxBytes, exposeLocalPaths = true } = {}) {
    const stateDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'foldseek-resources-'));
    const fetchImpl = async url => ({
        ok: true,
        status: 200,
        json: async () => (url.includes('/ticket/type/') ? { type: 'structuresearch' }
            : url.includes('/databases') ? []
                : url.includes('/result/') ? RAW
                    : { id: 'T1', status: 'COMPLETE' }),
        text: async () => '',
    });
    const client = createClient({
        baseUrl: 'https://example.test', stateDir, fetchImpl, artifacts: { exposeLocalPaths },
    });
    return { client, resources: createResources(client, maxBytes ? { maxBytes } : {}) };
}

test('an exported manifest is listed, readable and linked without embedded contents', async () => {
    const { client, resources } = await fixture();
    const descriptor = await client.exportResult('T1abcd');
    const [listed] = await resources.list();
    assert.equal(listed.uri, descriptor.manifestUri);

    const manifest = JSON.parse((await resources.read(listed.uri)).text);
    assert.equal(manifest.artifactId, descriptor.artifactId);
    assert.equal(manifest.state.ticket, 'T1abcd');

    const links = resourceLinks(descriptor);
    assert.equal(links.length, descriptor.files.length);
    assert.ok(links.every(link => link.type === 'resource_link'
        && link.text === undefined && link.blob === undefined));
});

test('resource reads reject traversal and files absent from the manifest', async () => {
    const { client, resources } = await fixture();
    const descriptor = await client.exportResult('T1abcd');
    const dir = path.dirname(descriptor.localPath);
    await fsp.writeFile(path.join(dir, 'secret.txt'), 'secret');

    for (const uri of [
        `${descriptor.uri}secret.txt`,
        `${descriptor.uri}../../../etc/passwd`,
        `${descriptor.uri}%2e%2e/manifest.json`,
        'file:///etc/passwd',
    ]) {
        await assert.rejects(() => resources.read(uri),
            err => ['INVALID_ARTIFACT_PATH', 'ARTIFACT_NOT_FOUND'].includes(err.code));
    }
});

test('resource size limits and withheld local paths are explicit', async () => {
    const { client, resources } = await fixture({ maxBytes: 100, exposeLocalPaths: false });
    const descriptor = await client.exportResult('T1abcd');
    assert.equal(descriptor.localPath, undefined);
    assert.equal(descriptor.artifactRoot, undefined);

    const over = descriptor.files.find(file => file.bytes > resources.maxBytes);
    assert.ok(over);
    await assert.rejects(() => resources.read(`${descriptor.uri}${over.path}`), err => {
        assert.equal(err.code, 'RESOURCE_TOO_LARGE');
        assert.match(err.message, /withholds local paths/);
        assert.doesNotMatch(err.message, /artifactRoot|localPath/);
        return true;
    });
});

// Serve only manifest-listed artifact files and keep large row data out of model context.

import fs from 'node:fs/promises';
import path from 'node:path';

import { ARTIFACT_ID, URI_SCHEME } from 'foldseek-server-lib';

const MANIFEST = 'manifest.json';
const URI = new RegExp(`^${URI_SCHEME}://([0-9a-f]{64})/(.*)$`);
const TEXT_MIME = new Set(['application/json', 'application/x-ndjson', 'text/x-fasta', 'text/plain']);

export const RESOURCE_TEMPLATE = {
    uriTemplate: `${URI_SCHEME}://{artifactId}/{path}`,
    name: 'Result artifact file',
    description: 'One file of an exported result. Paths come from export_result or the manifest.',
    mimeType: 'application/json',
};

function invalid(code, message) {
    const err = new Error(`${code}: ${message}`);
    err.code = code;
    return err;
}

export const DEFAULT_MAX_BYTES = 16 * 1024;

export function createResources(client, { maxBytes = DEFAULT_MAX_BYTES } = {}) {
    const store = client.artifacts;

    return {
        maxBytes,

        template: RESOURCE_TEMPLATE,

        /** One entry per READY artifact: its manifest, which names every file it holds. */
        async list({ limit = 50 } = {}) {
            const artifacts = await store.list({ limit });
            return artifacts.map(({ artifactId, manifest }) => ({
                uri: store.uriFor(artifactId, MANIFEST),
                name: `${manifest.state.tool} ${manifest.state.ticket} manifest`,
                description: `${manifest.files.length} file(s), ${manifest.counts.exportedRows} row(s), ` +
                             `built ${manifest.createdAt}`,
                mimeType: 'application/json',
            }));
        },

        async read(uri) {
            const match = URI.exec(String(uri ?? ''));
            if (!match) {
                throw invalid('INVALID_ARTIFACT_PATH',
                    `not an artifact uri: ${JSON.stringify(uri)} (${RESOURCE_TEMPLATE.uriTemplate})`);
            }
            const [, artifactId, relPath] = match;
            if (!ARTIFACT_ID.test(artifactId)) {
                throw invalid('ARTIFACT_NOT_FOUND', `not an artifact id: ${artifactId}`);
            }

            const hit = await store.read(artifactId);
            if (!hit.ok) {
                throw invalid('ARTIFACT_NOT_FOUND',
                    `no readable artifact ${artifactId.slice(0, 12)} (${hit.reason})`);
            }

            const wanted = relPath === '' ? MANIFEST : relPath;
            const file = wanted === MANIFEST
                ? { path: MANIFEST, mime: 'application/json' }
                : hit.manifest.files.find(f => f.path === wanted);
            if (!file) {
                throw invalid('INVALID_ARTIFACT_PATH',
                    `${wanted} is not a file of this artifact — the manifest lists ` +
                    `${hit.manifest.files.map(f => f.path).join(', ')}`);
            }

            const full = path.join(hit.dir, file.path);

            // The stat, not the manifest's record: a .gz is measured compressed, as it crosses the wire.
            const bytes = await fs.stat(full).then(st => st.size).catch(() => null);
            if (bytes !== null && bytes > maxBytes) {
                // Mention filesystem alternatives only when local paths were exposed.
                const instead = store.exposeLocalPaths
                    ? 'Open it from the file system using artifactRoot or localPath from export_result, or'
                    : 'This deployment withholds local paths, so read it server-side, or';
                throw invalid('RESOURCE_TOO_LARGE',
                    `${file.path} is ${bytes} bytes, over the ${maxBytes} limit for a resource read. ` +
                    `${instead} raise FOLDSEEK_SERVER_RESOURCE_MAX_BYTES.`);
            }

            if (TEXT_MIME.has(file.mime)) {
                return { uri, mimeType: file.mime, text: await fs.readFile(full, 'utf8') };
            }
            return { uri, mimeType: file.mime, blob: (await fs.readFile(full)).toString('base64') };
        },
    };
}

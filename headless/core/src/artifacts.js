// One reproducible file bundle per result unit: complete factual data, addressed by a cache key that
// depends only on (server, ticket, entry, schema version).
//
// Build order is data files -> manifest -> READY, into a scratch directory on the same filesystem,
// then one atomic rename. A directory without READY is therefore never a half-written artifact that
// something else can read.

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

import { ARTIFACT_SCHEMA, validateArtifactManifest, unsafeRelativePath } from './schemas.js';
import { defaultRankingSemantics, metricSemantics, NUMERIC_METRIC_FIELDS } from './metrics.js';
import {
    kindForJobType, resultCounts, completenessOf, databaseProvenance,
    taxonomyExport, serializeRow, motifPatternExport,
} from './facts.js';
import { foldMasonColumns, foldMasonEntries, foldMasonFasta, msaResidueMap } from './msa.js';

export const ARTIFACT_ID = /^[0-9a-f]{64}$/;
export const DEFAULT_ARTIFACT_TTL_SECONDS = 1800;

export const URI_SCHEME = 'foldseek-artifact';

/** Written when we create an artifact root. The sweep refuses any root without it. */
export const ROOT_MARKER = '.foldseek-artifacts';

const READY = 'READY';
const MANIFEST = 'manifest.json';
const ACCESS = 'access.json';
const BUILD_PREFIX = '.build-';

const MIME = {
    json: 'application/json',
    jsonl: 'application/x-ndjson',
    fasta: 'text/x-fasta',
    gz: 'application/gzip',
};

const BUILT_BY = { package: 'foldseek-server-lib', version: '0.1.0' };

/** The origin an artifact belongs to, normalized so the same server never yields two namespaces. */
export function serverNamespaceFor({ baseUrl, apiPath = '/api' } = {}) {
    const trimmed = String(baseUrl ?? '').replace(/\/+$/, '');
    let origin = trimmed;
    try {
        const url = new URL(trimmed);
        origin = `${url.protocol.toLowerCase()}//${url.host.toLowerCase()}`;
    } catch { /* not a URL — use it as given rather than inventing one */ }
    return `${origin}${String(apiPath ?? '').replace(/\/+$/, '')}`;
}

export function artifactCacheKey({ serverNamespace, ticketId, normalizedEntry }) {
    const parts = [serverNamespace, ticketId, String(normalizedEntry), ARTIFACT_SCHEMA];
    return crypto.createHash('sha256').update(parts.join('\0')).digest('hex');
}

async function countLines(file) {
    const handle = await fs.open(file, 'r');
    try {
        let lines = 0;
        const buffer = Buffer.alloc(64 * 1024);
        for (;;) {
            const { bytesRead } = await handle.read(buffer, 0, buffer.length, null);
            if (bytesRead === 0) break;
            for (let i = 0; i < bytesRead; i++) if (buffer[i] === 10) lines++;
        }
        return lines;
    } finally {
        await handle.close();
    }
}

/** Cheap integrity probe: a JSONL file that was written whole ends in a newline. */
async function endsWithNewline(file, size) {
    if (size === 0) return true;
    const handle = await fs.open(file, 'r');
    try {
        const buffer = Buffer.alloc(1);
        await handle.read(buffer, 0, 1, size - 1);
        return buffer[0] === 10;
    } finally {
        await handle.close();
    }
}

export function createArtifactStore({
    root,
    clock = () => new Date(),
    ttlSeconds = DEFAULT_ARTIFACT_TTL_SECONDS,
    exposeLocalPaths = true,
    insideStateDir = true,
    verifyRows = false,
    // What the caller sees this root as: the mount is the shared parent, not the export directory.
    mountName = null,
    pathPrefix = null,
} = {}) {
    if (!root) throw new Error('createArtifactStore({ root }) is required');

    const building = new Set();

    const dirFor = (id) => {
        if (!ARTIFACT_ID.test(id)) throw new Error(`not an artifact id: ${JSON.stringify(id)}`);
        return path.join(root, id);
    };

    const store = {
        root,
        ttlSeconds,
        exposeLocalPaths,
        now: () => clock(),

        dirFor,
        isActive: id => building.has(id),

        /**
         * A hit only when READY is present, the manifest validates, and every file measures up.
         *
         * "Measures up" is a byte-size match plus a terminal newline on each JSONL file — O(1) per
         * file. Counting every row costs a full read of the artifact on every hit (24 ms on a 3 MB
         * search, 22 ms on a 14 MB alignment) and catches almost nothing size does not: a truncated or
         * partial write changes the size. Pass verifyRows for the exhaustive check.
         */
        async read(id, { verifyRows: verify = verifyRows } = {}) {
            let dir;
            try { dir = dirFor(id); } catch { return { ok: false, reason: 'INVALID_ID' }; }

            try { await fs.access(dir); } catch { return { ok: false, reason: 'ABSENT' }; }
            // Present but unfinished: a failed or interrupted build, never something to read.
            try { await fs.access(path.join(dir, READY)); } catch { return { ok: false, reason: 'NOT_READY' }; }

            let manifest;
            try {
                manifest = JSON.parse(await fs.readFile(path.join(dir, MANIFEST), 'utf8'));
            } catch { return { ok: false, reason: 'MANIFEST_UNREADABLE' }; }

            const check = validateArtifactManifest(manifest);
            if (!check.ok) return { ok: false, reason: 'MANIFEST_INVALID', errors: check.errors };
            if (manifest.artifactId !== id) return { ok: false, reason: 'ID_MISMATCH' };

            for (const file of manifest.files) {
                if (unsafeRelativePath(file.path)) return { ok: false, reason: 'UNSAFE_PATH' };
                const full = path.join(dir, file.path);
                let stat;
                try { stat = await fs.stat(full); } catch { return { ok: false, reason: 'FILE_MISSING' }; }
                if (stat.size !== file.bytes) return { ok: false, reason: 'BYTES_MISMATCH' };
                if (file.mime !== MIME.jsonl) continue;
                if (verify) {
                    if (await countLines(full) !== file.rows) return { ok: false, reason: 'ROWS_MISMATCH' };
                } else if (!await endsWithNewline(full, stat.size)) {
                    return { ok: false, reason: 'TRUNCATED' };
                }
            }
            return { ok: true, manifest, dir };
        },

        async touch(id) {
            const at = clock().toISOString();
            const file = path.join(dirFor(id), ACCESS);
            const tmp = `${file}.tmp-${crypto.randomBytes(6).toString('hex')}`;
            await fs.writeFile(tmp, JSON.stringify({ lastAccessedAt: at }));
            await fs.rename(tmp, file);
            return at;
        },

        async lastAccessedAt(id) {
            const dir = dirFor(id);
            try {
                const { lastAccessedAt } = JSON.parse(await fs.readFile(path.join(dir, ACCESS), 'utf8'));
                if (lastAccessedAt) return lastAccessedAt;
            } catch { /* fall back to the build time: an artifact without an access record looks older */ }
            try {
                const { createdAt } = JSON.parse(await fs.readFile(path.join(dir, MANIFEST), 'utf8'));
                return createdAt ?? null;
            } catch { return null; }
        },

        /**
         * Build into scratch on the same filesystem, then rename. A lost race is not an error: the
         * winner built the same bytes from the same source, so it is re-validated and used.
         */
        async build(id, write) {
            const dir = dirFor(id);
            await fs.mkdir(root, { recursive: true });
            // Claims the root as ours, so a mistyped export directory is never swept.
            await fs.writeFile(path.join(root, ROOT_MARKER), JSON.stringify({
                kind: 'foldseek-server artifact root', createdAt: clock().toISOString(),
            })).catch(() => {});
            const scratch = await fs.mkdtemp(path.join(root, BUILD_PREFIX));
            building.add(id);

            try {
                const manifest = await write(scratch);
                const check = validateArtifactManifest(manifest);
                if (!check.ok) {
                    const err = new Error(`refusing to publish an invalid manifest: ${JSON.stringify(check.errors)}`);
                    err.code = 'EXPORT_FAILED';
                    throw err;
                }
                await fs.writeFile(path.join(scratch, MANIFEST), JSON.stringify(manifest));
                await fs.writeFile(path.join(scratch, ACCESS), JSON.stringify({ lastAccessedAt: clock().toISOString() }));
                await fs.writeFile(path.join(scratch, READY), '');
                await fs.rename(scratch, dir);
                return { manifest, cacheHit: false };
            } catch (err) {
                await fs.rm(scratch, { recursive: true, force: true }).catch(() => {});
                if (err.code === 'EEXIST' || err.code === 'ENOTEMPTY') {
                    const winner = await store.read(id);
                    if (winner.ok) return { manifest: winner.manifest, cacheHit: true };
                }
                throw err;
            } finally {
                building.delete(id);
            }
        },

        uriFor(id, relPath = '') { return `${URI_SCHEME}://${id}/${relPath}`; },

        /** READY artifacts, newest first. Bounded: a listing is for choosing one, not for auditing. */
        async list({ limit = 50 } = {}) {
            let names;
            try { names = await fs.readdir(root); } catch { return []; }
            const found = [];
            for (const name of names) {
                if (!ARTIFACT_ID.test(name)) continue;
                const hit = await store.read(name);
                if (hit.ok) found.push({ artifactId: name, manifest: hit.manifest });
            }
            found.sort((a, b) => String(b.manifest.createdAt).localeCompare(String(a.manifest.createdAt)));
            return found.slice(0, limit);
        },

        /** Small by construction: roles, sizes and counts, never file contents. */
        descriptor(manifest, { cacheHit = false, mountRoot = null } = {}) {
            const id = manifest.artifactId;
            const accessed = clock();
            const out = {
                schema: manifest.schema,
                artifactId: id,
                cacheHit,
                uri: store.uriFor(id),
                manifestUri: store.uriFor(id, MANIFEST),
                ticket: manifest.state.ticket,
                entry: manifest.state.entry,
                jobType: manifest.state.jobType,
                resultKind: manifest.state.resultKind,
                counts: manifest.counts,
                completeness: manifest.completeness,
                files: manifest.files.map(({ role, path: p, mime, bytes, rows, uncompressedBytes }) => ({
                    role, path: p, mime, bytes, rows,
                    ...(uncompressedBytes === undefined ? {} : { uncompressedBytes }),
                })),
                integrityIssues: manifest.integrityIssues,
                expiresAt: new Date(accessed.getTime() + ttlSeconds * 1000).toISOString(),
            };
            if (exposeLocalPaths) {
                const dir = dirFor(id);
                // A caller that knows where it sees the export directory gets paths in its own space:
                // it is the only party that can know, and the arithmetic is ours to do.
                // mountRoot is where the caller sees the shared folder, so the prefix is ours to add.
                const base = mountRoot
                    ? (pathPrefix ? path.join(mountRoot, pathPrefix) : mountRoot)
                    : root;
                if (!path.relative(root, dir).startsWith('..')) {
                    // exportRoot and its basename, because a sandboxed caller sees the export directory
                    // at a mount of its own and must rebuild the path rather than use ours. The server
                    // cannot discover that view: there is no channel for it, and `roots` is deprecated
                    // and unimplemented by the hosts that sandbox.
                    const seen = mountName ?? path.basename(root);
                    out.exportRoot = base;
                    out.mountName = seen;
                    out.pathFromMount = pathPrefix ? path.join(pathPrefix, id) : id;
                    out.artifactRoot = path.join(base, id);
                    out.localPath = path.join(base, id, MANIFEST);
                    out.localPathVerified = false;
                    if (mountRoot) out.pathsRemapped = true;
                    out.ifUnreadable = mountRoot
                        ? 'paths are already in the space you named; if they still do not open, the '
                          + 'mountRoot was wrong'
                        : insideStateDir
                        ? 'these files are inside this server\'s private state directory, so a client '
                          + 'that does not share its filesystem cannot read them at any path — use the '
                          + 'uri, or ask the operator to set FOLDSEEK_SERVER_SHARED_DIR to a folder '
                          + 'you can be granted'
                        : `find a directory named "${seen}" among the paths you can read, then join `
                          + 'pathFromMount and a file path to it';
                }
            }
            return out;
        },
    };
    return store;
}

/** Collects files as they are written, so the manifest can never disagree with the directory. */
function fileCollector(scratch) {
    const files = [];
    return {
        files,
        async write(relPath, role, contents, { rows = null, uncompressedBytes = null } = {}) {
            const problem = unsafeRelativePath(relPath);
            if (problem) throw Object.assign(new Error(`unsafe artifact path ${relPath}: ${problem}`),
                { code: 'EXPORT_FAILED' });
            const full = path.join(scratch, relPath);
            await fs.mkdir(path.dirname(full), { recursive: true });
            await fs.writeFile(full, contents);
            const { size } = await fs.stat(full);
            const ext = relPath.endsWith('.json.gz') ? 'gz' : relPath.split('.').pop();
            files.push({
                role,
                path: relPath,
                mime: MIME[ext] ?? 'application/octet-stream',
                bytes: size,
                rows,
                ...(uncompressedBytes === null ? {} : { uncompressedBytes }),
            });
            return size;
        },
        async writeJsonl(relPath, role, values, { chunkRows = 512 } = {}) {
            const problem = unsafeRelativePath(relPath);
            if (problem) throw Object.assign(new Error(`unsafe artifact path ${relPath}: ${problem}`),
                { code: 'EXPORT_FAILED' });
            const full = path.join(scratch, relPath);
            await fs.mkdir(path.dirname(full), { recursive: true });

            const handle = await fs.open(full, 'w');
            let rows = 0;
            let bytes = 0;
            let pending = [];
            const flush = async () => {
                if (!pending.length) return;
                const { bytesWritten } = await handle.write(pending.join(''));
                bytes += bytesWritten;
                pending = [];
            };
            try {
                for (const value of values) {
                    pending.push(`${JSON.stringify(value)}\n`);
                    rows += 1;
                    if (pending.length >= chunkRows) await flush();
                }
                await flush();
            } finally {
                await handle.close();
            }
            files.push({ role, path: relPath, mime: MIME.jsonl, bytes, rows });
            return rows;
        },
    };
}

function* rowsOf(parsed, dbIndex, tool) {
    for (const groupId of Object.keys(parsed.results[dbIndex]?.alignments ?? {})) {
        yield serializeRow(parsed, dbIndex, groupId, { tool });
    }
}

async function writeSearchFiles(collector, { parsed, tool, counts, issues }) {
    for (const [dbIndex, entryData] of (parsed.results ?? []).entries()) {
        const safe = `db-${dbIndex}`;
        const expected = counts.databases[dbIndex].parsedRows;
        if (expected > 0) {
            const written = await collector.writeJsonl(
                `search/${safe}.rows.jsonl`, 'rows', rowsOf(parsed, dbIndex, tool));
            if (written !== expected) {
                issues.push({
                    code: 'EXPORTED_ROW_MISMATCH',
                    detail: `${entryData.db}: wrote ${written} rows for ${expected} parsed groups`,
                });
            }
        }

        const report = entryData.taxonomyreports?.[0];
        if (report?.length) {
            const { nodes, issues: taxIssues } = taxonomyExport(report);
            for (const issue of taxIssues) {
                issues.push({ ...issue, detail: `${entryData.db}: ${issue.detail}` });
            }
            await collector.write(`search/${safe}.taxonomy.json`, 'taxonomy',
                JSON.stringify({ db: entryData.db, dbIndex, totalNodes: nodes.length, nodes }),
                { rows: nodes.length });

            // A hit whose leaf taxon is absent from the report cannot be placed in the tree.
            const known = new Set(nodes.map(n => n.taxId));
            const dangling = new Set();
            for (const group of Object.values(entryData.alignments ?? {})) {
                const head = Array.isArray(group) ? group[0] : group;
                const taxId = Number(head?.taxId);
                // 0 is the "unclassified" sentinel: no assignment to dangle.
                if (Number.isFinite(taxId) && taxId !== 0 && !known.has(taxId)) dangling.add(taxId);
            }
            if (dangling.size) {
                issues.push({
                    code: 'REFERENCE_GAP',
                    detail: `${entryData.db}: ${dangling.size} row taxon id(s) are absent from the taxonomy report`,
                });
            }
        }

        if (tool === 'folddisco' && expected > 0) {
            const patterns = motifPatternExport(entryData);
            await collector.write(`search/${safe}.motif-patterns.json`, 'motif-patterns',
                JSON.stringify({ db: entryData.db, dbIndex, ...patterns }),
                { rows: patterns.patterns.length });
        }
    }
}

async function writeFoldMasonFiles(collector, { result, issues }) {
    const entries = result?.entries ?? [];
    const roster = foldMasonEntries(result);
    await collector.write('msa/entries.json', 'msa-entries', JSON.stringify(roster), { rows: entries.length });

    for (const [representation, role] of [['aa', 'msa-fasta-aa'], ['3di', 'msa-fasta-3di']]) {
        const fasta = foldMasonFasta(result, { representation, limit: 0 });
        if (fasta.error || !fasta.fasta) continue;
        await collector.write(`msa/${representation}.fasta`, role, fasta.fasta, { rows: fasta.returned });
    }

    const columns = foldMasonColumns(result, { limit: 0, includeLetters: true, precision: null });
    if (!columns.error) {
        await collector.writeJsonl('msa/columns.jsonl', 'msa-columns', columns.rows);
    }

    const maps = [];
    for (let i = 0; i < entries.length; i++) {
        try { maps.push(msaResidueMap(result, i)); } catch { /* counted as a roster mismatch below */ }
    }
    if (maps.length) await collector.writeJsonl('msa/residue-map.jsonl', 'msa-residue-map', maps);
    if (maps.length !== entries.length) {
        issues.push({
            code: 'ROSTER_MISMATCH',
            detail: `residue map covers ${maps.length} of ${entries.length} entries`,
        });
    }

    const coordinates = entries.map((e, index) => ({
        index, name: e.name, ca: typeof e.ca === 'string' ? e.ca : null,
    }));
    if (coordinates.some(c => c.ca)) {
        const raw = JSON.stringify({ totalEntries: entries.length, entries: coordinates });
        const gz = zlib.gzipSync(Buffer.from(raw, 'utf8'));
        await collector.write('msa/coordinates.json.gz', 'msa-coordinates', gz,
            { rows: coordinates.length, uncompressedBytes: Buffer.byteLength(raw) });
    }

    if (typeof result?.tree === 'string' && result.tree.length) {
        await collector.write('msa/tree.json', 'msa-tree', JSON.stringify({ newick: result.tree }));
    }
}

/**
 * Assemble the manifest and every data file for one unit.
 * @returns {(scratch: string) => Promise<object>} the writer `store.build` expects
 */
export function artifactWriter({
    artifactId, serverNamespace, ticket, entry, jobType, table = null, foldMasonResult = null,
    record = null, catalog = null, configuredCap = null, clock = () => new Date(),
}) {
    return async (scratch) => {
        const kind = kindForJobType(jobType);
        const collector = fileCollector(scratch);
        const issues = [];

        let counts;
        let completeness;
        let ranking = null;
        let semantics = {};
        let databases = [];
        let mode = null;

        if (kind === 'foldmason') {
            const entries = foldMasonResult?.entries ?? [];
            counts = { serverAlignments: entries.length, parsedRows: entries.length, grouping: 'none' };
            completeness = completenessOf({ jobType, parsedRows: entries.length });
            await writeFoldMasonFiles(collector, { result: foldMasonResult, issues });
        } else {
            const parsed = table.raw;
            mode = table.mode || null;
            const measured = resultCounts(parsed, { tool: table.tool });
            const provenance = databaseProvenance(parsed, catalog);
            ranking = defaultRankingSemantics({
                tool: table.tool, mode: table.mode, isComplex: table.isComplex,
            });
            semantics = Object.fromEntries(
                NUMERIC_METRIC_FIELDS
                    .map(field => [field, metricSemantics({ tool: table.tool, mode: table.mode, field })])
                    .filter(([, s]) => s.known)
                    .map(([field, { known, ...facts }]) => [field, facts]),
            );
            databases = provenance.databases.map((db, i) => ({
                ...db,
                serverAlignments: measured.databases[i].serverAlignments,
                parsedRows: measured.databases[i].parsedRows,
            }));
            counts = {
                serverAlignments: measured.serverAlignments,
                parsedRows: measured.parsedRows,
                grouping: measured.grouping,
            };
            const largest = measured.databases.reduce((a, d) => Math.max(a, d.parsedRows), 0);
            completeness = completenessOf({ jobType, parsedRows: largest, configuredCap });

            await writeSearchFiles(collector, { parsed, tool: table.tool, counts: measured, issues });
            await collector.write('databases.json', 'databases',
                JSON.stringify({ catalogAvailable: provenance.catalogAvailable, databases }),
                { rows: databases.length });
        }

        const exportedRows = collector.files
            .filter(f => f.role === 'rows' || f.role === 'msa-entries')
            .reduce((a, f) => a + (f.rows ?? 0), 0);

        return {
            schema: ARTIFACT_SCHEMA,
            artifactId,
            state: { serverNamespace, ticket, entry, jobType, mode, resultKind: kind === 'complexsearch' ? 'complexsearch' : (kind === 'search' ? 'search' : kind) },
            derivedFrom: record?.derivedFrom ?? null,
            createdAt: clock().toISOString(),
            builtBy: BUILT_BY,
            counts: { ...counts, exportedRows },
            completeness,
            ranking,
            metricSemantics: semantics,
            databases,
            files: collector.files,
            integrityIssues: issues,
        };
    };
}

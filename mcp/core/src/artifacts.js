// Build each result bundle in scratch and expose it only after an atomic READY-marked rename.

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

import { ARTIFACT_SCHEMA, validateArtifactManifest, unsafeRelativePath } from './schemas.js';
import { defaultRankingSemantics, metricSemantics, NUMERIC_METRIC_FIELDS } from './metrics.js';
import {
    kindForJobType, toolForJobType, resultCounts, completenessOf, databaseProvenance,
    taxonomyExport, serializeRow, motifPatternExport, queryRoster,
} from './facts.js';
import { foldMasonColumns, foldMasonEntries, foldMasonFasta, msaResidueMap } from './msa.js';
import { listCaResidues } from '../../../frontend/lib/structureText.js';
import { splitAlphaNum } from '../../../frontend/lib/parseResults.js';

export const ARTIFACT_ID = /^[0-9a-f]{64}$/;
export const DEFAULT_ARTIFACT_TTL_SECONDS = 1800;

/** Marks an artifact root safe for cleanup. */
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

/** Normalize a server origin into one artifact namespace. */
export function serverNamespaceFor({ baseUrl, apiPath = '/api' } = {}) {
    const trimmed = String(baseUrl ?? '').replace(/\/+$/, '');
    let origin = trimmed;
    try {
        const url = new URL(trimmed);
        origin = `${url.protocol.toLowerCase()}//${url.host.toLowerCase()}`;
    } catch { /* Preserve non-URL identifiers. */ }
    return `${origin}${String(apiPath ?? '').replace(/\/+$/, '')}`;
}

export function artifactCacheKey({ serverNamespace, ticketId, queryIdx }) {
    const parts = [serverNamespace, ticketId, String(queryIdx), ARTIFACT_SCHEMA];
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

/** Check a JSONL terminal newline without reading the whole file. */
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
    verifyRows = false,
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
        now: () => clock(),

        dirFor,
        isActive: id => building.has(id),

        /** Validate READY, manifest, file sizes and JSONL endings; optionally recount rows. */
        async read(id, { verifyRows: verify = verifyRows } = {}) {
            let dir;
            try { dir = dirFor(id); } catch { return { ok: false, reason: 'INVALID_ID' }; }

            try { await fs.access(dir); } catch { return { ok: false, reason: 'ABSENT' }; }
            // Never read an unfinished build.
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

        /** Build in same-filesystem scratch, atomically rename and reuse a valid race winner. */
        async build(id, write) {
            const dir = dirFor(id);
            await fs.mkdir(root, { recursive: true });
            // Claim the root before it becomes eligible for cleanup.
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

        /** Describe roles, sizes and counts without file contents. */
        descriptor(manifest, { cacheHit = false } = {}) {
            const id = manifest.artifactId;
            const accessed = clock();
            const out = {
                schema: manifest.schema,
                artifactId: id,
                cacheHit,
                ticket: manifest.state.ticket,
                queryIdx: manifest.state.queryIdx,
                tool: manifest.state.tool,
                ...(manifest.queries ? { queries: manifest.queries } : {}),
                counts: manifest.counts,
                completeness: manifest.completeness,
                files: manifest.files.map(({ role, path: p, mime, bytes, rows, uncompressedBytes }) => ({
                    role, path: p, mime, bytes, rows,
                    ...(uncompressedBytes === undefined ? {} : { uncompressedBytes }),
                })),
                integrityIssues: manifest.integrityIssues,
                expiresAt: new Date(accessed.getTime() + ttlSeconds * 1000).toISOString(),
            };
            if (pathPrefix) out.pathFromMount = path.join(pathPrefix, id);
            return out;
        },
    };
    return store;
}

/** Record manifest entries while writing files. */
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

function numbers(value, count) {
    const values = Array.isArray(value) ? value.map(Number)
        : String(value ?? '').split(',').filter(part => part.trim() !== '').map(Number);
    return values.length === count && values.every(Number.isFinite) ? values : null;
}

function motifResidues(parsed) {
    if (typeof parsed?.motif === 'string' && parsed.motif.trim() !== '') {
        return parsed.motif.split(',').map(token => token.trim().split(':')[0]).filter(Boolean);
    }
    for (const result of parsed?.results ?? []) {
        for (const group of Object.values(result?.alignments ?? {})) {
            const head = Array.isArray(group) ? group[0] : group;
            if (typeof head?.queryresidues === 'string' && head.queryresidues !== '') {
                return head.queryresidues.split(',').map(token => token.trim()).filter(Boolean);
            }
        }
    }
    return [];
}

async function queryResidueCoordinates(structureText, residues, issues) {
    const rows = await listCaResidues(structureText);
    const byAddress = new Map();
    const byNumber = new Map();
    for (const row of rows) {
        byAddress.set(`${row.chain}|${row.resno}`, row);
        if (!byNumber.has(String(row.resno))) byNumber.set(String(row.resno), []);
        byNumber.get(String(row.resno)).push(row);
    }

    let missing = 0;
    let ambiguous = 0;
    const positions = residues.map((residue, motifIndex) => {
        const [chain, resno] = splitAlphaNum(residue);
        let row = chain ? byAddress.get(`${chain}|${resno}`) : null;
        if (!chain) {
            const candidates = byNumber.get(String(resno)) ?? [];
            if (candidates.length === 1) row = candidates[0];
            else if (candidates.length > 1) ambiguous += 1;
        }
        if (!row) missing += 1;
        return {
            motifIndex,
            residue,
            queryCa: row ? row.xyz : null,
        };
    });
    if (missing || ambiguous) {
        issues.push({
            code: 'RESIDUE_GEOMETRY_MISMATCH',
            detail: `query motif: ${missing} residue coordinate(s) missing; ${ambiguous} unchained token(s) ambiguous`,
        });
    }
    return { queryResidues: residues, positions };
}

function residueGeometry(parsed, dbIndex, issues) {
    const rows = [];
    let badCoordinates = 0;
    let badMatrices = 0;
    let badWidth = 0;
    for (const groupId of Object.keys(parsed.results[dbIndex]?.alignments ?? {})) {
        const group = parsed.results[dbIndex].alignments[groupId];
        const hit = Array.isArray(group) ? group[0] : group;
        const queryResidues = String(hit?.queryresidues ?? '').split(',').map(v => v.trim()).filter(Boolean);
        const targetResidues = String(hit?.targetresidues ?? '').split(',').map(v => v.trim());
        const matched = targetResidues.filter(token => token !== '_').length;
        const flatCa = numbers(hit?.tCa, matched * 3);
        const tmat = numbers(hit?.tmat, 3);
        const umat = numbers(hit?.umat, 9);
        if (!flatCa) badCoordinates += 1;
        if (!tmat || !umat) badMatrices += 1;
        if (queryResidues.length !== targetResidues.length) badWidth += 1;

        let caIndex = 0;
        const positions = targetResidues.map((targetResidue, motifIndex) => {
            const gap = targetResidue === '_';
            const targetCa = !gap && flatCa ? flatCa.slice(caIndex * 3, caIndex * 3 + 3) : null;
            if (!gap) caIndex += 1;
            return { motifIndex, targetResidue: gap ? null : targetResidue, targetCa };
        });
        rows.push({
            id: `${dbIndex}#${groupId}`,
            dbIndex,
            groupId: String(groupId),
            target: hit?.target ?? null,
            queryResidues,
            positions,
            tmat,
            umat,
        });
    }
    if (badCoordinates || badMatrices || badWidth) {
        issues.push({
            code: 'RESIDUE_GEOMETRY_MISMATCH',
            detail: `${parsed.results[dbIndex]?.db ?? `db-${dbIndex}`}: ${badCoordinates} bad tCa, `
                + `${badMatrices} bad transform, ${badWidth} residue-width mismatch row(s)`,
        });
    }
    return rows;
}

async function writeSearchFiles(collector, { parsed, tool, counts, issues, queryStructure }) {
    if (tool === 'folddisco') {
        const residues = motifResidues(parsed);
        const query = await queryResidueCoordinates(queryStructure, residues, issues);
        await collector.write('search/query-residue-coordinates.json', 'query-residue-coordinates',
            JSON.stringify(query), { rows: query.positions.length });
    }
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

            // Report hit taxa missing from the exported taxonomy tree.
            const known = new Set(nodes.map(n => n.taxId));
            const dangling = new Set();
            for (const group of Object.values(entryData.alignments ?? {})) {
                const head = Array.isArray(group) ? group[0] : group;
                const taxId = Number(head?.taxId);
                // Taxon 0 is unclassified, not a dangling assignment.
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
            await collector.writeJsonl(`search/${safe}.residue-geometry.jsonl`, 'residue-geometry',
                residueGeometry(parsed, dbIndex, issues));
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
        try { maps.push(msaResidueMap(result, i)); } catch { /* Counted below. */ }
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

/** Build the manifest and data files for one result unit. */
export function artifactWriter({
    artifactId, serverNamespace, ticket, queryIdx, jobType, table = null, foldMasonResult = null,
    record = null, catalog = null, queryStructure = null, configuredCap = null, queries = null,
    clock = () => new Date(),
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

            await writeSearchFiles(collector, {
                parsed, tool: table.tool, counts: measured, issues, queryStructure,
            });
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
            state: { serverNamespace, ticket, queryIdx, mode, tool: toolForJobType(jobType) },
            ...(queries ? { queries: queryRoster(queries) } : {}),
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

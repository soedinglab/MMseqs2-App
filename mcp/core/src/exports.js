// Publish complete result artifacts without owning result or storage rules.

import fs from 'node:fs/promises';
import { artifactCacheKey, artifactWriter } from './artifacts.js';

const GC_MIN_INTERVAL_SECONDS = 600;

export function createExportService({
    results,
    getDatabases,
    artifactStore,
    serverNamespace,
    resultRowCap = null,
    collectGarbage,
    onWarning = null,
} = {}) {
    if (!results) throw new Error('createExportService({ results }) is required');
    if (!artifactStore) throw new Error('createExportService({ artifactStore }) is required');

    return {
        async exportResult(ticket, queryIdx = 0) {
            const unit = await results.resolveUnit(ticket, queryIdx);
            if (unit.status !== 'COMPLETE') {
                const err = new Error(`ticket ${ticket} is ${unit.status}; nothing to export yet`);
                err.code = unit.status === 'COMPLETE' ? 'EXPORT_FAILED' : 'RESULT_NOT_READY';
                err.status = unit.status;
                throw err;
            }

            const artifactId = artifactCacheKey({
                serverNamespace, ticketId: ticket, queryIdx: unit.queryIdx,
            });
            const hit = await artifactStore.read(artifactId);
            if (hit.ok) {
                await artifactStore.touch(artifactId);
                return artifactStore.descriptor(hit.manifest, { cacheHit: true });
            }
            if (hit.reason !== 'ABSENT') {
                onWarning?.(`rebuilding artifact ${artifactId.slice(0, 12)}: ${hit.reason}`);
                await fs.rm(artifactStore.dirFor(artifactId), { recursive: true, force: true });
            }

            const catalog = await getDatabases().catch(() => null);
            const queryStructure = unit.kind === 'folddisco'
                ? (await results.getQueryStructure(ticket, { encodeComplex: false })).content
                : null;
            const { manifest, cacheHit } = await artifactStore.build(artifactId, artifactWriter({
                artifactId,
                serverNamespace,
                ticket,
                queryIdx: unit.queryIdx,
                jobType: unit.jobType,
                table: unit.table ?? null,
                foldMasonResult: unit.foldMasonResult ?? null,
                record: unit.record,
                catalog,
                queryStructure,
                configuredCap: resultRowCap,
                clock: artifactStore.now,
            }));
            await collectGarbage({ minIntervalSeconds: GC_MIN_INTERVAL_SECONDS })
                .catch(err => onWarning?.(`GC failed: ${err.message}`));
            return artifactStore.descriptor(manifest, { cacheHit });
        },
    };
}

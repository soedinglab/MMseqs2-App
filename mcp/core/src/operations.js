// Coordinate backend requests, cached state, selections, exports and garbage collection.

import { Store, defaultStateDir } from './store.js';
import { TERMINAL_STATUSES, kindForJobType, toolForJobType } from './facts.js';
import { createArtifactStore, serverNamespaceFor } from './artifacts.js';
import {
    createGarbageCollector, fileAudit, DEFAULT_RESULT_TTL_SECONDS,
} from './gc.js';
import { DEFAULT_INPUT_TTL_SECONDS, sharedPaths, describeSharedDir } from './inputs.js';
import path from 'node:path';
import { createSubmitService, FOLDMASON_MIN_FILES, assertTaxFilter } from './submits.js';
import { createResultService } from './results.js';
import { createSelectionService } from './selections.js';
import { createExportService } from './exports.js';
import {
    createBackendClient, HttpError, UnsupportedOnDeploymentError,
} from './backendClient.js';

export { TERMINAL_STATUSES, kindForJobType, toolForJobType };
export { HttpError, UnsupportedOnDeploymentError };

export { FOLDMASON_MIN_FILES, assertTaxFilter };

export function createOperations({
    backend = null,
    baseUrl,
    apiPath = '/api',
    cg2allUrl = 'https://3di.foldseek.com/cg2all/predict',
    stateDir = defaultStateDir(),
    basicAuth = null,
    fetchImpl = globalThis.fetch,
    onWarning = null,
    resultRowCap = null,
    sharedDir = null,
    resultTtlSeconds = DEFAULT_RESULT_TTL_SECONDS,
    inputTtlSeconds = DEFAULT_INPUT_TTL_SECONDS,
    artifacts = {},
} = {}) {
    const backendClient = backend ?? createBackendClient({
        baseUrl, apiPath, basicAuth, fetchImpl,
    });
    const effectiveBaseUrl = backendClient.baseUrl;
    const effectiveFetchImpl = backendClient.fetchImpl;
    const effectiveApiPath = backendClient.apiRoot.slice(effectiveBaseUrl.length);
    const store = new Store(stateDir);

    const serverNamespace = serverNamespaceFor({
        baseUrl: effectiveBaseUrl, apiPath: effectiveApiPath,
    });

    // Keep user-visible shared files outside private server state.
    const shared = sharedDir ? path.resolve(sharedDir) : null;
    if (shared) {
        const toState = path.relative(shared, stateDir);
        if (toState === '' || (!toState.startsWith('..') && !path.isAbsolute(toState))) {
            throw new Error(`sharedDir ${shared} contains the state directory ${stateDir} — ` +
                            'pick a directory outside it');
        }
    }
    const { exportsDir, importsDir } = shared ? sharedPaths(shared) : {};
    const artifactRoot = exportsDir || path.join(stateDir, 'artifacts');
    const artifactStore = createArtifactStore({
        root: artifactRoot,
        pathPrefix: shared ? 'exports' : null,
        ...artifacts,
    });
    let submits;
    const results = createResultService({
        backend: backendClient,
        store,
        getDatabases: (...args) => submits.getDatabases(...args),
        resultRowCap,
    });
    const selections = createSelectionService({ store, results });
    submits = createSubmitService({
        backend: backendClient,
        store,
        results,
        fetchImpl: effectiveFetchImpl,
        cg2allUrl,
        onWarning,
    });
    const collectGarbage = createGarbageCollector({
        artifactStore,
        store,
        importsDir,
        stateDir,
        resultTtlSeconds,
        inputTtlSeconds,
        onWarning,
        audit: artifacts.audit ?? fileAudit(path.join(stateDir, 'artifact-gc-audit.jsonl')),
    });
    const exportsService = createExportService({
        results,
        getDatabases: submits.getDatabases,
        artifactStore,
        serverNamespace,
        resultRowCap,
        collectGarbage,
        onWarning,
    });

    const ops = {
        baseUrl: effectiveBaseUrl,
        apiRoot: backendClient.apiRoot,
        backend: backendClient,
        cg2allUrl,
        store,
        fetchImpl: effectiveFetchImpl,
        onWarning,

        ...results,
        ...selections,
        ...submits,
        ...exportsService,

        getSharedDir({ localTransport = true } = {}) {
            return describeSharedDir(shared, {
                exposeLocalPaths: localTransport && artifacts.exposeLocalPaths !== false,
            });
        },

        artifacts: artifactStore,
        serverNamespace,
        collectGarbage,

        // Expose the shared layout to MCP transport setup.
        sharedDirs: shared ? { shared, exportsDir, importsDir } : null,
    };

    return ops;
}

export { idForHit } from './table.js';

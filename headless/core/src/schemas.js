// Public contract shapes. A version bump means a public meaning or shape change, not a refactor.

export const SUMMARY_SCHEMA = 'foldseek-server/result-summary@1';
export const ARTIFACT_SCHEMA = 'foldseek-server/result-artifact@1';

export const TOOLS = ['foldseek', 'multimer', 'foldmason', 'folddisco'];
export const STATUSES = ['PENDING', 'RUNNING', 'COMPLETE', 'ERROR', 'UNKNOWN'];
export const INTEGRITY_CODES = [
    'ROSTER_MISMATCH', 'REFERENCE_GAP', 'TAXONOMY_DEPTH_JUMP', 'EXPORTED_ROW_MISMATCH',
];
export const SELECTION_KINDS = ['rows', 'columns'];

const ARTIFACT_ID = /^[0-9a-f]{64}$/;

function isObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const IS = {
    string: v => typeof v === 'string' && v.length > 0,
    boolean: v => typeof v === 'boolean',
    int: v => Number.isSafeInteger(v),
    number: v => typeof v === 'number' && Number.isFinite(v),
    object: isObject,
    array: Array.isArray,
};

/** Relative, contained, and free of anything a path resolver could reinterpret. */
export function unsafeRelativePath(value) {
    if (typeof value !== 'string' || value.length === 0) return 'must be a non-empty string';
    if (value.includes('\\')) return 'must not contain a backslash';
    if (value.includes('\0')) return 'must not contain a null byte';
    if (value.startsWith('/')) return 'must be relative';
    if (/^[A-Za-z]:/.test(value)) return 'must not be a drive-absolute path';
    if (value.split('/').some(part => part === '..' || part === '.' || part === '')) {
        return 'must not contain empty or traversal segments';
    }
    if (value.includes('%2e') || value.includes('%2E') || value.includes('%2f') || value.includes('%2F')) {
        return 'must not contain percent-encoded separators';
    }
    return null;
}

function checkValue(errors, path, value, spec) {
    if (value === null) {
        if (!spec.nullable) errors.push({ path, problem: 'must not be null' });
        return;
    }
    if (!IS[spec.type](value)) {
        errors.push({ path, problem: `expected ${spec.type}` });
        return;
    }
    if (spec.enum && !spec.enum.includes(value)) {
        errors.push({ path, problem: `expected one of ${spec.enum.join(', ')}` });
    }
    if (spec.pattern && !spec.pattern.test(value)) {
        errors.push({ path, problem: `does not match ${spec.pattern}` });
    }
    if (spec.min !== undefined && value < spec.min) {
        errors.push({ path, problem: `must be >= ${spec.min}` });
    }
    if (spec.items) value.forEach((item, i) => checkValue(errors, `${path}[${i}]`, item, spec.items));
    if (spec.shape) checkShape(errors, path, value, spec.shape);
    if (spec.check) {
        const problem = spec.check(value);
        if (problem) errors.push({ path, problem });
    }
}

function checkShape(errors, base, value, shape) {
    const at = key => (base ? `${base}.${key}` : key);
    for (const [key, spec] of Object.entries(shape.fields)) {
        if (!Object.hasOwn(value, key)) {
            if (spec.required) errors.push({ path: at(key), problem: 'required' });
            continue;
        }
        checkValue(errors, at(key), value[key], spec);
    }
    if (shape.allowExtra) return;
    for (const key of Object.keys(value)) {
        if (!Object.hasOwn(shape.fields, key)) {
            errors.push({ path: at(key), problem: 'unexpected field' });
        }
    }
}

function run(value, shape) {
    if (!isObject(value)) return { ok: false, errors: [{ path: '', problem: 'expected object' }] };
    const errors = [];
    checkShape(errors, '', value, shape);
    return { ok: errors.length === 0, errors };
}

// Flat: a nested "semantics" object repeated the sort order and echoed the mode, tool and field that
// the enclosing payload already carries.
const RANKING = {
    allowExtra: false,
    fields: {
        field: { type: 'string', required: true },
        label: { type: 'string', required: true },
        direction: { type: 'string', required: true, enum: ['higher', 'lower'] },
        crossDatabaseComparable: { type: 'boolean', required: true, nullable: true },
    },
};

const COMPLETENESS = {
    allowExtra: false,
    fields: {
        complete: { type: 'boolean', required: true, nullable: true },
        saturated: { type: 'boolean', required: true },
        rowCap: { type: 'int', nullable: true, min: 1 },
    },
};

function counts({ exportedRows = false } = {}) {
    return {
        allowExtra: false,
        fields: {
            serverAlignments: { type: 'int', required: true, min: 0 },
            parsedRows: { type: 'int', required: true, min: 0 },
            exportedRows: { type: 'int', required: exportedRows, min: 0 },
            grouping: { type: 'string', required: true, enum: ['complexid', 'none'] },
        },
    };
}

const ARTIFACT_DATABASE = {
    allowExtra: false,
    fields: {
        dbIndex: { type: 'int', required: true, min: 0 },
        id: { type: 'string', required: true },
        safeName: { type: 'string', required: true },
        display: { type: 'string', nullable: true },
        version: { type: 'string', nullable: true },
        status: { type: 'string', nullable: true },
        taxonomy: { type: 'boolean', required: true },
        taxonomyTree: { type: 'boolean', required: true },
        hasDescription: { type: 'boolean', required: true },
        serverAlignments: { type: 'int', required: true, min: 0 },
        parsedRows: { type: 'int', required: true, min: 0 },
    },
};

const SUMMARY_DATABASE = {
    allowExtra: false,
    fields: {
        dbIndex: { type: 'int', required: true, min: 0 },
        id: { type: 'string', required: true },
        display: { type: 'string', nullable: true },
        version: { type: 'string', nullable: true },
        taxonomyTree: { type: 'boolean', required: true },
        parsedRows: { type: 'int', required: true, min: 0 },
        topHit: {
            type: 'object',
            nullable: true,
            shape: {
                allowExtra: false,
                fields: {
                    id: { type: 'string', required: true },
                    target: { type: 'string', nullable: true },
                    value: { type: 'number', nullable: true },
                    taxName: { type: 'string', nullable: true },
                },
            },
        },
    },
};

const SELECTION = {
    allowExtra: false,
    fields: {
        name: { type: 'string', required: true },
        kind: { type: 'string', required: true, enum: SELECTION_KINDS },
        size: { type: 'int', required: true, min: 0 },
        // One index each, under its own name: rows belong to a query, columns to an alignment row.
        queryIdx: { type: 'int', min: 0 },
        entry: { type: 'int', min: 0 },
        createdAt: { type: 'string', required: true, nullable: true },
        updatedAt: { type: 'string', required: true, nullable: true },
    },
};

const SUMMARY_HEAD = {
    schema: { type: 'string', required: true, enum: [SUMMARY_SCHEMA] },
    ticket: { type: 'string', required: true },
    // Omitted for FoldMason and FoldDisco: one result per ticket, so there is no query to index.
    queryIdx: { type: 'int', min: 0 },
    status: { type: 'string', required: true, enum: STATUSES },
};

// Two variants rather than one shape of optional fields: a not-ready summary must not be able to
// carry result data, and a complete one must not be able to omit it.
const SUMMARY_NOT_READY = {
    allowExtra: false,
    fields: {
        ...SUMMARY_HEAD,
        tool: { type: 'string', required: true, nullable: true, enum: TOOLS },
        code: { type: 'string', required: true, enum: ['RESULT_NOT_READY', 'RESULT_FAILED'] },
        next: { type: 'string', required: true },
    },
};

const SUMMARY_READY = {
    allowExtra: false,
    fields: {
        ...SUMMARY_HEAD,
        mode: { type: 'string', nullable: true },
        tool: { type: 'string', required: true, enum: TOOLS },
        submission: { type: 'object', required: true, nullable: true },
        derivedFrom: { type: 'object', required: true, nullable: true },
        databases: { type: 'array', required: true, items: { type: 'object', shape: SUMMARY_DATABASE } },
        counts: { type: 'object', required: true, shape: counts() },
        completeness: { type: 'object', required: true, shape: COMPLETENESS },
        ranking: { type: 'object', required: true, nullable: true, shape: RANKING },
        motifPatterns: {
            type: 'object',
            nullable: true,
            shape: {
                allowExtra: false,
                fields: {
                    distinct: { type: 'int', required: true, min: 0 },
                    top: { type: 'array', required: true },
                    queryResidues: { type: 'object', nullable: true },
                },
            },
        },
        msa: { type: 'object', nullable: true },
        selections: { type: 'array', required: true, items: { type: 'object', shape: SELECTION } },
    },
};

const MANIFEST = {
    allowExtra: false,
    fields: {
        schema: { type: 'string', required: true, enum: [ARTIFACT_SCHEMA] },
        artifactId: { type: 'string', required: true, pattern: ARTIFACT_ID },
        state: {
            type: 'object',
            required: true,
            shape: {
                allowExtra: false,
                fields: {
                    serverNamespace: { type: 'string', required: true },
                    ticket: { type: 'string', required: true },
                    queryIdx: { type: 'int', required: true, min: 0 },
                    mode: { type: 'string', nullable: true },
                    tool: { type: 'string', required: true, enum: TOOLS },
                },
            },
        },
        derivedFrom: { type: 'object', required: true, nullable: true },
        createdAt: { type: 'string', required: true },
        builtBy: {
            type: 'object',
            required: true,
            shape: {
                allowExtra: false,
                fields: {
                    package: { type: 'string', required: true },
                    version: { type: 'string', required: true },
                },
            },
        },
        counts: { type: 'object', required: true, shape: counts({ exportedRows: true }) },
        completeness: { type: 'object', required: true, shape: COMPLETENESS },
        ranking: { type: 'object', required: true, nullable: true, shape: RANKING },
        metricSemantics: { type: 'object', required: true },
        databases: { type: 'array', required: true, items: { type: 'object', shape: ARTIFACT_DATABASE } },
        files: {
            type: 'array',
            required: true,
            items: {
                type: 'object',
                shape: {
                    allowExtra: false,
                    fields: {
                        role: { type: 'string', required: true },
                        path: { type: 'string', required: true, check: unsafeRelativePath },
                        mime: { type: 'string', required: true },
                        bytes: { type: 'int', required: true, min: 0 },
                        rows: { type: 'int', required: true, nullable: true, min: 0 },
                        uncompressedBytes: { type: 'int', min: 0 },
                    },
                },
            },
        },
        integrityIssues: {
            type: 'array',
            required: true,
            items: {
                type: 'object',
                shape: {
                    allowExtra: false,
                    fields: {
                        code: { type: 'string', required: true, enum: INTEGRITY_CODES },
                        detail: { type: 'string', required: true },
                    },
                },
            },
        },
    },
};

export function validateResultSummary(value) {
    if (!isObject(value)) return { ok: false, errors: [{ path: '', problem: 'expected object' }] };
    return run(value, value.status === 'COMPLETE' ? SUMMARY_READY : SUMMARY_NOT_READY);
}

export function validateArtifactManifest(value) {
    return run(value, MANIFEST);
}

// Column filters for the result tables. A filter holds for a group when any chain satisfies it.

import { expandDescendants } from './taxonomyFilter.js';

// FoldDisco shows `targetname`, the cleaned-up form of `target`.
const TEXT_FIELD = { target: ['target', 'targetname'], desc: ['description'] };
const RANGE_FIELD = {
    prob: 'prob', seqId: 'seqId', eval: 'eval', score: 'score',
    qtm: 'complexqtm', ttm: 'complexttm',
    idf: 'idfscore', rmsd: 'rmsd', node: 'nodecount',
};

const CHOICE_FIELD = { strand: 'strand' };
const CHOICE_LABEL = { strand: { '+': 'Plus (+)', '-': 'Minus (−)' } };

function choiceLabel(key, value) {
    return CHOICE_LABEL[key]?.[value] ?? String(value);
}

export function filterKind(key) {
    if (key === 'tax') return 'tax';
    if (key in TEXT_FIELD) return 'text';
    if (key in RANGE_FIELD) return 'range';
    if (key in CHOICE_FIELD) return 'choice';
    return null;
}

/** Distinct values of a categorical column as `{ value, text }`, sorted by value. */
export function choiceValues(alignments, key) {
    const field = CHOICE_FIELD[key];
    const values = new Set();
    for (const group of Object.values(alignments || {})) {
        for (const item of group) {
            if (item[field] != null) values.add(item[field]);
        }
    }
    return [...values].sort().map(value => ({ value, text: choiceLabel(key, value) }));
}

/** { min, max, minPositive } over every chain, or null when the column has no numbers. */
export function rangeBounds(alignments, key) {
    const field = RANGE_FIELD[key];
    let min = Infinity, max = -Infinity, minPositive = Infinity;
    for (const group of Object.values(alignments || {})) {
        for (const item of group) {
            const v = parseFloat(item[field]);
            if (Number.isNaN(v)) continue;
            if (v < min) min = v;
            if (v > max) max = v;
            if (v > 0 && v < minPositive) minPositive = v;
        }
    }
    return min <= max ? { min, max, minPositive } : null;
}

export function isLogScale(key, mode = '') {
    return key === 'eval' && mode !== 'tmalign' && mode !== 'lolalign';
}

/** Slider position <-> value. Log scale clamps non-positive values to the lowest position. */
export function sliderScale(bounds, log) {
    if (!log || !(bounds.minPositive < Infinity) || bounds.minPositive >= bounds.max) {
        return {
            min: bounds.min, max: bounds.max,
            toSlider: v => v,
            fromSlider: s => s,
        };
    }
    const lo = Math.log10(bounds.minPositive);
    const hi = Math.log10(bounds.max);
    return {
        min: lo, max: hi,
        toSlider: v => (v <= bounds.minPositive ? lo : Math.min(hi, Math.log10(v))),
        fromSlider: s => (s <= lo ? bounds.min : s >= hi ? bounds.max : 10 ** s),
    };
}

/** null when [lo, hi] covers the whole column, so a full-width range is no filter at all. */
export function normalizeRange(lo, hi, bounds) {
    if (Number.isNaN(lo) || Number.isNaN(hi)) return null;
    if (lo > hi) [lo, hi] = [hi, lo];
    if (lo <= bounds.min && hi >= bounds.max) return null;
    return [lo, hi];
}

/** Taxa that occur in the hits: the report subtree when present, else the hits' own taxa. */
export function taxonOptions(report, alignments) {
    if (Array.isArray(report) && report.length > 0) {
        return report
            .filter(r => Number(r.clade_reads) > 0)
            .map(r => ({
                text: r.name.trim(),
                value: String(r.taxon_id),
                rank: r.rank,
                count: Number(r.clade_reads),
            }));
    }
    const counts = new Map();
    for (const group of Object.values(alignments || {})) {
        for (const item of group) {
            if (item.taxId == null) continue;
            const id = String(item.taxId);
            const entry = counts.get(id) || { text: item.taxName, value: id, rank: '', count: 0 };
            entry.count++;
            counts.set(id, entry);
        }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count);
}

export function taxFilterFor(report, option) {
    const ids = Array.isArray(report) && report.length > 0
        ? expandDescendants(report, option.value)
        : [option.value];
    return { taxId: option.value, name: option.text, ids: ids.map(Number) };
}

function chainTest(key, value) {
    switch (filterKind(key)) {
        case 'text': {
            const needle = String(value).trim().toLowerCase();
            if (!needle) return null;
            const fields = TEXT_FIELD[key];
            return item => fields.some(field => String(item[field] ?? '').toLowerCase().includes(needle));
        }
        case 'tax': {
            const ids = new Set(value.ids);
            return item => ids.has(Number(item.taxId));
        }
        case 'choice': {
            const field = CHOICE_FIELD[key];
            return item => item[field] === value;
        }
        case 'range': {
            const [lo, hi] = value;
            const field = RANGE_FIELD[key];
            return item => {
                const v = parseFloat(item[field]);
                return v >= lo && v <= hi;
            };
        }
        default:
            return null;
    }
}

/** group => bool, or null when nothing filters. Only `keys` are applied when given. */
export function makeGroupPredicate(filters, keys = null) {
    const tests = Object.entries(filters || {})
        .filter(([key]) => !keys || keys.includes(key))
        .map(([key, value]) => chainTest(key, value))
        .filter(Boolean);
    if (tests.length === 0) return null;
    return group => tests.every(test => group.some(test));
}

export function formatFilterNumber(v, log = false) {
    if (!Number.isFinite(v)) return String(v);
    if (log || (v !== 0 && Math.abs(v) < 1e-3)) return v.toExponential(1);
    return String(parseFloat(v.toPrecision(3)));
}

export function formatFilterValue(key, value, log = false) {
    switch (filterKind(key)) {
        case 'text': return `"${value}"`;
        case 'tax': return value.name;
        case 'choice': return choiceLabel(key, value);
        case 'range': return `${formatFilterNumber(value[0], log)} – ${formatFilterNumber(value[1], log)}`;
        default: return String(value);
    }
}

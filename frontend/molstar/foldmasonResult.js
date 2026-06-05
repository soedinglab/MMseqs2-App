import { OrderedSet } from 'molstar/lib/mol-data/int';
import { to_mmCIF } from 'molstar/lib/mol-model/structure/export/mmcif';
import { MolScriptBuilder as MS } from 'molstar/lib/mol-script/language/builder';
import { tmalign, parseMatrix as parseTMMatrix } from 'tmalign-wasm';
import { pulchra } from 'pulchra-wasm';
import { decodeMultimer, mergeMultimer, revertChainInfo, splitMultimer, storeChains } from '../Utilities.js';
import { mockPDB } from './foldseekUtilities.js';
import { loadStructureFromData } from './io.js';
import { focusCurrentLoci, isValidLoci, lociFromExpression, OneToThree, residueInfoFromLoci, structuresMatch } from './interactions.js';
import { addUniformRepresentation, cartoonParams } from './representations.js';
import { mat4FromRotationTranslation, transformStructureConformation } from './transforms.js';
import { mergeExpressions, residueExpression } from './selectionExpressions.js';

const ReferenceColor = 0x1e88e5;
const RegularColor = 0xffc107;
const MaskColor = 0x666666;
async function addRepresentation(plugin, structure, label, color, expression, alpha = 1, type = 'cartoon', qualityPreset = 'viewer') {
    return addUniformRepresentation(plugin, structure, {
        label,
        type,
        color,
        expression,
        typeParams: cartoonParams({ alpha, qualityPreset }),
    });
}

async function addStructure(plugin, state, input, index) {
    const entry = input.entries[index];
    const pdb = await structurePDB(entry);
    const source = { data: pdb, format: 'pdb', label: `key-${index}` };
    let structure = await loadStructureFromData(plugin, source);

    if (index !== input.reference && state.referenceStructure) {
        const matrix = await superpositionMatrix(input.entries[input.reference], entry);
        structure = await transformStructureConformation(plugin, structure, matrix, {
            method: 'apply',
            tags: 'foldmason-transform',
        });
    }

    const color = index === input.reference ? ReferenceColor : RegularColor;
    const item = {
        index,
        entry,
        structure,
        base: await addRepresentation(plugin, structure, `foldmason-${index}`, color, MS.struct.generator.all(), 1, 'cartoon', input.representationQuality),
        mask: null,
    };
    item.mask = await addRepresentation(plugin, structure, `foldmason-${index}-mask`, MaskColor, maskExpression(entry, input.mask), 1, 'cartoon', input.representationQuality);
    state.structures.set(index, item);
    if (index === input.reference) state.referenceStructure = structure;
}

async function deleteRepresentation(plugin, item) {
    if (item?.component?.ref) {
        await plugin.state.data.build().delete(item.component.ref).commit();
    }
}

async function removeStructure(plugin, state, index) {
    const item = state.structures.get(index);
    if (!item) return;
    if (item.structure?.ref) {
        await plugin.state.data.build().delete(item.structure.ref).commit();
    }
    state.structures.delete(index);
}

function resetSceneState(state, input) {
    state.entries = input.entries;
    state.reference = input.reference;
    state.mask = input.mask;
    state.structures = new Map();
    state.referenceStructure = null;
    state.focusKey = null;
}

async function rebuildScene(plugin, state, input) {
    await plugin.clear();
    resetSceneState(state, input);

    if (!input.entries?.length || input.reference < 0) return;
    if (input.selection.includes(input.reference)) {
        await addStructure(plugin, state, input, input.reference);
    }
    for (const index of input.selection) {
        if (index !== input.reference) await addStructure(plugin, state, input, index);
    }
    plugin.managers.camera.reset();
}

async function updateStructures(plugin, state, input) {
    if (
        state.entries !== input.entries
        || state.reference !== input.reference
        || !state.structures
    ) {
        await rebuildScene(plugin, state, input);
        return;
    }

    const next = new Set(input.selection);
    for (const index of Array.from(state.structures.keys())) {
        if (!next.has(index)) await removeStructure(plugin, state, index);
    }
    for (const index of input.selection) {
        if (!state.structures.has(index)) await addStructure(plugin, state, input, index);
    }
    if (state.mask !== input.mask) {
        state.mask = input.mask;
        await updateMasks(plugin, state, input);
    }
}

async function updateMasks(plugin, state, input) {
    for (const item of state.structures.values()) {
        await deleteRepresentation(plugin, item.mask);
        item.mask = await addRepresentation(
            plugin,
            item.structure,
            `foldmason-${item.index}-mask`,
            MaskColor,
            maskExpression(item.entry, input.mask),
            1,
            'cartoon',
            input.representationQuality,
        );
    }
}

async function setSelection(plugin, state, input) {
    const loci = lociForColumns(state, input.selectedColumns || []);
    plugin.managers.interactivity.lociSelects.deselectAll();
    for (const item of loci) {
        plugin.managers.interactivity.lociSelects.select({ loci: item }, false);
    }
}

async function setPreview(plugin, state, input) {
    const column = input.previewColumn;
    if (!Number.isInteger(column) || column < 0) {
        plugin.managers.interactivity.lociHighlights.clearHighlights();
        return;
    }
    if (Number.isInteger(input.previewStructureIndex) && input.previewStructureIndex >= 0) {
        const item = state.structures.get(input.previewStructureIndex);
        const loci = item ? lociForItem(item, [column]) : null;
        if (loci) {
            plugin.managers.interactivity.lociHighlights.highlightOnly({ loci }, false);
        } else {
            plugin.managers.interactivity.lociHighlights.clearHighlights();
        }
        return;
    }
    const loci = lociForColumns(state, [column]);
    if (loci.length === 0) {
        plugin.managers.interactivity.lociHighlights.clearHighlights();
        return;
    }
    plugin.managers.interactivity.lociHighlights.highlightOnly({ loci: loci[0] }, false);
}

async function setFocus(plugin, state, input) {
    const focus = input.focusColumn;
    const key = Number.isInteger(focus) ? `${focus}:${input.focusToken || 0}` : null;
    if (state.focusKey === key) return;
    state.focusKey = key;
    if (!Number.isInteger(focus) || focus < 0) return;

    const reference = state.structures.get(input.reference);
    if (!reference) return;
    const loci = lociForItem(reference, [focus]);
    if (!loci) return;
    plugin.managers.camera.focusLoci(loci, {
        durationMs: 250,
        extraRadius: 8,
        minRadius: 4,
    });
}

function lociForColumns(state, columns) {
    const loci = [];
    for (const item of state.structures?.values?.() || []) {
        const itemLoci = lociForItem(item, columns);
        if (itemLoci) loci.push(itemLoci);
    }
    return loci;
}

function lociForItem(item, columns) {
    const expression = columnExpression(item.entry, columns);
    if (!expression) return null;
    return lociFromExpression(item.structure, expression);
}

function columnExpression(entry, columns) {
    return mergeExpressions(columns.map(column => residueExpressionForColumn(entry, column)));
}

function maskExpression(entry, mask = []) {
    const maskedColumns = [];
    for (let i = 0; i < entry.aa.length; i++) {
        if (mask[i] === 0) maskedColumns.push(i);
    }
    return columnExpression(entry, maskedColumns);
}

function residueExpressionForColumn(entry, column) {
    if (!Number.isInteger(column) || entry.aa?.[column] === '-') return null;
    const residueIndex = residueIndexForColumn(entry.aa, column);
    if (residueIndex < 1) return null;
    const chain = entry.chains?.[residueIndex] || 'A';
    const residue = entry.resns?.[residueIndex] || residueIndex;
    return mergeExpressions([
        residueExpression(chain, residue),
        residueExpression(null, residueIndex),
    ]);
}

function structureEvent(state, current, type) {
    if (!isValidLoci(current?.loci)) {
        return { type, column: -1, hasLoci: false };
    }
    const item = itemForLoci(state, current.loci);
    if (!item) return { type, column: -1, hasLoci: true, residue: null };

    const residue = residueInfoFromLoci(current.loci);
    if (!residue) {
        return {
            type,
            index: item.index,
            column: -1,
            hasLoci: true,
            residue: null,
            name: item.entry.name,
        };
    }

    const column = columnForResidue(item.entry, residue.chain, residue.residue);
    const residueInfo = residueInfoForColumn(item.entry, column) || {
        chain: residue.chain,
        residue: residue.residue,
        oneLetter: residue.oneLetter,
        threeLetter: residue.threeLetter,
    };
    return {
        type,
        index: item.index,
        column,
        hasLoci: true,
        name: item.entry.name,
        residue: residueInfo,
    };
}

function itemForLoci(state, loci) {
    for (const item of state.structures?.values?.() || []) {
        const structure = item.structure?.cell?.obj?.data;
        if (structuresMatch(loci.structure, structure)) return item;
    }
    return null;
}

function columnForResidue(entry, chain, residue) {
    let residueIndex = -1;
    const hasChain = typeof chain === 'string' && chain.trim() !== '';
    for (let i = 1; i < entry.resns.length; i++) {
        if ((!hasChain || (entry.chains?.[i] || 'A') === chain) && entry.resns[i] === residue) {
            residueIndex = i;
            break;
        }
    }
    if (residueIndex < 1) return -1;

    let seen = 0;
    for (let column = 0; column < entry.aa.length; column++) {
        if (entry.aa[column] === '-') continue;
        seen++;
        if (seen === residueIndex) return column;
    }
    return -1;
}

function residueInfoForColumn(entry, column) {
    if (!Number.isInteger(column) || column < 0 || entry.aa?.[column] === '-') return null;
    const residueIndex = residueIndexForColumn(entry.aa, column);
    if (residueIndex < 1) return null;
    const oneLetter = entry.aa[column] || '';
    return {
        chain: entry.chains?.[residueIndex] || 'A',
        residue: entry.resns?.[residueIndex] || residueIndex,
        oneLetter,
        threeLetter: OneToThree[oneLetter] || '',
    };
}

function residueIndexForColumn(seq, column) {
    let residueIndex = 0;
    for (let i = 0; i <= column && i < seq.length; i++) {
        if (seq[i] !== '-') residueIndex++;
    }
    return residueIndex;
}

async function superpositionMatrix(reference, target) {
    const alignment = mockAlignment(reference.aa, target.aa);
    const fasta = `>target\n${alignment.dbAln}\n\n>query\n${alignment.qAln}`;
    const referencePDB = subPDB(mockPDB(reference.ca, reference.aa.replace(/-/g, ''), 'A'), alignment.qStartPos, alignment.qEndPos);
    const targetPDB = subPDB(mockPDB(target.ca, target.aa.replace(/-/g, ''), 'A'), alignment.dbStartPos, alignment.dbEndPos);
    const { matrix } = await tmalign(targetPDB, referencePDB, fasta);
    const { t, u } = parseTMMatrix(matrix);
    return mat4FromRotationTranslation(t, u);
}

function mockAlignment(one, two) {
    const res = { backtrace: '', qAln: '', dbAln: '' };
    let started = false;
    let m = 0;
    let qr = 0;
    let tr = 0;
    let qBuffer = '';
    let tBuffer = '';
    while (m < one.length) {
        const qc = one[m];
        const tc = two[m];
        if (qc === '-' && tc === '-') {
            // skip
        } else if (qc === '-') {
            if (started) {
                res.backtrace += 'D';
                qBuffer += qc;
                tBuffer += tc;
            }
            tr++;
        } else if (tc === '-') {
            if (started) {
                res.backtrace += 'I';
                qBuffer += qc;
                tBuffer += tc;
            }
            qr++;
        } else {
            if (started) {
                res.qAln += qBuffer;
                res.dbAln += tBuffer;
                qBuffer = '';
                tBuffer = '';
            } else {
                started = true;
                res.qStartPos = qr;
                res.dbStartPos = tr;
            }
            res.backtrace += 'M';
            qBuffer += qc;
            tBuffer += tc;
            res.qEndPos = qr;
            res.dbEndPos = tr;
            qr++;
            tr++;
        }
        m++;
    }
    res.qStartPos++;
    res.dbStartPos++;
    res.qSeq = one.replace(/-/g, '');
    res.tSeq = two.replace(/-/g, '');
    return res;
}

function subPDB(pdb, start, end) {
    return pdb.split(/\r?\n/)
        .filter((line) => {
            if (!line.startsWith('ATOM') && !line.startsWith('HETATM')) return false;
            const residue = Number.parseInt(line.slice(22, 26), 10);
            return residue >= start && residue <= end;
        })
        .join('\n');
}

async function structurePDB(entry) {
    const mock = mockPDB(entry.ca, entry.aa.replace(/-/g, ''), 'A');
    try {
        if (!entry.suffix) return await pulchra(mock);

        const decoded = decodeMultimer(mock, entry.suffix);
        const chains = storeChains(decoded);
        const chunks = [];
        for (const split of splitMultimer(decoded)) {
            chunks.push(await pulchra(split));
        }
        return revertChainInfo(mergeMultimer(chunks), chains);
    } catch (e) {
        return mock;
    }
}

function makeCIF(state) {
    const blocks = [];
    for (const item of state.structures?.values?.() || []) {
        const structure = item.structure?.cell?.obj?.data;
        if (structure) blocks.push(to_mmCIF(`structure_${item.index}`, structure, false, { copyAllCategories: false }));
    }
    return blocks.join('\n');
}

export const foldmasonResult = {
    async mount() {
        return {};
    },

    async update(plugin, state, input) {
        await updateStructures(plugin, state, input);
        await setSelection(plugin, state, input);
        await setPreview(plugin, state, input);
        await setFocus(plugin, state, input);
    },

    onHover(plugin, state, input, event) {
        return structureEvent(state, event?.current, 'structure-hover');
    },

    onClick(plugin, state, input, event) {
        focusCurrentLoci(plugin, event?.current);
        return structureEvent(state, event?.current, 'structure-click');
    },

    resetView(plugin, state, input) {
        const reference = state.structures?.get?.(input.reference);
        const loci = reference ? lociForItem(reference, input.selectedColumns || []) : null;
        if (loci) {
            plugin.managers.camera.focusLoci(loci, { durationMs: 250, extraRadius: 10, minRadius: 5 });
        } else {
            plugin.managers.camera.reset();
        }
    },

    async makeCIF(plugin, state) {
        return makeCIF(state);
    },

    async dispose(plugin) {
        await plugin?.clear?.();
    },
};

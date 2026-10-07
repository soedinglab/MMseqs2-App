// Persist hit and MSA selections and turn them into query records.

import { getAccession } from '../../../frontend/lib/targetName.js';
import { motifFromTargetResidues } from './motif.js';
import { createMsaSelection } from './msa.js';
import { createQuery, createQuerySet } from './submits.js';
import { idForHit } from './table.js';

export function createSelectionService({ store, results } = {}) {
    if (!store) throw new Error('createSelectionService({ store }) is required');
    if (!results) throw new Error('createSelectionService({ results }) is required');

    const selections = {
        async selectMsaColumns(ticket, { entry = 0, columns = [], name = 'default' } = {}) {
            return createMsaSelection(
                await results.getFoldMasonResult(ticket), { entry, columns, ticket, name });
        },

        async loadMsaSelection(ticket, name = 'default') {
            const record = await store.readSelection(ticket, name);
            if (!record) return null;
            if (record.page && record.page !== 'foldmason') {
                throw new Error(`selection "${name}" on ${ticket} is a ${record.page} row selection, `
                                + 'not a column selection');
            }
            return createMsaSelection(await results.getFoldMasonResult(ticket), {
                ticket, name,
                entry: record.entry ?? 0,
                columns: record.columns ?? [],
                residueAa: record.residueAa ?? [],
                savedAt: record.updatedAt,
            });
        },

        async saveMsaSelection(selection, name = selection.name) {
            if (!selection.ticket) {
                throw new Error('this selection has no ticket, so there is nothing to save it against');
            }
            selection.name = name;
            const record = await store.writeSelection(selection.ticket, name, {
                page: 'foldmason',
                entry: selection.entryIndex,
                columns: selection.columns,
                ...(selection.residueAa.length ? { residueAa: selection.residueAa } : {}),
            });
            selection.savedAt = record.updatedAt;
            return record;
        },

        queryFromMsaSelection(selection) {
            return createQuery(selection.querySpec());
        },

        listSelections(ticket) { return store.listSelections(ticket); },
        deleteSelection(ticket, name = 'default') { return store.deleteSelection(ticket, name); },
        copySelection(ticket, fromName, toName) { return store.copySelection(ticket, fromName, toName); },

        async queryFromRow(row) {
            const { table, head } = row;
            if (!head) throw new Error(`no hit ${row.id} in this result`);
            const label = head.target ?? head.targetname ?? row.id;
            if (table.tool === 'folddisco') {
                return createQuery({
                    kind: 'structure',
                    text: await results.getFoldDiscoTargetStructure(table.ticket,
                        { id: idForHit(head, row.db), database: row.db }),
                    name: getAccession(head.target ?? label),
                    motif: motifFromTargetResidues(head.targetresidues) || undefined,
                    db: row.db,
                    ticket: table.ticket,
                    lineage: { queryIdx: table.queryIdx, rowId: row.id, db: row.db },
                }, { label });
            }
            return createQuery({
                kind: 'chains',
                chains: await results.getHitChains(table.ticket, {
                    queryIdx: table.queryIdx, db: row.db, idx: Number(row.groupId),
                }),
                db: row.db,
                accession: getAccession(head.target ?? label),
                ticket: table.ticket,
                lineage: { queryIdx: table.queryIdx, rowId: row.id, db: row.db },
            }, { label });
        },

        async loadHitSelection(table, name = 'default') {
            const record = await store.readSelection(table.ticket, name);
            return record
                ? table.selection(record.ids ?? [], { name, savedAt: record.updatedAt })
                : null;
        },

        async saveHitSelection(selection, name = selection.name) {
            selection.name = name;
            const { table } = selection;
            const record = await store.writeSelection(table.ticket, name, {
                queryIdx: table.queryIdx, page: table.tool, ids: selection.ids,
            });
            selection.savedAt = record.updatedAt;
            return record;
        },

        async querySetFromSelection(selection) {
            const queries = await Promise.all(
                selection.rows().map(row => selections.queryFromRow(row)));
            return createQuerySet(queries, {
                ticket: selection.table.ticket,
                queryIdx: selection.table.queryIdx,
                description: selection.describe(),
            });
        },
    };

    return selections;
}

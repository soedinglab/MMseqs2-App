// Resolving a taxon name to an id. The rule matters more than the lookup: a person picked from a
// dropdown, so ambiguity that a human settled by eye has to be settled by rule or refused.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveTaxFilter, taxFilterHasNames, TAX_CANDIDATE_CAP, assertTaxFilter } from '../src/index.js';

const LIVE = process.env.FOLDSEEK_SERVER_LIVE_TESTS === '1';

/** One canned suggest response per query, in the shape NCBI Datasets returns. */
const stub = (byName) => async (url) => {
    // Matched case-insensitively, as the real endpoint does.
    const name = decodeURIComponent(new URL(url).pathname.split('/').pop()).toLowerCase();
    const key = Object.keys(byName).find(k => k.toLowerCase() === name);
    if (!key) return { ok: false, status: 404 };
    return { ok: true, status: 200, json: async () => ({ sci_name_and_ids: byName[key] }) };
};

test('numeric filters never touch the network, and pass through unchanged', async () => {
    let called = 0;
    const fetchImpl = async () => { called += 1; return { ok: false, status: 500 }; };

    for (const raw of ['9606', '2,!10090', '', '  ', undefined]) {
        const out = await resolveTaxFilter(raw, { fetchImpl });
        assert.deepEqual(out.resolved, [], JSON.stringify(raw));
    }
    assert.equal(called, 0, 'a caller passing ids behaves exactly as before');
    assert.equal((await resolveTaxFilter('2,!10090', { fetchImpl })).filter, '2,!10090');
    assert.equal(taxFilterHasNames('2,!10090'), false);
    assert.equal(taxFilterHasNames('2,!Mus musculus'), true);
});

test('an exact scientific name wins over its own subspecies', async () => {
    // The real response for "Homo sapiens": the species, then two subspecies.
    const fetchImpl = stub({
        'Homo sapiens': [
            { sci_name: 'Homo sapiens', tax_id: '9606', rank: 'SPECIES' },
            { sci_name: 'Homo sapiens neanderthalensis', tax_id: '63221', rank: 'SUBSPECIES' },
            { sci_name: "Homo sapiens subsp. 'Denisova'", tax_id: '741158', rank: 'SUBSPECIES' },
        ],
    });
    const out = await resolveTaxFilter('Homo sapiens', { fetchImpl });
    assert.equal(out.filter, '9606');
    assert.deepEqual(out.resolved, [
        { name: 'Homo sapiens', taxId: '9606', sciName: 'Homo sapiens', rank: 'SPECIES' },
    ]);

    // Case is not part of a name's identity here.
    assert.equal((await resolveTaxFilter('homo sapiens', { fetchImpl })).filter, '9606');
});

test('a name that matches nothing exactly is refused with its candidates', async () => {
    const many = Array.from({ length: 17 }, (_, i) => (
        { sci_name: `Candidate ${i}`, tax_id: String(1000 + i), rank: 'SPECIES' }));
    const fetchImpl = stub({ human: many });

    const err = await resolveTaxFilter('human', { fetchImpl }).catch(e => e);
    assert.equal(err.code, 'TAXON_AMBIGUOUS');
    assert.match(err.message, /Pass the numeric id you mean/);
    // Capped, and it says how many it did not show.
    assert.equal(err.message.split('; ').length, TAX_CANDIDATE_CAP);
    assert.match(err.message, /17 in all/);
    assert.ok(err.message.length < 700, `refusal is ${err.message.length} bytes`);
});

test('a single candidate is taken, an empty list and a dead endpoint are distinguished', async () => {
    const only = stub({ Nanoarchaeota: [{ sci_name: 'Candidatus Nanoarchaeota', tax_id: '192989' }] });
    assert.equal((await resolveTaxFilter('Nanoarchaeota', { fetchImpl: only })).filter, '192989');

    const empty = async () => ({ ok: true, status: 200, json: async () => ({ sci_name_and_ids: [] }) });
    const notFound = await resolveTaxFilter('Notataxon', { fetchImpl: empty }).catch(e => e);
    assert.equal(notFound.code, 'TAXON_NOT_FOUND');
    assert.match(notFound.message, /scientific name, not common name/);

    const dead = async () => { throw new Error('ENOTFOUND'); };
    const failed = await resolveTaxFilter('Bacteria', { fetchImpl: dead }).catch(e => e);
    assert.equal(failed.code, 'TAXON_LOOKUP_FAILED');
    assert.match(failed.message, /Pass a numeric taxon id instead/);
});

test('names and ids mix in one filter, and negation stays with its token', async () => {
    const fetchImpl = stub({
        Archaea: [{ sci_name: 'Archaea', tax_id: '2157', rank: 'SUPERKINGDOM' }],
        'Escherichia coli': [{ sci_name: 'Escherichia coli', tax_id: '562', rank: 'SPECIES' }],
    });
    const out = await resolveTaxFilter('Archaea, !Escherichia coli', { fetchImpl });
    assert.equal(out.filter, '2157,!562');
    assert.deepEqual(out.resolved.map(r => [r.name, r.taxId, r.negated ?? false]),
        [['Archaea', '2157', false], ['Escherichia coli', '562', true]]);

    const mixed = await resolveTaxFilter('9606,!Archaea', { fetchImpl });
    assert.equal(mixed.filter, '9606,!2157');
    assert.equal(mixed.resolved.length, 1, 'only the name needed resolving');
});

test('live: the ranks the frontend filters to are the ones that resolve', { skip: !LIVE }, async () => {
    // Without tax_rank_filter=higher_taxon, "Bacteria" never returns taxid 2. This is the assertion
    // that catches the filter being dropped again.
    for (const [name, id] of [['Bacteria', '2'], ['Archaea', '2157'], ['Eukaryota', '2759'],
        ['Escherichia coli', '562'], ['Homo sapiens', '9606']]) {
        const out = await resolveTaxFilter(name);
        assert.equal(out.filter, id, name);
    }
    const err = await resolveTaxFilter('human').catch(e => e);
    assert.equal(err.code, 'TAXON_AMBIGUOUS', 'a common name is not a scientific one');
});

test('a malformed id list is refused locally, not looked up', async () => {
    let called = 0;
    const fetchImpl = async () => { called += 1; return { ok: false, status: 500 }; };

    // Each of these is neither a plain id nor a name, so it goes to the numeric validator untouched.
    for (const raw of ['9606;10090', '12-15', '9606,', '2..3']) {
        const out = await resolveTaxFilter(raw, { fetchImpl });
        assert.equal(out.resolved.length, 0, raw);
    }
    assert.equal(called, 0, 'a botched id list is not a taxon name');
});

test('a malformed filter is not quietly repaired on the way to the validator', async () => {
    let called = 0;
    const fetchImpl = async () => { called += 1; return { ok: false, status: 500 }; };

    // Resolution must not normalise away a syntax error. "9606,!" is the dangerous one: repaired to
    // "9606" it drops an exclusion the caller was in the middle of writing.
    for (const [raw, expected] of [['9606, ', '9606,'], ['9606,', '9606,'], [',9606', ',9606'],
        ['9606,!', '9606,!'], ['9606,,10090', '9606,,10090']]) {
        const out = await resolveTaxFilter(raw, { fetchImpl });
        assert.equal(out.filter, expected, raw);
        assert.throws(() => assertTaxFilter(out.filter), /invalid taxon filter/, raw);
    }

    // Only a wholly empty filter means "no filter".
    for (const raw of ['', '   ', undefined, null]) {
        assert.equal((await resolveTaxFilter(raw, { fetchImpl })).filter, '');
    }
    assert.equal(called, 0);
});

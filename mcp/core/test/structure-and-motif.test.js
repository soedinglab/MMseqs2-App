// The structure reader and the motif validator, which together decide whether a FoldDisco job is
// allowed to be submitted at all.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { listResidues, residueTokenSet } from '../../../frontend/lib/structureText.js';
import { checkMotif, assertMotif, MOTIF_MAX_RESIDUES } from '../src/motif.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// Well-formed PDB: residue name at columns 18-20, chain at 22, residue number at 23-26.
const PDB = [
    'ATOM      1  N   MET A   1      11.104   6.134  -6.504  1.00  0.00           N',
    'ATOM      2  CA  MET A   1      11.639   6.071  -5.147  1.00  0.00           C',
    'ATOM      3  N   ALA A   2      12.719   5.518  -4.897  1.00  0.00           N',
    'ATOM      4  CA  GLY B  17      13.083   5.508  -3.510  1.00  0.00           C',
    'HETATM    5  O   HOH A 101      14.000   5.000  -3.000  1.00  0.00           O',
].join('\n');

const CIF = [
    'data_TEST',
    'loop_',
    '_atom_site.group_PDB',
    '_atom_site.id',
    '_atom_site.label_comp_id',
    '_atom_site.label_asym_id',
    '_atom_site.label_seq_id',
    '_atom_site.auth_seq_id',
    '_atom_site.auth_asym_id',
    'ATOM 1 MET A 1 5 A',
    'ATOM 2 MET A 1 5 A',
    'ATOM 3 ALA A 2 6 A',
    'ATOM 4 GLY B 1 20 B',
    '#',
].join('\n');

test('listResidues reads a PDB by fixed columns and deduplicates residues', () => {
    const residues = listResidues(PDB);
    assert.deepEqual(residues.map(r => `${r.chain}${r.resno}`), ['A1', 'A2', 'B17', 'A101']);
    assert.equal(residues[0].resName, 'MET');
    assert.equal(residues.at(-1).hetero, true, 'HETATM should be marked');
});

test('listResidues reads an mmCIF _atom_site loop using the auth numbering', () => {
    const residues = listResidues(CIF);
    // auth_seq_id/auth_asym_id, not label_*, because those are what NGL reports as resno/chainname
    // and therefore what a motif token means.
    assert.deepEqual(residues.map(r => `${r.chain}${r.resno}`), ['A5', 'A6', 'B20']);
    assert.equal(residues[0].resName, 'MET');
});

test('listResidues ignores loops that are not _atom_site', () => {
    const withChemComp = ['data_X', 'loop_', '_chem_comp.id', '_chem_comp.type', 'ALA L-PEPTIDE', '#', CIF].join('\n');
    assert.deepEqual(listResidues(withChemComp).map(r => `${r.chain}${r.resno}`), ['A5', 'A6', 'B20']);
});

test('listResidues repairs the column drift in FoldDisco hit structures', () => {
    const drifted = fs.readFileSync(path.join(HERE, 'fixtures', 'malformed-hit.pdb'), 'utf8');
    // Column 20 is non-blank in these files, which is padding in a well-formed record — the shift
    // would otherwise be read as chain "E"/residue "T" nonsense rather than chain A residue 1.
    const line = drifted.split('\n')[1];
    assert.notEqual(line[20], ' ', 'fixture must actually be drifted, or this test proves nothing');

    const residues = listResidues(drifted);
    assert.ok(residues.length > 0);
    assert.equal(residues[0].chain, 'A');
    assert.equal(residues[0].resno, '1');
    assert.equal(residues[0].resName, 'MET');
});

test('listResidues returns nothing for empty or non-structure input', () => {
    assert.deepEqual(listResidues(''), []);
    assert.deepEqual(listResidues('not a structure at all'), []);
    assert.deepEqual(listResidues(undefined), []);
});

test('residueTokenSet offers both the chain-qualified and bare forms', () => {
    const tokens = residueTokenSet(PDB);
    assert.ok(tokens.has('A1') && tokens.has('1'));
    assert.ok(tokens.has('B17') && tokens.has('17'));
});

test('checkMotif accepts tokens that name real residues', () => {
    for (const motif of ['A1', 'A1,A2', '1,2', 'A1:W', 'A1, A2 , B17']) {
        assert.equal(checkMotif(motif, PDB).valid, true, motif);
    }
});

test('checkMotif rejects a residue the query does not contain', () => {
    const result = checkMotif('A1,A999', PDB);
    assert.equal(result.valid, false);
    assert.deepEqual(result.missing, ['A999']);
    assert.match(result.reason, /not in the query structure/);
});

test('checkMotif rejects malformed tokens', () => {
    assert.match(checkMotif('', PDB).reason, /empty/);
    assert.match(checkMotif('   ', PDB).reason, /empty/);
    assert.match(checkMotif('A1::W', PDB).reason, /more than one/);
    assert.match(checkMotif('A1:9', PDB).reason, /not a letter/);
    assert.match(checkMotif('hello', PDB).reason, /not a residue token/);
});

// A residue that exists but cannot be addressed: splitAlphaNum('A-3') reads the minus as part of
// the chain name, so the token would be misread everywhere a motif is parsed back into residues.
test('checkMotif rejects negative residue numbers even when the structure has them', () => {
    const negative = 'ATOM      1  CA  PRO A  -3      11.1   6.1  -6.5  1.00  0.00           C';
    assert.equal(listResidues(negative)[0].resno, '-3', 'the reader still sees it');
    assert.equal(checkMotif('A-3', negative).valid, false);
});

test('checkMotif enforces the residue ceiling', () => {
    const many = Array.from({ length: MOTIF_MAX_RESIDUES + 1 }, (_, i) => `A${i + 1}`).join(',');
    assert.match(checkMotif(many).reason, new RegExp(String(MOTIF_MAX_RESIDUES)));
});

test('checkMotif without a structure checks syntax only', () => {
    assert.equal(checkMotif('A999').valid, true);
    assert.equal(checkMotif('A999', PDB).valid, false);
});

test('assertMotif throws with the reason attached', () => {
    assert.throws(() => assertMotif('A999', PDB), /not in the query structure/);
    assert.doesNotThrow(() => assertMotif('A1', PDB));
});

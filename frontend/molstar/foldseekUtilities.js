import { OneToThree } from './interactions.js';

export function getChainName(name) {
    if (!name || /_v[0-9]+$/.test(name)) return 'A';
    if (/^[A-Za-z0-9]$/.test(name)) return name;
    const pos = name.lastIndexOf('_');
    return pos !== -1 ? name.substring(pos + 1, pos + 2) : 'A';
}

export function getAccession(name) {
    if (!name || /_v[0-9]+$/.test(name)) return name;
    const pos = name.lastIndexOf('_');
    return pos !== -1 ? name.substring(0, pos) : name;
}

export function mockPDB(ca, seq, chain, start = 1) {
    const atoms = ca.split(',');
    const pdb = [];
    let j = 1;
    for (let i = 0; i < atoms.length; i += 3, j++) {
        const resno = start + j - 1;
        const [x, y, z] = atoms.slice(i, i + 3).map(element => Number.parseFloat(element));
        const residue = seq !== '' && atoms.length / 3 === seq.length ? seq[i / 3] : 'A';
        pdb.push(
            'ATOM  ' +
            j.toString().padStart(5) +
            '  CA  ' +
            (OneToThree[residue] || 'ALA') +
            chain.toString().padStart(2) +
            resno.toString().padStart(4) +
            '    ' +
            x.toFixed(3).padStart(8) +
            y.toFixed(3).padStart(8) +
            z.toFixed(3).padStart(8) +
            '  1.00  0.00           C  ',
        );
    }
    return pdb.join('\n');
}

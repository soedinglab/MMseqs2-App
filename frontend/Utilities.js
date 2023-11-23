import { Selection } from 'ngl';


function tryLinkTargetToDB(target, db) {
    var res = db.toLowerCase();
    if (res.startsWith("pfam")) {
        return 'https://pfam.xfam.org/family/' + target;
    } else if (res.startsWith("pdb")) {
        return 'https://www.rcsb.org/pdb/explore.do?structureId=' + target.replaceAll(/\.(cif|pdb)(\.gz)?/g, '').split('_')[0];
    } else if (res.startsWith("uniclust") || res.startsWith("uniprot") || res.startsWith("sprot") || res.startsWith("swissprot")) {
        return 'https://www.uniprot.org/uniprot/' + target;
    } else if (res.startsWith("eggnog_")) {
        return 'http://eggnogdb.embl.de/#/app/results?target_nogs=' + target;
    } else if (res.startsWith("cdd")) {
        return 'https://www.ncbi.nlm.nih.gov/Structure/cdd/cddsrv.cgi?uid=' + target;
    }

    if (__APP__ == "foldseek") {
        if (target.startsWith("AF-")) {
            return 'https://www.alphafold.ebi.ac.uk/entry/' + target.replaceAll(/-F[0-9]+-model_v[0-9]+(\.(cif|pdb))?(\.gz)?(_[A-Z0-9]+)?$/g, '');
        } else if (target.startsWith("GMGC")) {
            return 'https://gmgc.embl.de/search.cgi?search_id=' + target.replaceAll(/\.(cif|pdb)(\.gz)?/g, '')
        } else if (target.startsWith("MGYP")) {
            return 'https://esmatlas.com/explore/detail/' + target.replaceAll(/\.(cif|pdb)(\.gz)?/g, '')
        }

        if (res.startsWith("cath")) {
            if (target.startsWith('af_')) {
                const cath = target.substring(target.lastIndexOf('_') + 1);
                return "https://www.cathdb.info/version/latest/superfamily/" + cath;
            } else {
                return "https://www.cathdb.info/version/latest/domain/"+ target;
            }
        }
    }
    return null;
}

function tryFixTargetName(target, db) {
    var res = db.toLowerCase();
    if (__APP__ == "foldseek") {
        if (target.startsWith("AF-")) {
            return target.replaceAll(/\.(cif|pdb)(\.gz)?(_[A-Z0-9]+)?$/g, '');
        } else if (res.startsWith("pdb") || res.startsWith("gmgc") || res.startsWith("mgyp") || res.startsWith("mgnify")) {
            return target.replaceAll(/\.(cif|pdb)(\.gz)?/g, '');
        }
        if (res.startsWith("cath")) {
            if (target.startsWith('af_')) {
                const match = target.match(/^af_([A-Z0-9]+)_(\d+)_(\d+)_(\d+\.\d+\.\d+\.\d+)$/);
                if (match && match.length == 5) {
                    return match[4] + ' '  + match[1] + ' ' + match[2] + '-' + match[3];
                }
            }
        }
    }
    return target;
}

export function parseResults(data) {
    let empty = 0;
    let total = 0;
    for (let i in data.results) {
        let result = data.results[i];
        let db = result.db;
        result.hasDescription = false;
        result.hasTaxonomy = false;
        if (result.alignments == null) {
            empty++;
        }
        total++;
        for (let j in result.alignments) {
            let item = result.alignments[j];
            let split = item.target.split(' ');
            item.target = split[0];
            item.description = split.slice(1).join(' ');
            if (item.description.length > 1) {
                result.hasDescription = true;
            }
            item.href = tryLinkTargetToDB(item.target, db);
            item.target = tryFixTargetName(item.target, db);
            item.id = 'result-' + i + '-' + j;
            item.active = false;
            if (__APP__ != "foldseek" || data.mode != "tmalign") {
                item.eval = (typeof(item.eval) === "string") ? item.eval : item.eval.toExponential(2);
            }
            if (__APP__ == "foldseek") {
                item.prob = (typeof(item.prob) === "string") ? item.prob : item.prob.toFixed(2);
                if (data.mode == "tmalign") {
                    item.eval = (typeof(item.eval) === "string") ? item.eval : item.eval.toFixed(3);
                }
            }
            if ("taxId" in item) {
                result.hasTaxonomy = true;
            }
        }
    }
    return (total != 0 && empty / total == 1) ? ({ results: [] }) : data;
}

export function dateTime() {
    // Generates current YYYY_MM_DD_HH_MM_SS timestamp
    return new Date().toLocaleString('sv').replace(' ', '_').replaceAll('-', '_').replaceAll(':', '_');
}

export function djb2(str) {
  let hash = 5381; // Initial hash value
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i); // Magic number 33
  }
  return hash >>> 0; // Convert to an unsigned 32-bit integer
}

export function download(data, name) {
    const json = JSON.stringify(data);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
    // const date = new Date().toLocaleString('sv').replace(' ', '_').replaceAll('-', '_').replaceAll(':', '_');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    // link.download = `${this.$STRINGS.APP_NAME}_${date}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
}

export function parseResultsList(data) {
    let hits = [];
    for (let result of data) {
        hits.push(parseResults(result));
    }
    return hits;
}

// Map 0-based indices in the alignment to corresponding 1-based indices in the structure
export function makePositionMap(realStart, alnString) {
    let map = Array(alnString.length);
    for (let i = 0, gaps = 0; i < alnString.length; i++) {
        if (alnString[i] === '-') {
            map[i] = null;
            gaps++;
        } else {
            map[i] = realStart + i - gaps;
        }
    }
    return map
}

const oneToThree = {
    "A":"ALA", "R":"ARG", "N":"ASN", "D":"ASP",
    "C":"CYS", "E":"GLU", "Q":"GLN", "G":"GLY",
    "H":"HIS", "I":"ILE", "L":"LEU", "K":"LYS",
    "M":"MET", "F":"PHE", "P":"PRO", "S":"SER",
    "T":"THR", "W":"TRP", "Y":"TYR", "V":"VAL",
    "U":"SEC", "O":"PHL", "X":"XAA"
  };
  
 
export function xyz(structure, resIndex) {
    var rp = structure.getResidueProxy()
    var ap = structure.getAtomProxy()
    rp.index = resIndex
    ap.index = rp.getAtomIndexByName('CA')
    return [ap.x, ap.y, ap.z]
}

function atomToPDBRow(ap) {
    const { serial, atomname, resname, chainname, resno, inscode, x, y, z } = ap
    return `ATOM  ${serial.toString().padStart(5)}${atomname.padStart(4)}  ${resname.padStart(3)} ${chainname.padStart(1)}${resno.toString().padStart(4)} ${inscode.padStart(1)}  ${x.toFixed(3).padStart(8)}${y.toFixed(3).padStart(8)}${z.toFixed(3).padStart(8)}`
}

export function makeChainMap(structure, sele) {
    let map = new Map()
    let idx = 1;
    structure.eachResidue(rp => {
        map.set(idx++, { index: rp.index, resno: rp.resno });
    }, new Selection(sele));
    return map
}

export function makeSubPDB(structure, sele) {
    let pdb = [];
    structure.eachAtom(ap => { pdb.push(atomToPDBRow(ap)) }, new Selection(sele));
    return pdb.join('\n')
} 

/**
 * Create a mock PDB from Ca data
 * Follows the spacing spec from https://www.wwpdb.org/documentation/file-format-content/format33/sect9.html#ATOM
 * Will have to change if/when swapping to fuller data
 */
export function mockPDB(ca, seq) {
    const atoms = ca.split(',')
    const pdb = new Array()
    let j = 1
    for (let i = 0; i < atoms.length; i += 3, j++) {
        let [x, y, z] = atoms.slice(i, i + 3).map(element => parseFloat(element))
        pdb.push(
            'ATOM  '
            + j.toString().padStart(5)
            + '  CA  ' + oneToThree[seq != "" && (atoms.length/3) == seq.length ? seq[i/3] : 'A'] + ' A'
            + j.toString().padStart(4)
            + '    '
            + x.toString().padStart(8)
            + y.toString().padStart(8)
            + z.toString().padStart(8)
            + '  1.00  0.00           C  '
        )
    }
    return pdb.join('\n')
}

/* ------ The rotation matrix to rotate Chain_1 to Chain_2 ------ */
/* m               t[m]        u[m][0]        u[m][1]        u[m][2] */
/* 0     161.2708425765   0.0663961888  -0.6777150909  -0.7323208325 */
/* 1     109.4205584665  -0.9559071424  -0.2536229340   0.1480437178 */
/* 2      29.1924015422  -0.2860648199   0.6902011757  -0.6646722921 */
/* Code for rotating Structure A from (x,y,z) to (X,Y,Z): */
/* for(i=0; i<L; i++) */
/* { */
/*    X[i] = t[0] + u[0][0]*x[i] + u[0][1]*y[i] + u[0][2]*z[i]; */
/*    Y[i] = t[1] + u[1][0]*x[i] + u[1][1]*y[i] + u[1][2]*z[i]; */
/*    Z[i] = t[2] + u[2][0]*x[i] + u[2][1]*y[i] + u[2][2]*z[i]; */
/* } */
export function transformStructure(structure, t, u) {
    structure.eachAtom(atom => {
        const [x, y, z] = [atom.x, atom.y, atom.z];
        atom.x = t[0] + u[0][0] * x + u[0][1] * y + u[0][2] * z;
        atom.y = t[1] + u[1][0] * x + u[1][1] * y + u[1][2] * z;
        atom.z = t[2] + u[2][0] * x + u[2][1] * y + u[2][2] * z;
    })
}
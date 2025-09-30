import { Selection, Matrix4, PdbWriter } from "ngl";

function tryLinkTargetToDB(target, db) {
  try {
    var res = db.toLowerCase();
    if (res.startsWith("pfam")) {
      return "https://www.ebi.ac.uk/interpro/entry/pfam/" + target;
    } else if (res.startsWith("pdb")) {
      return (
        "https://www.rcsb.org/structure/" +
        target
          .replaceAll(/-assembly[0-9]+/g, "")
          .replaceAll(/\.(cif|pdb|ent)(\.gz)?/g, "")
          .split("_")[0]
      );
    } else if (
      res.startsWith("uniclust") ||
      res.startsWith("uniprot") ||
      res.startsWith("sprot") ||
      res.startsWith("swissprot")
    ) {
      return "https://www.uniprot.org/uniprot/" + target;
    } else if (res.startsWith("eggnog_")) {
      return "http://eggnogdb.embl.de/#/app/results?target_nogs=" + target;
    } else if (res.startsWith("cdd")) {
      return (
        "https://www.ncbi.nlm.nih.gov/Structure/cdd/cddsrv.cgi?uid=" + target
      );
    }

    if (__APP__ == "foldseek") {
      if (target.startsWith("AF-")) {
        let accession = target.replaceAll(
          /-F[0-9]+-model_v[0-9]+(\.(cif|pdb))?(\.gz)?(_[A-Z0-9]+)?$/g,
          ""
        );
        accession = accession.substring(3);
        return [
          {
            label: "AFDB",
            accession: accession,
            href: "https://www.alphafold.ebi.ac.uk/entry/" + accession,
          },
          {
            label: "UniProt",
            accession: accession,
            href: "https://www.uniprot.org/uniprot/" + accession,
          },
        ];
      } else if (target.startsWith("GMGC")) {
        return (
          "https://gmgc.embl.de/search.cgi?search_id=" +
          target.replaceAll(/\.(cif|pdb)(\.gz)?/g, "")
        );
      } else if (target.startsWith("MGYP")) {
        return (
          "https://esmatlas.com/explore/detail/" +
          target.replaceAll(/\.(cif|pdb)(\.gz)?/g, "")
        );
      } else if (target.startsWith("LevyLab_")) {
        let accession = target.split("_")[1];
        return [
          {
            label: "AFDB",
            accession: accession,
            href: "https://www.alphafold.ebi.ac.uk/entry/" + accession,
          },
          {
            label: "UniProt",
            accession: accession,
            href: "https://www.uniprot.org/uniprot/" + accession,
          },
        ];
      } else if (target.startsWith("ProtVar_")) {
        let accession1 = target.split("_")[1];
        let accession2 = target.split("_")[2];
        let result = [
          {
            label: "AFDB",
            accession: accession1,
            href: "https://www.alphafold.ebi.ac.uk/entry/" + accession1,
          },
          {
            label: "UniProt",
            accession: accession1,
            href: "https://www.uniprot.org/uniprot/" + accession1,
          },
        ];
        if (accession1 != accession2) {
          result.push({
            label: "AFDB",
            accession: accession2,
            href: "https://www.alphafold.ebi.ac.uk/entry/" + accession2,
          });
          result.push({
            label: "UniProt",
            accession: accession2,
            href: "https://www.uniprot.org/uniprot/" + accession2,
          });
        }
        return result;
      } else if (target.startsWith("ModelArchive_")) {
        return "https://modelarchive.org/doi/10.5452/" + target.split("_")[1];
      } else if (target.startsWith("Predictome_")) {
        return "https://predictomes.org/summary/" + target.split("_")[1];
      }
      if (res.startsWith("cath")) {
        if (target.startsWith("af_")) {
          const cath = target.substring(target.lastIndexOf("_") + 1);
          return "https://www.cathdb.info/version/latest/superfamily/" + cath;
        } else {
          return "https://www.cathdb.info/version/latest/domain/" + target;
        }
      } else if (res.startsWith("bfvd")) {
        const bfvd = target.replaceAll(/_.*/g, "");
        return [
          {
            label: "BFVD",
            accession: bfvd,
            href: "https://bfvd.foldseek.com/cluster/" + bfvd,
          },
          {
            label: "UniRef",
            accession: bfvd,
            href: "https://www.uniprot.org/uniref/UniRef100_" + bfvd,
          },
        ];
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

function tryFixTargetName(target, db) {
  var res = db.toLowerCase();
  if (__APP__ == "foldseek") {
    if (target.startsWith("AF-")) {
      return target.replaceAll(/\.(cif|pdb)(\.gz)?(_[A-Z0-9]+)?$/g, "");
    } else if (
      res.startsWith("pdb") ||
      res.startsWith("gmgc") ||
      res.startsWith("mgyp") ||
      res.startsWith("mgnify")
    ) {
      return target.replaceAll(/\.(cif|pdb|ent)(\.gz)?/g, "");
    } else if (res.startsWith("bfvd")) {
      return target.replaceAll(/_unrelaxed.*/g, "");
    }
    if (res.startsWith("cath")) {
      if (target.startsWith("af_")) {
        const match = target.match(
          /^af_([A-Z0-9]+)_(\d+)_(\d+)_(\d+\.\d+\.\d+\.\d+)$/
        );
        if (match && match.length == 5) {
          return match[4] + " " + match[1] + " " + match[2] + "-" + match[3];
        }
      }
    }
  }
  return target;
}

// Process e.g. AF-{uniprot ID}-F1_model_v4.cif.pdb.gz to just uniprot ID
export function tryFixName(name) {
  if (name.startsWith("AF-")) {
    name = name.replaceAll(/(AF[-_]|[-_]F[0-9]+[-_]model[-_]v[0-9]+)/g, "");
  }
  return name.replaceAll(/\.(cif|pdb|gz)/g, "");
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
    const grouped = {};
    for (let j in result.alignments) {
      for (let k in result.alignments[j]) {
        let item = result.alignments[j][k];
        let split = item.target.split(" ");
        item.target = split[0];
        item.description = split.slice(1).join(" ");
        if (item.description.length > 1) {
          result.hasDescription = true;
        }
        item.href = tryLinkTargetToDB(item.target, db);
        item.target = tryFixTargetName(item.target, db);
        item.id = "result-" + i + "-" + j;
        item.active = false;
        if (__APP__ != "foldseek" || data.mode != "tmalign") {
          item.eval =
            typeof item.eval === "string"
              ? item.eval
              : item.eval.toExponential(2);
        }
        if (__APP__ == "foldseek") {
          item.prob =
            typeof item.prob === "string" ? item.prob : item.prob.toFixed(2);
          if (data.mode == "tmalign") {
            item.eval =
              typeof item.eval === "string" ? item.eval : item.eval.toFixed(3);
          } else if (data.mode == "lolalign") {
            item.eval = item.eval * 100;
            item.eval = parseFloat(item.eval.toFixed(2)).toString();
          }
        }
        if ("taxId" in item) {
          result.hasTaxonomy = true;
        }
        let groupId = item.complexid ?? k;
        // console.log("Group ID: " + groupId + " complexid: " + item.complexid + " j: " + j)
        if (!grouped[groupId]) {
          grouped[groupId] = [];
        }
        grouped[groupId].push(item);
      }
    }
    result.alignments = grouped;
  }
  return total != 0 && empty / total == 1
    ? { results: [], mode: data.mode }
    : data;
}

export function splitAlphaNum(str) {
  const len = str.length;
  let i = 0;

  while (i < len) {
    const cc = str.charCodeAt(i);
    if (cc >= 48 && cc <= 57) {
      break;
    }
    i++;
  }
  const alpha = str.slice(0, i);

  let j = i;
  while (j < len) {
    const cc = str.charCodeAt(j);
    if (cc < 48 || cc > 57) {
      break;
    }
    j++;
  }
  const numeric = str.slice(i, j);

  let substitution = "";
  if (j < len && str.charCodeAt(j) === 58 /* ':' */) {
    substitution = str.slice(j);
  }

  return [alpha, numeric, substitution];
}

function computeInterresidueDist(splitTarget) {
  const dist = [];
  let lastChain = null;
  let lastPos = null;

  for (let i = 1; i < splitTarget.length; ++i) {
    const curr = splitTarget[i];

    if (curr === "_") {
      dist.push(null);
      continue;
    }

    let [currChain, currPos] = splitAlphaNum(curr);
    currPos = currPos | 0;

    // Find last valid residue before current
    let j = i - 1;
    while (j >= 0 && splitTarget[j] === "_") {
      j--;
    }
    if (j < 0) {
      dist.push(null);
      lastChain = currChain;
      lastPos = currPos;
      continue;
    }

    let [prevChain, prevPos] = splitAlphaNum(splitTarget[j]);
    prevPos = prevPos | 0;

    const delta = currChain === prevChain ? currPos - prevPos : currPos;
    dist.push(delta);

    // Update last valid residue
    lastChain = currChain;
    lastPos = currPos;
  }

  return dist;
}

export function parseResultsFoldDisco(data) {
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
    result.queryresidues = {};
    const grouped = {};
    let meta = null;
    if ("meta" in result) {
      meta = {};
      for (let j in result.meta) {
        let entry = result.meta[j];
        meta[entry.key] = entry;
      }
    }
    result.meta = null;
    for (let j in result.alignments) {
      let item = result.alignments[j];
      let split = item.target.split("/");
      item.target = split[split.length - 1];

      const splitTarget = item.targetresidues.split(",");
      item.gaps = splitTarget.reduce((acc, s) => {
        return acc + (s == "_" ? "0" : "1");
      }, "");
      item.interresiduedist = computeInterresidueDist(splitTarget);
      item.idfscore = item.idfscore.toFixed(3);
      item.rmsd = item.rmsd.toFixed(3);

      item.queryresidues.split(",").map((r) => {
        let [chain, pos, _] = splitAlphaNum(r);
        if (!(chain in result.queryresidues)) {
          result.queryresidues[chain] = new Set();
        }
        result.queryresidues[chain].add(pos - 0);
      });

      item.href = tryLinkTargetToDB(item.target, db);
      item.targetname = tryFixTargetName(item.target, db).toUpperCase();
      item.id = "result-" + i + "-" + j;
      if (meta != null) {
        let header = meta[item.dbkey].header;
        let split = header.split(" ");
        item.description = split.slice(1).join(" ");
        if (item.description.length > 1) {
          result.hasDescription = true;
        }
        if ("taxId" in meta[item.dbkey]) {
          item.taxId = meta[item.dbkey].taxId;
          item.taxName = meta[item.dbkey].taxName;
          result.hasTaxonomy = true;
        }
      }
      let groupId = j;
      if (!grouped[groupId]) {
        grouped[groupId] = [];
      }
      grouped[j].push(item);
    }
    result.alignments = grouped;
    Object.keys(result.queryresidues).forEach(function (key, _) {
      result.queryresidues[key] = Array.from(result.queryresidues[key]);
    });
  }
  return total != 0 && empty / total == 1
    ? { results: [], mode: data.mode }
    : data;
}

export function dateTime() {
  // Generates current YYYY_MM_DD_HH_MM_SS timestamp
  return new Date()
    .toLocaleString("sv")
    .replace(" ", "_")
    .replaceAll("-", "_")
    .replaceAll(":", "_");
}

export function djb2(str) {
  let hash = 5381; // Initial hash value
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i); // Magic number 33
  }
  return hash >>> 0; // Convert to an unsigned 32-bit integer
}

export function downloadBlob(blob, name) {
  const link = document.createElement("a");
  // const date = new Date().toLocaleString('sv').replace(' ', '_').replaceAll('-', '_').replaceAll(':', '_');
  link.href = URL.createObjectURL(blob);
  link.download = name;
  // link.download = `${this.$STRINGS.APP_NAME}_${date}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function download(data, name) {
  const json = JSON.stringify(data);
  const blob = new Blob([json], { type: "application/json" });
  const link = document.createElement("a");
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
    if (alnString[i] === "-") {
      map[i] = null;
      gaps++;
    } else {
      map[i] = realStart + i - gaps;
    }
  }
  return map;
}

export const oneToThree = {
  A: "ALA",
  R: "ARG",
  N: "ASN",
  D: "ASP",
  C: "CYS",
  E: "GLU",
  Q: "GLN",
  G: "GLY",
  H: "HIS",
  I: "ILE",
  L: "LEU",
  K: "LYS",
  M: "MET",
  F: "PHE",
  P: "PRO",
  S: "SER",
  T: "THR",
  W: "TRP",
  Y: "TYR",
  V: "VAL",
  U: "SEC",
  O: "PHL",
  X: "XAA",
};

export const threeToOne = {
  ALA: "A",
  ARG: "R",
  ASN: "N",
  ASP: "D",
  CYS: "C",
  GLU: "E",
  GLN: "Q",
  GLY: "G",
  HIS: "H",
  ILE: "I",
  LEU: "L",
  LYS: "K",
  MET: "M",
  PHE: "F",
  PRO: "P",
  SER: "S",
  THR: "T",
  TRP: "W",
  TYR: "Y",
  VAL: "V",
  SEC: "U",
  PHL: "O",
  XAA: "X",
};

export function xyz(structure, resIndex) {
  var rp = structure.getResidueProxy();
  var ap = structure.getAtomProxy();
  rp.index = resIndex;
  ap.index = rp.getAtomIndexByName("CA");
  return [ap.x, ap.y, ap.z];
}

function atomToPDBRow(ap) {
  const { serial, atomname, resname, chainname, resno, inscode, x, y, z } = ap;
  return `ATOM  ${serial.toString().padStart(5)}${atomname.padStart(
    4
  )}  ${resname.padStart(3)} ${chainname.padStart(1)}${resno
    .toString()
    .padStart(4)} ${inscode.padStart(1)}  ${x.toFixed(3).padStart(8)}${y
    .toFixed(3)
    .padStart(8)}${z.toFixed(3).padStart(8)}`;
}

export function makeChainMap(structure, sele) {
  let map = new Map();
  let idx = 1;
  structure.eachResidue((rp) => {
    map.set(idx++, { index: rp.index, resno: rp.resno });
  }, new Selection(sele));
  return map;
}

export function makeSubPDB(structure, sele) {
  let pdb = [];
  structure.eachAtom((ap) => {
    pdb.push(atomToPDBRow(ap));
  }, new Selection(sele));
  return pdb.join("\n");
}

/**
 * Create a mock PDB from Ca data
 * Follows the spacing spec from https://www.wwpdb.org/documentation/file-format-content/format33/sect9.html#ATOM
 * Will have to change if/when swapping to fuller data
 */
export function mockPDB(ca, seq, chain) {
  const atoms = ca.split(",");
  const pdb = new Array();
  let j = 1;
  for (let i = 0; i < atoms.length; i += 3, j++) {
    let [x, y, z] = atoms.slice(i, i + 3).map((element) => parseFloat(element));
    // if (x == 0 && y == 0 && z == 0) continue;
    pdb.push(
      "ATOM  " +
        j.toString().padStart(5) +
        "  CA  " +
        oneToThree[
          seq != "" && atoms.length / 3 == seq.length ? seq[i / 3] : "A"
        ] +
        chain.toString().padStart(2) +
        j.toString().padStart(4) +
        "    " +
        x.toFixed(3).padStart(8) +
        y.toFixed(3).padStart(8) +
        z.toFixed(3).padStart(8) +
        "  1.00  0.00           C  "
    );
  }
  return pdb.join("\n");
}

export function mergePdbs(chainPdbs /* [{pdb, chain}] */) {
  let serial = 1;
  const out = [];

  for (const { pdb, chain } of chainPdbs) {
    const lines = pdb.split(/\r?\n/);
    for (const line of lines) {
      if (/^(ATOM  |HETATM)/.test(line)) {
        // reassign atom serial no.
        let s = serial.toString().padStart(5, " ");
        let l = line.padEnd(80, " "); // 고정폭 보장
        l = l.slice(0, 6) + s + l.slice(11);

        // change chain_id
        l = l.substring(0, 21) + (chain[0] || "A") + l.substring(22);

        out.push(l);
        serial++;
      }
    }
    out.push("TER"); // 체인 경계
  }

  out.push("END");
  return out.join("\n");
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
  structure.eachAtom((atom) => {
    const [x, y, z] = [atom.x, atom.y, atom.z];
    atom.x = t[0] + u[0][0] * x + u[0][1] * y + u[0][2] * z;
    atom.y = t[1] + u[1][0] * x + u[1][1] * y + u[1][2] * z;
    atom.z = t[2] + u[2][0] * x + u[2][1] * y + u[2][2] * z;
  });
}

export function debounce(func, delay) {
  let timeoutId;
  return function () {
    const context = this;
    const args = arguments;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(function () {
      func.apply(context, args);
    }, delay);
  };
}

// Generate THREE.Matrix4 from 3x3 rotation and 1x3 translation matrices
// Can give this directly to StructureComponent.setTransform() to superpose
export function makeMatrix4(translation, rotation) {
  const u = rotation.slice();
  for (let i = 0; i < 3; i++) {
    u[i].push(translation[i]);
  }
  const nglMatrix = new Matrix4();
  const flatMatrix = [].concat(...u, [0, 0, 0, 1]);
  nglMatrix.set(...flatMatrix);
  return nglMatrix;
}

// Decompose Matrix4 into Quaternion, Position and Scale
// Slerp between Quaternions, linear interpolate position for some t (0.0-1.0)
// Compose new Matrix4 for transformation.
export function interpolateMatrices(a, b, t) {
  const quaternionA = new Quaternion();
  const positionA = new Vector3();
  const scaleA = new Vector3();
  const quaternionB = new Quaternion();
  const positionB = new Vector3();
  const scaleB = new Vector3();
  a.decompose(positionA, quaternionA, scaleA);
  b.decompose(positionB, quaternionB, scaleB);
  const quaternion = new Quaternion();
  quaternion.slerp(quaternionB, t);
  const position = new Vector3();
  position.lerpVectors(positionA, positionB, t);
  const matrix = new Matrix4();
  matrix.compose(position, quaternion, scaleA);
  return matrix;
}

export function animateMatrix(structure, newMatrix, duration) {
  let startTime = null;
  const oldMatrix = structure.matrix;
  const animate = (currentTime) => {
    if (!startTime) {
      startTime = currentTime;
    }
    let progress = Math.min(1, (currentTime - startTime) / duration);
    let interpolated = interpolateMatrices(oldMatrix, newMatrix, progress);
    structure.setTransform(interpolated);
    if (progress < 1) {
      window.requestAnimationFrame(animate);
    }
  };
  window.requestAnimationFrame(animate);
}

export function checkMultimer(pdbString) {
  const lines = pdbString.split("\n");
  const models = {};
  const chainSet = new Set();

  const trimmed = pdbString.trimStart();
  const isCIF = trimmed[0] === "#" || trimmed.startsWith("data_");

  if (!isCIF) {
    let currentModel = null;

    lines.forEach((line) => {
      const recordType = line.substring(0, 6).trim();

      if (recordType === "MODEL") {
        currentModel = line.substring(10, 14).trim();
        models[currentModel] = new Set();
      } else if (recordType === "ATOM") {
        const chainId = line.substring(21, 22);
        if (currentModel) {
          models[currentModel].add(chainId);
        } else {
          chainSet.add(chainId);
        }
      } else if (recordType === "ENDMDL") {
        currentModel = null;
      }
    });
  } else {
    let inLoop = false;
    let modelIndex = -1;
    let chainIndex = -1;
    let atomIndex = -1;
    let columnCount = 0;

    lines.forEach((line) => {
      if (line.startsWith("loop_")) {
        inLoop = true;
        columnCount = 0;
      } else if (inLoop && line.startsWith("_atom_site.")) {
        const colName = line.trim();
        if (colName === "_atom_site.pdbx_PDB_model_num") {
          modelIndex = columnCount;
        } else if (colName === "_atom_site.auth_asym_id") {
          chainIndex = columnCount;
        } else if (colName === "_atom_site.group_PDB") {
          atomIndex = columnCount;
        }
        columnCount++;
      } else if (inLoop && line.startsWith("#")) {
        inLoop = false;
      } else if (inLoop && line.trim()) {
        const dataColumns = line.trim().split(/\s+/);
        const groupPDB = atomIndex !== -1 ? dataColumns[atomIndex] : null;
        if (groupPDB !== "ATOM") {
          return;
        }

        const modelNum = modelIndex !== -1 ? dataColumns[modelIndex] : null;
        const chainId = chainIndex !== -1 ? dataColumns[chainIndex] : null;

        if (modelNum) {
          if (!models[modelNum]) {
            models[modelNum] = new Set();
          }
          models[modelNum].add(chainId);
        } else {
          chainSet.add(chainId);
        }
      }
    });
  }

  if (Object.keys(models).length === 0) {
    models["single model"] = chainSet;
  }
  return Object.values(models).some((model) => model.size > 1);
}

export function getPdbText(comp) {
  let pw = new PdbWriter(comp.structure, { renumberSerial: false });
  return pw
    .getData()
    .split("\n")
    .filter((line) => line.startsWith("ATOM"))
    .join("\n");
}

export const humanReadibleFormat = (bytes) => {
  const u = ["B", "KB", "MB", "GB"];
  let i = 0;
  while (bytes >= 1024 && i < u.length - 1) {
    bytes /= 1024;
    i++;
  }
  return `${bytes.toFixed(2)} ${u[i]}`;
};

export const calculateStrSize = (v) => {
  if (!v) return -1;

  if (typeof v == "string") {
    return v.length * 2;
  } else if (v instanceof Array) {
    let byte = 0;

    for (let s of v) {
      if (typeof s == "string") {
        byte += s.length * 2;
      } else if (s instanceof Object && !s.text && typeof s.text == "string") {
        byte += s.text.length * 2;
      }
    }

    return byte;
  } else {
    return -1;
  }
};

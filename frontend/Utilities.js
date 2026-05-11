import { MolScriptBuilder as MS } from "molstar/lib/mol-script/language/builder";
import { MinimizeRmsd } from "molstar/lib/mol-math/linear-algebra/3d/minimize-rmsd";
import { getPositionTable } from "molstar/lib/mol-model/structure/structure/util/superposition";
import { Mat4, Vec3 } from "molstar/lib/mol-math/linear-algebra";
import { Script } from "molstar/lib/mol-script/script";
import { StructureSelection } from "molstar/lib/mol-model/structure";
import { Color } from "molstar/lib/mol-util/color";
import { ungzip } from "pako";

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
          .replaceAll(/[0-9]+DI_/g, "") // For interface cluster, should we link to cluster web?
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
          "",
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
          /^af_([A-Z0-9]+)_(\d+)_(\d+)_(\d+\.\d+\.\d+\.\d+)$/,
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
  if (/-_-_-_/.test(name)) {
    name = name.split("-_-_-_")[0];
  }

  if (name.startsWith("AF-")) {
    name = name.replaceAll(/(AF[-_]|[-_]F[0-9]+[-_]model[-_]v[0-9]+)/g, "");
  }
  return name.replaceAll(/\.(cif|pdb|gz)/g, "");
}

export async function readUploadedText(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const data =
    bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b
      ? ungzip(bytes)
      : bytes;
  return new TextDecoder().decode(data);
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

// export function xyz(structure, resIndex) {
//   var rp = structure.getResidueProxy();
//   var ap = structure.getAtomProxy();
//   rp.index = resIndex;
//   ap.index = rp.getAtomIndexByName("CA");
//   return [ap.x, ap.y, ap.z];
// }

function atomToPDBRow(ap) {
  const { serial, atomname, resname, chainname, resno, inscode, x, y, z } = ap;
  return `ATOM  ${serial.toString().padStart(5)}${atomname.padStart(
    4,
  )}  ${resname.padStart(3)} ${chainname.padStart(1)}${resno
    .toString()
    .padStart(4)} ${inscode.padStart(1)}  ${x.toFixed(3).padStart(8)}${y
    .toFixed(3)
    .padStart(8)}${z.toFixed(3).padStart(8)}`;
}

export function makeChainMap(structure, sele) {
  let map = new Map();
  if (!structure || typeof structure.eachResidue !== "function") {
    return map;
  }
  let idx = 1;
  structure.eachResidue((rp) => {
    map.set(idx++, { index: rp.index, resno: rp.resno });
  });
  return map;
}

// export function makeSubPDB(structure, sele) {
//   let pdb = [];
//   let lastResno = null;
//   structure.eachAtom((ap) => {
//     if (ap.atomname === "CA" && ap.resno !== lastResno) {
//       lastResno = ap.resno;
//       pdb.push(atomToPDBRow(ap));
//     }
//   }, new Selection(sele));
//   return pdb.join("\n");
// }

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
        "  1.00  0.00           C  ",
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
        let l = line.padEnd(80, " ");
        l = l.slice(0, 6) + s + l.slice(11);

        // change chain_id
        l = l.substring(0, 21) + (chain[0] || "A") + l.substring(22);

        out.push(l);
        serial++;
      }
    }
    out.push("TER");
  }

  out.push("END");
  return out.join("\n");
}

/**
 *
 * @param {*} chainPdbs : Ca only pdb files with chain information in [{pdb, chain}] format
 * @returns concatenated pdb string
 * @abstract Concatenate multiple chains into one pdb files with single chain A
 */
export function concatenatePdbs(chainPdbs /* [{pdb, chain}] */) {
  let serial = 1;
  const out = [];

  for (const { pdb, chain } of chainPdbs) {
    const lines = pdb.split(/\r?\n/);
    for (const line of lines) {
      if (/^(ATOM  |HETATM)/.test(line)) {
        // reassign atom serial no. and residue sequence no.
        let s = serial.toString().padStart(5, " ");
        let rs = serial.toString().padStart(4, " ");
        let l = line.padEnd(80, " ");
        l = l.slice(0, 6) + s + l.slice(11, 21) + "A" + rs + l.slice(26);
        out.push(l);
        serial++;
      }
    }
  }
  out.push("TER");
  out.push("END");
  return out.join("\n");
}

/**
 *
 * @param {*} chainPdbs : Ca only pdb files with chain information in [{pdb, chain}] format
 * @returns concatenated pdb strings with suffix containing the chain informations
 * @abstract Concatenate multiple chains into one pdb files with single chain A, preserving the chain information in the suffix as well
 */
export function encodeMultimer(chainPdbs /* [{pdb, chain}] */) {
  const out = [];
  const chainInfoArr = [];
  const delimiter = "-_-_-_";
  let atomSerial = 1;

  for (const { pdb, chain } of chainPdbs) {
    const lines = pdb.split(/\r?\n/);
    const arr = [];

    for (const line of lines) {
      if (/^(ATOM  |HETATM)/.test(line)) {
        // reassign atom serial no. and residue sequence no.
        let l = line.padEnd(80, " ");
        let s = atomSerial.toString().padStart(5, " ");
        let rs = atomSerial.toString().padStart(4, " ");
        l = l.slice(0, 6) + s + l.slice(11, 21) + "A" + rs + l.slice(26);
        arr.push(l);
        atomSerial++;
      }
    }

    let firstResn = Number(arr.at(0).slice(22, 26));
    let lastResn = Number(arr.at(-1).slice(22, 26));

    const info = {};
    info.chain = chain;
    info.end = lastResn;
    info.offset = firstResn - 1;
    chainInfoArr.push(info);

    out.push(arr.join("\n"));
  }
  out.push("TER");
  out.push("END");

  let suffix =
    delimiter +
    chainInfoArr
      .map((e) => {
        return e.chain + "_" + e.end + "_" + e.offset;
      })
      .join("-");

  return {
    pdb: out.join("\n"),
    suffix: suffix,
  };
}

/**
 *
 * @param {*} pdb : Ca only pdb file merged by encodeMultimer()
 * @param {*} suffix : String containing chain information encoded by encodedMultimer()
 * @returns Recovered pdb with original multimer information encoded beforehand
 * @abstract Revert back the merged pdb into multimeric pdbs using multiple chain information encoded in suffix.
 * Make sure to call this function with Ca only pdb, before running pulchra
 */
export function decodeMultimer(pdb, suffix) {
  if (!suffix || suffix.length == 0) return pdb;

  const chainInfos = suffix.split("-").map((s) => {
    const out = {};
    const info = s.split("_");

    if (info.length != 3) return out;

    out.chain = info[0];
    out.end = Number(info[1]);
    out.offset = Number(info[2]);
    return out;
  });

  let index = 0;
  const out = [];

  for (const line of pdb.split("\n")) {
    if (line.startsWith("ATOM")) {
      const rs = Number(line.slice(22, 26));
      const result =
        line.slice(0, 21) +
        chainInfos[index].chain +
        (rs - chainInfos[index].offset).toString().padStart(4, " ") +
        line.slice(26);
      out.push(result);
      if (rs == chainInfos[index].end) {
        index++;
        out.push("TER");
      }
    }
  }
  out.push("END");

  return out.join("\n");
}

export function splitMultimer(pdb) {
  const arr = pdb.split("\nTER\n");
  const processed = arr.slice(0, -1).map((s) => s + "\nTER\nEND");
  return processed;
}

export function mergeMultimer(arr) {
  let serial = 1;
  const merged = arr.map((s) => s.split("\nEND")[0]).join("\n") + "\nEND";
  const out = [];
  for (const line of merged.split("\n")) {
    if (line.startsWith("ATOM")) {
      const result =
        line.slice(0, 6) + serial.toString().padStart(5, " ") + line.slice(11);
      out.push(result);
      serial++;
    } else if (line.startsWith("TER") || line.startsWith("END")) {
      out.push(line);
    }
  }
  return out.join("\n");
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
  if (typeof Matrix4 === "undefined") {
    return { translation, rotation };
  }
  const u = rotation.slice();
  for (let i = 0; i < 3; i++) {
    u[i].push(translation[i]);
  }
  const nglMatrix = new Matrix4();
  const flatMatrix = [].concat(...u, [0, 0, 0, 1]);
  nglMatrix.set(...flatMatrix);
  return nglMatrix;
}

// Generate Mol* Mat4 from 3x3 u (rotation) and 1x3 t (translation) matrices
export function makeMat4(t, u) {
  const mat = u.slice();
  for (let i = 0; i < 3; i++) {
    mat[i].push(t[i]);
  }
  const flatMatrix = [].concat(...mat, [0, 0, 0, 1]);

  if (typeof Mat4 === "undefined") {
    return flatMatrix;
  }

  let mat4 = Mat4.identity();
  mat4 = Mat4.fromArray(mat4, flatMatrix, 0);
  return mat4;
}

// Decompose Matrix4 into Quaternion, Position and Scale
// Slerp between Quaternions, linear interpolate position for some t (0.0-1.0)
// Compose new Matrix4 for transformation.
// export function interpolateMatrices(a, b, t) {
//   if (
//     typeof Quaternion === "undefined" ||
//     typeof Vector3 === "undefined" ||
//     typeof Matrix4 === "undefined"
//   ) {
//     return t >= 1 ? b : a;
//   }
//   const quaternionA = new Quaternion();
//   const positionA = new Vector3();
//   const scaleA = new Vector3();
//   const quaternionB = new Quaternion();
//   const positionB = new Vector3();
//   const scaleB = new Vector3();
//   a.decompose(positionA, quaternionA, scaleA);
//   b.decompose(positionB, quaternionB, scaleB);
//   const quaternion = new Quaternion();
//   quaternion.slerp(quaternionB, t);
//   const position = new Vector3();
//   position.lerpVectors(positionA, positionB, t);
//   const matrix = new Matrix4();
//   matrix.compose(position, quaternion, scaleA);
//   return matrix;
// }

// export function animateMatrix(structure, newMatrix, duration) {
//   let startTime = null;
//   const oldMatrix = structure.matrix;
//   const animate = (currentTime) => {
//     if (!startTime) {
//       startTime = currentTime;
//     }
//     let progress = Math.min(1, (currentTime - startTime) / duration);
//     let interpolated = interpolateMatrices(oldMatrix, newMatrix, progress);
//     structure.setTransform(interpolated);
//     if (progress < 1) {
//       window.requestAnimationFrame(animate);
//     }
//   };
//   window.requestAnimationFrame(animate);
// }

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

// export function getPdbText(comp) {
//   if (!comp) {
//     return "";
//   }
//   if (typeof PdbWriter !== "undefined" && comp.structure) {
//     let pw = new PdbWriter(comp.structure, { renumberSerial: false });
//     return pw
//       .getData()
//       .split("\n")
//       .filter((line) => line.startsWith("ATOM"))
//       .join("\n");
//   }
//   const text =
//     typeof comp === "string"
//       ? comp
//       : typeof comp.data === "string"
//       ? comp.data
//       : "";
//   return text
//     .split("\n")
//     .filter((line) => line.startsWith("ATOM"))
//     .join("\n");
// }

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

export function storeChains(pdb) {
  const arr = [];
  let c = "";
  for (let line of pdb.split("\n")) {
    if (line.startsWith("ATOM")) {
      c = line.charAt(21);
    } else if (line.startsWith("TER")) {
      arr.push(c);
    }
  }
  if (arr.length == 0) {
    arr.push(c);
  }
  return arr;
}

export function revertChainInfo(pdb, chains) {
  if (chains.length == 0 || chains[0] == "") {
    return pdb;
  }

  const arr = [];
  let i = 0;

  for (let line of pdb.split("\n")) {
    if (line.startsWith("ATOM")) {
      line = line.slice(0, 21) + chains[i] + line.slice(22);
    } else if (line.startsWith("TER")) {
      i++;
    }

    arr.push(line);
  }

  return arr.join("\n");
}

export function getAbsOffsetTop($el) {
  var sum = 0;
  while ($el) {
    sum += $el.offsetTop;
    $el = $el.offsetParent;
  }
  return sum;
}

export const getChainName = (name) => {
  if (/_v[0-9]+$/.test(name) || /^AF-\W+-/.test(name)) {
    return "A";
  }

  let pos = name.lastIndexOf("_");
  if (pos != -1) {
    let match = name.substring(pos + 1);
    return match.length >= 1 && isNaN(Number(match[0])) ? match[0] : "A";
  }
  // fallback
  return "A";
};

export const getAccession = (name) => {
  if (/-_-_-_/.test(name)) {
    name = name.split("-_-_-_")[0];
  }

  if (/^AF-\w+-/.test(name)) {
    name = name.split("-")[1];
  }

  // name = name.replaceAll(/-assembly[0-9]/g, "");
  name = name.replaceAll(/\.(cif|pdb|gz)/g, "");

  if (/_v[0-9]+$/.test(name)) {
    return name;
  }

  if (/_unrelaxed_rank_/.test(name)) {
    let pos = name.indexOf("_unrelaxed_rank_");
    return pos != -1 ? name.substring(0, pos) : name;
  }

  let pos = name.lastIndexOf("_");
  return pos != -1 ? name.substring(0, pos) : name;
};

/**
 * Throttle function
 * @param {Function} func - function to be applied throttle
 * @param {number} delay - delay in ms unit
 * @returns {Function} - new function with throttle
 */
export function throttle(func, delay) {
  let lastCallTime = 0;

  return function (...args) {
    const context = this;
    const now = Date.now();

    if (now - lastCallTime >= delay) {
      lastCallTime = now;
      func.apply(context, args);
    }
  };
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function getResidueIndices(
  seq,
  alnPoses /* array of highlighted columns */,
) {
  const result = [];

  if (alnPoses.length == 0) {
    return result;
  }

  let resno = 0;
  let startPos = 0;
  const sorted = [...alnPoses].sort((a, b) => a - b);
  for (let p of sorted) {
    for (let i = startPos; i <= p && i < seq.length; i++) {
      if (seq[i] != "-") {
        if (i == p) {
          result.push(resno++);
          startPos = i + 1;
          break;
        }
        resno++;
      }
    }
  }
  return result;
}

export function getResnoWithChain(
  seq,
  alnPoses /* array of highlighted columns */,
  chains,
  offsets,
) {
  const result = [];

  if (alnPoses.length == 0) {
    return result;
  }

  let resi = 0;
  let startPos = 0;
  const sorted = [...alnPoses].sort((a, b) => a - b);
  const isMultimer = Object.keys(offsets).length > 1;

  for (let p of sorted) {
    for (let i = startPos; i <= p && i < seq.length; i++) {
      if (seq[i] != "-") {
        if (i == p) {
          const resno = resi + 1;
          const chain = isMultimer ? chains[resno] : "A";
          const offset = isMultimer ? offsets[chain] : 0;
          result.push(chain + String(resno - offset));
          resi++;
          startPos = i + 1;
          break;
        }
        resi++;
      }
    }
  }
  return result;
}

// Deprecated: It was needed for ngl stage, but it became useless
export function wrapLog() {
  const originalLog = console.log;
  console.log = function (...args) {
    if (typeof args[0] === "string" && args[0].includes("STAGE LOG")) {
      return;
    }
    originalLog.apply(console, args);
  };
}

export function recoverLog() {
  const tmpIframe = document.createElement("iframe");
  tmpIframe.style.display = "none";
  document.body.appendChild(tmpIframe);
  console.log = tmpIframe.contentWindow.console.log;
  document.body.removeChild(tmpIframe);
}

export const toMolstarColor = (value, fallback) => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Color(value);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.length > 0) {
      const hex = trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
      const parsed = Number.parseInt(hex, 16);
      if (Number.isFinite(parsed)) {
        return Color(parsed);
      }
    }
  }
  return Color(fallback);
};

export const transformPdb = (pdb, t, u) => {
  if (!pdb) return pdb;
  return pdb
    .split("\n")
    .map((line) => {
      if (!line.startsWith("ATOM") && !line.startsWith("HETATM")) {
        return line;
      }
      const x = Number.parseFloat(line.slice(30, 38));
      const y = Number.parseFloat(line.slice(38, 46));
      const z = Number.parseFloat(line.slice(46, 54));
      if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
        return line;
      }
      const nx = t[0] + u[0][0] * x + u[0][1] * y + u[0][2] * z;
      const ny = t[1] + u[1][0] * x + u[1][1] * y + u[1][2] * z;
      const nz = t[2] + u[2][0] * x + u[2][1] * y + u[2][2] * z;
      const prefix = line.slice(0, 30);
      const suffix = line.slice(54);
      return `${prefix}${nx.toFixed(3).padStart(8)}${ny
        .toFixed(3)
        .padStart(8)}${nz.toFixed(3).padStart(8)}${suffix}`;
    })
    .join("\n");
};

export const extractAtomLines = (pdb) => {
  if (!pdb) {
    return [];
  }
  return pdb
    .split("\n")
    .filter((line) => line.startsWith("ATOM") || line.startsWith("HETATM"));
};

// single chain expression builder
export const buildChainExpression = (chain, ranges, useChainTest = true) => {
  // debugger
  const groupBy = MS.struct.atomProperty.macromolecular.residueKey();
  const chainTest = useChainTest
    ? MS.core.rel.eq([
        MS.struct.atomProperty.macromolecular.auth_asym_id(),
        chain,
      ])
    : null;
  if (!ranges || ranges.length === 0) {
    return chainTest
      ? MS.struct.generator.atomGroups({
          "chain-test": chainTest,
          "group-by": groupBy,
        })
      : MS.struct.generator.all();
  }
  const rangeExpressions = ranges.map((range) =>
    MS.struct.generator.atomGroups({
      ...(chainTest ? { "chain-test": chainTest } : {}),
      "residue-test": MS.core.rel.inRange([
        MS.struct.atomProperty.macromolecular.auth_seq_id(),
        range.start,
        range.end,
      ]),
      "group-by": groupBy,
    }),
  );
  return rangeExpressions.length === 1
    ? rangeExpressions[0]
    : MS.struct.combinator.merge(rangeExpressions);
};

export const getSelectionLoci = (expression, structureRef) => {
  const data = structureRef?.cell?.obj?.data;
  if (!data || !expression) {
    return null;
  }
  const selection = Script.getStructureSelection(expression, data);
  return StructureSelection.toLociWithSourceUnits(selection);
};

export const isChainToken = (token) => {
  return typeof token === "string" && /^[A-Za-z]$/.test(token);
};

export const parseAtomLine = (line) => {
  if (!line.startsWith("ATOM") && !line.startsWith("HETATM")) return null;
  let atom = line.slice(12, 16).trim();
  let chainId = line.length >= 22 ? line[21] : "";
  let resno = Number.parseInt(line.slice(22, 26).trim(), 10);
  let resname = line.slice(17, 20).trim();
  if (!Number.isFinite(resno) || !resname) {
    const parts = line.trim().split(/\s+/);
    if (
      parts.length >= 6 &&
      isChainToken(parts[4]) &&
      !Number.isNaN(Number.parseInt(parts[5], 10))
    ) {
      chainId = parts[4];
      resno = Number.parseInt(parts[5], 10);
      resname = parts[3] || resname;
    } else if (parts.length >= 5) {
      resno = Number.parseInt(parts[4], 10);
      resname = parts[3] || resname;
    }
  }
  return { atom, chainId, resno, resname };
};

/**
 *
 * @param {string} pdb
 * @returns {Map<string, Array<number>} map, mapping chainId to resno list
 */
export const buildSerialResidueMap = (pdb) => {
  const map = new Map();
  if (!pdb) {
    return map;
  }
  const lastResidue = new Map();
  for (const line of pdb.split("\n")) {
    const parsed = parseAtomLine(line);
    if (!parsed) {
      continue;
    }
    const chainKey =
      parsed.chainId && parsed.chainId.trim() ? parsed.chainId.trim() : "_";
    const residueKey = `${chainKey}:${parsed.resno}:${parsed.resname}`;
    if (lastResidue.get(chainKey) === residueKey) {
      continue;
    }
    lastResidue.set(chainKey, residueKey);
    if (!map.has(chainKey)) map.set(chainKey, []);
    map.get(chainKey).push(parsed.resno);
  }
  return map;
};

/**
 *
 * @param {Array<Object>} ranges: array of range objects({start, end}) consists of serial numbers
 * @param {Array<Number>} serialMap: array of resno corresponding to the given serialId
 * @returns {Array<Object>} array of validated resno for given ranges.
 */
export const mapRangesToAuth = (ranges, serialMap) => {
  if (!serialMap || serialMap.length === 0) {
    return ranges;
  }

  if (!ranges || ranges.length == 0) return [];

  return ranges
    .map((range) => {
      const startIdx = Math.max(1, Math.round(range.start));
      const endIdx = Math.max(1, Math.round(range.end));
      const startPos = Math.min(serialMap.length, startIdx) - 1;
      const endPos = Math.min(serialMap.length, endIdx) - 1;
      const startResno = serialMap[startPos];
      const endResno = serialMap[endPos];
      if (!Number.isFinite(startResno) || !Number.isFinite(endResno))
        return null;
      return {
        start: Math.min(startResno, endResno),
        end: Math.max(startResno, endResno),
      };
    })
    .filter(Boolean);
};

/**
 *
 * @param {string} pdb
 * @param {Map<string, Array[Object]>} rangesByChain
 * @returns {string} subpdb meeting the given ranges for each chain
 */
export const makeSubPdbFromRanges = (pdb, rangesByChain) => {
  if (!pdb) {
    return "";
  }
  const lines = pdb.split("\n");
  const atomLines = lines.filter(
    (line) => line.startsWith("ATOM") || line.startsWith("HETATM"),
  );
  const selected = [];
  const allRanges = [];
  rangesByChain.forEach((ranges) => {
    ranges.forEach((range) => allRanges.push(range));
  });
  const residueCounters = new Map();
  const lastResidue = new Map();
  for (const line of atomLines) {
    const parsed = parseAtomLine(line);
    if (!parsed) continue;
    const chainKey =
      parsed.chainId && parsed.chainId.trim() ? parsed.chainId.trim() : "_";
    const residueKey = `${chainKey}:${parsed.resno}:${parsed.resname}`;
    let serialIndex = residueCounters.get(chainKey) || 0; // serialIndex is reset to 0 for every chain.
    if (lastResidue.get(chainKey) !== residueKey) {
      serialIndex += 1;
      residueCounters.set(chainKey, serialIndex);
      lastResidue.set(chainKey, residueKey);
    }
    const ranges = rangesByChain.get(parsed.chainId) || allRanges;
    if (!ranges || ranges.length === 0) continue;
    for (const range of ranges) {
      if (serialIndex >= range.start && serialIndex <= range.end) {
        selected.push(line);
        break;
      }
    }
  }
  if (selected.length === 0) {
    return atomLines.join("\n");
  }
  return selected.join("\n");
};

export const isCg = (pdb) => {
  if (!pdb || typeof pdb !== "string") return false;

  const lines = pdb.split("\n");
  const atomLines = lines.filter(
    (line) => line.startsWith("ATOM") || line.startsWith("HETATM"),
  );
  let lastResno = -1;
  for (const line of atomLines) {
    const parsed = parseAtomLine(line);
    if (!parsed) continue;

    const resno = parsed.resno;
    if (lastResno < 0) {
      lastResno = resno;
    }
    if (parsed.atom != "CA") return false;
    else if (lastResno != resno) return true;
    else continue;
  }
};

export const superposeWithAlignment = (queryRef, targetRef, alignments) => {
  // 1. Parse alnFasta to get gapless (qResno, tResno) pairs
  const groupByChain = (items) => {
    const map = new Map();
    for (const { chain, resno } of items) {
      if (!map.has(chain)) map.set(chain, []);
      map.get(chain).push({ start: resno, end: resno });
    }
    return map;
  };

  const buildMultiChainExpr = (rangesByChain) => {
    const exprs = [];
    for (const [chain, ranges] of rangesByChain) {
      exprs.push(buildChainExpression(chain, ranges));
    }
    return exprs.length == 1 ? exprs[0] : MS.struct.combinator.merge(exprs);
  };

  const pairs = [];
  for (const aln of alignments) {
    const qChain = getChainName(aln.query);
    const tChain = getChainName(aln.target);
    let qPos = aln.qStartPos;
    let tPos = aln.dbStartPos;
    for (let i = 0; i < aln.qAln.length; i++) {
      const qAA = aln.qAln[i];
      const tAA = aln.dbAln[i];
      if (qAA !== "-" && tAA !== "-") {
        pairs.push({ qChain, qResno: qPos, tChain, tResno: tPos });
      }
      if (qAA !== "-") qPos++;
      if (tAA !== "-") tPos++;
    }
  }
  const n = pairs.length;

  // 2. Build two equal-length, correspondence-matched loci
  const qRanges = groupByChain(
    pairs.map((p) => ({ chain: p.qChain, resno: p.qResno })),
  );
  const tRanges = groupByChain(
    pairs.map((p) => ({ chain: p.tChain, resno: p.tResno })),
  );

  const qExpr = buildMultiChainExpr(qRanges); // MS.struct.combinator.merge of per-chain exprs
  const tExpr = buildMultiChainExpr(tRanges);

  const qLoci = getSelectionLoci(qExpr, queryRef);
  const tLoci = getSelectionLoci(tExpr, targetRef);

  // 3. Extract position tables and compute Kabsch transform
  const posQ = getPositionTable(qLoci, n);
  const posT = getPositionTable(tLoci, n);
  const result = MinimizeRmsd.compute({ a: posQ, b: posT });

  return result.bTransform; // Mat4, ready for updateTransformMatrix
};

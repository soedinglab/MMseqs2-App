import { ungzip } from "pako";
import { parseResults, parseResultsRiboseek } from "./lib/parseResults.js";

export {
  parseResults,
  parseResultsFoldDisco,
  parseResultsRiboseek,
  tryFixName,
  splitAlphaNum,
} from "./lib/parseResults.js";


export async function readUploadedText(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const data =
    bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b
      ? ungzip(bytes)
      : bytes;
  return new TextDecoder().decode(data);
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

export function parseResultsListRiboseek(data) {
  let hits = [];
  for (let result of data) {
    hits.push(parseResultsRiboseek(result));
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

export function makeCgPDBFromText(text) {
  const pdb = [];
  let lastResidue = null;
  let lastChain = null;
  for (const line of String(text || "").split("\n")) {
    if (!line.startsWith("ATOM")) continue;
    const atomname = line.slice(12, 16).trim();
    const element = (line.slice(76, 78).trim() || atomname[0]).toUpperCase();
    const chain = line.slice(21, 22).trim() || "A";
    const resno = line.slice(22, 26).trim();
    const key = `${chain}:${resno}`;
    if (atomname !== "CA" || element !== "C" || key === lastResidue) continue;
    if (lastChain && lastChain !== chain) pdb.push("TER");
    pdb.push(line.padEnd(80));
    lastResidue = key;
    lastChain = chain;
  }
  if (pdb.length) pdb.push("TER");
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
  
  if (name.includes(' ')) {
    name = name.split(' ')[0]
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
  
  if (name.includes(' ')) {
    name = name.split(' ')[0]
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

  const selectedColumns = new Set(alnPoses);
  let resno = 0;
  for (let i = 0; i < seq.length; i++) {
    if (seq[i] == "-") {
      continue;
    }
    if (selectedColumns.has(i)) {
      result.push(resno);
    }
    resno++;
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

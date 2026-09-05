// Building and re-combining CA-only PDB text. Extracted from Utilities.js

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
    chainInfoArr.length < 2
      ? ""
      : delimiter +
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

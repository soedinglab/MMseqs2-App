import { ungzip } from "pako";
import { parseResults, parseResultsRiboseek } from "./lib/parseResults.js";

export {
  parseResults,
  parseResultsFoldDisco,
  parseResultsRiboseek,
  tryFixName,
  splitAlphaNum,
} from "./lib/parseResults.js";

// Same reason, same arrangement: the CA-only PDB builders and the multimer encode/decode pair, the
// target-name readers, and the column-to-residue mapping all moved to lib/ so the headless layer can
// import them, and are re-exported here so every existing import site keeps working unchanged.
export {
  oneToThree,
  threeToOne,
  mockPDB,
  mergePdbs,
  concatenatePdbs,
  encodeMultimer,
  decodeMultimer,
  splitMultimer,
  mergeMultimer,
  storeChains,
  revertChainInfo,
} from "./lib/pdbAssembly.js";
export { getChainName, getAccession } from "./lib/targetName.js";
export { getResidueIndices, getResnoWithChain } from "./lib/alignmentColumns.js";


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


export function getAbsOffsetTop($el) {
  var sum = 0;
  while ($el) {
    sum += $el.offsetTop;
    $el = $el.offsetParent;
  }
  return sum;
}


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

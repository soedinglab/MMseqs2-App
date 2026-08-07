import * as wasm from "ribossfold-wasm";

const CACHE_LIMIT = 256;
const cache = new Map();
let folder = null;

// ACGU only, T -> U, everything else N
export function cleanSequence(sequence) {
  let out = "";
  for (const c of sequence.toUpperCase()) {
    if (c === "T") {
      out += "U";
    } else if (c === "A" || c === "C" || c === "G" || c === "U") {
      out += c;
    } else if (/[A-Z]/.test(c)) {
      out += "N";
    }
  }
  return out;
}

function parseResult(result) {
  if (typeof result === "string") {
    const tab = result.lastIndexOf("\t");
    if (tab === -1) {
      return { structure: result, mfe: 0 };
    }
    return {
      structure: result.slice(0, tab),
      mfe: parseInt(result.slice(tab + 1), 10) / 100,
    };
  }
  // kcal/mol
  return { structure: result.structure ?? "", mfe: result.mfe ?? 0 };
}

function resolveFolder() {
  for (const mod of [wasm, wasm.default]) {
    if (mod && typeof mod.fold === "function") {
      return (seq) => mod.fold(seq);
    }
  }
  if (typeof wasm.default === "function") {
    let instance = null;
    return async (seq) => {
      if (instance === null) {
        instance = await wasm.default();
      }
      return instance.foldSeq(seq);
    };
  }
  throw new Error("ribossfold-wasm does not expose a folding function");
}

export async function fold(sequence) {
  const seq = cleanSequence(sequence);
  if (seq.length === 0) {
    return { sequence: seq, structure: "", mfe: 0 };
  }
  if (cache.has(seq)) {
    return cache.get(seq);
  }

  if (folder === null) {
    folder = resolveFolder();
  }
  const { structure, mfe } = parseResult(await folder(seq));
  const result = { sequence: seq, structure, mfe };

  if (cache.size >= CACHE_LIMIT) {
    cache.delete(cache.keys().next().value);
  }
  cache.set(seq, result);
  return result;
}

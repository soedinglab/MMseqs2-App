// Mapping alignment columns to residues, and residues to (chain, resno).
//
// getResidueIndices/getResnoWithChain moved out of Utilities.js so Node can load them without ngl;
// re-exported there unchanged.
//
// entryChainMap is new here, but its body is not: it is MSA.vue's beforeMount trio (parseSuffix,
// chainToOffset, indexToChainAndOrigResn) lifted verbatim into one function. MSA.vue now imports it,
// so a FoldMason entry's chain bookkeeping has one definition — the motif built from a column
// selection depends on it, and a second copy could disagree about which chain a residue is in.

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

/**
 * A FoldMason entry's suffix, as `[{chain, end, offset}]`.
 *
 * `end` is the last residue number of that chain in the encoded (single-chain) numbering and
 * `offset` is what to subtract to recover the original number — exactly what encodeMultimer wrote.
 * Takes the suffix with the `-_-_-_` delimiter already stripped, which is the form both MSA.vue and
 * decodeMultimer expect.
 */
export function parseSuffix(suffix) {
  if (!suffix) return [];

  return suffix.split("-").map((s) => {
    const out = {};
    const info = s.split("_");

    if (info.length != 3) return out;

    out.chain = info[0];
    out.end = Number(info[1]);
    out.offset = Number(info[2]);
    return out;
  });
}

/**
 * Chain bookkeeping for one aligned entry.
 *
 * `chains` and `resns` are indexed by **1-based residue number** — index 0 is a filler so that
 * `chains[resno]` reads directly — and cover the ungapped sequence, not the alignment columns. A
 * monomer (no suffix) is chain 'A' throughout with offset 0, which is what the multimer branches
 * collapse to anyway.
 *
 * @param {string} aa      the gapped alignment string
 * @param {string} suffix  encodeMultimer's suffix, delimiter stripped; falsy for a monomer
 * @returns {{chainInfo: object[], offsets: Record<string, number>, chains: string[], resns: number[]}}
 */
export function entryChainMap(aa, suffix) {
  const chainInfo = parseSuffix(suffix);

  const offsets = {};
  if (chainInfo.length === 0) {
    offsets.A = 0;
  } else {
    for (const obj of chainInfo) offsets[obj.chain] = obj.offset;
  }

  const length = aa.replaceAll("-", "").length;
  const chains = Array(length + 1).fill("A");
  const resns = Array.from({ length: length + 1 }, (_, i) => i);

  if (chainInfo.length > 0) {
    let index = 0;
    for (let i = 1; i < length + 1; i++) {
      chains[i] = chainInfo[index].chain;
      resns[i] = i - chainInfo[index].offset;

      if (i == chainInfo[index].end) {
        index++;
      }
    }
  }

  return { chainInfo, offsets, chains, resns };
}

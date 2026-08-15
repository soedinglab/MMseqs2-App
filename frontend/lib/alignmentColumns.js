// Mapping alignment columns to residues, and residues to (chain, resno).

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

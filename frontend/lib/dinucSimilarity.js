// Riboseek scores RNA as dinucleotides (base, next base); these are the pairs scoring above
// zero in its data/dinuc.out, keyed query pair then target pair.
const SIMILAR = new Set(
  ("AAAG AAAU AAGA AAUA ACAU ACGC AGAA AGGG AUAA AUAC AUGU AUUU CACG CAUA CCCU CCUC CGCA " +
   "CGUG CUCC CUUU GAAA GAGG GCAC GCGU GGAG GGGA GUAU GUGC UAAA UACA UAUG UAUU UCCC UCUU " +
   "UGCG UGUA UUAU UUCU UUUA UUUC").split(" ")
);

const base = (c) => (c === "T" ? "U" : c);

function nextBases(aln) {
  const next = new Array(aln.length);
  let seen = "";
  for (let i = aln.length - 1; i >= 0; i--) {
    next[i] = seen;
    if (aln[i] !== "-") seen = base(aln[i]);
  }
  return next;
}

// BLAST-style midline. A dinucleotide running off the end of the alignment never matches.
export function alignmentDiffRna(qAln, dbAln) {
  const qNext = nextBases(qAln);
  const tNext = nextBases(dbAln);
  let res = "";
  for (let i = 0; i < qAln.length; i++) {
    const q = base(qAln[i]);
    const t = base(dbAln[i]);
    if (q === t && q !== "-") {
      res += qAln[i];
    } else {
      res += SIMILAR.has(q + qNext[i] + t + tNext[i]) ? "+" : " ";
    }
  }
  return res;
}

// Result parsing shared by the mounted frontend and the mcp agent layer under mcp/.
// Extracted from Utilities.js

// Needed for support on both frontend and mcp layer
const APP = typeof __APP__ !== 'undefined' ? __APP__ : (globalThis.__MMSEQS_APP__ ?? 'foldseek');

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
    } else if (res.startsWith("humanppi")) {
      return (
        "http://prodata.swmed.edu/humanPPI/results/" +
        target
          .split("__")
          .map((half) => half.split("_")[0])
          .join("_")
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

    if (APP == "foldseek") {
      if (target.startsWith("AF-")) {
        // Old: AF-<uniprot>-F1-model_v4, entry keyed on the bare accession.
        // New: AF-<id>-model_v1, entry keyed on the whole AF-<id>, no UniProt.
        // Interface entries append _<chain1>_<chain2>_<side>.
        const stem = target.replaceAll(
          /-(F[0-9]+-)?model_v[0-9]+(\.(cif|pdb))?(\.gz)?(_[A-Za-z0-9]+){0,3}$/g,
          "",
        );
        const isUniProt = /-F[0-9]+-model_v/.test(target);
        const accession = isUniProt ? stem.substring(3) : stem;
        const links = [
          {
            label: "AFDB",
            accession: accession,
            href: "https://www.alphafold.ebi.ac.uk/entry/" + accession,
          },
        ];
        if (isUniProt) {
          links.push({
            label: "UniProt",
            accession: accession,
            href: "https://www.uniprot.org/uniprot/" + accession,
          });
        }
        return links;
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
  if (APP == "foldseek") {
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
    const isGrouped =
      result.alignments != null && !Array.isArray(result.alignments);
    const grouped = isGrouped ? result.alignments : {};
    for (let j in result.alignments) {
      for (let k in result.alignments[j]) {
        let item = result.alignments[j][k];
        if (item.description === undefined) {
          let split = item.target.split(" ");
          item.description = split.slice(1).join(" ");
          item.href = tryLinkTargetToDB(split[0], db);
          item.target = tryFixTargetName(split[0], db);
        }
        if (item.description.length > 1) {
          result.hasDescription = true;
        }
        item.id = "result-" + i + "-" + j;
        item.active = false;
        if (APP != "foldseek" || data.mode != "tmalign") {
          item.eval =
            typeof item.eval === "string"
              ? item.eval
              : item.eval.toExponential(2);
        }
        if (APP == "foldseek") {
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
        if (!isGrouped) {
          let groupId = item.complexid ?? k;
          if (!grouped[groupId]) {
            grouped[groupId] = [];
          }
          grouped[groupId].push(item);
        }
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

export function parseResultsRiboseek(data) {
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
    const raw = result.alignments || [];
    const groups = raw.length > 0 && Array.isArray(raw[0]) ? raw : [raw];
    const hits = [];
    for (const group of groups) {
      for (const item of group) {
        if (item.description === undefined) {
          const split = item.target.split(" ");
          item.target = tryFixTargetName(split[0], db);
          item.description = split.slice(1).join(" ");
          item.href = tryLinkTargetToDB(split[0], db);
        }
        if (item.description.length > 1) {
          result.hasDescription = true;
        }
        item.id = "result-" + i + "-" + hits.length;
        item.evalStr = typeof item.eval === "string" ? item.eval : item.eval.toExponential(2);
        item.strand = item.qStartPos > item.qEndPos ? "-" : "+";
        if ("taxId" in item) {
          result.hasTaxonomy = true;
        }
        hits.push(item);
      }
    }
    result.alignments = hits;
  }
  return total != 0 && empty / total == 1
    ? { results: [], mode: data.mode }
    : data;
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


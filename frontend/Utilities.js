function tryLinkTargetToDB(target, db) {
    var res = db.toLowerCase();
    if (res.startsWith("pfam")) {
        return 'https://pfam.xfam.org/family/' + target;
    } else if (res.startsWith("pdb")) {
        return 'https://www.rcsb.org/pdb/explore.do?structureId=' + target.replaceAll(/\.(cif|pdb)(\.gz)?/g, '').split('_')[0];
    } else if (res.startsWith("uniclust") || res.startsWith("uniprot") || res.startsWith("sprot") || res.startsWith("swissprot")) {
        return 'https://www.uniprot.org/uniprot/' + target;
    } else if (res.startsWith("eggnog_")) {
        return 'http://eggnogdb.embl.de/#/app/results?target_nogs=' + target;
    } else if (res.startsWith("cdd")) {
        return 'https://www.ncbi.nlm.nih.gov/Structure/cdd/cddsrv.cgi?uid=' + target;
    }

    if (__APP__ == "foldseek") {
        if (target.startsWith("AF-")) {
            return 'https://www.alphafold.ebi.ac.uk/entry/' + target.replaceAll(/-F[0-9]+-model_v[0-9]+(\.(cif|pdb))?(\.gz)?(_[A-Z0-9]+)?$/g, '');
        } else if (target.startsWith("GMGC")) {
            return 'https://gmgc.embl.de/search.cgi?search_id=' + target.replaceAll(/\.(cif|pdb)(\.gz)?/g, '')
        } else if (target.startsWith("MGYP")) {
            return 'https://esmatlas.com/explore/detail/' + target.replaceAll(/\.(cif|pdb)(\.gz)?/g, '')
        }

        if (res.startsWith("cath")) {
            if (target.startsWith('af_')) {
                const cath = target.substring(target.lastIndexOf('_') + 1);
                return "https://www.cathdb.info/version/latest/superfamily/" + cath;
            } else {
                return "https://www.cathdb.info/version/latest/domain/"+ target;
            }
        }
    }
    return null;
}

function tryFixTargetName(target, db) {
    var res = db.toLowerCase();
    if (__APP__ == "foldseek") {
        if (target.startsWith("AF-")) {
            return target.replaceAll(/\.(cif|pdb)(\.gz)?(_[A-Z0-9]+)?$/g, '');
        } else if (res.startsWith("pdb") || res.startsWith("gmgc") || res.startsWith("mgyp") || res.startsWith("mgnify")) {
            return target.replaceAll(/\.(cif|pdb)(\.gz)?/g, '');
        }
        if (res.startsWith("cath")) {
            if (target.startsWith('af_')) {
                const match = target.match(/^af_([A-Z0-9]+)_(\d+)_(\d+)_(\d+\.\d+\.\d+\.\d+)$/);
                if (match && match.length == 5) {
                    return match[4] + ' '  + match[1] + ' ' + match[2] + '-' + match[3];
                }
            }
        }
    }
    return target;
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
        for (let j in result.alignments) {
            let item = result.alignments[j];
            let split = item.target.split(' ');
            item.target = split[0];
            item.description = split.slice(1).join(' ');
            if (item.description.length > 1) {
                result.hasDescription = true;
            }
            item.href = tryLinkTargetToDB(item.target, db);
            item.target = tryFixTargetName(item.target, db);
            item.id = 'result-' + i + '-' + j;
            item.active = false;
            if (__APP__ != "foldseek" || data.mode != "tmalign") {
                item.eval = (typeof(item.eval) === "string") ? item.eval : item.eval.toExponential(2);
            }
            if (__APP__ == "foldseek") {
                item.prob = (typeof(item.prob) === "string") ? item.prob : item.prob.toFixed(2);
                if (data.mode == "tmalign") {
                    item.eval = (typeof(item.eval) === "string") ? item.eval : item.eval.toFixed(3);
                }
            }
            if ("taxId" in item) {
                result.hasTaxonomy = true;
            }
        }
    }
    return (total != 0 && empty / total == 1) ? ({ results: [] }) : data;
}

export function dateTime() {
    // Generates current YYYY_MM_DD_HH_MM_SS timestamp
    return new Date().toLocaleString('sv').replace(' ', '_').replaceAll('-', '_').replaceAll(':', '_');
}

export function djb2(str) {
  let hash = 5381; // Initial hash value
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i); // Magic number 33
  }
  return hash >>> 0; // Convert to an unsigned 32-bit integer
}

export function download(data, name) {
    const json = JSON.stringify(data);
    const blob = new Blob([json], { type: 'application/json' });
    const link = document.createElement('a');
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
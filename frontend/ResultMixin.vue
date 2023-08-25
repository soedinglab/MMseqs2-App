<script>
import colorScale from './lib/ColorScale';
import { rgb2hsl } from './lib/ColorSpace';

function lerp(v0, v1, t) {
    return v0*(1-t)+v1*t
}
function clamp(a,b,c) {
    return Math.max(b,Math.min(c,a));
}

export default {
    name: 'result',
    data() {
        return {
            ticket: "",
            error: "",
            mode: "",
            hits: null,
            alignment: null,
            activeTarget: null,
            alnBoxOffset: 0,
            selectedDatabases: 0,
            tableMode: 0,
        };
    },
    methods: {
        resetProperties() {},
        fetchData() {},
        tryLinkTargetToDB(target, db) {
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
        },
        tryFixTargetName(target, db) {
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
        },
        setColorScheme() {
            var color = colorScale();
            for (let result of (__LOCAL__) ? this.currentResult.results : this.hits.results) {
                result.color = color(result.db);
                let colorHsl = rgb2hsl(result.color);
                let max = {
                    score: Number.MIN_VALUE,
                    // eval: Number.MIN_VALUE,
                    // prob: Number.MIN_VALUE,
                    // seqId: Number.MIN_VALUE,
                    // qStartPos: Number.MIN_VALUE,
                    // qEndPos: Number.MIN_VALUE,
                    // qLen: Number.MIN_VALUE,
                    // dbStartPos: Number.MIN_VALUE,
                    // dbEndPos: Number.MIN_VALUE,
                    // dbLen: Number.MIN_VALUE,
                }
                let min = {
                    score: Number.MAX_VALUE,
                    // eval: Number.MAX_VALUE,
                    // prob: Number.MAX_VALUE,
                    // seqId: Number.MAX_VALUE,
                    // qStartPos: Number.MAX_VALUE,
                    // qEndPos: Number.MAX_VALUE,
                    // qLen: Number.MAX_VALUE,
                    // dbStartPos: Number.MAX_VALUE,
                    // dbEndPos: Number.MAX_VALUE,
                    // dbLen: Number.MAX_VALUE,
                }
                for (let alignment of result.alignments) {
                    for (const key in min) {
                        min[key] = alignment[key] < min[key] ? alignment[key] : min[key];
                        max[key] = alignment[key] > max[key] ? alignment[key] : max[key];
                    }
                }
                for (let alignment of result.alignments) {
                    let r = lerp(min.score / max.score, 1, alignment.score / max.score);
                    const luminosity = clamp(colorHsl[2] * Math.pow(0.55, -(1 - r)), 0.1, 0.9);
                    alignment.color = `hsl(${colorHsl[0]}, ${colorHsl[1]*100}%, ${luminosity*100}%)`
                }
            }
        },       
        parseResults(data) {
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
                    item.href = this.tryLinkTargetToDB(item.target, db);
                    item.target = this.tryFixTargetName(item.target, db);
                    item.id = 'result-' + i + '-' + j;
                    item.active = false;
                    if (__APP__ != "foldseek" || this.mode != "tmalign") {
                        item.eval = item.eval.toExponential(2);
                    }
                    if (__APP__ == "foldseek") {
                        item.prob = item.prob.toFixed(2);
                        if (this.mode == "tmalign") {
                            item.eval = item.eval.toFixed(3);
                        }
                    }
                    if ("taxId" in item) {
                        result.hasTaxonomy = true;
                    }
                }
            }
            return (total != 0 && empty / total == 1) ? ({ results: [] }) : data;
        },
    },
    watch: {
        hits: function() {
            this.setColorScheme();
        }
    },   
}
</script>
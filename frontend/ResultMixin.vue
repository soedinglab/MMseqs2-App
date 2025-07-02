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
    name: 'ResultMixin',
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
        setColorScheme() {
            if (!this.hits) {
                return;
            }
            var color = colorScale();
            for (let result of (__LOCAL__) ? this.currentResult.results : this.hits.results) {
                result.color = color(result.db ? result.db : 0);
                let colorHsl = rgb2hsl(result.color);
                let max = {
                    score: Number.MIN_VALUE,
                    idfscore: Number.MIN_VALUE,
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
                    idfscore: Number.MAX_VALUE,
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
                for (let entry of Object.values(result.alignments)) {
                    for (let alignment of entry) {
                        for (const key in min) {
                            if (key in alignment) {
                                min[key] = alignment[key] < min[key] ? alignment[key] : min[key];
                                max[key] = alignment[key] > max[key] ? alignment[key] : max[key];
                            }
                        }
                    }
                }
                for (let entry of Object.values(result.alignments)) {
                    for (let alignment of entry) {
                        let r = lerp(min.score / max.score, 1, alignment.score / max.score);
                        const luminosity = clamp(colorHsl[2] * Math.pow(0.55, -(1 - r)), 0.1, 0.9);
                        alignment.color = `hsl(${colorHsl[0]}, ${colorHsl[1]*100}%, ${luminosity*100}%)`
                    }
                }
            }
        },       
    },
    watch: {
        hits: function() {
            this.setColorScheme();
        }
    },   
}
</script>
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
                let maxScore = Number.MIN_VALUE;
                let minScore = Number.MAX_VALUE;
                for (let entry of Object.values(result.alignments)) {
                    for (let alignment of entry) {
                        if (alignment.score < minScore) minScore = alignment.score;
                        if (alignment.score > maxScore) maxScore = alignment.score;
                    }
                }
                for (let entry of Object.values(result.alignments)) {
                    for (let alignment of entry) {
                        let r = lerp(minScore / maxScore, 1, alignment.score / maxScore);
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
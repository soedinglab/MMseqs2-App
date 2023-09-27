<template>
<div class="canvas-wrapper">
    <canvas ref="canvas"></canvas>
</div>
</template>

<script>
function generateColumnCounts(sequences, alphabet='aa') {
    // e_n:  small-sample correction for alignment of n letters
    // H_i:  uncertainty (Shannon entropy) of position i
    // R_i:  information content (y-axis) of position i
    // F_bi: relative frequency of base/aa b at position i
    if (sequences.length === 0)
        return;
    const counts = [];
    const seqLength = sequences[0].aa.length;
    const numSequences = sequences.length;
    const e_n = Math.log(20) - ((1 / Math.log(2)) * (20 - 1) / (2 * numSequences));
    for (let i = 0; i < seqLength; i++) {
        let frequency = [];
        for (let j = 0; j < numSequences; j++) {
            let char = sequences[j][alphabet][i];
            if (char === '-') {
                continue;
            }
            if (typeof frequency[char] !== 'undefined') {
                frequency[char]++;
            } else {
                frequency[char] = 1;
            }
        }
        let H_i = 0.0;
        for (let j in frequency) {
            frequency[j] = frequency[j] / numSequences;
            H_i -= frequency[j] * Math.log(frequency[j]);
        }
        let R_i = Math.abs(e_n - H_i);
        let height = [];
        for (let j in frequency) {
            height.push([j, frequency[j] * R_i]);
        }
        height.sort(function(a, b) {
            return (a[1] > b[1] ? 1 : -1);
        });
        counts.push(height);
    }
    return counts;
}

export default {
    props: {
        sequences: { type: Array, default: () => ([]) },
        alphabet: { type: String, default: 'aa' },
        lineLen: { type: Number },
        width: { type: Number },
    },
    watch: {
        sequences: function(newSequences) {
            const canvas = this.$refs.canvas;
            const ctx = canvas.getContext("2d");         
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const counts = generateColumnCounts(newSequences, this.alphabet);
            const sums = counts.map(item => item.reduce((sum, [_, a]) => sum + a, 0))
            let max = Math.max(...sums);
            
            const fontSize = 16;
            let x = 10;
            const charWidth = canvas.width / this.lineLen;
            // const charWidth = 10;
            
            for (let i = 0; i < counts.length; i++) {
                let y = canvas.height;
                // let max = counts[i].reduce((sum, [, e]) => sum + e, 0)
                
                for (const [char, count] of counts[i]) {
                    const charHeight = count / max * canvas.height;
                    
                    ctx.save();
                    ctx.translate(x, y);
                    ctx.scale(1, charHeight / fontSize);
                    ctx.fillStyle = this.$vuetify.theme.dark ? 'white' : 'black';
                    ctx.fillText(char, 0, 0);
                    ctx.restore();

                    y -= charHeight;

                }
                x += charWidth;
            }
        }
    },
    mounted() {
        const canvas = this.$refs.canvas;
        const ctx = canvas.getContext("2d");         
        canvas.width = 16 * this.lineLen; //window.innerWidth;
        canvas.height = 100;
        ctx.font = '16px monospace'
        ctx.fillStyle = 'red';
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}
</script>

<style>
.canvas-wrapper {
    /* display: block; */
    border: 1px solid black;
    margin-left: 80px;
}
</style>
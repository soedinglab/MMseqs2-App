<template>
    <v-icon large :style="{'color': color}">{{ content }}</v-icon>
</template>

<script>
function h(x){
    var A = 31;
    var h = 0;
    for (var i = 0; i < x.length; ++i){
        h = ((h*A) + x[i].charCodeAt(0));
    }
    return h.toString(16).slice(0,14) + "" + h.toString(16)[0];
}

export default {
    name: 'history-avatar',
    props: {hash: { default: "", type: String }, type: { default: "", type: String },},
    computed: {
        color() {
            const hue = parseInt(h(this.hash).substr(-7), 16) / 0xfffffff * 360
            const cont = `(65% 0.15 ${hue})`
            const lch = CSS.supports('color: oklch(0% 0 0)') ? 'oklch' : 'lch'
            return lch + cont
        },
        content() {
            switch (this.type) {
                case 'structure': return this.$MDI.Monomer
                case 'complex': return this.$MDI.Multimer
                case 'msa': return this.$MDI.Wall
                case 'motif': return this.$MDI.Motif
                default: return this.$MDI.HelpCircleOutline
            }
        }
    }
}

</script>

<style></style>
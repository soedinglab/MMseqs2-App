<template>
    <div class="alignment-wrapper-outer" slot="content">
        <Alignment
            :key="`aln2-${alignment.id}`"
            :alignment="alignment"
            :lineLen="lineLen"
            :queryMap="queryMap"
            :targetMap="targetMap"
            @selected="setUserSelection"
        />
        <StructureViewer
            :key="`struc2-${alignment.id}`"
            :alignment="alignment"
            :queryMap="queryMap"
            :targetMap="targetMap"
            bgColour="white"
            qColour="lightgrey"
            tColour="red"
            ref="structureViewer"
        />
    </div>
</template>

<script>
import Alignment from './Alignment.vue'
import StructureViewer from './StructureViewer.vue'

function makePositionMap(realStart, alnString) {
    let map = new Map()
    for (let i = 0, gaps = 0; i <= alnString.length; i++) {
        if (alnString[i] === '-') map.set(i, null) && gaps++
        else map.set(i, realStart + i - gaps)
    }
    return map
}

export default {
    components: { StructureViewer, Alignment },
    data: () => ({
        queryMap: null,
        targetMap: null,
    }),
    props: {
        alignment: { type: Object, required: true, },
        lineLen: { type: Number, required: true, },
    },
    methods: {
        setUserSelection([start, end]) {
            if (!this.alignment) return
            this.$refs.structureViewer.setSelectionData(start, end)
        },
        updateMaps() {
            if (!this.alignment) return
            this.queryMap = makePositionMap(this.alignment.qStartPos, this.alignment.qAln)
            this.targetMap = makePositionMap(this.alignment.dbStartPos, this.alignment.dbAln)
        },
    },
    watch: { 'alignment': function() { this.updateMaps() } },
    beforeMount() { this.updateMaps() },
}
</script>

<style>
.alignment-wrapper-outer {
    display: inline-flex;
    flex-direction: row;
    flex-wrap: nowrap;
    justify-content: center;
    align-items: center;
}
</style>
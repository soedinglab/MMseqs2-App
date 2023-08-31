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
        <div v-if="$APP == 'foldseek'" class="alignment-structure-wrapper">
            <StructureViewer
                :key="`struc2-${alignment.id}`"
                :alignment="alignment"
                :queryMap="queryMap"
                :targetMap="targetMap"
                :hits="hits"
                bgColorLight="white"
                bgColorDark="#1E1E1E"
                qColor="lightgrey"
                tColor="red"
                qRepr="cartoon"
                tRepr="cartoon"
                ref="structureViewer"
            />
        </div>
    </div>
</template>

<script>
import Alignment from './Alignment.vue'

// Map 0-based indices in the alignment to corresponding 1-based indices in the structure
function makePositionMap(realStart, alnString) {
    let map = Array(alnString.length);
    for (let i = 0, gaps = 0; i < alnString.length; i++) {
        if (alnString[i] === '-') {
            map[i] = null;
            gaps++;
        } else {
            map[i] = realStart + i - gaps;
        }
    }
    return map
}

export default {
    components: { StructureViewer: () => __APP__ == "foldseek" ? import('./StructureViewer.vue') : null, Alignment },
    data: () => ({
        queryMap: null,
        targetMap: null,
    }),
    props: {
        alignment: { type: Object, required: true, },
        lineLen: { type: Number, required: true, },
        hits: { type: Object }
    },
    methods: {
        setUserSelection([start, end]) {
            if (!this.alignment) return
            if (__APP__ != "foldseek") return
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
    align-items: stretch;
    width: 100%;
}
.alignment-wrapper-inner {
    flex: 2;
    margin: auto;
    display: flex;
    flex-direction: column;
    align-items: end;
}

.alignment-structure-wrapper {
    flex: 1;
    min-width:450px;
    margin: 0;
    margin-bottom: auto;
}

@media screen and (max-width: 960px) {
    .alignment-wrapper-outer {
        display: flex;
        flex-direction: column;
    }
    .alignment-structure-wrapper {
        padding-top: 1em;
    }
}

@media screen and (min-width: 961px) {
    .alignment-structure-wrapper {
        padding-left: 2em;
    }
}

</style>

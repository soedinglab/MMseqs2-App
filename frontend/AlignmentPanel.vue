<template>
    <div class="alignment-panel" slot="content">
        <div class="alignment-wrapper-outer">
            <template
                v-for="(alignment, index) in alignments">
                {{ alignment.query.lastIndexOf('_') != -1 ? alignment.query.substring(alignment.query.lastIndexOf('_')+1) : '' }} ➔ {{ alignment.target }}
                <Alignment
                    :key="`aln2-${alignment.id}`"
                    :alignment="alignment"
                    :lineLen="lineLen"
                    :queryMap="queryMaps[index]"
                    :targetMap="targetMaps[index]"
                    @selected="setUserSelection"
                    :showhelp="index == alignments.length - 1"
                />
            </template>
        </div>
        <div v-if=" $APP == 'foldseek'" class="alignment-structure-wrapper">
            <StructureViewer
                :key="`struc2-${alignments[0].id}`"
                :alignments="alignments"
                :queryMaps="queryMaps"
                :targetMaps="targetMaps"
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
import { makePositionMap } from './Utilities.js'

export default {
    components: { StructureViewer: () => __APP__ == "foldseek" ? import('./StructureViewer.vue') : null, Alignment },
    data: () => ({
        queryMap: null,
        targetMap: null,
    }),
    props: {
        alignments: { type: Array, required: true, },
        lineLen: { type: Number, required: true, },
        hits: { type: Object }
    },
    methods: {
        setUserSelection([start, end]) {
            if (!this.alignments) return
            if (__APP__ != "foldseek") return
            this.$refs.structureViewer.setSelectionData(start, end)
        },
        updateMaps() {
            if (!this.alignments) return
            this.queryMaps = [];
            this.targetMaps = [];
            for (let alignment of this.alignments) {
                this.queryMaps.push(makePositionMap(alignment.qStartPos, alignment.qAln));
                this.targetMaps.push(makePositionMap(alignment.dbStartPos, alignment.dbAln));
            }

        },
    },
    watch: { 'alignment': function() { this.updateMaps() } },
    beforeMount() { this.updateMaps() },
}
</script>

<style scoped>
.alignment-panel {
    display: inline-flex;
    flex-wrap: nowrap;
    justify-content: center;
    width: 100%;
}

.alignment-wrapper-outer {
    display: inline-flex;
    flex-direction: column;
}

.alignment-wrapper-inner {
    padding-bottom: 1em;
}

.alignment-structure-wrapper {
    min-width:450px;
    margin: 0;
    margin-bottom: auto;
}

@media screen and (max-width: 960px) {
    .alignment-wrapper-outer, .alignment-panel  {
        display: flex;
    }
    .alignment-panel {
        flex-direction: column-reverse;
    }
    .alignment-structure-wrapper {
        padding-bottom: 1em;
    }

    .alignment-wrapper-outer, .alignment-structure-wrapper {
        align-self: center;
    }
}

@media screen and (min-width: 961px) {
    .alignment-structure-wrapper {
        padding-left: 2em;
    }
}

</style>

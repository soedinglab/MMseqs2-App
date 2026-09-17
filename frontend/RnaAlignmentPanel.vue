<template>
    <div class="rna-alignment-panel">
        <div class="rna-alignment-wrapper">
            <div class="rna-alignment-header">
                <v-select
                    persistent-hint
                    label="Colorscheme"
                    v-model="colorscheme"
                    :items="schemes"
                    attach
                    dense
                    hide-details
                    style="max-width: 220px"
                ></v-select>
                <div class="rna-alignment-stats">
                    <span><strong>{{ alignment.seqId }}</strong> seq. id.</span>
                    <span><strong>{{ alignment.evalStr }}</strong> E-value</span>
                    <span><strong>{{ alignment.score }}</strong> bits</span>
                    <span><strong>{{ strand }}</strong> strand</span>
                </div>
            </div>

            <Alignment
                :key="`rna-aln-${alignment.id}`"
                :alnIndex="0"
                :alignment="alignment"
                :lineLen="lineLen"
                :queryMap="queryMap"
                :targetMap="targetMap"
                :highlights="highlights"
                :colorscheme="colorscheme"
                :nucleotide="true"
            />
        </div>

        <div class="rna-structure-wrapper">
            <div>
                <RnaStructureViewer
                    :key="`rna-q-${alignment.id}`"
                    :sequence="querySequence"
                    :name="queryName"
                    :highlightStart="queryHighlightStart"
                    :highlightLength="queryHighlightLength"
                    :height="300"
                />
                <div class="rna-caption">{{ queryCaption }}</div>
            </div>
            <div>
                <RnaStructureViewer
                    :key="`rna-t-${alignment.id}`"
                    :sequence="targetSequence"
                    :name="alignment.target"
                    :height="300"
                />
                <div class="rna-caption">{{ targetCaption }}</div>
            </div>
        </div>
    </div>
</template>

<script>
import Alignment from './Alignment.vue';
import RnaStructureViewer from './RnaStructureViewer.vue';
import { makePositionMap } from './Utilities.js';

export default {
    name: 'RnaAlignmentPanel',
    components: { Alignment, RnaStructureViewer },
    props: {
        alignment: { type: Object, required: true },
        lineLen: { type: Number, required: true },
        query: { type: Object, default: null },
    },
    data() {
        return {
            colorscheme: 'nucleotide',
            schemes: [
                { text: "Nucleotide", value: "nucleotide" },
                { text: "Purine/Pyrimidine", value: "purine-pyrimidine" },
                { text: "Clustal2", value: "clustal2" },
                { text: "None", value: "" },
            ],
        };
    },
    computed: {
        highlights() {
            return new Array(Math.ceil(this.alignment.qAln.length / this.lineLen)).fill([undefined, undefined]);
        },
        queryMap() {
            return makePositionMap(this.alignment.qStartPos, this.alignment.qAln);
        },
        targetMap() {
            return makePositionMap(this.alignment.dbStartPos, this.alignment.dbAln);
        },
        // riboseek searches both strands
        strand() {
            return this.alignment.qStartPos > this.alignment.qEndPos ? '-' : '+';
        },
        queryName() {
            if (!this.query || !this.query.header) {
                return 'Query';
            }
            return this.query.header.split(/\s+/)[0];
        },
        querySequence() {
            return this.query && this.query.sequence ? this.query.sequence : this.alignment.qAln.replace(/-/g, '');
        },
        queryHighlightStart() {
            if (!this.query || !this.query.sequence) {
                return -1;
            }
            return Math.min(this.alignment.qStartPos, this.alignment.qEndPos) - 1;
        },
        queryHighlightLength() {
            if (!this.query || !this.query.sequence) {
                return 0;
            }
            return Math.abs(this.alignment.qEndPos - this.alignment.qStartPos) + 1;
        },
        targetSequence() {
            return this.alignment.dbAln.replace(/-/g, '');
        },
        queryCaption() {
            return this.query && this.query.sequence
                ? 'Full query sequence, aligned region highlighted'
                : 'Aligned region';
        },
        targetCaption() {
            if (this.targetSequence.length >= this.alignment.dbLen) {
                return 'Full target sequence';
            }
            const start = Math.min(this.alignment.dbStartPos, this.alignment.dbEndPos);
            const end = Math.max(this.alignment.dbStartPos, this.alignment.dbEndPos);
            return `Aligned region, ${start}-${end} of ${this.alignment.dbLen} nt`;
        },
    },
};
</script>

<style scoped>
.rna-alignment-panel {
    display: flex;
    flex-direction: column;
    width: 100%;
    gap: 2em;
}

.rna-alignment-wrapper {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 0;
    overflow-x: auto;
}

.rna-alignment-header {
    display: flex;
    align-items: center;
    gap: 24px;
    flex-wrap: wrap;
    padding-top: 8px;
    margin-bottom: 1em;
}

.rna-alignment-stats {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    font-size: 0.9rem;
}

.rna-structure-wrapper {
    display: flex;
    flex-direction: row;
    gap: 1em;
    width: 100%;
}

.rna-structure-wrapper > * {
    flex: 1 1 0;
    min-width: 0;
}

.rna-caption {
    font-size: 0.85rem;
    opacity: 0.7;
    margin-top: 0.5em;
}

@media screen and (max-width: 960px) {
    .rna-structure-wrapper {
        flex-direction: column;
    }
}
</style>

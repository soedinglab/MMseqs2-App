<template>
    <div>
        <v-sheet class="pa-1 sticky-sheet" :style="{'background-color': $vuetify.theme.dark ? '#1e1e1e' : '#fff'}">
            <h2 style="margin-top: 0.5em; margin-bottom: 1em;">
                <div style="display: inline-block; width: 24px;"></div>
                <span>Best Hit</span>
            </h2>
        </v-sheet>
        <div
        class="mt-3"
        style="display: flex;
               justify-content: center;
               padding-bottom: 32px;
               ">
            <TopHitEntries
                v-if="bestHit && bestHit.topHit"
                :entry="bestHit"
                ref="bestHit"
                :mode="mode"
                :columnName="columnName"
                :thumbnailUrl="thumbnailUrl"
                :isActive="isActive"
                :isSpinning="isActive && viewerSpinning"
                :searchType="searchType"
                @activate="handleCardActivate"
                @resetView="handleToolbarResetView"
                @toggleSpin="handleToolbarToggleSpin"
                @jump="$emit('jumpTo', bestHitIndex)"
                />
        </div>
        <StructureViewerThumbnail
            v-if="thumbnailItem"
            ref="thumbnailViewer"
            :thumbnailItem="thumbnailItem"
            :hits="hits"
            :mode="mode"
            :searchType="searchType"
            :queryPdb="queryPdb"
            @thumbnail-ready="setThumbnail"
            @viewer-ready="handleViewerReady"
            @spin-change="viewerSpinning = $event"
        />
    </div>
</template>

<script>
import TopHitEntries from './TopHitEntries.vue';
import StructureViewerThumbnail from './molstar/StructureViewerThumbnail.vue';

export default {
    name: "TopHits",
    components: { TopHitEntries, StructureViewerThumbnail },
    data() {
        return {
            bestHit: null,
            bestHitIndex: -1,
            columnName: "",
            thumbnailUrl: "",
            isActive: false,
            viewerSpinning: false,
        }
    },
    props: {
        hits: {
            type: Object,
            required: true,
        },
        mode: { /* 0: Foldseek; 1: Foldseek Multimer; 2: Folddisco */
            type: Number,
            required: true,
        },
        alignMode: {
            type: String,
            default: "",
        },
        searchType: {
            type: String,
            default: "",
        },
        queryPdb: {
            type: String,
            default: "",
        },
    },
    computed: {
        thumbnailItem() {
            if (!this.bestHit || !this.bestHit.topHit || this.bestHit.topHit.length == 0) return null;
            return { db: this.bestHit.db, alignments: this.bestHit.topHit };
        },
    },
    methods: {
        clearThumbnail() {
            if (this.thumbnailUrl) {
                URL.revokeObjectURL(this.thumbnailUrl);
                this.thumbnailUrl = "";
            }
        },
        setThumbnail(blob) {
            if (!blob) return;
            this.clearThumbnail();
            this.thumbnailUrl = URL.createObjectURL(blob);
        },
        hitScore(hit) {
            if (!hit.topHit) return -Infinity;
            const first = hit.topHit[0]
            return this.mode == 0 ? first.score
                : this.mode == 1 ? first.complexqtm
                : first.idfscore
        },
        rebuildBestHit() {
            this.isActive = false;
            this.viewerSpinning = false;
            const topHits = this.hits.results.map(
                ({alignments, db, color, hasTaxonomy, hasDescription}) => {
                    const minKey = alignments && Object.keys(alignments).length > 0
                        ? Object.keys(alignments).map(i => Number(i))[0] : -1
                    const firstEntry = minKey < 0 ? null : alignments[minKey]
                    const qTM = this.mode == 1 && minKey >= 0 ? firstEntry[0].complexqtm.toFixed(2) : undefined
                    const tTM = this.mode == 1 && minKey >= 0 ? firstEntry[0].complexttm.toFixed(2) : undefined
                    if (firstEntry && this.mode == 1) {
                        for (let entry of firstEntry) {
                            const prefix =
                                entry.query.lastIndexOf('_') != -1
                                    ? entry.query.substring(entry.query.lastIndexOf('_')+1)
                                    : ''
                            entry.title = prefix + ' ➔ ' + entry.target
                        }
                    }
                    return {
                        db, color, hasDescription, hasTaxonomy, qTM, tTM,
                        topHit: firstEntry
                    }
            })

            // Ties keep the earlier database, matching the tab order.
            this.bestHitIndex = topHits.reduce(
                (best, hit, idx) => this.hitScore(hit) > this.hitScore(topHits[best]) ? idx : best, 0)
            this.bestHit = topHits[this.bestHitIndex] || null
        },
        handleViewerReady() {
            this.viewerSpinning = true;
        },
        handleToolbarResetView() {
            if (this.$refs.thumbnailViewer) {
                this.$refs.thumbnailViewer.handleResetView();
            }
        },
        handleToolbarToggleSpin() {
            if (this.$refs.thumbnailViewer) {
                this.$refs.thumbnailViewer.handleToggleSpin();
            }
        },
        handleCardActivate() {
            if (!this.thumbnailItem) return;

            if (this.isActive) {
                // Clicking the card again deactivates
                this.isActive = false;
                this.viewerSpinning = false;
                this.$nextTick(() => {
                    if (this.$refs.thumbnailViewer) {
                        this.$refs.thumbnailViewer.clearActiveViewer();
                    }
                });
                return;
            }

            this.isActive = true;

            this.$nextTick(() => {
                const targetEl = this.$refs.bestHit?.$refs.viewerSlot;
                if (!targetEl || !this.$refs.thumbnailViewer) return;
                this.$refs.thumbnailViewer.setActiveViewer(targetEl);
            });
        },
    },
    beforeMount() {
        this.rebuildBestHit();

        if (this.alignMode != "") {
            if (__APP__ == 'foldseek') {
                switch (this.alignMode) {
                    case 'tmalign':
                        this.columnName = 'TM-score'
                        break;
                    case 'lolalign':
                        this.columnName = 'LOL-score'
                        break;
                    default:
                        this.columnName = 'E-Value'
                }
            } else {
                this.columnName = 'E-Value'
            }
        }
    },
    watch: {
        hits() {
            this.clearThumbnail();
            this.rebuildBestHit();
        },
        '$route.params.entry'() {
            this.clearThumbnail();
            this.rebuildBestHit();
        },
    },
    beforeDestroy() {
        this.clearThumbnail();
    },
}
</script>

<style scoped>
.sticky-sheet {
    position: sticky;
    top: 140px;
    z-index: 5;
}
.sticky-sheet::before {
    content: "";
    width: 100%;
    bottom: 0;
    left: 0;
    height: 1px;
    position: absolute;
    display: block;
    z-index: inherit;
    background-color: rgba(0, 0, 0, 0.12);
}
        
.theme--dark .sticky-sheet::before {
    background-color: rgba(255, 255, 255, 0.12);
}
</style>

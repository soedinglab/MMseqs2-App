<template>
    <div>
        <v-sheet class="pa-1 sticky-sheet" :style="{'background-color': $vuetify.theme.dark ? '#1e1e1e' : '#fff'}">
            <h2 style="margin-top: 0.5em; margin-bottom: 1em;">
                <div style="display: inline-block; width: 24px;"></div>
                <span>Top Hits</span>
            </h2>
        </v-sheet>
        <div
        class="mt-3"
        style="display: flex;
               flex-direction: row;
               flex-wrap: wrap;
               justify-content: center;
               align-items: start;
               gap: 24px 24px;
               padding-bottom: 32px;
               ">
            <template v-if="topHits">
                <template v-for="(hit, idx) in topHits"
                >
                    <TopHitEntries
                            :entry="hit"
                            :key="hit.db"
                            :mode="mode"
                            :columnName="columnName"
                            :thumbnailUrl="thumbnailCache[hit.db]"
                            :isActive="activeCardId === hit.db"
                            :isSpinning="activeCardId === hit.db && viewerSpinning"
                            @activate="e => handleCardActivate(e, hit)"
                            @register="e => handleRegister(e, hit.db)"
                            @resetView="handleToolbarResetView"
                            @toggleSpin="handleToolbarToggleSpin"
                            @jump="$emit('jumpTo', idx)"
                            />
                </template>
            </template>
        </div>
        <StructureViewerThumbnail
            v-if="thumbnailQueue.length > 0"
            ref="thumbnailViewer"
            :thumbnailQueue="thumbnailQueue"
            :hits="hits" :mode="mode"
            @thumbnail-ready="handleThumbnailReady"
            @viewer-ready="handleViewerReady"
        />
    </div>
</template>

<script>
import TopHitEntries from './TopHitEntries.vue';
import StructureViewerThumbnail from './StructureViewerThumbnail.vue';

export default {
    name: "TopHits",
    components: { TopHitEntries, StructureViewerThumbnail },
    data() {
        return {
            topHits: null,
            columnName: "",
            thumbnailCache: {},
            activeCardId: null,
            thumbnailQueue: [],
            viewerSpinning: false,
            dragRegistry: {_ptrDownX: 0, _ptrDownY: 0, targetDb: undefined},
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
        }
    },
    methods: {
        handleThumbnailReady({ id, result }) {
            // const url = URL.createObjectURL(blob);
            this.$set(this.thumbnailCache, id, result);
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
                this.viewerSpinning = this.$refs.thumbnailViewer.isSpinning;
            }
        },
        handleCardActivate(event, hit) {
            if (!hit) return

            if (!this.dragRegistry.targetDb ||
                this.dragRegistry.targetDb !== hit.db
            ) {
                // Came from outside. Ignore and reset registry
                this.dragRegistry._ptrDownX = 0
                this.dragRegistry._ptrDownY = 0
                this.dragRegistry.targetDb = undefined
                return 
            }
            
            const deltaX = event.clientX - this.dragRegistry._ptrDownX
            const deltaY = event.clientY - this.dragRegistry._ptrDownY

            if (Math.sqrt(deltaX*deltaX + deltaY*deltaY) > 5) {
                // dragged
                this.dragRegistry._ptrDownX = event.clientX
                this.dragRegistry._ptrDownY = event.clientY
                return 
            }

            if (!hit.topHit) return;
            const cardId = hit.db;

            if (this.activeCardId === cardId) {
                // Clicking same card deactivates
                this.activeCardId = null;
                this.viewerSpinning = false;
                this.$nextTick(() => {
                    if (this.$refs.thumbnailViewer) {
                        this.$refs.thumbnailViewer.deactivateViewer();
                    }
                });
                return;
            }

            const wasActive = this.activeCardId !== null;
            this.activeCardId = cardId;

            this.$nextTick(() => {
                // Find the TopHitEntries component for this card
                const entries = this.$children.filter(c => c.$options.name === 'TopHitEntries');
                const targetEntry = entries.find(c => c.entry.db === cardId);
                if (!targetEntry || !targetEntry.$refs.viewerSlot) return;
                const targetEl = targetEntry.$refs.viewerSlot;

                if (this.$refs.thumbnailViewer) {
                    if (wasActive) {
                        this.$refs.thumbnailViewer.switchViewer(cardId, hit.topHit, targetEl);
                    } else {
                        this.$refs.thumbnailViewer.activateViewer(cardId, hit.topHit, targetEl);
                    }
                }
            });
        },
        handleRegister(event, db) {
            this.dragRegistry.targetIdx = db
            this.dragRegistry._ptrDownX = event.clientX
            this.dragRegistry._ptrDownY = event.clientY
        },
    },
    beforeMount() {
        this.topHits = this.hits.results.map(
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

        // Build thumbnail queue from topHits
        this.thumbnailQueue = this.topHits
            .filter(hit => hit.topHit && hit.topHit.length > 0)
            .map(hit => ({
                id: hit.db,
                alignments: hit.topHit,
                db: hit.db,
            }));

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
    beforeDestroy() {
        // Revoke all blob URLs
        Object.values(this.thumbnailCache).forEach(url => {
            URL.revokeObjectURL(url);
        });
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

<template>
    <v-card 
    v-if="entry"
    elevation="2"
    outlined
    width="320"
    max-width="320"
    min-height="360"
    class="hit-card"
    :style="{'--active-color': entry.color}"
    >
        <v-tooltip bottom nudge-top="18px" :color="entry.color">
            <template v-slot:activator="{on}">
                <v-card-title class="card-title" v-on="on" @click.stop="$emit('jump')">
                    <span style="font-weight: 700; text-transform: uppercase;" class="card-title-content">{{db}}</span>
                    <div class="hit-arrow"></div>
                </v-card-title>
            </template>
            <span>Jump to {{ db.toUpperCase() }}</span>
        </v-tooltip>
        <template v-if="entry.topHit">
            <div class="thumbnail-container" style="margin-left: 16px; margin-right: 16px;" @click="$emit('activate')">
                <div v-if="isActive" ref="viewerSlot" class="viewer-slot">
                    <StructureViewerToolbar
                        :isFullscreen="false"
                        :isSpinning="isSpinning"
                        :disablePDBButton="true"
                        :disableImageButton="true"
                        :disableQueryButton="true"
                        :disableTargetButton="true"
                        :disableArrowButton="true"
                        :disableResetButton="false"
                        :disableSpinButton="false"
                        :disableFullscreenButton="true"
                        @resetView="$emit('resetView')"
                        @toggleSpin="$emit('toggleSpin')"
                    />
                </div>
                <img v-else-if="thumbnailUrl" :src="thumbnailUrl" class="thumbnail-img" />
                <v-skeleton-loader height="240" v-else type="image" />
            </div>
            <v-card-text>
                <div class="card-content-entry" data-label="Query TM-score" v-if="entry.qTM">
                    <span>{{ entry.qTM }}</span>
                </div>
                <div class="card-content-entry" data-label="Target TM-score" v-if="entry.tTM">
                    <span>{{ entry.tTM }}</span>
                </div>
                <div class="card-content-entry" :data-label="mode == 1 ? 'Chain Pairing' : 'Target'">
                    <v-select v-if="mode == 1 && entry.topHit.length > 1"
                        v-model="selectedObject" :items="entry.topHit"
                        class="multichain-select"
                        item-text="title" return-object dense 
                        :item-color="entry.color"
                        hide-details
                        style="font-size: 12px; max-width: 187px;"
                        flat solo single-line
                    ></v-select>
                    <span v-else>
                        {{ mode == 1 
                            ? selectedObject.title 
                            : mode == 2 
                            ? selectedObject.targetname 
                            : selectedObject.target }}
                    </span>
                </div>
                <div class="card-content-entry" v-if="entry.hasDescription"
                data-label="Description"><span>{{ selectedObject.description }}</span></div>
                <div class="card-content-entry" v-if="entry.hasTaxonomy"
                data-label="Taxonomy">
                    <a 
                    :href="'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?mode=Info&id=' + selectedObject.taxId" 
                    target="_blank"
                    rel="noopener"
                    :title="selectedObject.taxName"
                    @click.stop
                    >{{ selectedObject.taxName }}</a>
                </div>
                <template v-if="mode == 2">
                    <div class="card-content-entry" data-label="IDF-score"><span>{{ selectedObject.idfscore }}</span></div>
                    <div class="card-content-entry" data-label="RMSD"><span>{{ selectedObject.rmsd }}</span></div>
                    <div class="card-content-entry" data-label="Node count"><span>{{ selectedObject.nodecount }}</span></div>
                    <div class="card-content-entry" data-label="Matched residues"><span :title="selectedObject.targetresidues">{{ selectedObject.targetresidues }}</span></div>
                </template>
                <template v-else>
                    <div class="card-content-entry" data-label="Probability"><span>{{ selectedObject.prob }}</span></div>
                    <div class="card-content-entry" data-label="Sequence Identity"><span>{{ selectedObject.seqId }}</span></div>
                    <div class="card-content-entry" :data-label="columnName"><span>{{ selectedObject.eval }}</span></div>
                    <div class="card-content-entry" data-label="Score"><span>{{ selectedObject.score }}</span></div>
                    <div class="card-content-entry graphical" data-label="Position">
                        <Ruler
                            :length="selectedObject.qLen" :start="selectedObject.qStartPos" :end="selectedObject.qEndPos"
                            :color="selectedObject.color" :label="true"
                        />
                    </div>
                </template>
            </v-card-text>
        </template>
        <template v-else>
            <v-card-text style="
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1rem;
                height: 296px;
            ">
            <span
                style="
                    transform: translateY(-24px);
                "
            >No hit :(</span>
            </v-card-text>
        </template>
    </v-card>
</template>

<script>
import Ruler from './Ruler.vue';
import StructureViewerToolbar from './StructureViewerToolbar.vue';

export default {
    name: 'TopHitEntries',
    components: {
        Ruler,
        StructureViewerToolbar,
    },
    data() {
        return {
            selectedObject: null,
        }
    },
    props: {
        entry: {
            type: Object,
            required: true,
        },
        mode: {
            type: Number,
            default: 0,
        },
        columnName: {
            type: String,
            default: ""
        },
        thumbnailUrl: {
            type: String,
            default: null,
        },
        isActive: {
            type: Boolean,
            default: false,
        },
        isSpinning: {
            type: Boolean,
            default: false,
        },
    },
    beforeMount() {
        if (this.entry?.topHit) {
            this.selectedObject = this.entry.topHit[0]
        }
    },
    computed: {
        db() {
            return this.entry?.db.replaceAll(/_folddisco$/g, '')
        }
    },
}

</script>

<style scoped>

.hit-arrow {
    margin-left: 8px;
    display: block;
    background-color: var(--active-color);
    position: relative;
    height: 0.6em;
    width: 4px;
    opacity: 0;
    transition: transform 0.4s cubic-bezier(0.075, 0.82, 0.165, 1), opacity 0.4s cubic-bezier(0.075, 0.82, 0.165, 1);
}

.hit-arrow::before {
    content: "";
    width: 0;
    height: 0;
    border-left: 0.24em solid white;
    border-top: 0.3em solid transparent;
    border-bottom: 0.3em solid transparent;
    position: absolute;
    left: 0;
    z-index: 2;
    top: 0;
}

.hit-arrow::after {
    content: "";
    width: 0;
    height: 0;
    border-left: 0.24em solid var(--active-color);
    border-top: 0.3em solid transparent;
    border-bottom: 0.3em solid transparent;
    position: absolute;
    right: 0;
    transform: translateX(100%);
    z-index: 1;
    top: 0;
}

@keyframes wiggle-and-pause {
    0% { transform: translateX(0); }
    40% { transform: translateX(0); }
    45% { transform: translateX(8px); }
    50% { transform: translateX(0); }
    55% { transform: translateX(8px); }
    60% { transform: translateX(0); }
    100% { transform: translateX(0); }
}
        
/* .hit-arrow:hover {
    animation: wiggle-and-pause 3.2s infinite;
} */

.card-title {
    cursor: pointer;
}

.card-title-content {
    position: relative;
    z-index: 3;
}
.card-title-content::before {
    display: block;
    content: "";
    height: 8px;
    width: 0;
    background-color: var(--active-color);
    opacity: 0.7;
    position: absolute;
    left: 0;
    bottom: 6px;
    z-index: 1;
    transition: width 0.4s cubic-bezier(0.075, 0.82, 0.165, 1);
    mix-blend-mode: multiply;
}

.theme--dark .card-title-content::before {
    opacity: 0.6;
    mix-blend-mode: soft-light;
}

.theme--dark .hit-arrow::before {
    border-left: 0.24em solid rgb(30, 30, 30);
}

.card-title:hover .card-title-content::before {
    width: 100%;
}
        
.card-title:hover .hit-arrow {
    opacity: 1;
    animation: wiggle-and-pause 3.2s infinite;
}

.card-content-entry {
    display: flex;
    flex-direction: row;
    /* font-size: 1rem; */
    border-bottom: 1px solid #eee;
    align-items: start;

    &:last-child {
        border-bottom: 0;
    }
}

.card-content-entry::before {
    content: attr(data-label);
    font-weight: 600;
    margin-right: auto;
    padding-right: 0.5em;
    word-break: keep-all;
    flex: 1;
    white-space: nowrap;
}

.card-content-entry > span, .card-content-entry > a, .card-content-entry > .content-wrapper {
    flex: 2;
    margin-left: auto;
    text-align: right;
    word-wrap: anywhere;
}

.hit-card {
    transition: box-shadow 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
}

.hit-card:hover {
    box-shadow: 0px 2px 4px -1px rgba(0, 0, 0, 0.2), 0px 4px 5px 0px rgba(0, 0, 0, 0.14), 0px 1px 10px 0px rgba(0, 0, 0, 0.12) !important;
}

.thumbnail-container {
    position: relative;
    width: calc(318px - 32px);
    min-height: 200px;
    max-height: 240px;
    cursor: pointer;
    overflow: hidden;
}

.thumbnail-img {
    width: 100%;
    height: auto;
    max-height: 240px;
    object-fit: contain;
    display: block;
    transition: opacity 0.2s ease;
}

.viewer-slot {
    width: 100%;
    height: 240px;
    position: relative;
}


</style>

<style>

.multichain-select > .v-input__control > .v-input__slot {
    padding: 0px !important;
}

.hit-card div.ruler {
    margin: 10px 0;
}

</style>
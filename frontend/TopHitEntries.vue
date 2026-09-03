<template>
    <v-card 
    v-if="entry"
    elevation="2"
    outlined
    :max-width="$vuetify.breakpoint.width < 960 ? 320 : 900"
    class="hit-card"
    :style="{'--active-color': entry.color}"
    >
        <div class="thumbnail-column">
            <v-tooltip bottom nudge-top="18px" :color="entry.color">
                <template v-slot:activator="{on}">
                    <v-card-title class="card-title" v-on="on" @click.stop="$emit('jump')">
                        <span style="font-weight: 700; text-transform: uppercase;" class="card-title-content">{{db}}</span>
                        <div class="hit-arrow"></div>
                    </v-card-title>
                </template>
                <span>Jump to {{ db.toUpperCase() }}</span>
            </v-tooltip>
            <div class="thumbnail-container" style="margin: 16px;" @click="$emit('activate')">
                <div v-if="isActive" ref="viewerSlot" class="viewer-slot" @click.stop @dblclick="$emit('activate')">
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
                <img v-else-if="thumbnailUrl" class="thumbnail-img" :src="thumbnailUrl" alt="" />
                <v-skeleton-loader height="240" v-else type="image" />
            </div>
        </div>
        <v-divider v-if="$vuetify.breakpoint.mdAndUp" vertical class="hit-card-divider"></v-divider>
        <div class="card-content-container">
            <v-card-text>
                <div class="card-content-entry" :data-label="searchType === 'interfacesearch' ? 'Query Interface TM-score' : 'Query TM-score'" v-if="entry.qTM">
                    <span>{{ entry.qTM }}</span>
                </div>
                <div class="card-content-entry" :data-label="searchType === 'interfacesearch' ? 'Target Interface TM-score' : 'Target TM-score'" v-if="entry.tTM">
                    <span>{{ entry.tTM }}</span>
                </div>
                <div class="card-content-entry" :data-label="mode == 1 ? 'Chain Pairing' : 'Target'">
                    <v-menu v-if="mode == 1 && entry.topHit.length > 1" offset-y left :nudge-bottom="4">
                        <template v-slot:activator="{on, attrs, value}">
                            <button type="button" class="pairing-picker"
                                :class="{'pairing-picker--open': value}"
                                :title="selectedObject.title"
                                v-bind="attrs" v-on="on" @click.stop
                            >
                                <span>{{ selectedObject.title }}</span>
                                <v-icon size="18">{{ $MDI.ChevronDown }}</v-icon>
                            </button>
                        </template>
                        <v-list dense>
                            <v-list-item v-for="pair in entry.topHit" :key="pair.title"
                                :input-value="pair === selectedObject" :color="entry.color"
                                @click="selectedObject = pair"
                            >
                                <v-list-item-title>{{ pair.title }}</v-list-item-title>
                            </v-list-item>
                        </v-list>
                    </v-menu>
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
        </div>
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
            default: "",
        },
        isActive: {
            type: Boolean,
            default: false,
        },
        isSpinning: {
            type: Boolean,
            default: false,
        },
        searchType: {
            type: String,
            default: "",
        },
    },
    beforeMount() {
        if (this.entry?.topHit) {
            this.selectedObject = this.entry.topHit[0]
        }
    },
    watch: {
        entry(entry) {
            if (entry?.topHit && !entry.topHit.includes(this.selectedObject)) {
                this.selectedObject = entry.topHit[0]
            }
        },
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

.card-content-entry > .pairing-picker {
    flex: 0 1 auto;
    min-width: 0;
    margin-left: auto;
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    color: inherit;
    cursor: pointer;
}

.pairing-picker > span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.pairing-picker:hover > span, .pairing-picker--open > span {
    text-decoration-style: solid;
    text-decoration-color: var(--active-color);
}

.theme--dark .pairing-picker > span {
    text-decoration-color: rgba(255, 255, 255, 0.35);
}

.pairing-picker .v-icon {
    color: var(--active-color);
    transition: transform 0.2s cubic-bezier(0.075, 0.82, 0.165, 1);
}

.pairing-picker--open .v-icon {
    transform: rotate(180deg);
}

.pairing-picker:focus-visible {
    outline: 2px solid var(--active-color);
    outline-offset: 2px;
    border-radius: 2px;
}

.hit-card {
    transition: box-shadow 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
    display: flex;
    flex-direction: row;
    align-items: flex-start;
}

.thumbnail-column {
    width: 320px;
    flex-shrink: 0;
}

.card-content-container {
    flex-grow: 1;
}

.hit-card-divider.v-divider--vertical {
    align-self: stretch;
    height: auto;
    min-height: 0;
    max-height: none;
    margin: 16px 0;
}

@media screen and (max-width: 959px) {
    .hit-card {
        flex-direction: column;
    }
    .card-content-container {
        flex-grow: 0;
    }
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
    height: 240px;
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

.hit-card div.ruler {
    margin: 10px 0;
}

</style>

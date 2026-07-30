<template>
    <div>
        <v-sheet class="pa-1 sticky-sheet" :style="{'background-color': $vuetify.theme.dark ? '#1e1e1e' : '#fff'}">
            <h2 style="margin-top: 0.5em; margin-bottom: 1em;">
                <div style="display: inline-block; width: 24px;"></div>
                <span>Top Hits</span>
            </h2>
        </v-sheet>
        <div class="mt-3 top-hits-cards">
            <v-card v-for="(entry, idx) in topHits" :key="entry.db"
                elevation="2" outlined width="320" max-width="320" min-height="360"
                class="hit-card" :style="{'--active-color': entry.color}">
                <v-tooltip bottom nudge-top="18px" :color="entry.color">
                    <template v-slot:activator="{on}">
                        <v-card-title class="card-title" v-on="on" @click.stop="$emit('jumpTo', idx)">
                            <span style="font-weight: 700; text-transform: uppercase;" class="card-title-content">{{ entry.db }}</span>
                            <div class="hit-arrow"></div>
                        </v-card-title>
                    </template>
                    <span>Jump to {{ entry.db.toUpperCase() }}</span>
                </v-tooltip>

                <template v-if="entry.topHit">
                    <div style="margin-left: 16px; margin-right: 16px;">
                        <RnaStructureViewer
                            :key="entry.topHit.id"
                            :sequence="targetSequence(entry.topHit)"
                            :name="entry.topHit.target"
                            :height="240"
                        />
                    </div>
                    <v-card-text>
                        <div class="card-content-entry" data-label="Target">
                            <a v-if="entry.topHit.href" :href="entry.topHit.href" target="_blank"
                                rel="noopener" @click.stop>{{ entry.topHit.target }}</a>
                            <span v-else>{{ entry.topHit.target }}</span>
                        </div>
                        <div class="card-content-entry" v-if="entry.hasDescription" data-label="Description">
                            <span>{{ entry.topHit.description }}</span>
                        </div>
                        <div class="card-content-entry" v-if="entry.hasTaxonomy" data-label="Taxonomy">
                            <a :href="'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?mode=Info&id=' + entry.topHit.taxId"
                                target="_blank" rel="noopener" :title="entry.topHit.taxName" @click.stop>{{ entry.topHit.taxName }}</a>
                        </div>
                        <div class="card-content-entry" data-label="Sequence Identity"><span>{{ entry.topHit.seqId }}</span></div>
                        <div class="card-content-entry" data-label="E-Value"><span>{{ entry.topHit.evalStr }}</span></div>
                        <div class="card-content-entry" data-label="Score"><span>{{ entry.topHit.score }}</span></div>
                        <div class="card-content-entry graphical" data-label="Position">
                            <Ruler :length="entry.topHit.qLen" :start="entry.topHit.qStartPos"
                                :end="entry.topHit.qEndPos" :color="entry.topHit.color" :label="true" />
                        </div>
                    </v-card-text>
                </template>
                <template v-else>
                    <v-card-text style="display: flex; align-items: center; justify-content: center; font-size: 1rem; height: 296px;">
                        <span style="transform: translateY(-24px);">No hit :(</span>
                    </v-card-text>
                </template>
            </v-card>
        </div>
    </div>
</template>

<script>
import Ruler from './Ruler.vue';
import RnaStructureViewer from './RnaStructureViewer.vue';

export default {
    name: 'TopHitsRiboseek',
    components: { Ruler, RnaStructureViewer },
    props: {
        hits: { type: Object, required: true },
    },
    computed: {
        topHits() {
            return this.hits.results.map((result) => {
                const alignments = result.alignments || [];
                let best = null;
                for (const a of alignments) {
                    if (best === null || a.score > best.score) {
                        best = a;
                    }
                }
                return {
                    db: result.db,
                    color: result.color,
                    hasDescription: result.hasDescription,
                    hasTaxonomy: result.hasTaxonomy,
                    topHit: best,
                };
            });
        },
    },
    methods: {
        targetSequence(hit) {
            return hit.dbAln.replace(/-/g, '');
        },
    },
};
</script>

<style scoped>
.top-hits-cards {
    display: flex;
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    align-items: start;
    gap: 24px 24px;
    padding-bottom: 32px;
}

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
    border-bottom: 1px solid #eee;
    align-items: start;
}

.card-content-entry:last-child {
    border-bottom: 0;
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

.card-content-entry > span, .card-content-entry > a {
    flex: 2;
    margin-left: auto;
    text-align: right;
    word-wrap: anywhere;
}

.card-content-entry.graphical {
    display: block;
    padding-top: 4px;
}

.hit-card {
    transition: box-shadow 0.3s cubic-bezier(0.075, 0.82, 0.165, 1);
}

.hit-card:hover {
    box-shadow: 0px 2px 4px -1px rgba(0, 0, 0, 0.2), 0px 4px 5px 0px rgba(0, 0, 0, 0.14), 0px 1px 10px 0px rgba(0, 0, 0, 0.12) !important;
}
</style>

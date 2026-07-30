<template>
<v-container grid-list-md fluid pa-2>
    <v-layout wrap>
        <v-flex xs12>
        <panel>
            <template slot="header">
                <template v-if="!$LOCAL">
                    <NameField :ticket="ticket"></NameField>
                </template>
                <template v-else-if="query">
                    <span class="hidden-sm-and-down">Results:&nbsp;</span>
                    <small class="ticket">{{ query.header }}</small>
                </template>
            </template>

            <div slot="desc" v-if="resultState == 'PENDING'">
                <v-container fill-height grid-list-md>
                    <v-layout justify-center>
                        <v-flex xs4>
                            <img style="max-width:100%" src="./assets/marv-search_2x.png" srcset="./assets/marv-search_2x.png 2x, ./assets/marv-search_3x.png 3x" />
                        </v-flex>
                        <v-flex xs8>
                            <h3>Still Pending</h3>
                            <p>Please wait a moment</p>
                        </v-flex>
                    </v-layout>
                </v-container>
            </div>
            <div slot="desc" v-else-if="resultState == 'EMPTY'">
                <v-container fill-height grid-list-md>
                    <v-layout justify-center>
                        <v-flex xs4>
                            <img style="max-width:100%" src="./assets/marv-result_2x.png" srcset="./assets/marv-result_2x.png 2x, ./assets/marv-result_3x.png 3x" />
                        </v-flex>
                        <v-flex xs8>
                            <h3>No hits found!</h3>
                            <p>Start a <v-btn to="/riboseek">New Search</v-btn>?</p>
                        </v-flex>
                    </v-layout>
                </v-container>
            </div>
            <div slot="desc" v-else-if="resultState != 'RESULT'">
                <v-container fill-height grid-list-md>
                    <v-layout justify-center>
                        <v-flex xs4>
                            <img style="max-width:100%" src="./assets/marv-error_2x.png" srcset="./assets/marv-error_2x.png 2x, ./assets/marv-error_3x.png 3x" />
                        </v-flex>
                        <v-flex xs8>
                            <h3>Error!</h3>
                            <p>Start a <v-btn to="/riboseek">New Search</v-btn>?</p>
                        </v-flex>
                    </v-layout>
                </v-container>
            </div>

            <template slot="content" v-if="resultState == 'RESULT'">
                <!-- hack to get a menu that can be used from outside the list -->
                <!-- we don't want to make potentially thousands of menus -->
                <v-menu offset-y ref="menuwrapper" absolute style="z-index: 99999 !important;">
                    <template v-slot:activator="{ on: activation }">
                        <div style="display: none">{{ menuActivator = activation }}</div>
                    </template>
                    <v-list>
                        <v-list-item two-line v-for="(item, index) in menuItems" :key="index"
                            :href="item.href" target="_blank" rel="noopener">
                            <v-list-item-content>
                                <v-list-item-title>{{ item.label }}</v-list-item-title>
                                <v-list-item-subtitle>{{ item.accession }}</v-list-item-subtitle>
                            </v-list-item-content>
                        </v-list-item>
                    </v-list>
                </v-menu>

                <v-sheet style="position:sticky; min-height: 44px; padding-bottom: 2em;
                    z-index: 99999 !important;" :style="{'top': onlyOne ? '48px' : '64px'}" class="sticky-tabs">
                    <v-tabs v-if="!onlyOne" :color="selectedDatabase > 0 ? hits.results[selectedDatabase - 1].color : null"
                        center-active grow
                        v-model="selectedDatabase" show-arrows @change="closeAlignment">
                        <v-tab>Summary</v-tab>
                        <v-tab v-for="entry in hits.results" :key="entry.db">
                            {{ entry.db }} ({{ entry.alignments ? entry.alignments.length : 0 }})
                        </v-tab>
                    </v-tabs>
                </v-sheet>

                <template v-if="!onlyOne && selectedDatabase == 0">
                    <TopHitsRiboseek :hits="hits" @jumpTo="(i) => selectedDatabase = i + 1" />
                    <ResultRiboseekDB v-if="topEntry"
                        :entryidx="0" :entry="topEntry" :tableMode="tableMode"
                        :alignment="alignment" :onlyOne="onlyOne" merged
                        @switchTableMode="(n) => tableMode = n"
                        @showAlignment="(item, e) => showAlignment(item, e)"
                        @forwardDropdown="(e, h) => forwardDropdown(e, h)"
                        @jumpTo="(i) => selectedDatabase = i + 1"
                    ></ResultRiboseekDB>
                </template>

                <ResultRiboseekDB v-for="(entry, entryidx) in hits.results" :key="entry.db"
                    v-if="onlyOne || entryidx == selectedDatabase - 1"
                    :entryidx="entryidx" :entry="entry" :tableMode="tableMode"
                    :alignment="alignment" :onlyOne="onlyOne" :closeAlignment="closeAlignment"
                    @switchTableMode="(n) => tableMode = n"
                    @showAlignment="(item, e) => showAlignment(item, e)"
                    @forwardDropdown="(e, h) => forwardDropdown(e, h)"
                ></ResultRiboseekDB>
            </template>
        </panel>
        <NavigationButton v-if="resultState == 'RESULT'"
            :scrollOffsetArr="scrollOffsetArr"
            :tabOffset="tabOffset"
            @needUpdate="updateScrollOffsetArr"
        ></NavigationButton>
        </v-flex>
    </v-layout>

    <portal>
        <panel v-if="alignment != null" class="alignment" :style="{ 'top': alnBoxOffset + 'px',
            width: $vuetify.breakpoint.smAndDown ? 'calc(100% - 16px)' : 'calc(100% - 32px)',
            right: $vuetify.breakpoint.smAndDown ? '8px' : '16px'}" v-click-outside="closeAlignment">
            <template slot="desc">
                <v-btn icon @click="closeAlignment" style="display: block; margin-left: auto;">
                    <v-icon>{{ $MDI.CloseCircleOutline }}</v-icon>
                </v-btn>
            </template>
            <RnaAlignmentPanel slot="content"
                :key="`rna-ap-${alignment.id}`"
                :alignment="alignment"
                :lineLen="fluidLineLen"
                :query="query"
            />
        </panel>
    </portal>
</v-container>
</template>

<script>
import Panel from './Panel.vue';
import NameField from './NameField.vue';
import NavigationButton from './NavigationButton.vue';
import ResultRiboseekDB from './ResultRiboseekDB.vue';
import TopHitsRiboseek from './TopHitsRiboseek.vue';
import RnaAlignmentPanel from './RnaAlignmentPanel.vue';
import RnaStructureViewer from './RnaStructureViewer.vue';
import colorScale from './lib/ColorScale';
import { rgb2hsl } from './lib/ColorSpace';
import { parseResultsRiboseek, download, dateTime, getAbsOffsetTop } from './Utilities.js';
import { debounce } from './lib/debounce';

function lerp(v0, v1, t) {
    return v0 * (1 - t) + v1 * t;
}
function clamp(a, b, c) {
    return Math.max(b, Math.min(c, a));
}

export default {
    name: 'ResultRiboseek',
    tool: 'riboseek',
    components: { Panel, NameField, NavigationButton, ResultRiboseekDB,
        TopHitsRiboseek, RnaAlignmentPanel, RnaStructureViewer },
    data() {
        return {
            ticket: '',
            error: '',
            hits: null,
            query: null,
            selectedDatabase: 0,
            tableMode: 0,
            alignment: null,
            activeTarget: null,
            alnBoxOffset: 0,
            menuActivator: null,
            menuItems: [],
            scrollOffsetArr: [],
            tabOffset: 140,
        };
    },
    mounted() {
        this.$root.$on('downloadJSON', this.downloadJSON);
        window.addEventListener('resize', this.handleAlignmentBoxResize, { passive: true });
        this.fetchData();
    },
    destroyed() {
        this.$root.$off('downloadJSON', this.downloadJSON);
        window.removeEventListener('resize', this.handleAlignmentBoxResize);
    },
    watch: {
        '$route': function(to, from) {
            if (from.path != to.path) {
                this.fetchData();
            }
        },
    },
    computed: {
        resultState() {
            if (this.error != "") {
                return "ERROR";
            }
            if (this.hits == null) {
                return "PENDING";
            }
            if (!this.hits.results) {
                return "ERROR";
            }
            if (this.hits.results.length == 0) {
                return "EMPTY";
            }
            for (let i in this.hits.results) {
                if (this.hits.results[i].alignments != null && this.hits.results[i].alignments.length > 0) {
                    return "RESULT";
                }
            }
            return "EMPTY";
        },
        onlyOne() {
            return this.hits?.results?.length == 1;
        },
        topEntry() {
            if (!this.hits || !this.hits.results || this.hits.results.length < 2) {
                return null;
            }
            const all = [];
            this.hits.results.forEach((result, dbIdx) => {
                for (const hit of (result.alignments || [])) {
                    hit.dbIdx = dbIdx;
                    hit.dbName = result.db;
                    hit.dbColor = result.color;
                    all.push(hit);
                }
            });
            all.sort((a, b) => b.score - a.score);
            return {
                db: "Top 100",
                color: this.hits.results[0].color,
                hasDescription: this.hits.results.some(r => r.hasDescription),
                hasTaxonomy: this.hits.results.some(r => r.hasTaxonomy),
                alignments: all.slice(0, 100),
            };
        },
        queryName() {
            if (!this.query || !this.query.header) {
                return 'Query';
            }
            return this.query.header.split(/\s+/)[0];
        },
        fluidLineLen() {
            if (this.$vuetify.breakpoint.xsOnly) {
                return 30;
            } else if (this.$vuetify.breakpoint.smAndDown) {
                return 60;
            } else if (this.$vuetify.breakpoint.mdAndDown) {
                return 45;
            }
            return 80;
        },
    },
    methods: {
        async fetchData() {
            this.ticket = this.$route.params.ticket;
            this.error = "";
            this.hits = null;
            this.query = null;
            this.selectedDatabase = 0;
            this.closeAlignment();

            try {
                let hits;
                if (this.ticket.startsWith('user-')) {
                    hits = this.$root.userData[this.$route.params.entry];
                } else {
                    const response = await this.$axios.get(
                        "api/result/" + this.ticket + '/' + this.$route.params.entry);
                    hits = parseResultsRiboseek(response.data);
                }
                this.query = hits.query
                    || (hits.queries && hits.queries.length > 0 ? hits.queries[0] : null);
                this.hits = hits;
                this.setColorScheme();
                this.$nextTick(() => setTimeout(() => this.updateScrollOffsetArr(), 0));
            } catch (error) {
                this.error = "Failed";
                this.hits = null;
            }
        },
        async fetchAllData() {
            let page = 0;
            const limit = 7;
            const all = [];

            const getQueries = async (queries) => Promise.all(queries.map(async (q) => {
                const response = await this.$axios.get(`api/result/${this.ticket}/${q.id}`);
                const data = parseResultsRiboseek(response.data);
                data.query = (data.queries && data.queries.length > 0) ? data.queries[0] : null;
                return data;
            }));

            const getPage = async () => {
                const response = await this.$axios.get(
                    `api/result/queries/${this.ticket}/${limit}/${page}`);
                all.push(...await getQueries(response.data.lookup));
                if (response.data.hasNext) {
                    page++;
                    await getPage();
                }
            };

            await getPage();
            download(all, `Riboseek_${dateTime()}.json`);
        },
        setColorScheme() {
            if (!this.hits || !this.hits.results) {
                return;
            }
            const color = colorScale();
            for (const result of this.hits.results) {
                result.color = color(result.db ? result.db : 0);
                const colorHsl = rgb2hsl(result.color);
                let maxScore = Number.MIN_VALUE;
                let minScore = Number.MAX_VALUE;
                for (const alignment of result.alignments) {
                    if (alignment.score < minScore) minScore = alignment.score;
                    if (alignment.score > maxScore) maxScore = alignment.score;
                }
                for (const alignment of result.alignments) {
                    const r = lerp(minScore / maxScore, 1, alignment.score / maxScore);
                    const luminosity = clamp(colorHsl[2] * Math.pow(0.55, -(1 - r)), 0.1, 0.9);
                    alignment.color = `hsl(${colorHsl[0]}, ${colorHsl[1] * 100}%, ${luminosity * 100}%)`;
                }
            }
        },
        showAlignment(item, event) {
            if (this.alignment === item) {
                this.closeAlignment();
                return;
            }
            this.alignment = null;
            this.$nextTick(() => {
                this.alignment = item;
                this.activeTarget = event.target.closest('.alignment-action');
                this.alnBoxOffset = getAbsOffsetTop(this.activeTarget) + this.activeTarget.offsetHeight;
            });
        },
        closeAlignment() {
            this.$nextTick(() => {
                this.alignment = null;
                this.activeTarget = null;
            });
        },
        handleAlignmentBoxResize: debounce(function() {
            if (this.activeTarget != null) {
                this.alnBoxOffset = getAbsOffsetTop(this.activeTarget) + this.activeTarget.offsetHeight;
            }
        }, 32, false),
        updateScrollOffsetArr() {
            const entries = document.querySelectorAll('[class^="result-entry-"]');
            this.scrollOffsetArr = [...entries].map(
                (n) => Math.ceil(n.getBoundingClientRect().top + window.scrollY));
        },
        forwardDropdown(event, items) {
            if (this.menuActivator) {
                this.menuItems = items;
                this.menuActivator.click(event);
            }
        },
        downloadJSON() {
            if (this.ticket.startsWith('user-')) {
                download(this.$root.userData, `Riboseek_${dateTime()}.json`);
            } else {
                this.fetchAllData();
            }
        },
    },
};
</script>

<style scoped>
.rna-caption {
    font-size: 0.85rem;
    opacity: 0.7;
    margin-top: 0.5em;
}

@media print, screen and (max-width: 599px) {
    small.ticket {
        display: inline-block;
        line-height: 0.9;
    }
}
</style>

<style lang="scss">
.sticky-tabs::before {
    content: "";
    width: 100%;
    position: absolute;
    top: -16px;
    background-color: inherit;
    display: block;
    height: 16px;
    z-index: inherit;
}

.alignment {
    position: absolute;
    z-index: 999;
    box-shadow: 0 3px 5px -1px rgba(0,0,0,.2), 0 6px 10px 0 rgba(0,0,0,.14), 0 1px 18px 0 rgba(0,0,0,.12) !important;
}
</style>

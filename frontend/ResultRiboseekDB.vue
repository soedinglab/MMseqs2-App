<template>
    <div>
        <v-sheet style="position: sticky; z-index: 99997 !important; padding-bottom: 16px;"
            :db="entryidx" class="sticky-sheet" :class="`result-entry-${entryidx}`"
            :style="{'height': headHeight, 'top': headTop,
                'box-shadow': $vuetify.breakpoint.smAndDown ? 'rgba(0, 0, 0, 0.2) 0px 8px 6px -6px' : '',
                'padding-bottom': $vuetify.breakpoint.smAndDown ? 0 : '16px',
            }">
            <v-flex class="d-flex" :style="{ 'flex-direction' : $vuetify.breakpoint.smAndDown ? 'column' : null,
                'align-items': 'center', 'justify-content': $vuetify.breakpoint.smAndDown ? 'center' : 'space-between'}">
                <h2 style="margin-top: 0.5em; margin-bottom: 1em; display: inline-block;" class="mr-auto">
                    <span style="text-transform: uppercase;">{{ entry.db }}</span>
                    <small v-if="isFiltered">{{ filteredHits.length }} of {{ entryLength }} hits</small>
                    <small v-else>{{ entryLength > 1 ? entryLength.toString() + " hits" : entryLength > 0 ? "1 hit" : "no hit" }}</small>
                </h2>

                <div style="display: flex; justify-content: center; align-items: center;"
                    :style="{'width' : $vuetify.breakpoint.smAndDown ? '100%' : ''}">
                    <v-btn v-if="hasEntries && hasTaxonomyReport" @click="toggleSankeyVisibility(entry.db)"
                        :class="{ 'mr-2': $vuetify.breakpoint.mdAndUp, 'mb-2': $vuetify.breakpoint.smAndDown }" large>
                        {{ isSankeyVisible[entry.db] ? 'Hide Taxonomy' : 'Show Taxonomy' }}
                    </v-btn>
                    <v-btn-toggle v-if="hasEntries" mandatory :value="tableMode" @change="switchTableMode"
                        :class="{'mb-2': $vuetify.breakpoint.smAndDown}">
                        <v-btn>Graphical</v-btn>
                        <v-btn>Numeric</v-btn>
                    </v-btn-toggle>
                    <v-menu v-show="$vuetify.breakpoint.smAndDown" bottom left>
                        <template v-slot:activator="{on, attrs}">
                            <v-btn icon v-bind="attrs" v-on="on" v-show="$vuetify.breakpoint.smAndDown"
                                style="align-self: flex-end; margin-bottom: 16px; margin-left: 8px" title="Sort options">
                                <v-icon>{{ $MDI.Sort }}</v-icon>
                            </v-btn>
                        </template>
                        <v-list flat dense>
                            <v-list-item-group mandatory :color="entry.color" :value="sortMenuValue">
                                <v-list-item v-for="c in sortColumns" :key="c.key" @click.stop="changeSortMode(c.key)">
                                    <v-list-item-title>{{ c.title }}</v-list-item-title>
                                    <v-list-item-icon>
                                        <v-icon :style="{'opacity' : sortKey == c.key ? '1' : 0}">
                                            {{ sortOrder < 0 ? $MDI.ChevronDown : $MDI.ChevronUp }}
                                        </v-icon>
                                    </v-list-item-icon>
                                </v-list-item>
                            </v-list-item-group>
                        </v-list>
                    </v-menu>
                </div>
            </v-flex>
        </v-sheet>

        <v-flex v-if="hasEntries && hasTaxonomyReport && isSankeyVisible[entry.db]" class="mb-2">
            <SankeyDiagram :rawData="entry.taxonomyreports[0]" :db="entry.db"
                :currentSelectedNodeId="localSelectedTaxId" :currentSelectedDb="selectedDb"
                @selectTaxon="handleSankeySelect"></SankeyDiagram>
        </v-flex>

        <table class="v-table result-table" style="position:relative; margin-bottom: 3em;"
            v-if="hasEntries" :style="{'--active-color': entry.color}">
            <colgroup>
                <col style="width: 36px;" />
                <col :style="{ width: entry.hasDescription || entry.hasTaxonomy ? '18%' : '28%' }" />
                <col v-if="entry.hasDescription" />
                <col v-if="entry.hasTaxonomy" />
                <col style="width: 7%;" />
                <col style="width: 8%;" />
                <template v-if="tableMode == 0">
                    <col style="min-width: 20%;" />
                </template>
                <template v-else>
                    <col style="width: 6%;" />
                    <col style="width: 7%;" />
                    <col style="width: 9%;" />
                    <col style="width: 9%;" />
                </template>
                <col style="width: 6%;" />
            </colgroup>
            <thead style="position: sticky; z-index: 99997 !important;" class="sticky-thead"
                :style="{'top': colheadTop, 'background-color': $vuetify.theme.dark ? '#1e1e1e' : '#fff'}">
                <tr>
                    <th class="thin phantom-checkbox"></th>
                    <th :class="[`wide-${3 - entry.hasDescription - entry.hasTaxonomy}`, {'sort-selected': sortKey == 'target', 'sort-down': sortOrder < 0}]"
                        class="sort-criterion" title="Click to sort by target name" @click="changeSortMode('target')">Target</th>
                    <th v-if="entry.hasDescription" class="sort-criterion"
                        :class="{'sort-selected': sortKey == 'desc', 'sort-down': sortOrder < 0}"
                        @click="changeSortMode('desc')" title="Click to sort by description">Description</th>
                    <th v-if="entry.hasTaxonomy" class="sort-criterion"
                        :class="{'sort-selected': sortKey == 'tax', 'sort-down': sortOrder < 0}"
                        @click="changeSortMode('tax')" title="Click to sort by scientific name">Scientific Name</th>
                    <th class="thin sort-criterion default-down" :class="{'sort-selected': sortKey == 'seqId', 'sort-down': sortOrder < 0}"
                        @click="changeSortMode('seqId')" title="Click to sort by sequence identity">Seq. Id.</th>
                    <th class="thin sort-criterion" :class="{'sort-selected': sortKey == 'eval', 'sort-down': sortOrder < 0}"
                        @click="changeSortMode('eval')" title="Click to sort by E-value">E-Value</th>
                    <th class="thin sort-criterion default-down" :class="{'sort-selected': sortKey == 'score', 'sort-down': sortOrder < 0}"
                        v-show="tableMode == 1" @click="changeSortMode('score')" title="Click to sort by score">Score</th>
                    <th class="thin sort-criterion" :class="{'sort-selected': sortKey == 'strand', 'sort-down': sortOrder < 0}"
                        v-show="tableMode == 1" @click="changeSortMode('strand')" title="Click to sort by strand">Strand</th>
                    <th v-show="tableMode == 1">Query Pos.</th>
                    <th v-show="tableMode == 1">Target Pos.</th>
                    <th v-show="tableMode == 0">
                        Position in query
                        <v-tooltip open-delay="300" top>
                            <template v-slot:activator="{ on }">
                                <v-icon v-on="on" style="font-size: 16px; float: right;">{{ $MDI.HelpCircleOutline }}</v-icon>
                            </template>
                            <span>The position of the aligned region of the target sequence in the query.
                                The arrow points along the strand the match is on.</span>
                        </v-tooltip>
                    </th>
                    <th class="alignment-action thin">Alignment</th>
                </tr>
            </thead>
            <tbody>
                <tr aria-hidden="true" style="height: 8px"></tr>
                <tr v-for="item in visibleHits" :key="item.id"
                    :class="['hit', { 'active': alignment && alignment.id == item.id }]">
                    <td class="phantom-checkbox"></td>
                    <td class="db long" data-label="Target"
                        :style="{ 'border-color': merged ? item.dbColor : entry.color,
                                  '--active-color': merged ? item.dbColor : entry.color }">
                        <a :id="item.id" class="anchor" style="position: absolute; top: 0" @click.stop></a>
                        <a style="text-decoration: underline; color: #2196f3;"
                            v-if="Array.isArray(item.href)"
                            @click.stop="$emit('forwardDropdown', $event, item.href)"
                            rel="noopener" :title="item.target">{{ item.target }}</a>
                        <a v-else :href="item.href" target="_blank" rel="noopener"
                            :title="item.target" @click.stop>{{ item.target }}</a>
                    </td>
                    <td class="long" data-label="Description" v-if="entry.hasDescription">
                        <span :title="item.description">{{ item.description }}</span>
                    </td>
                    <td class="long" v-if="entry.hasTaxonomy" data-label="Taxonomy">
                        <a :href="'https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?mode=Info&id=' + item.taxId"
                            target="_blank" rel="noopener" :title="item.taxName" @click.stop>{{ item.taxName }}</a>
                    </td>
                    <td class="thin" data-label="Sequence Identity">{{ item.seqId }}</td>
                    <td class="thin" data-label="E-Value">{{ item.evalStr }}</td>
                    <td class="thin" v-show="tableMode == 1" data-label="Score">{{ item.score }}</td>
                    <td class="thin" v-show="tableMode == 1" data-label="Strand">{{ item.strand }}</td>
                    <td v-show="tableMode == 1" data-label="Query Position">{{ item.qStartPos }}-{{ item.qEndPos }} ({{ item.qLen }})</td>
                    <td v-show="tableMode == 1" data-label="Target Position">{{ item.dbStartPos }}-{{ item.dbEndPos }} ({{ item.dbLen }})</td>
                    <td class="graphical" data-label="Position" v-show="tableMode == 0"
                        :title="`${Math.min(item.qStartPos, item.qEndPos)}-${Math.max(item.qStartPos, item.qEndPos)} on the ${item.strand == '-' ? 'minus' : 'plus'} strand`">
                        <Ruler :length="item.qLen" :start="item.qStartPos" :end="item.qEndPos" :color="item.color" :label="true"></Ruler>
                    </td>
                    <td class="alignment-action">
                        <!-- performance issue with thousands of v-btns, hardcode the minimal button instead -->
                        <button @click.stop="$emit('showAlignment', item, $event)" type="button"
                            class="v-btn v-btn--icon v-btn--round v-btn--text v-size--default"
                            :class="{
                                'v-btn--outlined': alignment && alignment.id == item.id,
                                'theme--dark': $vuetify.theme.dark
                            }">
                            <span class="v-btn__content">
                                <span aria-hidden="true" class="v-icon notranslate theme--dark">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" role="img" aria-hidden="true" class="v-icon__svg">
                                    <path d="M5,13H19V11H5M3,17H17V15H3M7,7V9H21V7"></path>
                                </svg>
                                </span>
                            </span>
                        </button>
                    </td>
                </tr>
                <tr v-if="renderLimit < sortedHits.length" ref="sentinel" aria-hidden="true" style="height: 1px"></tr>
                <tr v-if="renderLimit < sortedHits.length">
                    <td :colspan="fullColSpan" style="text-align: center; padding: 8px; color: #888;">
                        Showing {{ visibleHits.length }} of {{ sortedHits.length }} hits
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
</template>

<script>
import Ruler from './Ruler.vue';
import ResultSankeyMixin from './ResultSankeyMixin.vue';

export default {
    name: 'ResultRiboseekDB',
    mixins: [ ResultSankeyMixin ],
    components: { Ruler },
    props: {
        tableMode: { type: Number, default: 0 },
        entryidx: { type: Number, default: 0 },
        entry: { type: Object, default: null },
        alignment: { type: Object, default: null },
        onlyOne: { type: Boolean, default: false },
        merged: { type: Boolean, default: false },
        closeAlignment: { type: Function, default: () => {} },
    },
    data() {
        return {
            sortKey: 'score',
            sortOrder: -1,
            renderLimit: 100,
            selectedDb: "",
        };
    },
    created() {
        this.BATCH_SIZE = 100;
    },
    mounted() {
        this.setupObserver();
    },
    beforeDestroy() {
        if (this._observer) {
            this._observer.disconnect();
        }
    },
    computed: {
        hits() {
            return this.entry && this.entry.alignments ? this.entry.alignments : [];
        },
        entryLength() {
            return this.hits.length;
        },
        hasEntries() {
            return this.entryLength > 0;
        },
        headTop() {
            return this.onlyOne ? '92px' : '140px';
        },
        headHeight() {
            const auxHeight = this.$vuetify.breakpoint.smAndDown ? 56 : 0;
            const padding = this.$vuetify.breakpoint.smAndDown ? 0 : 16;
            const taxHeight = this.$vuetify.breakpoint.smAndDown && this.hasTaxonomyReport ? 52 : 0;
            return String(auxHeight + 64 + padding + taxHeight) + 'px';
        },
        colheadTop() {
            const tabs = !this.onlyOne ? 48 : 0;
            const stacked = this.$vuetify.breakpoint.smAndDown ? 108 : 0;
            return String(172 + tabs + stacked) + 'px';
        },
        fullColSpan() {
            return 5 + this.entry.hasDescription + this.entry.hasTaxonomy + (this.tableMode == 1 ? 3 : 0);
        },
        sortColumns() {
            const columns = [{ key: 'target', title: 'Target' }];
            if (this.entry.hasDescription) {
                columns.push({ key: 'desc', title: 'Description' });
            }
            if (this.entry.hasTaxonomy) {
                columns.push({ key: 'tax', title: 'Scientific Name' });
            }
            return columns.concat([
                { key: 'seqId', title: 'Sequence Identity' },
                { key: 'eval', title: 'E-Value' },
                { key: 'score', title: 'Score' },
                { key: 'strand', title: 'Strand' },
            ]);
        },
        sortMenuValue() {
            return this.sortColumns.findIndex(c => c.key == this.sortKey);
        },
        hasTaxonomyReport() {
            return this.entry.hasTaxonomy && !this.merged
                && this.entry.taxonomyreports && this.entry.taxonomyreports.length > 0;
        },
        isFiltered() {
            return this.filteredHitsTaxIds != null && this.filteredHitsTaxIds.length > 0;
        },
        filteredHits() {
            if (!this.isFiltered) {
                return this.hits;
            }
            const clade = new Set(this.filteredHitsTaxIds);
            return this.hits.filter(h => h.taxId != null && clade.has(Number(h.taxId)));
        },
        sortedHits() {
            return [...this.filteredHits].sort(this.comparator);
        },
        visibleHits() {
            return this.sortedHits.slice(0, this.renderLimit);
        },
        comparator() {
            const text = (key) => (a, b) => this.sortOrder * String(a[key]).localeCompare(String(b[key]));
            switch (this.sortKey) {
                case 'target':
                    return text('target');
                case 'desc':
                    return text('description');
                case 'tax':
                    return text('taxName');
                case 'strand':
                    return text('strand');
                default:
                    return (a, b) => this.sortOrder * (a[this.sortKey] - b[this.sortKey]);
            }
        },
    },
    watch: {
        sortedHits() {
            this.renderLimit = this.BATCH_SIZE;
            this.setupObserver();
        },
        filteredHitsTaxIds() {
            this.renderLimit = this.BATCH_SIZE;
            this.setupObserver();
        },
    },
    methods: {
        switchTableMode(value) {
            this.$emit('switchTableMode', value);
        },
        changeSortMode(key) {
            if (this.sortKey == key) {
                this.sortOrder *= -1;
            } else {
                this.sortKey = key;
                this.sortOrder = ['target', 'desc', 'tax', 'strand', 'eval'].includes(key) ? 1 : -1;
            }
        },
        setupObserver() {
            this.$nextTick(() => {
                if (this._observer) {
                    this._observer.disconnect();
                }
                if (!this.$refs.sentinel) {
                    return;
                }
                this._observer = new IntersectionObserver((entries) => {
                    if (entries.some(e => e.isIntersecting)) {
                        this.loadMore();
                    }
                }, { rootMargin: '400px' });
                this._observer.observe(this.$refs.sentinel);
            });
        },
        loadMore() {
            if (this.renderLimit >= this.sortedHits.length) {
                return;
            }
            this.renderLimit += this.BATCH_SIZE;
            this.setupObserver();
        },
    },
};
</script>

<style lang="scss" scoped>
@import "result-table";

.result-table td.db {
    position: relative;
}
</style>

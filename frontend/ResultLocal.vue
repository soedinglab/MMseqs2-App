<template>
    <div>
        <v-app-bar app :height="'48px'" fixed clipped-left :class="['ml-0', 'pl-3', null]">
            <v-app-bar-title>{{ $STRINGS.APP_NAME }} Search Results</v-app-bar-title>
            <v-spacer />
            <v-file-input
                id="uploadData"
                class="shrink"
                type="file"
                accept="application/json"
                placeholder="Load JSON data file"
                style="position: relative; top: 30%;"
                @change="uploadData" 
                single-line
                outlined
                filled
                flat
                dense
            />
            <v-toolbar-items v-once class="hidden-sm-and-down">
                <v-btn text rel="external noopener" target="_blank"
                       v-for="i in ($STRINGS.NAV_URL_COUNT - 0)" :key="i" :href="$STRINGS['NAV_URL_' + i]">{{ $STRINGS["NAV_TITLE_" + i]}}</v-btn>
            </v-toolbar-items>
        </v-app-bar>
        <v-tabs center-active grow style="margin-bottom: 1em" show-arrows>
            <v-tab v-for="(entry, index) in hits" :key="entry.query.header" @click="changeResult(index)">
                {{ entry.query.header }} ({{ entry.results[0].alignments ? entry.results[0].alignments.length : 0 }})
            </v-tab>
        </v-tabs>
        <ResultView
            :key="currentIndex"
            :ticket="ticket"
            :error="error"
            :mode="mode"
            :hits="currentResult"
            :selectedDatabases="selectedDatabases"
            :tableMode="tableMode"
        />
        <v-container grid-list-md fluid pa-2>
            <v-layout wrap>
                <v-flex xs12>
                    <v-card rounded="0">
                    <v-card-title primary-title class="pb-0 mb-0">
                        <div class="text-h5 mb-0">Reference</div>
                    </v-card-title>
                    <v-card-title primary-title class="pt-0 mt-0">
                        <p class="text-subtitle-2 mb-0" v-html="$STRINGS.CITATION"></p>
                    </v-card-title>
                    </v-card>
                </v-flex>
            </v-layout>
        </v-container>
    </div>
</template>

<script>
import ResultMixin from './ResultMixin.vue';
import ResultView from './ResultView.vue';
import Navigation from './Navigation.vue';

export default {
    name: 'result',
    mixins: [ResultMixin],
    components: { ResultView, Navigation },
    data() {
        return {
            currentIndex: 0
        };
    },
    mounted() {
        document.onreadystatechange = () => {
            if (document.readyState == "complete") {
                let data = JSON.parse(document.getElementById("data").textContent);
                this.fetchData(data);
            }
        }
    },
    computed: {
        currentResult() {
            if (this.hits === null)
                return null;
            return this.hits[this.currentIndex];
        },
        currentQuery() {
            if (this.hits === null)
                return "";
            return this.hits[this.currentIndex].query.header;
        }
    },
    methods: {
        changeResult(newRes) {
            this.currentIndex = newRes;
            this.setColorScheme();
        },
        uploadData(file) {
            if (!file) {
                return;
            }
            let fr = new FileReader();
            fr.addEventListener(
                "load",
                (e) => {
                    let data = JSON.parse(e.target.result);
                    this.fetchData(data);
                }
            );
            fr.readAsText(file)
        },
        resetProperties() {
            this.ticket = "";
            this.error = "";
            this.mode = "";
            this.hits = null;
            this.selectedDatabases = 0;
            this.tableMode = 0;
        },
        fetchData(data) {
            this.resetProperties();
            this.hits = [];
            for (let result of data) {
                this.hits.push(this.parseResults(result));
            }
        }
    }
};
</script>

<style scoped>
::v-deep .v-app-bar-title__content {
    text-overflow: revert !important;
}
</style>
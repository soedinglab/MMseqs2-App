<template>
<Local 
    :title="appTitle"
    @uploadData="handleUploadData"
    @downloadData="handleDownloadData"
>
    <template v-slot:default>
        <v-tabs v-if="hits" center-active grow style="margin-bottom: 1em" show-arrows>
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
    </template>
</Local>
</template>

<script>
import { parseResultsList, download, dateTime } from './Utilities.js';
import ResultMixin from './ResultMixin.vue';
import ResultView from './ResultView.vue';
import Local from './Local.vue';

export default {
    name: 'result',
    mixins: [ResultMixin],
    components: { ResultView, Local },
    data() {
        return {
            currentIndex: 0
        };
    },
    mounted() {
        document.onreadystatechange = () => {
            if (document.readyState == "complete") {
                let div = document.getElementById("data");
                if (!div) {
                    return null;
                }
                let data = JSON.parse(div.textContent);
                this.fetchData(data);
            }
        }
    },
    computed: {
        appTitle() {
            return `${__STRINGS__.APP_NAME} Search`;
        },
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
        handleUploadData(data) {
            this.fetchData(data);
        },
        handleDownloadData() {
            if (!this.hits) {
                return null;
            }
            download(this.hits, `${__APP__}-${dateTime()}.json`);
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
            this.hits = parseResultsList(data);
        }
    }
};
</script>

<style scoped>
::v-deep .v-app-bar-title__content {
    text-overflow: revert !important;
}
</style>
<style>
.theme--light .panel-root .v-toolbar {
    background-color: #454545 !important;
}

.theme--dark .panel-root .v-toolbar {
    background-color: #1e1e1e !important;
}
</style>
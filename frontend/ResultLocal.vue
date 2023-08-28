<template>
    <div>
        <v-tabs center-active grow style="margin-bottom: 1em" show-arrows>
            <v-tab v-for="(entry, index) in hits" :key="entry.query.header" @click="changeResult(index)">
                {{ entry.query.header }} ({{ entry.results[0].alignments ? entry.results[0].alignments.length : 0 }})
            </v-tab>
        </v-tabs>
        <input id="uploadData" type="file" @change="uploadData" />
        <ResultView
            :key="currentIndex"
            :ticket="ticket"
            :error="error"
            :mode="mode"
            :hits="currentResult"
            :selectedDatabases="selectedDatabases"
            :tableMode="tableMode"
        />       
    </div>
</template>

<script>
import ResultMixin from './ResultMixin.vue';
import ResultView from './ResultView.vue';

export default {
    name: 'result',
    mixins: [ResultMixin],
    components: { ResultView },
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
        uploadData(event) {
            const file = event.target.files[0];
            let fr = new FileReader();
            fr.addEventListener(
                "load",
                (e) => {
                    let str = e.target.result;
                    this.hits = [];
                    for (const hit of JSON.parse(str)) {
                        this.hits.push(this.parseResults(hit));
                    }
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
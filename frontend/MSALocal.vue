<template>
<Local
    title="FoldMason Results"
    @uploadData="handleUploadData"
    @downloadData="handleDownloadData"
>
    <template v-slot:default>
        <MSA
            v-if="entries.length > 0"
            :key="key"
            :entries="entries"
            :scores="scores"
            :statistics="statistics"
        />
    </template>
</Local>
</template>

<script>
import { dateTime, download } from './Utilities.js';
import MSA from './MSA.vue';
import Local from './Local.vue';

export default {
    components: {
        MSA,
        Local
    },
    data() {
        return {
            entries: [],
            scores: [],
            statistics: {},
            key: ""
        }
    },
    mounted() {
        document.onreadystatechange = () => {
            if (document.readyState == "complete") {
                let div = document.getElementById("data");
                if (!div) {
                    return null;
                }
                let data = JSON.parse(div.textContent);
                this.handleUploadData(data);
            }
        }
    },
    methods: {
        clearData() {
            this.key = "";
            this.entries = [];
            this.scores = [];
            this.statistics = {};
        },
        handleUploadData(data) {
            this.clearData();
            this.key = dateTime();  // TODO better uid for uploaded data
            this.entries = data.entries;
            this.scores = data.scores;
            this.statistics = data.statistics;
        },
        handleDownloadData() {
            if (!this.entries) {
                return;
            }
            download({
                entries: this.entries,
                scores: this.scores,
                statistics: this.statistics
            }, `FoldMason-${dateTime()}.json`);
        }
    }
}
</script>
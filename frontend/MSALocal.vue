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

// Process e.g. AF-{uniprot ID}-F1_model_v4.cif.pdb.gz to just uniprot ID
function tryFixName(name) {
    if (name.startsWith("AF-")) {
        name = name.replaceAll(/(AF[-_]|[-_]F[0-9]+[-_]model[-_]v[0-9]+)/g, '')
    }
    return name.replaceAll(/\.(cif|pdb|gz)/g, '');
}

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
            this.entries.forEach(entry => {
                entry.name = tryFixName(entry.name);
            });
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
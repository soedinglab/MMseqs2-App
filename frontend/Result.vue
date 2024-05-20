<template>
    <ResultView
        :ticket="ticket"
        :error="error"
        :hits="hits"
        :selectedDatabases="selectedDatabases"
        :tableMode="tableMode"
    />
</template>

<script>
import { download, parseResults, dateTime } from './Utilities.js';
import ResultMixin from './ResultMixin.vue';
import ResultView from './ResultView.vue';

function pdb2ca(pdb) {
    let ca = "";
    for (const line of pdb.split('\n')) {
        if (line.startsWith("ATOM") && line.slice(12, 16).trim() === "CA") {
            const xyz = line.slice(30, 54).trim().split(/\s+/).join(',');
            ca += (ca === "") ? xyz : `,${xyz}`;
        }
    }
    return ca;
}

export default {
    name: 'Result',
    components: { ResultView },
    mixins: [ResultMixin],
    mounted() {
        this.$root.$on('downloadJSON', () => {
            let data;
            if (this.ticket.startsWith('user')) {
                data = this.$root.userData;
                download(data, `${`Foldseek_${dateTime()}.json`}`)
            } else {
                this.fetchAllData();
            }
        })
        if (this.hits) {
            return;
        }
        this.fetchData();
    },
    destroyed () {
        this.$root.$off('downloadJSON');
    },
    watch: {
        '$route': function(to, from) {
            if (from.path != to.path) {
                this.fetchData();
            }
        },
        hits: function() {
            this.setColorScheme();
        }
    },
    methods: {
        resetProperties() {
            this.ticket = this.$route.params.ticket;
            this.error = "";
            this.hits = null;
            this.selectedDatabases = 0;
            this.tableMode = 0;
        },
        async fetchData() {
            this.resetProperties();
            try {
                let hits;
                if (this.ticket.startsWith('user')) {
                    let localData = this.$root.userData;
                    hits = localData[this.$route.params.entry];
                } else {
                    const response = await this.$axios.get("api/result/" + this.ticket + '/' + this.$route.params.entry);
                    const data = response.data;
                    if (data.alignments == null || data.alignments.length > 0) {
                        hits = parseResults(data);
                    } else {
                        throw new Error("No hits found");
                    }
                }
                this.hits = hits;
            } catch {
                this.error = "Failed";
                this.hits = null;
            }
        },
        async fetchResult(page) {
            const url = `api/result/${this.ticket}/${page}`;
            // console.log("fetching result url", url)
            try {
                const response = await this.$axios.get(url);
                return parseResults(response.data);
            } catch {
                // console.log("result fetch error")
            }
        },
        async fetchAllData() {
            let page = 0;
            let limit = 7;
            let allData = [];
            
            // List of queries [{ id, name, set }]
            // Generate Promises to retrieve query PDB/results, convert PDB -> qCa string, return data
            let getQueryPromises = async (queries) => {
                const promises = queries.map(async query => {
                    const [hitResponse, hitQuery] = await Promise.all([
                        this.$axios.get(`api/result/${this.ticket}/${query.id}`),
                        this.$axios.get(`api/result/${this.ticket}/query`)
                    ]);
                    const data = parseResults(hitResponse.data);
                    data.query.pdb = JSON.stringify(hitQuery.data);
                    data.query.qCa = pdb2ca(hitQuery.data);
                    return data;
                });
                return Promise.all(promises);
            }

            // Fetch all possible queries, retrieve data for each
            // Recurses around query limit
            let getFn = async () => {
                const queryResponse = await this.$axios.get(`api/result/queries/${this.ticket}/${limit}/${page}`);
                const result = await getQueryPromises(queryResponse.data.lookup);
                allData.push(...result);
                if (queryResponse.data.hasNext) {
                    page++;
                    await getFn();
                }
            } 
            
            await getFn();
            download(allData, `Foldseek_${dateTime()}.json`);
        }
    }
};
</script>
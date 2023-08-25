<template>
    <ResultView
        :ticket="ticket"
        :error="error"
        :mode="mode"
        :hits="hits"
        :selectedDatabases="selectedDatabases"
        :tableMode="tableMode"
    />       
</template>

<script>
import ResultMixin from './ResultMixin.vue';
import ResultView from './ResultView.vue';

export default {
    components: { ResultView },
    mixins: [ResultMixin],
    mounted() {
        this.fetchData();
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
            this.mode = "";
            this.hits = null;
            this.selectedDatabases = 0;
            this.tableMode = 0;           
        },
        fetchData() {
            this.resetProperties();
            this.$axios.get("api/result/" + this.ticket + '/' + this.$route.params.entry)
                .then((response) => {
                    this.error = "";
                    const data = response.data;
                    if ("mode" in data) {
                        this.mode = data.mode;
                    }
                    if (data.alignments == null || data.alignments.length > 0) {
                        this.hits = this.parseResults(data); 
                    } else {
                        this.error = "Failed";
                        this.hits = [];
                    }
                }, () => {
                    this.error = "Failed";
                    this.hits = [];
                });
        }
    }
};
</script>
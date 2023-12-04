<template>
    <div>
        <div class="input-group">
            <v-tooltip open-delay="300" top>
                <template v-slot:activator="{ on }">
                    <label v-on="on">Databases&nbsp;<v-icon color="#FFFFFFB3" style="margin-top:-3px" small v-on="on">{{
                        $MDI.HelpCircleOutline }}</v-icon></label>
                </template>
                <span v-if="$ELECTRON || hideEmail">Choose the databases to search against and the result mode.</span>
                <span v-else>Choose the databases to search against, the result mode, and optionally an email to notify you
                    when the job is done.</span>
            </v-tooltip>
        </div>

        <div v-if="allDatabases.length == 0">
            <div :class="['alert', { 'alert-info': !dberror }, { 'alert-danger': dberror }]">
                <span v-if="dberror">Could not query available databases!</span>
                <span v-else-if="dbqueried == false">Loading databases...</span>
                <span v-else>
                    No databases found! <br />
                    <span v-if="$ELECTRON">
                        Go to <router-link to="preferences">Preferences</router-link> to add a database.
                    </span>
                </span>
            </div>
        </div>
        <template v-else>
            <v-checkbox v-for="(db, index) in allDatabases" v-model="selectedDatabases" :key="index" :value="db.path"
                :label="db.name + ' ' + db.version"
                :append-icon="(db.status == 'ERROR' || db.status == 'UNKNOWN') ? $MDI.AlertCircleOutline : ((db.status == 'PENDING' || db.status == 'RUNNING') ? $MDI.ProgressWrench : undefined)"
                :disabled="db.status != 'COMPLETE'" hide-details>
            </v-checkbox>
        </template>
        <div v-if="databasesNotReady" class="alert alert-info mt-1">
            <span>Databases are loading...</span>
        </div>
    </div>
</template>
  
<script>
export default {
    name: 'Databases',
    props: {
        selected: {
            type: Array,
            default: () => []
        },
        allDatabases: {
            type: Array,
            default: () => []
        },
        hideEmail: {
            type: Boolean,
            default: false
        }
    },
    data() {
        return {
            dberror: false,
            dbqueried: false,
            selectedDatabases: this.selected,
            availableDatabases: this.allDatabases
        };
    },
    computed: {
        databasesNotReady() {
            return this.allDatabases.some(db => db.status === "PENDING" || db.status === "RUNNING");
        }
    },
    watch: {
        $route: "fetchData",
        selected(newVal) {
            this.selectedDatabases = newVal;
        },
        selectedDatabases(newVal) {
            this.$emit('update:selected', newVal);
        },
        availableDatabases(newVal) {
            this.$emit('update:all-databases', newVal);
        }
    },
    created() {
        this.fetchData();
    },
    methods: {
        async fetchData() {
            try {
                const response = await this.$axios.get("api/databases/all");
                this.dbqueried = true;
                this.dberror = false;
                this.availableDatabases = response.data.databases;

                const complete = this.availableDatabases.filter(db => db.status === "COMPLETE");
                if (this.selectedDatabases.length === 0) {
                    this.selectedDatabases = complete.filter(db => db.default).map(db => db.path);
                } else {
                    const paths = complete.map(db => db.path);
                    this.selectedDatabases = this.selectedDatabases.filter(path => paths.includes(path));
                }

                if (this.availableDatabases.some(db => db.status === "PENDING" || db.status === "RUNNING")) {
                    setTimeout(this.fetchData, 1000);
                }
            } catch (error) {
                this.dberror = true;
                this.availableDatabases = [];
            }
        }
    }
};
</script>

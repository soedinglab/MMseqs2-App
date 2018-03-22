<template>
<v-container grid-list-md fluid>
    <v-layout row wrap>
    <v-flex xs12 md7>
        <panel>
            <template slot="header">
                Databases
            </template>

            <template slot="toolbar-extra">
                <v-toolbar-items>
                    <template v-if="databases.length > 1">
                    <v-btn v-if="inReorder == false" dark @click="inReorder = true">
                        Reorder
                    </v-btn>
                    <v-btn dark primary v-else @click="saveOrder">
                        Save Order
                    </v-btn>
                    </template>
                    <v-btn dark class="ml-1 mr-0" @click="dialog = true">Add Database</v-btn>
                </v-toolbar-items>
            </template>

            <div slot="desc" v-if="error || databases.length == 0">
                <v-container fill-height grid-list-md>
                    <v-layout row justify-center>
                        <v-flex xs4>
                            <img style="max-width:100%" src="./assets/marv-error_2x.png" srcset="./assets/marv-error_2x.png 2x, ./assets/marv-error_3x.png 3x" />
                        </v-flex>
                        <v-flex xs8>
                            <h3 v-if="error">Error!</h3>
                            <template v-else>
                            <h3>No databases found!</h3>
                            <p>Please add a <a @click="dialog = true">new database</a>.</p>
                            </template>
                        </v-flex>
                    </v-layout>
                </v-container>
            </div>

            <div slot="content">
                <v-list two-line subheader dense>
                    <draggable v-model="databases" :options="{ handle: '.drag-handle' }">
                    <v-list-tile v-for="(child, i) in databases" :key="i">
                        <v-list-tile-action>
                            <v-icon v-if="inReorder == false">dns</v-icon>
                            <v-btn v-else style="cursor: move" icon class="drag-handle">
                                <v-icon>reorder</v-icon>
                            </v-btn>
                        </v-list-tile-action>
                        <v-list-tile-content>
                            <v-list-tile-title>
                                {{ child.name }}
                            </v-list-tile-title>
                            <v-list-tile-sub-title>
                                {{ child.version }}
                            </v-list-tile-sub-title>
                        </v-list-tile-content>
                        <v-list-tile-action>
                            <v-btn icon @click="deleteDatabase(child.path)">
                                <v-icon>delete</v-icon>
                            </v-btn>
                        </v-list-tile-action>
                    </v-list-tile>
                    </draggable>
                </v-list>
            </div>
        </panel>
        </v-flex>
        <v-flex xs12 md5>
        <v-container grid-list-md fluid>
            <v-layout row wrap>
                <v-flex xs12>
                    <v-card color="blue-grey darken-2" class="white--text">
                        <v-card-title primary-title>
                            <div>
                                <div class="headline"><span v-if="!supportedPlatform">Uns</span><span v-else>S</span>upported Platform</div>
                                <span class="grey--text">Current Platform: {{ __OS__.platform }} - {{ __OS__.arch }} - {{ __OS__.simd }}</span>
                            </div>
                        </v-card-title>
                    </v-card>
                </v-flex>
                <v-flex xs12>
                    <v-card color="blue-grey darken-2" class="white--text">
                        <v-card-title primary-title>
                            <div>
                                <div class="headline">MMseqs2</div>
                                <span class="grey--text">Version: {{ mmseqsVersion }}</span>
                            </div>
                        </v-card-title>
                    </v-card>
                </v-flex>
            </v-layout>
        </v-container>
        </v-flex>
    </v-layout>
    <new-database :show="dialog" @close="dialog = false"></new-database>
</v-container>
</template>

<script>
import Panel from './Panel.vue';
import NewDatabase from './NewDatabase.vue'
import Draggable from 'vuedraggable';

export default {
    components: { Panel, Draggable, NewDatabase },
    data() {
        return {
            databases: [],
            error: false,
            inReorder: false,
            dialog: false,
        }
    },
    created() {
        this.fetchData();
    },
    watch: {
        $route: "fetchData"
    },
    computed: {
        supportedPlatform() {
            if (!__ELECTRON__) {
                return true;
            }
            
            var isSupportedOS = false;
            switch(this.__OS__.platform) {
                case "win32":
                case "darwin":
                case "linux":
                isSupportedOS = true;
                break;
                default:
                isSupportedOS = false;
            }

            const isSupportedArch = this.__OS__.arch == "x64";

            var isSupportedSIMD = false;
            switch(this.__OS__.simd) {
                case "avx2":
                case "sse41":
                isSupportedSIMD = true;
                break;
                default:
                isSupportedSIMD = false;
            }
            
            return isSupportedOS && isSupportedArch && isSupportedSIMD;
        }
    },
    methods: {
        fetchData() {
            this.error = false;
            this.$http.get("api/databases").then(
                response => {
                    response.json().then(data => {
                        this.databases = data.databases;
                        this.error = false;
                    }).catch(this.apiError);
                }).catch(this.apiError);
        },
        saveOrder() {
            this.inReorder = false;
            const database = this.databases.map(x => { return x.path; });
            this.$http.post("api/databases/order", { database }, { emulateJSON: true }).then(
                response => {
                    response.json().then(data => {
                        this.databases = data.databases;
                        this.error = false;
                    }).catch(this.apiError);
                }).catch(this.apiError);
        },
        deleteDatabase(path) {
            if (confirm("Are you sure?") == true) {
                this.$http.delete("api/database", { params: { path: path }, emulateJSON: true }).then(
                response => {
                    if (response.status != 200) {
                        this.apiError();
                    } else {
                        this.fetchData();
                    }
                }).catch(this.apiError);
            }
        },
        apiError() {
            this.error = true;
        }
    }
};
</script>
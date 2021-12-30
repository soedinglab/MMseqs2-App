<template>
<v-container grid-list-md fluid px-2 py-1>
    <v-layout wrap>
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
                    <v-layout justify-center>
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
                    <v-list-item v-for="(child, i) in databases" :key="i">
                        <v-list-item-action>
                            <v-icon v-if="inReorder == false">{{ $MDI.Dns }}</v-icon>
                            <v-btn v-else style="cursor: move" icon class="drag-handle">
                                <v-icon>{{ $MDI.ReorderHorizontal }}</v-icon>
                            </v-btn>
                        </v-list-item-action>
                        <v-list-item-content>
                            <v-list-item-title>
                                {{ child.name }}
                            </v-list-item-title>
                            <v-list-item-subtitle>
                                {{ child.version }}
                            </v-list-item-subtitle>
                        </v-list-item-content>
                        <v-list-item-action>
                            <v-btn icon @click="deleteDatabase(child.path)">
                                <v-icon>{{ $MDI.Delete }}</v-icon>
                            </v-btn>
                        </v-list-item-action>
                    </v-list-item>
                    </draggable>
                </v-list>
            </div>
        </panel>
        </v-flex>
        <v-flex xs12 md5>
        <v-container grid-list-md fluid style="margin-top:-12px;">
            <v-layout wrap>
                <v-flex xs12>
                    <v-card>
                        <v-card-title primary-title style="background-color:#465A64; color:#fff;">
                            <div>
                                <div class="text-h5">{{ $STRINGS.APP_NAME }} Version</div>
                                <span class="text-subtitle-1" style="word-break: break-all;">{{ mmseqsVersion }}</span>
                                <br>
                                <span class="text-subtitle-1">Current Platform: {{ __OS__.platform }} - {{ __OS__.arch }}</span>
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
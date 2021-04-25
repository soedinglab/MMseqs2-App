<template>
<v-dialog v-model="show" persistent max-width="500px">
<panel>
    <template slot="header">
        New Database
    </template>
    <template slot="toolbar-extra">
        <v-toolbar-items>
            <v-btn @click="close">Close</v-btn>
            <v-btn @click="submitDatabase">Submit</v-btn>
        </v-toolbar-items>
    </template>
    <div slot="content">
        <v-layout wrap>
            <v-flex xs12 sm6>
                <v-text-field v-model="form.name" label="Name" required></v-text-field>
            </v-flex>
            <v-flex xs12 sm6>
                <v-text-field v-model="form.version" label="Version" required></v-text-field>
            </v-flex>
            <v-flex xs12 sm6>
                <v-select
                    :items="formats"
                    v-model="form.format"
                    label="Format"
                    single-line
                    ></v-select>
            </v-flex>
            <v-flex xs12 sm6>
                <v-btn large color="primary" text style="width: 100%; margin-left: 0;" :disabled="form.format == ''"  @click="selectPath">
                    <template v-if="form.path == ''">
                        Select File
                    </template>
                    <template v-else>
                        {{ form.path }}
                    </template>
                </v-btn>
            </v-flex>
            <v-flex xs12 sm6>
                <v-checkbox v-model="form.default" label="Include in Default"></v-checkbox>
            </v-flex>
            <v-flex xs12>
                <v-text-field v-model="form.index" label="Extra Indexing Parameters (optional)"></v-text-field>
            </v-flex>
            <v-flex xs12>
                <v-text-field v-model="form.search" label="Extra Search Parameters (optional)"></v-text-field>
            </v-flex>
        </v-layout>
    </div>
</panel>
</v-dialog>
</template>

<script>
import Panel from './Panel.vue';

export default {
    props: { show: { default: false, type: Boolean} },
    components: { Panel },
    data() {
        return {
            apiError: false,
            formError: false,
            form : {
                name: "",
                version: "",
                path: "",
                format: "",
                default: false,
                index: "",
                search: "",
            },
            formats: [
                { text: "FASTA", value: "fasta" },
                { text: "Stockholm", value: "stockholm" }
            ]
        }
    },
    methods: {
        selectPath() {
            this.newDatabase(this.form.format, (path) => this.form.path = path);
        },
        validForm() {
            return this.form.name.length > 0
                && this.form.version.length > 0
                && this.form.path.length > 0
                && this.formats.map(x => { return x.value; }).includes(this.form.format);
        },
        submitDatabase() {
            if (this.validForm() == false) {
                this.formError = true;
                return;
            } else {
                this.formError = false;
            }

            this.apiError = false;
            this.$http.post("api/database", this.form, { emulateJSON: true }).then(
            response => {
               response.json().then(data => {
                    this.$router.push({
                        name: "queue",
                        params: { ticket: data.id }
                    });
                    this.close();
                }).catch(() => this.apiError = true);
            }).catch(() => this.apiError = true);
        },
        close() {
            this.$emit('close');
        }
    }
};
</script>
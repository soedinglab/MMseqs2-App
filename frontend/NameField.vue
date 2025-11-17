<template>
    <v-flex style="flex-direction: row;" grow>
        <span  class="hidden-sm-and-down">Results for job:&nbsp;</span>
        <template v-if="inEdit">
            <v-text-field
            label="Name" v-model="tmpNameStr"
            :placeholder="ticket" single-line dense
            :rules="rules" 
            clearable :details="false"
            >
            </v-text-field>
            <v-icon @click="saveName">{{ $MDI.Check }}</v-icon>
        </template>
        <template v-else>
            <small class="ticket">
                {{ toDisplay }}
            </small>
            <v-icon @click="enableEdit">{{ $MDI.Pencil }}</v-icon>
        </template>
    </v-flex>
</template>

<script>

import { storage, HistoryMixin } from './lib/HistoryMixin'

export default {
    data() {
        return {
        tmpNameStr: "",
        rules: [e => e.length <= 25 || "Max 25 characters "],
        name: "",
        inEdit: false,
    }},
    mixins: [HistoryMixin],
    props: {
        ticket: {
            type: String,
            default: "",
        }
    },
    computed: {
        toDisplay() {
            return this.name != "" ? this.name : this.ticket
        }
    },
    created() {
        let name = JSON.parse(storage.name_map || "[]").find(e => e.id == this.ticket)?.name
        if (name) {
            this.name = name
        }
    },
    methods: {
        saveName() {
            this.inEdit = false
        },
        enableEdit() {
            this.inEdit = true
        }
    }
}
</script>

<style scoped>

@media print, screen and (max-width: 599px) {
    small.ticket {
        display: inline-block;
        line-height: 0.9;
    }
}
</style>
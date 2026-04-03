<template>
    <v-textarea
        :aria-label="$STRINGS.QUERIES_HELP"
        class="marv-bg mono"
        :loading="loading"
        :value="value" @input="$emit('input', $event)"
        @dragover.prevent
        @drop="fileDrop"
        :placeholder="$STRINGS.QUERIES_HELP"
        spellcheck="false"
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
    >
    </v-textarea>
</template>

<script>
import { readUploadedText } from "./Utilities.js";

export default {
    name: 'QueryTextarea',
    props: {
        value: String,
        loading: Boolean
    },
    methods: {
        fileDrop(event) {
            event.preventDefault();
            event.stopPropagation();
            var dataTransfer = event.dataTransfer || event.target;
            if (dataTransfer && dataTransfer.files && dataTransfer.files.length > 0) {
                readUploadedText(dataTransfer.files[0]).then((text) => {
                    this.$emit('input', text);
                });
            }
        }
    }
};
</script>

<style scoped>
.marv-bg .input-group__input {
    max-height: inherit;
}

.marv-bg >>> textarea {
    height: 100%;
    min-height: 270px;
    background-image: url("./assets/marv-search-gray.png");
    background-repeat: no-repeat;
    background-position: right 15px bottom -10px;
    background-size: 200px;
    line-height: 1.5;
}

.marv-bg >>> .v-input__control, .marv-bg >>> .v-input__slot, .marv-bg >>> .v-text-field__slot {
    flex: 1;
    align-self: stretch;
}

</style>

<template>
    <v-btn v-bind:id="id" type="button" class="btn btn--raised btn--file" style="position: relative;"  :block="$vuetify.breakpoint.xsOnly">
        <div v-bind:id="id + 'label'" class="btn__content" aria-hidden>
            {{ label }}
        </div>
        <input ref="fileInput" :aria-label="label" type="file" v-on:change="upload" :multiple="multiple" :accept="accept">
    </v-btn>
</template>

<script>
export default {
    name: 'file-button',
    props: {
        id: String,
        label: String,
        multiple: { type: Boolean, default: false },
        accept: { type: String, default: "*" }
    },
    methods: {
        upload(event) {
            var files = this.$el.getElementsByTagName('input')[0].files;
            this.$emit('upload', files);
        },
        trigger() {
            this.$refs.fileInput.click();
        }
    }
}
</script>

<style scoped>
.btn--file {
    position: relative;
    overflow: hidden;
}

.btn--file input[type=file] {
    position: absolute;
    top: 0;
    right: 0;
    min-width: 100%;
    min-height: 100%;
    font-size: 100px;
    text-align: right;
    filter: alpha(opacity=0);
    opacity: 0;
    outline: none;
    background: white;
    cursor: inherit;
    display: block;
}
</style>
<template>
    <label v-bind:id="id"
           class="btn btn-default btn-file">
        {{ label }}
        <input type="file"
               style="display: none;"
               v-on:change="upload">
    </label>
</template>

<script>
export default {
    name: 'file-button',
    props: ['id', 'label'],
    methods: {
        upload(event) {
            var files = this.$el.getElementsByTagName('input')[0].files;
            this.$emit('upload', files);
        }
    }
}
</script>

<style>
.btn-file {
    position: relative;
    overflow: hidden;
}

.btn-file input[type=file] {
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
<template>
    <button v-bind:id="id" type="button" class="btn btn--raised btn--file" style="position: relative;">
        <div class="btn__content">
            {{ label }}
        </div>
        <input type="file" v-on:change="upload">
    </button>
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
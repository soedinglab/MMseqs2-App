<template>
    <div class="panel-root">
        <v-toolbar v-if="!!$slots['header'] || !!header" flat dense dark>
            <span class="title white--text align-end">
                <slot v-if="$slots['header']" name="header"></slot>
                <template v-else>{{ header }}</template>
            </span>
            <v-spacer></v-spacer>
            <slot name="toolbar-extra"></slot>
        </v-toolbar>
        <v-card :class="['panel', 'd-flex', { 'force-fill-height' : fillHeight }]">
            <v-card-text class="subheading justify" v-if="$slots['desc']">
                <slot name="desc"></slot>
            </v-card-text>
            <v-card-text class="panel-content justify d-flex" v-if="$slots['content']">
                <slot name="content"></slot>
            </v-card-text>
        </v-card>
    </div>
</template>

<script>
export default {
    name: 'panel',
    props: { header : { default: '', type: String }, 'fillHeight' : { default: false, type: Boolean }},
}
</script>

<style>
.panel-root, .panel-content {
    flex-direction:column;
}

.panel-root nav {
    flex: 0;
}

.panel-root .force-fill-height {
    display:flex;
    height: 100% !important;
}

.panel-root .toolbar.theme--dark {
    background: url('/assets/spiration-dark.png');
    background-repeat: repeat;
}
</style>
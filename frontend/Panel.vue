<template>
    <div :class="['panel-root', elevation != null ? 'elevation-' + elevation : null ]">
        <v-toolbar v-if="!!$slots['header'] || !!header" text dense dark>
            <v-btn v-if="collapsible" style="margin-top:0;margin-left:-15px;" icon plain  @click="isCollapsed = !isCollapsed" :aria-expanded="isCollapsed ? 'false' : 'true'" :aria-controls="uuid">
                <v-icon v-if="isCollapsed">
                    {{ $MDI.PlusBox }}
                </v-icon>
                <v-icon v-else>
                    {{ $MDI.MinusBox }}
                </v-icon>
            </v-btn>
            <span class="text-h6 align-end">
                <slot v-if="$slots['header']" name="header"></slot>
                <template v-else>{{ header }}</template>
            </span>
            <v-spacer></v-spacer>
            <slot name="toolbar-extra"></slot>
        </v-toolbar>
        <v-card rounded="0" :class="['panel', { 'd-flex' : flex }, { 'force-fill-height' : fillHeight }]" v-if="!isCollapsed" :id="uuid">
            <v-card-text v-if="$slots['desc']" class="subheading justify">
                <slot name="desc"></slot>
            </v-card-text>
            <v-card-text v-if="$slots['content']" :class="['panel-content', 'justify', { 'd-flex' : flex }]">
                <slot name="content"></slot>
            </v-card-text>
        </v-card>
    </div>
</template>

<script>
let uuid = 0;
export default {
    name: 'panel',
    props: { 
        header : { default: '', type: String }, 
        'fillHeight' : { default: false, type: Boolean }, 
        'collapsible' : { default: false, type: Boolean },
        'collapsed' : { default: false, type: Boolean },
        'flex' : { default: true, type: Boolean },
        'elevation' : { default: null, type: Number }
    },
    data() {
        return {
            isCollapsed: this.collapsed,
        }
    },
    beforeCreate() {
        this.uuid = 'panel-' + uuid.toString();
        uuid += 1;
    },
}
</script>

<style scoped>
.panel-root, .panel-content {
    flex-direction: column;
}

.panel-root header, .panel-content {
    contain: content;
}

.panel-root nav {
    flex: 0;
}

.panel-root .force-fill-height {
    display: flex;
    height: 100% !important;
}

.panel-root >>> .v-toolbar {
    background-repeat: repeat;
}

.theme--light .panel-root >>> .v-toolbar {
    background: url('./assets/spiration-dark.png');
    
}

.theme--dark .panel-root >>> .v-toolbar {
    background: url('./assets/spiration-darker.png');
}

.panel-root >>> .text-h6 {
    margin-bottom: -5px;
}

.panel-root >>> .text-h6 i.v-icon {
    font-size: 1em;
    vertical-align: bottom;
}
</style>
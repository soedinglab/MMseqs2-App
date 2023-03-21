<template>
<div>
<v-navigation-drawer stateless app permanent clipped :mini-variant="mini" :expand-on-hover="false" ref="drawer">
    <v-list>
        <v-list-item to="/search">
            <v-list-item-action>
                <v-icon>{{ $MDI.Magnify }}</v-icon>
            </v-list-item-action>
            <v-list-item-content>
                <v-list-item-title>Search</v-list-item-title>
            </v-list-item-content>
        </v-list-item>

        <router-view name="sidebar"></router-view>

        <history />

        <v-list-item v-if="$ELECTRON" to="/preferences">
            <v-list-item-action>
                <v-icon>{{ $MDI.Tune }}</v-icon>
            </v-list-item-action>
            <v-list-item-content>
                <v-list-item-title>Preferences</v-list-item-title>
            </v-list-item-content>
        </v-list-item>
    </v-list>
</v-navigation-drawer>
<v-app-bar v-on:dblclick.native="electronHandleTitleBarDoubleClick()" app :height="$ELECTRON ? '72px' : '48px'" fixed clipped-left :class="['ml-0', 'pl-3', $ELECTRON ? 'pt-2' : null]" :style="{'-webkit-app-region': $ELECTRON ? 'drag' : null, '-webkit-user-select': $ELECTRON ? 'none' : null}">
    <v-app-bar-nav-icon :input-value="!mini ? 'activated' : undefined" @click.stop="toggleMini"></v-app-bar-nav-icon>
    <v-app-bar-title><router-link to="/" style="color: inherit; text-decoration: none">{{ $STRINGS.APP_NAME }} Search</router-link></v-app-bar-title>
    <object style="margin-left:8px; display: inline-block; width: 38px;height: 38px;vertical-align: middle"
            v-if="$APP == 'mmseqs'"
            type="image/svg+xml"
            data="./assets/marv1.svg"
            aria-hidden="true">
        <img src="./assets/marv1.png" style="max-width:100%" />
    </object>
    <img v-if="$APP == 'foldseek'" src="./assets/marv-foldseek-small.png" style="margin-left:8px; display: inline-block; width: 48px;height: 48px;vertical-align: middle" aria-hidden="true" />

    <v-spacer></v-spacer>
    <v-toolbar-items v-once v-if="!$ELECTRON" class="hidden-sm-and-down">
        <v-btn text rel="external noopener" target="_blank"
               v-for="i in ($STRINGS.NAV_URL_COUNT - 0)" :key="i" :href="$STRINGS['NAV_URL_' + i]">{{ $STRINGS["NAV_TITLE_" + i]}}</v-btn>
    </v-toolbar-items>
</v-app-bar>

</div>
</template>

<script>
import History from './History.vue';

export default {
    components : { History },
    data: () => ({
        mini: true
    }),
    created() {
        this.$root.$on('multi', this.shouldExpand);
    },
    mounted() {
        // defeat https://github.com/vuetifyjs/vuetify/pull/14523
        Object.defineProperty(this.$refs.drawer._data, 'isMouseover', { get: () => { false } })
    },
    beforeDestroy() {
        this.$root.$off('multi', this.shouldExpand);
    },
    methods: {
        shouldExpand(expand) {
            this.mini = !expand;
        },
        toggleMini() {
            this.mini = !this.mini;
        },
        electronHandleTitleBarDoubleClick() {
            this.handleTitleBarDoubleClick();
        }
    }
}
</script>

<style scoped>
::v-deep .v-app-bar-title__content {
    text-overflow: revert !important;
}
::v-deep .theme--light.v-navigation-drawer {
    background-color: #f5f5f5;
    border-color: #f5f5f5;
    /* transition-duration: 0s !important; */
    /* transition-timing-function: linear; */
}

::v-deep .theme--dark.v-navigation-drawer {
    background-color: #212121;
    border-color: #212121;
}
</style>

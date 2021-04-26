<template>
<div>
<v-navigation-drawer stateless app permanent clipped :mini-variant.sync="mini">
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
<v-app-bar app :height="$ELECTRON ? '72px' : '48px'" fixed clipped-left :class="['ml-0', 'pl-3', $ELECTRON ? 'pt-2' : null]" :style="{'-webkit-app-region': $ELECTRON ? 'drag' : null, '-webkit-user-select': $ELECTRON ? 'none' : null}">
    <v-app-bar-nav-icon @click.stop="toggleMini"></v-app-bar-nav-icon>
    <v-app-bar-title><router-link to="/" style="color: inherit; text-decoration: none">MMseqs2 Search</router-link></v-app-bar-title>
    <object style="margin-left:8px; display: inline-block; width: 38px;height: 38px;vertical-align: middle" 
            type="image/svg+xml"
            data="./assets/marv1.svg"
            aria-hidden="true">
        <img src="./assets/marv1.png" style="max-width:100%" />
    </object>

    <v-spacer></v-spacer>
    <v-toolbar-items v-once v-if="!$ELECTRON" class="hidden-sm-and-down">
        <v-btn text rel="external noopener" target="_blank" href="https://mmseqs.com">MMseqs2</v-btn>
        <v-btn text rel="external noopener" target="_blank" href="https://github.com/soedinglab/MMseqs2-App">Github</v-btn>
        <v-btn text rel="external noopener" target="_blank" href="http://www.mpibpc.mpg.de/soeding">Södinglab</v-btn>
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
    beforeDestroy() {
        this.$root.$off('multi', this.shouldExpand);
    },
    methods: {
        shouldExpand(expand) {
            if (expand) {
                this.mini = false;
                this.$root.$emit('navigation-resize', this.mini);
            }
        },
        toggleMini() {
            this.mini = !this.mini;
            this.$root.$emit('navigation-resize', this.mini);
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

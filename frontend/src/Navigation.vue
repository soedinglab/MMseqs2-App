<template>
<div>
<v-navigation-drawer absolute app permanent clipped class="grey lighten-4" :mini-variant.sync="mini">
    <v-list class="grey lighten-4">
        <v-list-tile to="/search">
            <v-list-tile-action>
                <v-icon>search</v-icon>
            </v-list-tile-action>
            <v-list-tile-content>
                <v-list-tile-title>Search</v-list-tile-title>
            </v-list-tile-content>
        </v-list-tile>

        <router-view name="sidebar"></router-view>

        <history />

        <v-list-tile v-if="$ELECTRON" to="/preferences">
            <v-list-tile-action>
                <v-icon>settings</v-icon>
            </v-list-tile-action>
            <v-list-tile-content>
                <v-list-tile-title>Preferences</v-list-tile-title>
            </v-list-tile-content>
        </v-list-tile>
    </v-list>
</v-navigation-drawer>
<v-toolbar dense fixed clipped-left app class="ml-0 pl-3">
    <v-toolbar-side-icon @click.stop="mini = !mini"></v-toolbar-side-icon>
    <v-toolbar-title>MMseqs2 Search</v-toolbar-title>
    <object style="margin-left:8px; display: inline-block; width: 38px;height: 38px;vertical-align: middle" 
            type="image/svg+xml"
            data="./assets/marv1.svg"
            aria-hidden="true">
        <img src="./assets/marv1.png" style="max-width:100%" />
    </object>

    <v-spacer></v-spacer>
    <v-toolbar-items v-once v-if="!$ELECTRON" class="hidden-sm-and-down">
        <v-btn flat rel="external noopener" target="_blank" href="https://mmseqs.com">MMseqs2</v-btn>
        <v-btn flat rel="external noopener" target="_blank" href="https://github.com/soedinglab/mmseqs-webserver">Github</v-btn>
        <v-btn flat rel="external noopener" target="_blank" href="http://www.mpibpc.mpg.de/soeding">Södinglab</v-btn>
    </v-toolbar-items>
</v-toolbar>
</div>
</template>

<script>
import History from './History.vue';

export default {
    components : { History },
    data: () => ({
        mini: true
    })
}
</script>

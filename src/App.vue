<template>
    <v-app toolbar id="app">
        <v-navigation-drawer persistent clipped enable-resize-watcher class="grey lighten-4 pb-0" light app v-model="drawer">
            <navigation />
        </v-navigation-drawer>
        <v-toolbar dense fixed clipped-left app>
            <v-toolbar-title class="ml-0 pl-3">
                <v-toolbar-side-icon @click.stop="drawer = !drawer"></v-toolbar-side-icon>
                <object style="display: inline-block;width: 38px;height: 38px;vertical-align: middle;" 
                            type="image/svg+xml"
                            data="./assets/marv1.svg"
                            aria-hidden="true">
                        <img src="./assets/marv1.png" />
                    </object>
                MMseqs Search Server
            </v-toolbar-title>
                <v-spacer></v-spacer>
    <v-toolbar-side-icon class="hidden-md-and-up"></v-toolbar-side-icon>
    <v-toolbar-items v-if="!__ELECTRON__" class="hidden-sm-and-down">
      <v-btn flat rel="external noopener" target="_blank" href="https://mmseqs.com">MMseqs2</v-btn>
      <v-btn flat rel="external noopener" target="_blank" href="https://github.com/soedinglab/mmseqs-webserver">Github</v-btn>
      <v-btn flat rel="external noopener" target="_blank" href="http://www.mpibpc.mpg.de/soeding">Södinglab</v-btn>
    </v-toolbar-items>
        </v-toolbar>
        <main>
            <v-content>
                <v-container app fill-height>
                    <v-layout>
                        <router-view></router-view>
                    </v-layout>
                </v-container>
            </v-content>
        </main>
    </v-app>
</template>

<script>
import Navigation from './Navigation.vue';

export default {
    components: { Navigation },
    data: () => ({
        drawer: true,
    })
}
</script>
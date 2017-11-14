<template>
    <v-app toolbar id="app">
        <navigation />
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
}
</script>
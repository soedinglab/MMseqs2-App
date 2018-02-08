<template>
    <v-app toolbar id="app">
        <navigation />
        <v-content>
            <v-container app fill-height>
                <v-layout>
                    <router-view></router-view>
                </v-layout>
            </v-container>
        </v-content>
    </v-app>
</template>

<script>
import Navigation from './Navigation.vue';

export default {
    components: { Navigation },
}
</script>
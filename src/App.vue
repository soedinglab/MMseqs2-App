<template>
    <v-app toolbar id="app">
        <navigation />
        <v-content>
            <v-container app fill-height>
                <router-view></router-view>
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
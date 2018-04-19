<template>
    <v-app toolbar id="app">
        <navigation />
        <v-content>
            <router-view></router-view>
        </v-content>
    </v-app>
</template>

<script>
import Navigation from './Navigation.vue';

export default {
    components: { Navigation },
}
</script>
<template>
    <v-app id="app" :class="{'electron' : $ELECTRON}">
        <navigation />
        <v-main>
            <router-view />
        </v-main>
    </v-app>
</template>

<script>
import Navigation from './Navigation.vue';

export default {
    components: { Navigation }
}
</script>
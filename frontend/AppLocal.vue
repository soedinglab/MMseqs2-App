<template>
    <v-app id="app" :class="{'electron' : $ELECTRON}">
        <v-main>
            <MSALocal v-if="$APP === 'foldmason'" />
            <ResultLocal v-else />  
        </v-main>
    </v-app>
</template>

<script>
import ResultLocal from './ResultLocal.vue';
import MSALocal from './MSALocal.vue';

export default {
    components: { ResultLocal, MSALocal },
}
</script>
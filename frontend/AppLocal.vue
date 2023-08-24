<template>
    <v-app id="app" :class="{'electron' : $ELECTRON}">
        <v-main>
            <Result />  
        </v-main>
    </v-app>
</template>

<script>
import Result from './Result.vue';

export default {
    components: { Result },
}
</script>
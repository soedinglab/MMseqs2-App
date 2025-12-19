<template>
    <v-layout wrap>
        <v-flex xs12>
            <v-card rounded="0">
            <v-card-title primary-title class="pb-0 mb-0">
                <div class="text-h5 mb-0">Reference</div>
            </v-card-title>
            <v-card-title primary-title class="pt-0 mt-0">
                <p class="text-subtitle-2 mb-0" v-html="reference"></p>
            </v-card-title>
            </v-card>
            <div style="text-align: center; color: grey; margin-top: 0.9rem; font-size: 0.9rem;">
                The {{ $STRINGS.APP_NAME }} Server is proudly <a :href="$STRINGS.NAV_URL_1" style="text-decoration: none; color: darkgray">free and open-source software</a>.
            </div>
        </v-flex>
    </v-layout>
</template>

<script>
export default {
    name: "reference",
    props: {
        reference: {
            type: String,
            required: true
        }
    },
}
</script>

<style scoped>
.text-subtitle-2 {
    word-break: break-word;
}
</style>
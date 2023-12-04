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
        </v-flex>
    </v-layout>
</template>

<script>
export default {
    name: "reference",
    data: () => ({
        reference: null,
    }),
}
</script>
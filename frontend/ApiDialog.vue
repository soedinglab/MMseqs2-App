<template>
    <modal-dialog v-model="showCurl" :disabled="disabled" label="API" :icon="$MDI.API">
        <template v-slot:title>cURL Command</template>
        <template v-slot:text>
            {{ $STRINGS.CURL_INTRO }}
            <br>
            <code>curl -X POST -F q=@PATH_TO_FILE <span v-if="email">-F 'email={{email}}'</span> -F 'mode={{mode}}' <span v-for="(path, i) in database" :key="i">-F 'database[]={{ path }}' </span> {{ origin() + '/api/ticket' }}</code>
            <br>
            Refer to the <a href="https://search.mmseqs.com/docs/" target="_blank" rel="noopener">API documentation</a>, on how to check the status and fetch the result.
        </template>
    </modal-dialog>
</template>

<script>
import ModalDialog from "./ModalDialog.vue";

export default {
  name: 'ApiDialog',
  components: {
    ModalDialog
  },
  props: {
    disabled: {
      type: Boolean,
      default: false
    },
    email: {
      type: String,
      default: ''
    },
    mode: {
      type: String,
      default: ''
    },
    database: {
      type: Array,
      default: []
    }
  },
  data() {
    return {
      showCurl: false,
    };
  },
  methods: {
    origin() {
        return (
            window.location.protocol +
            "//" +
            window.location.hostname +
            (window.location.port ? ":" + window.location.port : "")
        );
    }
  }
};
</script>

<style scoped>
code {
    font-size: 0.8em;
}
</style>
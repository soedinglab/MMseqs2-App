<template>
    <modal-dialog v-model="showCurl" :disabled="disabled" label="API" :icon="$MDI.API">
        <template v-slot:title>API Command</template>
        <template v-slot:text>
            {{ $STRINGS.CURL_INTRO }}
            <br>
            <div class="mt-1 mb-1">
              <label>
                <input type="radio" value="curl" v-model="selectedClient" /> curl
              </label>
              <label>
                <input type="radio" value="python" v-model="selectedClient" /> Python
              </label>
            </div>
            <code v-if="selectedClient == 'curl'">
                curl -X POST \<br>
                &nbsp;&nbsp;-F q=@PATH_TO_FILE \<br>
                <span v-if="email">
                  &nbsp;&nbsp;-F 'email={{email}}' \<br>
                </span>
                <span v-if="mode">
                  &nbsp;&nbsp;-F 'mode={{mode}}' \<br>
                </span>
                <span v-if="taxfilter">
                  &nbsp;&nbsp;-F 'taxfilter={{taxfilter}}' \<br>
                </span>
                <span v-for="(path, i) in database" :key="i">
                  &nbsp;&nbsp;-F 'database[]={{ path }}'  \<br>
                </span>
                <span
                  v-for="(val, key) in $attrs"
                  :key="key"
                >
                &nbsp;&nbsp;-F '{{ key }}={{ val }}' \<br>
                </span>
                &nbsp;&nbsp;{{ origin() + '/api/ticket' + (suffix ? ('/' + suffix) : '') }}
              </code>
              <code v-else style="white-space: pre-wrap;">import requests

url = "{{ origin() + '/api/ticket' + (suffix ? ('/' + suffix) : '') }}"
file = "PATH_TO_FILE"
with open(file, "rb") as f:
    files = { "q": f }
    data = [
<span style="white-space: normal;">
<span v-if="email">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;("email", "{{ email }}"),<br></span>
<span v-if="mode">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;("mode", "{{ mode }}"),<br></span>
<span v-if="taxfilter">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;("taxfilter", "{{ taxfilter }}"),<br></span>
<span v-for="(path, i) in database" :key="`db-${i}`">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;("database[]", "{{ path }}"),<br></span>
<span v-for="(val, key) in $attrs" :key="key">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;("{{ key }}", "{{ val }}"),<br></span>
&nbsp;&nbsp;&nbsp;&nbsp;]</span>
    response = requests.post(url, files=files, data=data)
    print(response.status_code)
    print(response.json())</code>
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
  inheritAttrs: false,
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
    },
    taxfilter: {
      type: String,
      default: ''
    },
    suffix: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      showCurl: false,
      selectedClient: 'curl'
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
    display: block;
}
</style>
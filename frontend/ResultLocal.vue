<template>
    <div>
        <v-app-bar app :height="'48px'" fixed clipped-left>
            <img height="28px" src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbDpzcGFjZT0icHJlc2VydmUiIHN0eWxlPSJmaWxsLXJ1bGU6ZXZlbm9kZDtjbGlwLXJ1bGU6ZXZlbm9kZDtzdHJva2UtbGluZWNhcDpyb3VuZDtzdHJva2UtbGluZWpvaW46cm91bmQ7c3Ryb2tlLW1pdGVybGltaXQ6MTAiIHZpZXdCb3g9IjAgMCA0NjggMzA2Ij48cGF0aCBkPSJNMzcyIDIwMnMxNC0xIDM3LTE5YzIzLTE3IDQwLTQ5IDU1LTU1bC0xMTQgMjQtNCAzMiAyNiAxOFoiIHN0eWxlPSJmaWxsOiNmN2QxOGE7ZmlsbC1ydWxlOm5vbnplcm87c3Ryb2tlOiMwMDA7c3Ryb2tlLXdpZHRoOjQuNDhweCIvPjxwYXRoIGQ9Ik02MiAxMzlTODcgMjEgMjY5IDJsMSAxLTQ2IDYxcy00MC0zLTU1IDdjMCAwIDE5LTEzIDY5LTRzNTAtMjAgNTAtMjAgOCAyMiAwIDI5bDI5IDE0LTE4IDRzMTI1LTEyIDE2NyAzM2MwIDAtMjYgMTctNjAgMjAtNTYgNS02MiAyMi02MiAyMnMyNS0xMCA0MyA0bC0yMiA5czE1IDggMTUgMjNsLTI2IDEwczM2LTE4IDUyLTdsLTI0IDE4czIzIDMgMzggMTVsLTMyIDhzMTUgMiAyNyAzMWwtNDUtNnM3IDkgNCAzMGwtMjUtMjJzLTE3IDQ2LTE1OCAyQzQ5IDI0MCA1NiAyMjEgNTAgMTkxbC0yNi0xczItMTUgMTgtMjFMMiAxNDJzMjQtMTMgNDItOGwtOC0yNXMyOSAxMSAyNiAzMFoiIHN0eWxlPSJmaWxsOiNlMTMyMTM7ZmlsbC1ydWxlOm5vbnplcm87c3Ryb2tlOiMwMDA7c3Ryb2tlLXdpZHRoOjQuNDhweCIvPjxwYXRoIGQ9Ik0xMDEgMjUzYy00Ni0yMyA4LTEzNCAzNy0xNTEgMjgtMTYgNTcgNyA2MyAxOSAwIDAgMjMtMTggNTctN3M0OSA0NyAzNiAxMTVjLTggNDEtMjQgNTgtMzUgNjUtNyA0LTE0IDUtMjEgMy0yNS02LTEwNS0yNy0xMzctNDRaIiBzdHlsZT0iZmlsbDojZjdkMThhO2ZpbGwtcnVsZTpub256ZXJvO3N0cm9rZTojMDAwO3N0cm9rZS13aWR0aDo0LjQ4cHgiLz48cGF0aCBkPSJNMTM2IDExMnMtNDEtMTAtNTYgMThjLTE1IDI3IDEyIDM4IDI3IDQzIDE2IDQgNDcgNCA1Ny0xM3MtMS0zOC0yOC00OFoiIHN0eWxlPSJmaWxsOiNmZmY7ZmlsbC1ydWxlOm5vbnplcm87c3Ryb2tlOiMwMDA7c3Ryb2tlLXdpZHRoOjQuNDhweCIvPjxwYXRoIGQ9Ik0xMTYgMTYwYzE2IDggMzQtMzcgMjAtNDQtMTQtNi00MCAzNS0yMCA0NFoiIHN0eWxlPSJmaWxsLXJ1bGU6bm9uemVybztzdHJva2U6IzAwMDtzdHJva2Utd2lkdGg6NC40OHB4Ii8+PHBhdGggZD0iTTI4NCAxNDhjLTQxLTE1LTU5IDUtNjUgMjJzMiA0NCA0MiA1MyA1MC00IDU2LTE5YzUtMTYgNi00MS0zMy01NloiIHN0eWxlPSJmaWxsOiNmZmY7ZmlsbC1ydWxlOm5vbnplcm87c3Ryb2tlOiMwMDA7c3Ryb2tlLXdpZHRoOjQuNDhweCIvPjxwYXRoIGQ9Ik0yNDggMTk5YzE5IDkgNDctNDEgMjMtNTJzLTQzIDQzLTIzIDUyWm0tODUtMTVjMS04IDIwLTEgMjAgNSAwIDctOSA4LTEyIDctNC0xLTktNi04LTEyWiIgc3R5bGU9ImZpbGwtcnVsZTpub256ZXJvO3N0cm9rZTojMDAwO3N0cm9rZS13aWR0aDo0LjQ4cHgiLz48cGF0aCBkPSJNMTMyIDEyMGM3IDMtMiAxNS02IDEyczMtMTQgNi0xMlptMTI4IDMwYzcgMy0yIDE1LTYgMTItNC0yIDMtMTQgNi0xMloiIHN0eWxlPSJmaWxsOiNmZmY7ZmlsbC1ydWxlOm5vbnplcm8iLz48cGF0aCBkPSJtMTE1IDIxMiA5LTRzLTggNyAwIDEzYzggNyAyNS00IDQ2LTEgMjEgNCA0MCAxOSA1NSAyMSAxNiAzIDI0IDEgMjMtNC0xLTYgNSA3IDUgNyIgc3R5bGU9ImZpbGw6bm9uZTtmaWxsLXJ1bGU6bm9uemVybztzdHJva2U6IzAwMDtzdHJva2Utd2lkdGg6NC40OHB4Ii8+PC9zdmc+" />
            &nbsp;
            <v-app-bar-title class="ml-2">{{ $STRINGS.APP_NAME }} Search</v-app-bar-title>
            <v-spacer />
            <v-file-input
                id="uploadData"
                class="shrink"
                type="file"
                accept="application/json"
                placeholder="Load JSON data file"
                style="position: relative; top: 30%;"
                @change="uploadData" 
                single-line
                outlined
                filled
                flat
                dense
            />
            <v-toolbar-items>
                <v-btn text @click="downloadData">
                    <v-icon>
                        {{ $MDI.FileDownloadOutline }}
                    </v-icon>
                </v-btn>
                <v-btn text rel="external noopener" target="_blank" class="hidden-sm-and-down"
                       v-for="i in ($STRINGS.NAV_URL_COUNT - 0)" :key="i" :href="$STRINGS['NAV_URL_' + i]">{{ $STRINGS["NAV_TITLE_" + i]}}</v-btn>
            </v-toolbar-items>
        </v-app-bar>
        <v-tabs v-if="hits" center-active grow style="margin-bottom: 1em" show-arrows>
            <v-tab v-for="(entry, index) in hits" :key="entry.query.header" @click="changeResult(index)">
                {{ entry.query.header }} ({{ entry.results[0].alignments ? entry.results[0].alignments.length : 0 }})
            </v-tab>
        </v-tabs>
        <ResultView
            v-if="hits"
            :key="currentIndex"
            :ticket="ticket"
            :error="error"
            :mode="mode"
            :hits="currentResult"
            :selectedDatabases="selectedDatabases"
            :tableMode="tableMode"
        />
        <v-container grid-list-md fluid pa-2 v-else>
            <v-layout wrap>
                <v-flex xs12>
                    <v-card rounded="0">
                        <v-card-title primary-title class="mb-0 pa-4">
                            No data loaded
                        </v-card-title>
                    </v-card>
                </v-flex>
            </v-layout>
        </v-container>
        <v-container grid-list-md fluid pa-2>
            <v-layout wrap>
                <v-flex xs12>
                    <v-card rounded="0">
                    <v-card-title primary-title class="pb-0 mb-0">
                        <div class="text-h5 mb-0">Reference</div>
                    </v-card-title>
                    <v-card-title primary-title class="pt-0 mt-0">
                        <p class="text-subtitle-2 mb-0" v-html="$STRINGS.CITATION"></p>
                    </v-card-title>
                    </v-card>
                </v-flex>
            </v-layout>
        </v-container>
    </div>
</template>

<script>
import { parseResultsList, download, dateTime } from './Utilities.js';
import ResultMixin from './ResultMixin.vue';
import ResultView from './ResultView.vue';
import Navigation from './Navigation.vue';

export default {
    name: 'result',
    mixins: [ResultMixin],
    components: { ResultView, Navigation },
    data() {
        return {
            currentIndex: 0
        };
    },
    mounted() {
        document.onreadystatechange = () => {
            if (document.readyState == "complete") {
                let div = document.getElementById("data");
                if (!div) {
                    return null;
                }
                let data = JSON.parse(div.textContent);
                this.fetchData(data);
            }
        }
    },
    computed: {
        currentResult() {
            if (this.hits === null)
                return null;
            return this.hits[this.currentIndex];
        },
        currentQuery() {
            if (this.hits === null)
                return "";
            return this.hits[this.currentIndex].query.header;
        }
    },
    methods: {
        changeResult(newRes) {
            this.currentIndex = newRes;
            this.setColorScheme();
        },
        uploadData(file) {
            if (!file) {
                return;
            }
            let fr = new FileReader();
            fr.addEventListener(
                "load",
                (e) => {
                    let data = JSON.parse(e.target.result);
                    this.fetchData(data);
                }
            );
            fr.readAsText(file)
        },
        downloadData() {
            if (!this.hits) {
                return null;
            }
            download(this.hits, `Foldseek-${dateTime()}.json`);
        },
        resetProperties() {
            this.ticket = "";
            this.error = "";
            this.mode = "";
            this.hits = null;
            this.selectedDatabases = 0;
            this.tableMode = 0;
        },
        fetchData(data) {
            this.resetProperties();
            this.hits = parseResultsList(data);
        }
    }
};
</script>

<style scoped>
::v-deep .v-app-bar-title__content {
    text-overflow: revert !important;
}
</style>
<style>
.theme--light .panel-root .v-toolbar {
    background-color: #454545 !important;
}

.theme--dark .panel-root .v-toolbar {
    background-color: #1e1e1e !important;
}
</style>
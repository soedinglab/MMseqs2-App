<template>
<div>
<v-navigation-drawer v-if="!$LOCAL" stateless app permanent clipped :mini-variant="mini" :expand-on-hover="false" ref="drawer">
    <v-list v-if="!$LOCAL">
        <v-list-item to="/search">
            <v-list-item-action>
                <v-icon>{{ $APP == 'mmseqs' ? $MDI.Magnify : $MDI.Monomer }}</v-icon>
            </v-list-item-action>
            <v-list-item-content>
                <v-list-item-title>Search</v-list-item-title>
            </v-list-item-content>
        </v-list-item>
        <v-list-item to="/multimer" v-if="$APP == 'foldseek'">
            <v-list-item-action>
                <v-icon>{{ $MDI.Multimer }}</v-icon>
            </v-list-item-action>
            <v-list-item-content>
                <v-list-item-title>Multimer search</v-list-item-title>
            </v-list-item-content>
        </v-list-item>
        <v-list-item to="/foldmason" v-if="$APP == 'foldseek'">
            <v-list-item-action>
                <v-icon>{{ $MDI.Wall }}</v-icon>
            </v-list-item-action>
            <v-list-item-content>
                <v-list-item-title>FoldMason MSA</v-list-item-title>
            </v-list-item-content>
        </v-list-item>
      
        <v-list-group v-if="$route.name === 'result'" v-model="expanded">
            <template slot="activator">
                <v-list-item-action>
                    <v-icon>{{ $MDI.FileDownloadOutline }}</v-icon>
                </v-list-item-action>
                <v-list-item-content>
                    <v-list-item-title>Downloads</v-list-item-title>
                </v-list-item-content>
            </template>
            
            <template v-if="!this.mini">
            <v-list-item
                @click="$ELECTRON ? electronDownload($route.params.ticket) : null"
                :href="$ELECTRON ? null : url('api/result/download/' + $route.params.ticket)"
                :target="$ELECTRON ? null : '_blank'"
                title="Download hit tables (M8 files)"
            >
                <v-list-item-action>
                    <v-icon>{{ $ELECTRON ? $MDI.FileDownloadOutline : $MDI.TableLarge }}</v-icon>
                </v-list-item-action>
                <v-list-item-content>
                    <v-list-item-title>Hit tables</v-list-item-title>
                    <v-list-item-subtitle>Archive of M8 files</v-list-item-subtitle>
                </v-list-item-content>
            </v-list-item>
            <v-list-item
                @click="downloadJSON"
                style="padding-left: 16px;"
                title="Download all result data (JSON file)"
            >
                <v-list-item-action>
                    <v-icon>{{ $MDI.ApplicationBracesOutline }}</v-icon>
                </v-list-item-action>
                <v-list-item-content>
                    <v-list-item-title>All data</v-list-item-title>
                    <v-list-item-subtitle>Reloadable JSON file</v-list-item-subtitle>
                </v-list-item-content>
            </v-list-item>
            </template>
        </v-list-group>
        <v-list-group v-else-if="$route.name === 'foldmasonresult'" v-model="expanded">
            <template slot="activator">
                <v-list-item-action>
                    <v-icon>{{ $MDI.FileDownloadOutline }}</v-icon>
                </v-list-item-action>
                <v-list-item-content>
                    <v-list-item-title>Downloads</v-list-item-title>
                </v-list-item-content>
            </template>
            <template v-if="!this.mini">
            <v-list-item
                @click="downloadMSA"
                style="padding-left: 16px;"
                title="Download MSTAs (FASTA files)"
            >
                <v-list-item-action>
                    <v-icon>{{ $MDI.TextBoxOutline }}</v-icon>
                </v-list-item-action>
                <v-list-item-content>
                    <v-list-item-title>MSTA</v-list-item-title>
                    <v-list-item-subtitle>.fasta file</v-list-item-subtitle>
                </v-list-item-content>
            </v-list-item>
            <v-list-item
                @click="downloadJSON"
                style="padding-left: 16px;"
                title="Download all result data (JSON file)"
            >
                <v-list-item-action>
                    <v-icon>{{ $MDI.ApplicationBracesOutline }}</v-icon>
                </v-list-item-action>
                <v-list-item-content>
                    <v-list-item-title>All data</v-list-item-title>
                    <v-list-item-subtitle>Reloadable JSON file</v-list-item-subtitle>
                </v-list-item-content>
            </v-list-item>
            </template>
        </v-list-group>

        <v-divider></v-divider>

        <router-view name="sidebar"></router-view>
        <history v-if="!$LOCAL" />

        <v-list-item v-if="$ELECTRON" to="/preferences">
            <v-list-item-action>
                <v-icon>{{ $MDI.Tune }}</v-icon>
            </v-list-item-action>
            <v-list-item-content>
                <v-list-item-title>Preferences</v-list-item-title>
            </v-list-item-content>
        </v-list-item>
    </v-list>
</v-navigation-drawer>
<v-app-bar v-on:dblclick.native="electronHandleTitleBarDoubleClick()" app :height="$ELECTRON ? '72px' : '48px'" fixed clipped-left :class="['ml-0', 'pl-3', $ELECTRON ? 'pt-2' : null]" :style="{'-webkit-app-region': $ELECTRON ? 'drag' : null, '-webkit-user-select': $ELECTRON ? 'none' : null}">
    <v-app-bar-nav-icon v-if="!$LOCAL" :input-value="!mini ? 'activated' : undefined" @click.stop="toggleMini"></v-app-bar-nav-icon>
    <v-app-bar-title>
        <router-link v-if="!$LOCAL" to="/" style="color: inherit; text-decoration: none">{{ $STRINGS.APP_NAME }} Search</router-link>
        <span v-if="$LOCAL">{{ $STRINGS.APP_NAME }} Search</span>
    </v-app-bar-title>
    <object style="margin-left:8px; display: inline-block; width: 38px;height: 38px;vertical-align: middle"
            v-if="$APP == 'mmseqs'"
            type="image/svg+xml"
            data="./assets/marv1.svg"
            aria-hidden="true">
        <img src="./assets/marv1.png" style="max-width:100%" />
    </object>
    <img v-if="$APP == 'foldseek'" src="./assets/marv-foldseek-small.png" style="margin-left:8px; display: inline-block; width: 48px;height: 48px;vertical-align: middle" aria-hidden="true" />

    <v-spacer></v-spacer>
    <v-toolbar-items v-once v-if="!$ELECTRON" class="hidden-sm-and-down">
        <v-btn text rel="external noopener" target="_blank"
               v-for="i in ($STRINGS.NAV_URL_COUNT - 0)" :key="i" :href="$STRINGS['NAV_URL_' + i]">{{ $STRINGS["NAV_TITLE_" + i]}}</v-btn>
    </v-toolbar-items>
</v-app-bar>

</div>
</template>

<script>
import buildFullPath from 'axios/lib/core/buildFullPath.js'
import { parseResultsList, download, djb2 } from './Utilities';
import History from './History.vue';

export default {
    components : { History, },
    data: () => ({
        mini: true,
        expanded: false
    }),
    created() {
        this.$root.$on('multi', this.shouldExpand);
    },
    mounted() {
        // defeat https://github.com/vuetifyjs/vuetify/pull/14523
        if (!__LOCAL__) Object.defineProperty(this.$refs.drawer._data, 'isMouseover', { get: () => { false } });
    },
    beforeDestroy() {
        this.$root.$off('multi', this.shouldExpand);
    },
    watch: {
        expanded: function(event) {
            this.$root.$emit('multi', event);
        }
    },
    methods: {
        url(url) {
            // workaround was fixed in axios git, remove when axios is updated
            const fullUrl = buildFullPath(this.$axios.defaults.baseURL, url);
            return this.$axios.getUri({ url: fullUrl })
        },
        electronDownload(ticket) {
            this.saveResult(ticket);
        },
        log(message) {
            console.log(message);
            return message;
        },
        shouldExpand(expand) {
            if (expand)
                this.mini = !expand;
        },
        toggleMini() {
            this.mini = !this.mini;
        },
        electronHandleTitleBarDoubleClick() {
            this.handleTitleBarDoubleClick();
        },
        uploadJSON() {
            let file = this.$refs.upload.files[0];
            let hash = djb2(file.name);
            let fr = new FileReader();
            fr.addEventListener(
                "load",
                (e) => {
                    let data = parseResultsList(JSON.parse(e.target.result));
                    this.$root.userData = data;
                    this.$router.push({ name: 'result', params: { ticket: `user-${hash}`, entry: 0 }}).catch(error => {});
                }
            );
            fr.readAsText(file)
        },
        downloadJSON() {
            this.$root.$emit("downloadJSON");
        },
        downloadMSA() {
            this.$root.$emit("downloadMSA");
        }
    }
}
</script>

<style scoped>
::v-deep .v-app-bar-title__content {
    text-overflow: revert !important;
}
::v-deep .theme--light.v-navigation-drawer {
    background-color: #f5f5f5;
    border-color: #f5f5f5;
    /* transition-duration: 0s !important; */
    /* transition-timing-function: linear; */
}

::v-deep .theme--dark.v-navigation-drawer {
    background-color: #212121;
    border-color: #212121;
}
</style>

<template>
    <v-list-group v-if="items && items.length > 0" v-model="drawer" no-action :prepend-icon="$MDI.History">
        <template slot="activator">
            <v-list-item-content>
                <v-list-item-title>
                    History
                </v-list-item-title>
                <v-list-item-subtitle v-if="drawer" class="ml-n1" @click.stop>
                    <button :style="{'opacity' : page == 0 ? 0.6 : 1}" @click.stop="previous();"><v-icon style="transform:inherit">{{ $MDI.ChevronLeft }}</v-icon></button>
                    <button :style="{'opacity' : (page + 1) * limit >= items.length ? 0.6 : 1}"  @click.stop="next();"><v-icon style="transform:inherit">{{ $MDI.ChevronRight }}</v-icon></button>
                </v-list-item-subtitle>
            </v-list-item-content>
        </template>

        <div v-for="child in items.slice(page * limit, (page + 1) * limit)" :key="child.id" class="history-row">
            <v-list-item :class="{ 'list__item--highlighted': child.id == current }" :to="formattedRoute(child)" style="padding-left: 16px;">
                <v-list-item-icon>
                    <history-avatar v-if="jobStatus(child.id) == 'COMPLETE' && drawableType(child.id)"
                        :hash="child.id" :type="drawableType(child.id)" />
                    <identicon v-else-if="jobStatus(child.id) == 'COMPLETE'" :hash="child.id" :size="32"></identicon>
                    <v-icon :size="32" v-else-if="jobStatus(child.id) == 'RUNNING'">{{ $MDI.ClockOutline }}</v-icon>
                    <v-icon :size="32" v-else-if="jobStatus(child.id) == 'PENDING'">{{ $MDI.ClockOutline }}</v-icon>
                    <v-icon :size="32" v-else>{{ $MDI.HelpCircleOutline }}</v-icon>
                </v-list-item-icon>
                <v-list-item-content>
                    <v-list-item-title>
                        {{ formattedDate(child.time) }}
                    </v-list-item-title>
                    <v-list-item-subtitle><span class="mono">{{ jobName(child.id) || child.id }}</span></v-list-item-subtitle>
                </v-list-item-content>
            </v-list-item>
            <!-- Floats over the row, outside the list-item's grid entirely. -->
            <v-btn icon x-small class="history-delete-btn" title="Remove from history"
                @click.stop.prevent="askDelete(child)">
                <v-icon small>{{ $MDI.Close }}</v-icon>
            </v-btn>
        </div>

        <portal>
            <v-dialog v-model="deleteDialog" width="480px">
                <v-card v-if="pendingDelete">
                    <v-card-title>Remove this job from history?</v-card-title>
                    <v-card-text>
                        <span class="mono primary--text">{{ jobName(pendingDelete.id) || pendingDelete.id }}</span>
                        will be removed from your history.<br>
                        <strong>This cannot be undone.</strong>
                    </v-card-text>
                    <v-card-actions>
                        <v-spacer></v-spacer>
                        <v-btn color="primary" text @click="cancelDelete">Cancel</v-btn>
                        <v-btn color="error" text @click="performDelete">Delete</v-btn>
                    </v-card-actions>
                </v-card>
            </v-dialog>
        </portal>
    </v-list-group>
</template>

<script>
import Identicon from './Identicon.vue';
import HistoryAvatar from './HistoryAvatar.vue';
import { convertToQueryUrl } from './lib/convertToQueryUrl';
import {
    migrateHistoryStorage,
    readHistory,
    upsertHistoryItem,
    removeHistoryItem,
    getJobName,
    removeJobName,
    getJobType,
    setJobType,
    removeJobType,
    isTerminalStatus,
    getJobStatus,
    setJobStatus,
    removeJobStatus,
} from './lib/HistoryMixin';
import { RAW_TYPE, pathForTicket } from './lib/ticketRoute.js';


export default {
    components: { Identicon, HistoryAvatar },
    data: () => ({
        current: "",
        drawer: false,
        error: false,
        items: [],
        page: 0,
        limit: 7,
        deleteDialog: false,
        pendingDelete: null,
    }),
    beforeDestroy() {
        if (this._pollTimer) {
            clearTimeout(this._pollTimer);
        }
    },
    created() {
        migrateHistoryStorage();
        this._typeFetches = new Set();
        this._statusFetch = false;
        this.loadList();
        this.fetchWindow();
    },
    watch: {
        '$route': function(to, from) {
            if (from.path != to.path) {
                this.loadList();
                this.fetchWindow();
            }
        },
        page() {
            this.fetchWindow();
        },
        drawer: function (val) {
            if (val == true) {
                this.$root.$emit('multi', true);
                this.fetchWindow();
            }
        }
    },
    methods: {
        previous() {
            if (this.page == 0) {
                return;
            }
            this.page -= 1;
        },
        next() {
            if ((this.page + 1) * this.limit >= this.items.length) {
                return;
            }
            this.page += 1;
        },
        loadList() {
            this.current = this.$route.params.ticket;
            this._verifiedCurrent = null;

            const items = [];
            for (const it of readHistory()) {
                if (!it || !it.id || it.id.startsWith("user")) {
                    continue;
                }
                items.push({ id: it.id, time: it.time });
            }

            // The job currently being viewed should always be listed (and remembered).
            if (this.current && !this.current.startsWith('user-')
                && !items.some(i => i.id == this.current)) {
                upsertHistoryItem(this.current, { time: +(new Date()) });
                items.unshift({ id: this.current, time: +(new Date()) });
            }

            items.sort((a, b) => (b.time || 0) - (a.time || 0));
            this.items = items;
        },
        // Ids visible in the current page +/- one page (the lazy-load window).
        windowIds() {
            const start = Math.max(0, (this.page - 1) * this.limit);
            const end = (this.page + 2) * this.limit;
            return this.items.slice(start, end)
                .map(i => i.id)
                .filter(id => !id.startsWith("user"));
        },
        // Lazily fetch status (and then type) for just the visible window.
        fetchWindow() {
            const ids = this.windowIds();
            if (ids.length == 0) {
                return;
            }
            this.fetchWindowTypes(ids);

            const toFetch = ids.filter(id => !isTerminalStatus(getJobStatus(id)));

            if (this.current && !this.current.startsWith('user-')
                && this._verifiedCurrent != this.current && !toFetch.includes(this.current)) {
                toFetch.push(this.current);
            }

            if (toFetch.length == 0 || this._statusFetch) {
                return;
            }
            this._statusFetch = true;
            this.error = false;
            this.$axios.post('api/tickets', convertToQueryUrl({ tickets: toFetch })).then(
                (response) => {
                    const data = response.data;
                    let hasPending = false;
                    const seen = {};
                    for (const t of data) {
                        setJobStatus(t.id, t.status);
                        seen[t.id] = true;
                        if (t.status == "PENDING" || t.status == "RUNNING") {
                            hasPending = true;
                        }
                    }
                    for (const id of toFetch) {
                        if (!seen[id]) {
                            setJobStatus(id, "UNKNOWN");
                        }
                    }
                    this._verifiedCurrent = this.current;
                    this.fetchWindowTypes(ids);
                    if (hasPending) {
                        if (this._pollTimer) {
                            clearTimeout(this._pollTimer);
                        }
                        this._pollTimer = setTimeout(() => this.fetchWindow(), 5000);
                    }
                }, () => {
                    this.error = true;
                })
                // Cleared on failure too, so a 503 is retried on the next trigger.
                .then(() => { this._statusFetch = false; });
        },
        // Resolve + cache the job type for window items that are COMPLETE and
        // whose type is not already known (from type_map or a prior fetch).
        fetchWindowTypes(ids) {
            for (const id of ids) {
                if (getJobStatus(id) != "COMPLETE" || getJobType(id) || this._typeFetches.has(id)) {
                    continue;
                }
                this._typeFetches.add(id);
                this.$axios.get("api/ticket/type/" + id).then(
                    // The store normalises and decides what is cacheable, so the raw response
                    // goes straight in.
                    (response) => setJobType(id, response.data.type),
                    () => {})
                    // Cleared on failure too: a 503 should be retryable on the next trigger.
                    .then(() => this._typeFetches.delete(id));
            }
        },
        formattedRoute(element) {
            // Unresolved or incomplete jobs fall through to /queue, which redirects once the
            // type is known — see lib/ticketRoute.js.
            const known = getJobStatus(element.id) == 'COMPLETE' ? getJobType(element.id) : null;
            return pathForTicket(element.id, known);
        },
        formattedDate(timestamp) {
            const date = new Date(timestamp);

            var month = date.getMonth() + 1;
            var day = date.getDate();
            var hour = date.getHours();
            var min = date.getMinutes();

            month = (month < 10 ? "0" : "") + month;
            day = (day < 10 ? "0" : "") + day;
            hour = (hour < 10 ? "0" : "") + hour;
            min = (min < 10 ? "0" : "") + min;

            const str = date.getFullYear() + "-" + month + "-" + day + " " + hour + ":" + min;

            return str;
        },
        jobName(id) {
            return getJobName(id);
        },
        jobStatus(id) {
            return getJobStatus(id);
        },
        drawableType(id) {
            const type = getJobType(id);
            return type && type !== RAW_TYPE ? type : "";
        },
        askDelete(child) {
            this.pendingDelete = child;
            this.deleteDialog = true;
        },
        cancelDelete() {
            this.deleteDialog = false;
            this.pendingDelete = null;
        },
        performDelete() {
            const item = this.pendingDelete;
            if (item) {
                removeHistoryItem(item.id);
                removeJobName(item.id);
                removeJobType(item.id);

                const idx = this.items.findIndex(v => v.id == item.id);
                if (idx != -1) {
                    this.items.splice(idx, 1);
                }
                removeJobStatus(item.id);

                // If the current page is now past the end, step back onto a real page.
                const maxPage = Math.max(0, Math.ceil(this.items.length / this.limit) - 1);
                if (this.page > maxPage) {
                    this.page = maxPage;
                }
            }
            this.deleteDialog = false;
            this.pendingDelete = null;
        }
    },
    computed: {
    }
}
</script>

<style scoped>
/* The remove (x) button lives outside the v-list-item (a sibling in the
   .history-row wrapper), so it is not part of the row's grid at all. It floats
   over the row's top-right corner and only appears while the row is hovered
   (or the button itself is keyboard-focused). */
.history-row {
    position: relative;
}
.history-delete-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    z-index: 2;
    opacity: 0;
    transition: opacity 0.2s ease;
}
.history-row:hover .history-delete-btn,
.history-delete-btn:focus,
.history-delete-btn:focus-within {
    opacity: 1;
}
/* Error-red only while the button itself is hovered/focused: the x glyph... */
.history-delete-btn:hover .v-icon,
.history-delete-btn:focus .v-icon {
    color: #FF5252;
}
/* ...and the circular hover/focus overlay behind it. */
.history-delete-btn:hover::before,
.history-delete-btn:focus::before {
    background-color: #FF5252;
    opacity: 0.18;
}

/* Vertically center the avatar and tighten the gap to the text: Vuetify's
   defaults (align-self: flex-start; margin-right: 32px) leave the avatar
   top-aligned and eat width, over-truncating the job name in this narrow list. */
.history-row ::v-deep .v-list-item__icon {
    align-self: center;
    /* !important to beat Vuetify's .v-list-item__icon:first-child { margin-right: 32px }. */
    margin: 0 16px 0 0 !important;
}
</style>

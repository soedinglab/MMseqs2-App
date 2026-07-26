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
                    <history-avatar v-if="statuses[child.id] == 'COMPLETE' && types[child.id] && types[child.id] !== 'raw'"
                        :hash="child.id" :type="types[child.id]" />
                    <identicon v-else-if="statuses[child.id] == 'COMPLETE'" :hash="child.id" :size="32"></identicon>
                    <v-icon :size="32" v-else-if="statuses[child.id] == 'RUNNING'">{{ $MDI.ClockOutline }}</v-icon>
                    <v-icon :size="32" v-else-if="statuses[child.id] == 'PENDING'">{{ $MDI.ClockOutline }}</v-icon>
                    <v-icon :size="32" v-else>{{ $MDI.HelpCircleOutline }}</v-icon>
                </v-list-item-icon>
                <v-list-item-content>
                    <v-list-item-title>
                        {{ formattedDate(child.time) }}
                    </v-list-item-title>
                    <v-list-item-subtitle><span class="mono">{{ child.name ? child.name : child.id }}</span></v-list-item-subtitle>
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
                        <span class="mono primary--text">{{ pendingDelete.name ? pendingDelete.name : pendingDelete.id }}</span>
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
    readNameMap,
    removeJobName,
    readTypeMap,
    setJobType,
    removeJobType,
} from './lib/HistoryMixin';
import emitter from './lib/emitter'

// Sentinel for a COMPLETE job whose backend type is not one we render a
// dedicated avatar for. It is stored so the type is treated as "resolved"
// (never re-fetched); such jobs fall back to the generic identicon.
const RAW_TYPE = 'raw';

// Map a backend job type onto the UI type used for the avatar and routing.
function normalizeJobType(type) {
    switch (type) {
        case "search":
        case "structuresearch":
            return 'structure';
        case "interfacesearch":
            return 'interface';
        case "complexsearch":
            return 'complex';
        case "foldmasoneasymsa":
            return 'msa';
        case "folddisco":
            return 'motif';
        default:
            return RAW_TYPE;
    }
}

// Status values that never change again, so we don't re-poll them.
const TERMINAL_STATUS = { COMPLETE: true, ERROR: true };

export default {
    components: { Identicon, HistoryAvatar },
    data: () => ({
        current: "",
        drawer: false,
        error: false,
        items: [],
        page: 0,
        limit: 7,
        types: {},
        statuses: {},
        deleteDialog: false,
        pendingDelete: null,
    }),
    mounted() {
        this.refreshJobName = this.refreshJobName.bind(this)
        emitter.on('refresh-job-name', this.refreshJobName)
    },
    beforeDestroy() {
        emitter.off('refresh-job-name', this.refreshJobName)
        if (this._pollTimer) {
            clearTimeout(this._pollTimer);
        }
    },
    created() {
        migrateHistoryStorage();
        // Resolved job types are cached permanently, so hydrate from localStorage
        // and never re-fetch a type we already know.
        this.types = readTypeMap();
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
        // Build the full list straight from localStorage (no network). This is
        // the source of truth and drives pagination; per-item status/type are
        // enriched lazily for the visible window only.
        loadList() {
            this.current = this.$route.params.ticket;

            // Parse name_map once and index it by id, rather than re-parsing per item.
            const names = {};
            for (const e of readNameMap()) {
                names[e.id] = e.name;
            }

            const items = [];
            for (const it of readHistory()) {
                if (!it || !it.id || it.id.startsWith("user")) {
                    continue;
                }
                items.push({ id: it.id, time: it.time, name: names[it.id] || "" });
            }

            // The job currently being viewed should always be listed (and remembered).
            if (this.current && !this.current.startsWith('user-')
                && !items.some(i => i.id == this.current)) {
                upsertHistoryItem(this.current, { time: +(new Date()) });
                items.unshift({ id: this.current, time: +(new Date()), name: names[this.current] || "" });
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
            // Only (re)query ids that are not already in a terminal state.
            const toFetch = ids.filter(id => !TERMINAL_STATUS[this.statuses[id]]);
            if (toFetch.length == 0) {
                this.fetchWindowTypes(ids);
                return;
            }
            this.error = false;
            this.$axios.post('api/tickets', convertToQueryUrl({ tickets: toFetch })).then(
                (response) => {
                    const data = response.data;
                    let hasPending = false;
                    // Match by Ticket.Id: MultiStatus skips invalid ids, so the
                    // response array is NOT positionally aligned with the request.
                    const seen = {};
                    for (const t of data) {
                        this.$set(this.statuses, t.id, t.status);
                        seen[t.id] = true;
                        if (t.status == "PENDING" || t.status == "RUNNING") {
                            hasPending = true;
                        }
                    }
                    // Ids the server did not return are unknown/expired jobs.
                    for (const id of toFetch) {
                        if (!seen[id]) {
                            this.$set(this.statuses, id, "UNKNOWN");
                        }
                    }
                    this.fetchWindowTypes(ids);
                    if (hasPending) {
                        if (this._pollTimer) {
                            clearTimeout(this._pollTimer);
                        }
                        this._pollTimer = setTimeout(() => this.fetchWindow(), 5000);
                    }
                }, () => {
                    this.error = true;
                });
        },
        // Resolve + cache the job type for window items that are COMPLETE and
        // whose type is not already known (from type_map or a prior fetch).
        fetchWindowTypes(ids) {
            for (const id of ids) {
                if (this.statuses[id] == "COMPLETE" && !this.types[id]) {
                    this.$axios.get("api/ticket/type/" + id).then(
                        (response) => {
                            const type = normalizeJobType(response.data.type);
                            this.$set(this.types, id, type);
                            setJobType(id, type);
                        }, () => {});
                }
            }
        },
        formattedRoute(element) {
            const type = this.types[element.id];
            if (this.statuses[element.id] == 'COMPLETE' && type) {
                switch (type) {
                    case 'structure':
                    case 'complex':
                    case 'interface':
                        return '/result/' + element.id + '/0';
                    case 'msa':
                        return '/result/foldmason/' + element.id;
                    case 'motif':
                        return '/result/folddisco/' + element.id;
                }
            }
            // Type not yet resolved / not complete: let Queue.vue redirect.
            return '/queue/' + element.id;
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
        refreshJobName(payload) {
            if (!payload) return
            const idx = this.items.findIndex(v => v.id == payload.id)
            if (idx != -1) {
                const obj = this.items[idx]
                obj.name = payload.name
                this.$set(this.items, idx, obj)
            }
        },
        askDelete(child) {
            this.pendingDelete = child;
            this.deleteDialog = true;
        },
        cancelDelete() {
            this.deleteDialog = false;
            this.pendingDelete = null;
        },
        // Client-side "forget": drops the item from localStorage and the reactive
        // view only. The job on the server is untouched (server-side deletion is a
        // future task).
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
                this.$delete(this.types, item.id);
                this.$delete(this.statuses, item.id);

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

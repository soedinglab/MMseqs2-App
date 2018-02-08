<template>
<div>
<v-navigation-drawer absolute app permanent clipped class="grey lighten-4" :mini-variant.sync="mini">
    <v-list class="grey lighten-4">
        <v-list-tile to="/search">
            <v-list-tile-action>
                <v-icon>search</v-icon>
            </v-list-tile-action>
            <v-list-tile-content>
                <v-list-tile-title>Search</v-list-tile-title>
            </v-list-tile-content>
        </v-list-tile>

        <router-view name="sidebar"></router-view>

        <v-list-group v-if="items && items.length > 0" :value="drawer" no-action>
            <v-list-tile slot="item" @click="drawer = !drawer;">
                <v-list-tile-action>
                    <v-icon>{{ drawer ? 'keyboard_arrow_up' : 'history' }}</v-icon>
                </v-list-tile-action>
                <v-list-tile-content>
                    <v-list-tile-title>
                        History
                    </v-list-tile-title>
                </v-list-tile-content>
                <v-list-tile-content v-if="drawer" style="align-items: flex-end;">
                    <div>
                        <button class="mx-1" :style="{'opacity' : page == 0 ? 0.6 : 1}" @click.stop="previous();"><v-icon style="transform:inherit">chevron_left</v-icon></button>
                        <button class="mx-1" :style="{'opacity' : (page + 1) * limit >= items.length ? 0.6 : 1}"  @click.stop="next();"><v-icon style="transform:inherit">chevron_right</v-icon></button>
                    </div>
                </v-list-tile-content>
            </v-list-tile>

            <v-list two-line subheader dense>
                <v-list-tile v-for="(child, i) in items.slice(page * limit, (page + 1) * limit)" :key="i" :class="{ 'list__tile--highlighted': child.ticket == ticket }" :to="formattedRoute(child)">
                    <v-list-tile-action>
                        <identicon v-if="child.status == 'COMPLETED'" :hash="child.ticket">done</identicon>
                        <v-icon v-else-if="child.status == 'RUNNING'">query-builder</v-icon>
                        <v-icon v-else-if="child.status == 'PENDING'">schedule</v-icon>
                        <v-icon v-else-if="child.status == 'ERROR'">error-outline</v-icon>
                        <v-icon v-else>help</v-icon>
                    </v-list-tile-action>
                    <v-list-tile-content>
                        <v-list-tile-title>
                            {{ formattedDate(child.time) }}
                        </v-list-tile-title>
                        <v-list-tile-sub-title><span class="mono">{{ child.ticket.substr(0,24) }}…</span></v-list-tile-sub-title>
                    </v-list-tile-content>
                </v-list-tile>
            </v-list>
        </v-list-group>
    </v-list>
</v-navigation-drawer>
<v-toolbar dense fixed clipped-left app class="ml-0 pl-3">
    <v-toolbar-side-icon @click.stop="mini = !mini"></v-toolbar-side-icon>
    <v-toolbar-title>MMseqs2 Search</v-toolbar-title>
    <object style="margin-left:8px; display: inline-block; width: 38px;height: 38px;vertical-align: middle" 
            type="image/svg+xml"
            data="/assets/marv1.svg"
            aria-hidden="true">
        <img src="./assets/marv1.png" style="max-width:100%" />
    </object>

    <v-spacer></v-spacer>
    <v-toolbar-side-icon v-once v-if="!$ELECTRON" class="hidden-md-and-up"></v-toolbar-side-icon>
    <v-toolbar-items v-once v-if="!$ELECTRON" class="hidden-sm-and-down">
        <v-btn flat rel="external noopener" target="_blank" href="https://mmseqs.com">MMseqs2</v-btn>
        <v-btn flat rel="external noopener" target="_blank" href="https://github.com/soedinglab/mmseqs-webserver">Github</v-btn>
        <v-btn flat rel="external noopener" target="_blank" href="http://www.mpibpc.mpg.de/soeding">Södinglab</v-btn>
    </v-toolbar-items>
</v-toolbar>
</div>
</template>

<script>
import Identicon from './Identicon.vue';

export default {
    components: { Identicon },
    data: () => ({
        ticket: null,
        drawer: false,
        mini: true,
        error: false,
        items: [],
        page: 0,
        limit: 7
    }),
    created() {
        this.fetchData();
    },
    watch: {
        '$route': 'fetchData'
    },
    localStorage: {
        history: {
            type: Array,
            default: []
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
            if ((this.page + 1) * this.limit > this.items.length) {
                return;
            }
            this.page += 1;
        },
        fetchData() {
            this.ticket = this.$route.params.ticket || null;

            this.error = false;
            var history = this.$localStorage.get('history');

            var tickets = [];
            for (var i in history) {
                tickets.push(history[i].ticket);
                history[i].status = "UNKOWN";
            }

            this.$http.post('api/tickets', { tickets: tickets }, { emulateJSON: true }).then(
                (response) => {
                    response.json().then((data) => {
                        var now = +(new Date());
                        var items = [];
                        for (var i in data) {
                            var include = false;
                            if (data[i].status == "COMPLETED") {
                                include = true;
                            } else if ((now - history[i].time) < (1000 * 60 * 60 * 24 * 7)) {
                                include = true;
                            }

                            if (include) {
                                var entry = history[i];
                                entry.status = data[i].status;
                                items.push(entry);
                            }
                        }
                        this.items = items;
                        this.$localStorage.set('history', items);
                    });
                }, () => {
                    this.error = true;
                });
        },
        formattedRoute(element) {
            if (element.status == 'COMPLETED') {
                return '/result/' + element.ticket + '/0';
            }
            return '/queue/' + element.ticket;
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
        }
    }
}
</script>

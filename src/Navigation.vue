<template>
    <v-list class="grey lighten-4">
        <v-list-tile to="/">
            <v-list-tile-action>
                <v-icon>search</v-icon>
            </v-list-tile-action>
            <v-list-tile-content>
                <v-list-tile-title>Search</v-list-tile-title>
            </v-list-tile-content>
        </v-list-tile>

        <router-view name="sidebar"></router-view>

        <v-list-group  v-if="items && items.length > 0" :value="drawer" no-action>
            <v-list-tile slot="item" @click="drawer = !drawer">
                <v-list-tile-action>
                    <v-icon>{{ drawer ? 'keyboard_arrow_up' : 'keyboard_arrow_down' }}</v-icon>
                </v-list-tile-action>
                <v-list-tile-content>
                    <v-list-tile-title>
                        History
                    </v-list-tile-title>
                </v-list-tile-content>
            </v-list-tile>

            <v-list-tile v-for="(child, i) in items" :key="i" :class="{ 'list__tile--active': child.ticket == ticket }" :to="formattedRoute(child)">
                <v-list-tile-action>
                    <v-icon v-if="child.status == 'COMPLETED'">done</v-icon>
                    <v-icon v-else-if="child.status == 'RUNNING'">query-builder</v-icon>
                    <v-icon v-else-if="child.status == 'PENDING'">directions-run</v-icon>
                    <v-icon v-else-if="child.status == 'ERROR'">error-outline</v-icon>
                    <v-icon v-else>help</v-icon>
                </v-list-tile-action>
                <v-list-tile-content>
                    <v-list-tile-title>
                        <span class="mono">{{ child.ticket.substr(0,9) }}…</span> — {{ formattedDate(child.time) }}
                    </v-list-tile-title>
                </v-list-tile-content>
            </v-list-tile>
        </v-list-group>
        
    </v-list>
</template>

<script>
export default {
    data: () => ({
        ticket: null,
        drawer: false,
        error: false,
        items: []
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

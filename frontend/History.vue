<template>
<v-list two-line subheader dense>
    <v-list-group v-if="items && items.length > 0" v-model="drawer" no-action prepend-icon="history">
        <v-list-tile slot="activator">
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

        <v-list-tile v-for="(child, i) in items.slice(page * limit, (page + 1) * limit)" :key="i" :class="{ 'list__tile--highlighted': child.id == current }" :to="formattedRoute(child)">
            <v-list-tile-action>
                <identicon v-if="child.status == 'COMPLETE'" :hash="child.id">done</identicon>
                <v-icon v-else-if="child.status == 'RUNNING'">query-builder</v-icon>
                <v-icon v-else-if="child.status == 'PENDING'">schedule</v-icon>
                <v-icon v-else-if="child.status == 'ERROR'">error-outline</v-icon>
                <v-icon v-else>help</v-icon>
            </v-list-tile-action>
            <v-list-tile-content>
                <v-list-tile-title>
                    {{ formattedDate(child.time) }}
                </v-list-tile-title>
                <v-list-tile-sub-title><span class="mono">{{ child.id }}</span></v-list-tile-sub-title>
            </v-list-tile-content>
        </v-list-tile>
    </v-list-group>
</v-list>
</template>

<script>
import Identicon from './Identicon.vue';

export default {
    components: { Identicon },
    data: () => ({
        current: "",
        drawer: false,
        error: false,
        items: [],
        page: 0,
        limit: 7
    }),
    created() {
        this.fetchData();
        this.$root.$on('navigation-resize', this.setDrawerState);
    },
    beforeDestroy() {
        this.$root.$off('navigation-resize', this.setDrawerState);
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
        setDrawerState(state) {
            this.drawer = !state;
        },
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
            this.current = this.$route.params.ticket;

            this.error = false;
            this.items = this.$localStorage.get('history');

            let tickets = [];
            for (let i in this.items) {
                tickets.push(this.items[i].id);
                this.items[i].status = "UNKNOWN";
            }

            this.$http.post('api/tickets', { tickets: tickets }, { emulateJSON: true }).then(
                (response) => {
                    response.json().then((data) => {
                        var now = +(new Date());
                        var items = [];
                        for (var i in data) {
                            var include = false;
                            if (data[i].status == "COMPLETE") {
                                include = true;
                            } else if (data[i].status == "UNKNOWN") {
                                include = false;
                            } else if ((now - this.items[i].time) < (1000 * 60 * 60 * 24 * 7)) {
                                include = true;
                            }

                            if (include) {
                                var entry = this.items[i];
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
            if (element.status == 'COMPLETE') {
                return '/result/' + element.id + '/0';
            }
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
        }
    }
}
</script>

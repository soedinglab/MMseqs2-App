<template>
    <v-list-group v-if="items && items.length > 0" v-model="drawer" no-action :prepend-icon="$MDI.History">
        <template slot="activator">
            <v-list-item-content>
                <v-list-item-title>
                    History
                </v-list-item-title>
                <v-list-item-subtitle v-if="drawer" class="ml-n1" @click.prevent>
                    <button :style="{'opacity' : page == 0 ? 0.6 : 1}" @click.prevent="previous();"><v-icon style="transform:inherit">{{ $MDI.ChevronLeft }}</v-icon></button>
                    <button :style="{'opacity' : (page + 1) * limit >= items.length ? 0.6 : 1}"  @click.prevent="next();"><v-icon style="transform:inherit">{{ $MDI.ChevronRight }}</v-icon></button>
                </v-list-item-subtitle>
            </v-list-item-content>
        </template>

        <v-list-item v-for="(child, i) in items.slice(page * limit, (page + 1) * limit)" :key="i" :class="{ 'list__item--highlighted': child.id == current }" :to="formattedRoute(child)" style="padding-left: 16px;">
            <v-list-item-icon>
                <identicon v-if="child.status == 'COMPLETE'" :hash="child.id"></identicon>
                <v-icon v-else-if="child.status == 'RUNNING'">{{ $MDI.ClockOutline }}</v-icon>
                <v-icon v-else-if="child.status == 'PENDING'">{{ $MDI.ClockOutline }}</v-icon>
                <v-icon v-else-if="child.status == 'ERROR'">{{ $MDI.HelpCircleOutline }}</v-icon>
                <v-icon v-else>{{ $MDI.HelpCircleOutline }}</v-icon>
            </v-list-item-icon>
            <v-list-item-content>
                <v-list-item-title>
                    {{ formattedDate(child.time) }}
                </v-list-item-title>
                <v-list-item-subtitle><span class="mono">{{ child.id }}</span></v-list-item-subtitle>
            </v-list-item-content>
        </v-list-item>
    </v-list-group>
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

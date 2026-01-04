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

        <v-list-item v-for="(child, i) in items.slice(page * limit, (page + 1) * limit)" :key="i" :class="{ 'list__item--highlighted': child.id == current }" :to="formattedRoute(child)" style="padding-left: 16px;">
            <v-list-item-icon>
                <history-avatar v-if="child.status == 'COMPLETE' && types[child.id]" 
                    :hash="child.id" :type="types[child.id]" />
                <identicon v-else-if="child.status == 'COMPLETE'" :hash="child.id"></identicon>
                <v-icon large v-else-if="child.status == 'RUNNING'">{{ $MDI.ClockOutline }}</v-icon>
                <v-icon large v-else-if="child.status == 'PENDING'">{{ $MDI.ClockOutline }}</v-icon>
                <v-icon large v-else-if="child.status == 'ERROR'">{{ $MDI.HelpCircleOutline }}</v-icon>
                <v-icon large v-else>{{ $MDI.HelpCircleOutline }}</v-icon>
            </v-list-item-icon>
            <v-list-item-content>
                <v-list-item-title>
                    {{ formattedDate(child.time) }}
                </v-list-item-title>
                <v-list-item-subtitle><span class="mono">{{ child.name ? child.name : child.id }}</span></v-list-item-subtitle>
            </v-list-item-content>
        </v-list-item>
    </v-list-group>
</template>

<script>
import Identicon from './Identicon.vue';
import HistoryAvatar from './HistoryAvatar.vue';
import { convertToQueryUrl } from './lib/convertToQueryUrl';
import { debounce } from './lib/debounce';
import { storage } from './lib/HistoryMixin';
import emitter from './lib/emitter'

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
    }),
    mounted() {
        this.refreshJobName = this.refreshJobName.bind(this)
        emitter.on('refresh-job-name', this.refreshJobName)
    },
    beforeDestroy() {
        emitter.off('refresh-job-name', this.refreshJobName)
    },
    created() {
        this.fetchData();
    },
    watch: {
        '$route': function(to, from) {
            if (from.path != to.path) {
                this.fetchData();
            }
        },
        items(value) {
            storage.history = JSON.stringify(value);
            const obj = this.types
            for (let v of value) {
                if (v.status == 'COMPLETE' && !obj[v.id]) {
                    this.$axios.get("api/ticket/type/" + v.id).then(
                        (response) => {
                            const data = response.data;
                            switch (data.type) {
                                case "search":
                                case "structuresearch":
                                    obj[v.id] = 'structure'
                                    break;
                                case "complexsearch":
                                    obj[v.id] = 'complex'
                                    break;
                                case "foldmasoneasymsa":
                                    obj[v.id] = 'msa'
                                    break;
                                case "folddisco":
                                    obj[v.id] = 'motif'
                                    break
                                default:
                                    obj[v.id] = ""
                                    break
                            }
                    })
                }
            }
            this.types = obj
        },
        drawer: function (val, oldVal) {
            if (val == true) {
                this.$root.$emit('multi', true);
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
            if ((this.page + 1) * this.limit > this.items.length) {
                return;
            }
            this.page += 1;
        },
        fetchData: debounce(function() {
            this.current = this.$route.params.ticket;

            this.error = false;
            var itemsTmp = JSON.parse(storage.history || "[]");
            let name_map = JSON.parse(storage.name_map || "[]");

            let tickets = [];
            var hasCurrent = false;
            let currentHasName = false;

            for (let i in itemsTmp) {
                if (this.current == itemsTmp[i].id) {
                    hasCurrent = true;
                }
                if (itemsTmp[i].id.startsWith("user")) {
                    continue;
                }
                tickets.push(itemsTmp[i].id);
                itemsTmp[i].status = "UNKNOWN";
            }
            
            if (this.current != undefined && hasCurrent == false && !this.current.startsWith('user-')) {
                tickets.unshift(this.current);
                itemsTmp.unshift({ id: this.current, status: "UNKNOWN", time: +(new Date()) })
            }

            this.$axios.post('api/tickets', convertToQueryUrl({ tickets: tickets })).then(
                (response) => {
                    const data = response.data;
                    var now = +(new Date());
                    var items = [];
                    var hasPending = false;
                    for (var i in data) {
                        var include = false;
                        if (data[i].status == "COMPLETE") {
                            include = true;
                        } else if (data[i].status == "UNKNOWN") {
                            include = false;
                        } else if ((now - itemsTmp[i].time) < (1000 * 60 * 60 * 24 * 7)) {
                            include = true;
                        }

                        if (data[i].status == "PENDING" || data[i].status == "RUNNING") {
                            hasPending = true;
                        }

                        if (include) {
                            var entry = itemsTmp[i];
                            let nameObj = name_map.find(v => v.id == entry.id)
                            if (nameObj) {
                                entry.name = nameObj.name
                            } else {
                                entry.name = ""
                            }
                            entry.status = data[i].status;
                            items.push(entry);
                        }
                    }
                    this.items = items;
                    if (hasPending) {
                        setTimeout(this.fetchData.bind(this), 5000);
                    }
                    name_map = name_map.filter(v => this.items.some(i => i.id == v.id))
                    storage.name_map = JSON.stringify(name_map)
                }, () => {
                    this.error = true;
            });
        }, 16, true),
        formattedRoute(element) {
            if (element.status == 'COMPLETE') {
                this.$axios.get("api/ticket/type/" + element.id).then(
                    (response) => {
                        const data = response.data;
                        switch (data.type) {
                            case "search":
                            case "structuresearch":
                            case "complexsearch":
                                return '/result/' + element.id + '/0';
                            case "foldmasoneasymsa":
                                return '/result/foldmason/' + element.id;
                            case "folddisco":
                                return '/result/folddisco/' + element.id;
                            default:
                                return '/';
                        }
                    })
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
        },
        refreshJobName(payload) {
            if (!payload) return
            const idx = this.items.findIndex(v => v.id == payload.id)
            if (idx != -1) {
                const obj = this.items[idx]
                obj.name = payload.name
                this.$set(this.items, idx, obj)
            }
        }
    },
    computed: {
    }
}
</script>

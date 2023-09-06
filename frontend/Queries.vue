<template>
    <div>
        <v-divider></v-divider>
        <v-list-item v-if="$ELECTRON" @click="electronDownload(ticket)">
            <v-list-item-action>
                <v-icon>{{ $MDI.FileDownloadOutline }}</v-icon>
            </v-list-item-action>
            <v-list-item-content>
                <v-list-item-title v-if="multi">
                    Download All
                </v-list-item-title>

                <v-list-item-title v-else>
                    Download M8
                </v-list-item-title>
            </v-list-item-content>
        </v-list-item>
        <v-list-item v-else target="_blank" :href="url('api/result/download/' + ticket)">
            <v-list-item-action>
                <v-icon>{{ $MDI.CloudDownloadOutline }}</v-icon>
            </v-list-item-action>
            <v-list-item-content>
                <v-list-item-title v-if="multi">
                    Download All
                </v-list-item-title>

                <v-list-item-title v-else>
                    Download M8
                </v-list-item-title>
            </v-list-item-content>
        </v-list-item>

        <v-list-group v-model="drawer" v-if="multi" no-action :ripple="false" :prepend-icon="$MDI.FormatListBulleted">
            <template slot="activator">
                <v-list-item-content>
                    <v-list-item-title>
                        Queries
                    </v-list-item-title>
                    <v-list-item-subtitle v-if="drawer" class="ml-n1" @click.prevent>
                        <button :style="{'opacity' : page == 0 ? 0.6 : 1}" @click.prevent="previous();"><v-icon style="transform:inherit">{{ $MDI.ChevronLeft }}</v-icon></button>
                        <button :style="{'opacity' : hasNext == false ? 0.6 : 1}"  @click.prevent="next();"><v-icon style="transform:inherit">{{ $MDI.ChevronRight }}</v-icon></button>
                    </v-list-item-subtitle>
                </v-list-item-content>
            </template>
            <template v-if="items.length > 0">
            <v-list-item
                v-for="(child, i) in items"
                :key="child.name"
                :class="{ 'list__item--active': child.id == entry }"
                :to="{ name: 'result', params: { ticket: ticket, entry: child.id }}"
                style="padding-left: 16px;"
            >
                <v-list-item-icon>
                    <v-icon v-if="child.id == entry">{{ $MDI.Label }}</v-icon>
                    <v-icon v-else>{{ $MDI.LabelOutline }}</v-icon>
                </v-list-item-icon>
                <v-list-item-content>
                    <v-list-item-title>
                        {{ child.name }}
                    </v-list-item-title>
                </v-list-item-content>
            </v-list-item>
            </template>
        </v-list-group>
    </div>
</template>

<script>
import buildFullPath from 'axios/lib/core/buildFullPath.js'

export default {
    data: () => ({
        ticket: null,
        entry: null,
        status: '',
        items: [],
        page: -1,
        limit: 7,
        hasNext: false,
        drawer: false,
        multi: false,
    }),
    created() {
        this.fetchData();
    },
    watch: {
        '$route': function(to, from) {
            if (from.path != to.path) {
                this.fetchData();
            }
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
            this.fetchData();
        },
        next() {
            if (!this.hasNext) {
                return;
            }
            this.page += 1;
            this.fetchData();
        },
        fetchData() {
            this.ticket = this.$route.params.ticket;
            this.entry = this.$route.params.entry;

            if (this.page == -1) {
                this.page = Math.floor(this.entry / this.limit);
            }

            this.error = "";
            if (this.ticket.startsWith('user')) {
                let localData = this.$root.userData;
                this.items = localData.map((res, i) => ({ id: i, name: res.query.header, set: i }));
                this.multi = this.items.length > 1 || (this.items.length == 1 && this.items[0].id != 0);
                if (this.multi) {
                    this.drawer = true;
                    this.$root.$emit('multi', true);
                }
            } else {
                this.$axios.get("api/result/queries/" + this.ticket + "/" + this.limit + "/" + this.page).then((response) => {
                    const data = response.data;
                    if (data.lookup) {
                        this.items = data.lookup;
                        this.hasNext = data.hasNext;
                        this.multi = this.items.length > 1 || (this.items.length == 1 && this.items[0].id != 0)
                        if (this.multi) {
                            this.drawer = true;
                            this.$root.$emit('multi', true);
                        }
                    }
                }).catch(() => {
                    this.status = "error";
                });
            }
        },
        url(url) {
            // workaround was fixed in axios git, remove when axios is updated
            const fullUrl = buildFullPath(this.$axios.defaults.baseURL, url);
            return this.$axios.getUri({ url: fullUrl })
        },
        electronDownload(ticket) {
            this.saveResult(ticket);
        }
    }
}
</script>
<template>
    <div>
        <v-divider></v-divider>
        <v-subheader class="grey--text mono">{{ticket.substr(0,30)}}…</v-subheader>
        <v-list-tile target="_blank" :href="$url('api/m8/' + ticket)">
            <v-list-tile-action>
                <v-icon>cloud_download</v-icon>
            </v-list-tile-action>
            <v-list-tile-content>
                <v-list-tile-title v-if="multi">
                    Download All
                </v-list-tile-title>

                <v-list-tile-title v-else>
                    Download M8
                </v-list-tile-title>
            </v-list-tile-content>
        </v-list-tile>

        <v-list-group :value="drawer" v-if="multi" no-action>
            <v-list-tile slot="item" @click="drawer = !drawer">
                <v-list-tile-action>
                    <v-icon>{{ drawer ? 'keyboard_arrow_up' : 'keyboard_arrow_down' }}</v-icon>
                </v-list-tile-action>
                <v-list-tile-content>
                    <v-list-tile-title>
                        Queries
                    </v-list-tile-title>
                </v-list-tile-content>
            </v-list-tile>
            <v-list-tile v-if="items.length > 0" v-for="(child, i) in items" :key="i" :class="{ 'list__tile--active': child.id == entry }" :to="{ name: 'result', params: { ticket: ticket, entry: child.id }}">
                <!-- <v-list-tile-action v-if="child.icon"> -->
                    <!-- <v-icon>{{ child.icon }}</v-icon> -->
                <!-- </v-list-tile-action> -->
                <v-list-tile-content>
                    <v-list-tile-title>
                        {{ child.name }}
                    </v-list-tile-title>
                </v-list-tile-content>
            </v-list-tile>
        </v-list-group>
        <v-divider></v-divider>

        <!-- <nav aria-label="Page navigation">
            <ul class="pager pager-sm">
                <li :class="['previous', { disabled: page == 0 }]">
                    <a @click="previous">
                        <span aria-hidden="true">&larr;</span>
                        <span class="sr-only">Older</span>
                    </a>
                    </li>
                <li :class="['next', { disabled: !hasNext }]">
                    <a @click="next">
                        <span class="sr-only">Newer</span>
                        <span aria-hidden="true">&rarr;</span>
                    </a>
                </li>
            </ul>
        </nav> -->
    </div>
</template>


<script>
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
		'$route': 'fetchData'
	},
    methods: {
        previous() {
            if (this.page == 0) {
                return;
            }
            this.page -= 1;
        },
        next() {
            if (!this.hasNext) {
                return;
            }
            this.page += 1;
        },
		fetchData() {
			this.ticket = this.$route.params.ticket;
            this.entry = this.$route.params.entry;
            
            if (this.page == -1) {
                this.page = Math.floor(this.entry / this.limit);
            }

            this.error = "";
            this.ticket = this.$route.params.ticket;
            this.$http.get("api/result/queries/" + this.ticket + "/" + this.limit + "/" + this.page).then((response) => {
                response.json().then((data) => {
                    if (data.lookup) {
                        this.items = data.lookup;
                        this.hasNext = data.hasNext;
                        this.multi = this.items.length > 1 || (this.items.length == 1 && this.items[0].id != 0)  
                        this.$emit('multi', this.multi);
                    }
                });
            }).catch(() => {
                this.status = "error";
            });
        }
    }
}
</script>
<template>
    <div>
        <v-divider></v-divider>
        <v-subheader class="grey--text mono">{{ticket.substr(0,30)}}…</v-subheader>
        <v-list-tile v-if="$ELECTRON" @click="electronDownload(ticket)">
            <v-list-tile-action>
                <v-icon>file_download</v-icon>
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
        <v-list-tile v-else target="_blank" :href="$url('api/result/download/' + ticket)">
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
                    <v-icon>{{ drawer ? 'keyboard_arrow_up' : 'list' }}</v-icon>
                </v-list-tile-action>
                <v-list-tile-content>
                    <v-list-tile-title>
                        Queries
                    </v-list-tile-title>
                </v-list-tile-content>
                <v-list-tile-content v-if="drawer" style="align-items: flex-end;">
                    <div>
                        <button class="mx-1" :style="{'opacity' : page == 0 ? 0.6 : 1}" @click.stop="previous();"><v-icon style="transform:inherit">chevron_left</v-icon></button>
                        <button class="mx-1" :style="{'opacity' : hasNext == false ? 0.6 : 1}"  @click.stop="next();"><v-icon style="transform:inherit">chevron_right</v-icon></button>
                    </div>
                </v-list-tile-content>
            </v-list-tile>
            <template v-if="items.length > 0">
            <v-list-tile v-for="(child, i) in items" :key="i" :class="{ 'list__tile--active': child.id == entry }" :to="{ name: 'result', params: { ticket: ticket, entry: child.id }}">
                <v-list-tile-action>
                    <v-icon v-if="child.id == entry">label</v-icon>
                    <v-icon v-else>label_outline</v-icon>
                </v-list-tile-action>
                <v-list-tile-content>
                    <v-list-tile-title>
                        {{ child.name }}
                    </v-list-tile-title>
                </v-list-tile-content>
            </v-list-tile>
            </template>
        </v-list-group>
        <v-divider></v-divider>
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
        },
        electronDownload(ticket) {
            this.saveResult(ticket);
        }
    }
}
</script>
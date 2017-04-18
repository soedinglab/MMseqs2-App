<template>
    <affix>
        <h3 style="padding-left:15px">All Queries</h3>
        <ul class="nav nav-pills nav-stacked">
            <li>
                <a :href="$url.parse('/api/download/msa/' + ticket).href">
                    Download MSAs
                </a>
            </li>
            <li>
                <a :href="$url('api/download/m8/' + ticket)">
                    Download M8
                </a>
            </li>
            <li role="separator"
                class="nav-divider"></li>
            <li v-for="query in items"
                :class="{ active: query.id == entry }">
                <router-link :to="{ name: 'result', params: { ticket: ticket, entry: query.id }}">{{ query.name }}
                </router-link>
            </li>
        </ul>
        <nav aria-label="Page navigation">
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
        </nav>
    </affix>
</template>


<script>
import Affix from './AffixFix.vue';

export default {
    props: ['ticket', 'entry'],
    components: { Affix },
    data() {
        return {
            status: '',
            items: [],
            page: -1,
            limit: 7,
            hasNext: false
        }
    },
    created() {
        this.fetchData();
    },
    watch: {
        '$route': 'fetchData',
        'page': 'fetchData'
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
            if (this.page == -1) {
                this.page = this.entry % this.limit;
            }

            this.error = "";
            this.ticket = this.$route.params.ticket;
            this.$http.get("api/result/queries/" + this.ticket + "/" + this.limit + "/" + this.page).then((response) => {
                response.json().then((data) => {
                    this.status = data.status;
                    switch (this.status) {
                        case "COMPLETED":
                            this.items = data.data.items;
                            this.hasNext = data.data.hasNext;
                            var isMulti = this.items.length > 1 || (this.items.length == 1 && this.items[0].id != 0)  
                            this.$emit('multi', isMulti);
                            break;
                        default:
                            break;
                    }
                });
            }).catch(() => {
                this.status = "error";
            });
        }
    }
}
</script>
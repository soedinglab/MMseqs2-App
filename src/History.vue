<template>
    <div id="queue"
         class="container">
        <div class="row">
            <div class="col-xs-12">
                <div class="panel panel-default">
                    <div class="panel-heading">Your Previous Submissions</div>
                    <div class="panel-body"
                         v-if="items.length == 0 || error">
                        <div class="alert alert-info"
                             v-if="items.length == 0">
                            No previous jobs saved.
                        </div>
                        <div class="alert alert-danger"
                             v-if="error">
                            Could not query history status. Please try again later.
                        </div>
                    </div>
                    <table v-if="items.length > 0"
                           class="table table-striped">
                        <thead>
                            <tr>
                                <th>Submission Date</th>
                                <th>Job</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="item in items">
                                <td>{{ formattedDate(item.time) }}</td>                                
                                <router-link v-if="item.status == 'COMPLETED'"
                                             tag="td"
                                             :to="'/result/' + item.ticket + '/0'"><a class="mono">{{ item.ticket }}</a></router-link>
                                <router-link v-else
                                             tag="td"
                                             :to="'/queue/' + item.ticket"><a class="mono">{{ item.ticket }}</a></router-link>
                                <td>{{ item.status }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'history',
    data() {
        return {
            error: false,
            items: []
        };
    },
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
                            if ( data[i].status == "COMPLETED") {
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
        formattedDate(timestamp) {
            const date = new Date(timestamp);

            var month = date.getMonth() + 1;
            var day = date.getDate();
            var hour = date.getHours();
            var min = date.getMinutes();
            var sec = date.getSeconds();

            month = (month < 10 ? "0" : "") + month;
            day = (day < 10 ? "0" : "") + day;
            hour = (hour < 10 ? "0" : "") + hour;
            min = (min < 10 ? "0" : "") + min;
            sec = (sec < 10 ? "0" : "") + sec;

            const str = date.getFullYear() + "-" + month + "-" + day + " " + hour + ":" + min + ":" + sec;

            return str;
        }
    }
};
</script>

<style>
.loader {
    margin: 25px auto;
}

#queue {
    margin-top: 20px;
}
</style>

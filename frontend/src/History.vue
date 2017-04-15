<template>
    <div id="queue"
         class="container">
        <div class="row">
            <div class="col-xs-12">
                <div class="panel panel-default">
                    <div class="panel-heading">Previous Submissions</div>
                    <div class="panel-body" v-if="items.length == 0">
                        <div class="alert alert-info">
                            No jobs
                        </div>

                    </div>
                    <table v-if="items.length > 0"
                           class="table table-striped">
                        <thead>
                            <tr>
                                <th>Ticket</th>
                                <th>Subission Date</th>
                                <th>Current Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="item in items">
                                <router-link tag="td"
                                             :to="'/queue/' + item.ticket"><a class="mono">{{ item.ticket }}</a></router-link>
                                <td>{{ formattedDate(item.time) }}</td>
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

            this.items = history;

            this.$http.post('api/tickets', { tickets: tickets }, { emulateJSON: true }).then(function (response) {
                response.json().then(function (data) {
                    for (var i in data) {
                        this.items[i].status = JSON.parse(data[i]).status;
                    }
                }.bind(this));
            }).catch(function () {
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

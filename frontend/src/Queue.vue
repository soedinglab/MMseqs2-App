<template>
	<div id="queue"
	     class="container">
		<div class="row queue-status"  v-if="status == 'PENDING'">
				<div class="col-sm-6 status">
					<div class="panel panel-default">
						<div class="panel-heading">Job Status: <strong>Waiting for worker</strong></div>
						<div class="panel-body">
							<scale-loader class="loader"
							              color="#000000" />
						</div>
					</div>
				</div>
				<div class="col-sm-offset-1 col-sm-4">
					<img style="width:100%" src="/assets/marv-search_2x.png" src-set="/assets/marv-search_2x.png 2x, /assets/marv-search_3x.png 3x" />
				</div>
		</div>

		<div class="row queue-status" v-if="status == 'RUNNING'">
			<div class="col-sm-6 status">
				<div class="panel panel-default">
					<div class="panel-heading">Job Status: <strong>In Progress</strong></div>
					<div class="panel-body">
						<grid-loader class="loader"
										color="#000000" />
					</div>
				</div>
			</div>
			<div class="col-sm-offset-1 col-sm-4">
				<img style="width:100%" src="/assets/marv-result_2x.png" src-set="/assets/marv-result_2x.png 2x, /assets/marv-result_3x.png 3x" />
			</div>
		</div>

		<div class="row queue-status" v-if="status == 'FAILED'">
			<div class="col-sm-6 status">
				<div class="alert alert-danger">
				{{ error }}
				</div>
			</div>
			<div class="col-sm-offset-1 col-sm-4">
				<img style="width:100%" src="/assets/marv-error_2x.png" src-set="/assets/marv-error_2x.png 2x, /assets/marv-error_3x.png 3x" />
			</div>
		</div>
	</div>
</template>

<script>
import ScaleLoader from '../node_modules/vue-spinner/src/ScaleLoader.vue';
import GridLoader from '../node_modules/vue-spinner/src/GridLoader.vue';

export default {
	components: { ScaleLoader, GridLoader },
	data() {
		return {
			status: "PENDING",
			error: "",
		};
	},
	created() {
		this.fetchData();
	},
	watch: {
		'$route': 'fetchData'
	},
	methods: {
		fetchData() {
			this.error = "";
			const ticket = this.$route.params.ticket;
			if (typeof(ticket) === "undefined") {
				return;
			}

			this.$http.get("api/ticket/" + ticket).then(function (response) {
				response.json().then(function (data) {
					this.status = data.status;

					switch (this.status) {
						case "FAILED":
							this.error = data.error;
							break;
						case "COMPLETED":
							this.$router.push({ name: 'result', params: { ticket: ticket, entry: 0 } });
							break;
						default:
							setTimeout(this.fetchData.bind(this), 1000);
							break;
					}
				}.bind(this));
			}).catch(function () {
				this.status = "error";
				this.error = "Failed";
			});
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

.queue-status .status {
	margin-top:50px;
}
.queue-status .panel-body {
	height:175px;
}

.queue-status .loader {
	margin:50px auto;
}
</style>

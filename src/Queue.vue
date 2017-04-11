<template>
	<div id="queue"
	     class="container">
		<div class="row">
			<div class="col-xs-12">
				<div v-if="status == 'PENDING'">
					<div class="panel panel-default">
						<div class="panel-heading">Job Status: <strong>Waiting for worker</strong></div>
						<div class="panel-body">
							<scale-loader class="loader"
							              color="#000000" />
						</div>
					</div>
				</div>
	
				<div v-if="status == 'RUNNING'">
					<div class="panel panel-default">
						<div class="panel-heading">Job Status: <strong>In Progress</strong></div>
						<div class="panel-body">
							<grid-loader class="loader"
							             color="#000000" />
						</div>
					</div>
				</div>
	
				<div v-if="status == 'FAILED'"
				     class="alert alert-danger">
					{{ error }}
				</div>
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
			status: "wait",
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
			this.$http.get("api/ticket/" + ticket).then(function (response) {
				response.json().then(function (data) {
					this.status = data.status;

					switch (this.status) {
						case "PENDING":
						case "RUNNING":
							setTimeout(this.fetchData.bind(this), 1000);
							break;
						case "FAILED":
							this.error = data.error;
							break;
						case "COMPLETED":
						default:
							this.$router.push({ name: 'result', params: { ticket: ticket } });
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
</style>

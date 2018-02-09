<template>
<v-container grid-list-md fluid>
	<v-layout row justify-center>
		<v-flex xs8>
			<panel>
				<template slot="header">
					Job Status:&nbsp;
					<strong v-if="status == 'PENDING'">Waiting for Worker</strong>
					<strong v-else-if="status == 'RUNNING'">In Progress</strong>
					<strong v-else>ERROR</strong>
				</template>

				<div class="text-xs-center" v-if="error" slot="desc">
					{{ error }}
				</div>

				<div class="status-img text-xs-center" slot="content" aria-hidden="true">
					<img v-if="status == 'PENDING'" src="/assets/marv-search_2x.png" src-set="/assets/marv-search_2x.png 2x, /assets/marv-search_3x.png 3x" />
					<img v-else-if="status == 'RUNNING'" src="/assets/marv-result_2x.png" src-set="/assets/marv-result_2x.png 2x, /assets/marv-result_3x.png 3x" />
					<img v-else src="/assets/marv-error_2x.png" src-set="/assets/marv-error_2x.png 2x, /assets/marv-error_3x.png 3x" />
				</div>
			</panel>
		</v-flex>
	</v-layout>
</v-container>
</template>

<script>
import Panel from './Panel.vue';

export default {
	components: { Panel },
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
			if (typeof (ticket) === "undefined") {
				return;
			}

			this.$http.get("api/ticket/" + ticket).then(
				(response) => {
					response.json().then((data) => {
						this.status = data.status;
						switch (this.status) {
							case "UNKNOWN":
								this.status = "FAILED";
								this.error = "No record of this job submission exists.";
								break;
							case "ERROR":
							case "FAILED":
								this.status = "FAILED";
								this.error = "FAILED";
								break;
							case "COMPLETED":
								this.$router.replace({ name: 'result', params: { ticket: ticket, entry: 0 } });
								break;
							default:
								setTimeout(this.fetchData.bind(this), 1000);
								break;
						}
					});
				},
				() => {
					this.status = "FAILED";
					this.error = "Could not query job status. Please try again later.";
				}
			);
		}
	}
};
</script>

<style>
.status-img img {
	max-width: 100%;
}
</style>

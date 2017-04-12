<template>
	<div id="result"
	     class="container">	
		<div class="row">
			<h2>Results for Job: <strong>{{ ticket }}</strong></h2>
			<msa :msa="msa" :ticket="ticket"></msa>
			<h3>List</h3>
			<table class="table table-responsive">
				<thead>
					<tr>
						<th>Query</th>
						<th>Target</th>
						<th>Sequence Identity</th>
						<th>Score</th>
						<th>E-Value</th>
						<th>Query Pos</th>
						<th>Target Pos</th>
					</tr>
				</thead>
				<tbody>
					<search-result-item v-for="entry in items"
										v-bind:key="entry.id"
						                v-bind:item="entry"></search-result-item>
				</tbody>
			</table>
		</div>
	</div>
</template>

<script>
import SearchResultItem from './SearchResultItem.vue';
import GridLoader from '../node_modules/vue-spinner/src/GridLoader.vue';
import Msa from './Msa.vue';

export default {
	name: 'result',
	components: { SearchResultItem, GridLoader, Msa },
	data() {
		return {
			status: "wait",
			ticket: "",
			error: "",
			items: [],
			msa: ""
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
			this.ticket = this.$route.params.ticket;
			this.$http.get("api/result/" + this.ticket).then(function (response) {
				response.json().then(function (data) {
					this.status = data.status;
					switch (this.status) {
						case "COMPLETED":
							this.items = data.items;
							this.msa = data.msa;
							break;
						default:
							this.$router.push({ name: 'queue', params: { ticket: this.ticket } });
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

#result {
	margin-top: 20px;
}
</style>

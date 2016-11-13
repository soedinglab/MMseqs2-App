<template>
	<div id="search-results" class="container">
		<div class="row">
			<div class="col-xs-12">
				<div v-if="status == 'WAITING'">
					<div class="panel panel-default">
						<div class="panel-heading">Job Status: <strong>Waiting for worker</strong></div>
						<div class="panel-body">
							<scale-loader class="loader" color="#000000" />
						</div>
					</div>
				</div>

				<div v-if="status == 'RUNNING'">
					<div class="panel panel-default">
						<div class="panel-heading">Job Status: <strong>In Progress</strong></div>
						<div class="panel-body">
							<grid-loader class="loader" color="#000000" />
						</div>
					</div>
				</div>

				<div v-if="status == 'FAILED'" class="alert alert-danger">
					{{ error }}
				</div>
			</div>
		</div>

		<div class="row" v-if="status == 'COMPLETED'">
			<div :class="items.length > 1 ? col-md-9 : col-xs-12" v-for="entries in items" v-bind:item="entries">
				<h2 :id="'item-' + entries.key">Query: <strong>{{ entries.key }}</strong></h2>
				<table class="table table-responsive">
					<thead>
						<tr>
							<th>Target</th>
							<th>Sequence Identity</th>
							<th>Score</th>
							<th>E-Value</th>
							<th>Query Pos</th>
							<th>Target Pos</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						<search-result-item v-for="entry in entries.data" v-bind:item="entry"></search-result-item>
					</tbody>
				</table>
			</div>
			<div v-if="items.length > 1" class="col-md-3">
				<ul class="nav nav-stacked" id="sidebar" v-for="entries in items" v-bind:item="entries">
					<li><a :href="'#item-' + entries.key">{{ entries.key }}</a></li>
				</ul>
				<bootstrap-pagination :pagination="pagination" />
			</div>
		</div>
	</div>
</template>

<script>
import SearchResultItem from './SearchResultItem.vue';
import BootstrapPagination from 'vue-bootstrap-pagination';
import ScaleLoader from '../node_modules/vue-spinner/src/ScaleLoader.vue';
import GridLoader from '../node_modules/vue-spinner/src/GridLoader.vue';

export default {
	name: 'search',
	components: { SearchResultItem, ScaleLoader, GridLoader, BootstrapPagination },
	data() {
		return {
			status : "wait",
			error : "",
			items : [],
			pagination: {
				per_page: 12,    // required
				current_page: 1, // required
				last_page: 12    // required
			},
		};
	},
	created () {
		this.fetchData();
	},
	watch: {
		'$route': 'fetchData'
	},
	methods: {
		fetchData () {
			this.error = "";
			var ticket = this.$route.params.ticket;
			this.$http.get("/mmseqs/api/ticket/" + ticket).then(function(response) {
				response.json().then(function(data) {
					this.status = data.status;
					this.error = "";

					switch(data.status) {
					case "WAITING":
					case "RUNNING":
						setTimeout(this.fetchData.bind(this), 1000);
						break;
					case "FAILED":
						this.error = data.result;
						break;
					case "COMPLETED":
						this.items = JSON.parse(data.result);
						break;
					}
				}.bind(this));
			},
			function() {
				this.status = "error";
				this.error = "Failed";
			})
		}
	}
};
</script>

<style>
	.loader {
		margin: 25px auto;
	}
</style>
<template>
	<div id="result"
	     class="container">
		<div class="row">
			<div :class="{'col-md-10' : multiquery, 'col-xs-12' : !multiquery }">
				<h2>
					Results for Job				
					<small>{{ ticket }}</small>
				</h2>

				<msa ref="msa"
					 :msa="msa"
				     :ticket="ticket"></msa>
				<h3>List
						<div class="pull-right">
							<popover effect="fade" placement="left" content="Enter your queries here or drag-and-drop a fasta file containing your queries into the textbox.">
								<a class="help" role="button"><span class="glyphicon glyphicon-question-sign" aria-hidden="true"></span></a>
							</popover>
						</div>
					</h3>
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
			<div v-show="multiquery"
			     class="col-md-2">
				<queries v-on:multi="setMultiQuery" :entry="entry" :ticket="ticket"></queries>
			</div>
		</div>
	</div>
</template>

<script>
import Popover from '../node_modules/vue-strap/src/Popover.vue';
import Affix from '../node_modules/vue-strap/src/Affix.vue';
import GridLoader from '../node_modules/vue-spinner/src/GridLoader.vue';


import SearchResultItem from './SearchResultItem.vue';
import Msa from './Msa.vue';
import Queries from './Queries.vue'

export default {
	name: 'result',
	components: { Queries, SearchResultItem,  Msa, GridLoader, Popover, Affix },
	data() {
		return {
			status: "wait",
			ticket: "",
			error: "",
			items: [],
			entry: 0,
			msa: "",
			multiquery: false
		};
	},
	created() {
		this.fetchData();
	},
	watch: {
		'$route': 'fetchData'
	},
	methods: {
		setMultiQuery(multi) {
			this.multiquery = multi;
			this.$refs.msa.fixWidth();
		},
		fetchData(entry) {
			this.error = "";
			this.ticket = this.$route.params.ticket;
			this.entry = this.$route.params.entry;

			this.$http.get("api/result/" + this.ticket + '/' + this.entry).then(function (response) {
				response.json().then(function (data) {
					this.status = data.status;
					switch (this.status) {
						case "COMPLETED":
							this.items = data.items;
							this.msa = data.msa;
							break;
						default:
							this.status = "error";
							this.error = "Failed";
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
</style>

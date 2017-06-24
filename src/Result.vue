<template>
	<div id="result" class="container">
		<div class="row">
			<div :class="{'col-md-10' : multiquery, 'col-xs-12' : !multiquery }">
				<h2>
					Results for Job
					<small>{{ ticket }}</small>
	
					<a v-if="!multiquery" :href="$url('api/m8/' + ticket)" class="btn btn-default pull-right" role="button" alt="Download">
						<span class="glyphicon glyphicon-download-alt" aria-hidden="true"></span>
					</a>
				</h2>
	
				<div v-if="msa && msa.results && msa.results.length > 0 && msa.results[0].alignments">
					<msa ref="msa" :ticket="ticket"></msa>
	
					<table class="table table-responsive">
						<thead>
							<tr>
								<th>Database</th>
								<th>Target</th>
								<th>Sequence Id.</th>
								<th>Score</th>
								<th>E-Value</th>
								<th>Query Pos.</th>
								<th>Target Pos.</th>
							</tr>
						</thead>
						<tbody v-for="entry in msa.results">
							<tr v-for="(item, index) in entry.alignments">
								<td class="db" v-if="index == 0" :rowspan="entry.alignments.length" :style="'border-color: ' + entry.color">{{ entry.db }}</id>
									<td>
										<a :href="(link = tryLinkTargetToDB(item.target, entry.db)) != false ? link : null">{{item.target}}</a>
									</td>
									<td>{{ item.seqId }}</td>
									<td>{{ item.score }}</td>
									<td>{{ item.eval }}</td>
									<td>{{ item.qStartPos }}-{{ item.qEndPos }}</td>
									<td>{{ item.dbStartPos }}-{{ item.dbEndPos }}</td>
							</tr>
						</tbody>
					</table>
				</div>
				<div v-else>
					No hits found! Start a
					<router-link to="/">New Search</router-link>?
				</div>
			</div>
			<div v-show="multiquery" class="col-md-2">
				<queries v-on:multi="setMultiQuery" :entry="entry" :ticket="ticket"></queries>
			</div>
		</div>
	</div>
</template>

<script>
import Popover from '../node_modules/vue-strap/src/Popover.vue';
import Affix from '../node_modules/vue-strap/src/Affix.vue';
import GridLoader from '../node_modules/vue-spinner/src/GridLoader.vue';

import Msa from './Msa.vue';
import Queries from './Queries.vue'
import colorScale from './ColorScale';

export default {
	name: 'result',
	components: { Queries, Msa, GridLoader, Popover, Affix },
	data() {
		return {
			status: "wait",
			ticket: "",
			error: "",
			entry: 0,
			msa: {
				query: {
					sequence: "",
					header: ""
				},
				results: []
			},
			multiquery: false
		};
	},
	created() {
		this.fetchData();
	},
	updated() {
		if (this.$refs.msa) {
			this.$refs.msa.setData(this.msa);
		}
	},
	watch: {
		'$route': 'fetchData'
	},
	methods: {
		tryLinkTargetToDB(target, db) {
			if (db.startsWith("pfam_")) {
				return 'http://pfam.xfam.org/family/' + target;
			} else if (db.startsWith("pdb")) {
				return 'http://www.rcsb.org/pdb/explore.do?structureId=' + target.split('_')[0];
			} else if (db.startsWith("uniclust")) {
				return 'http://www.uniprot.org/uniprot/' + target;
			}
			return false;
		},
		setMultiQuery(multi) {
			this.multiquery = multi;
			this.$refs.msa.fixWidth();
		},
		fetchData(entry) {
			this.error = "";
			this.ticket = this.$route.params.ticket;
			this.entry = this.$route.params.entry;

			this.$http.get("api/result/" + this.ticket + '/' + this.entry)
				.then((response) => {
					response.json().then((data) => {
						if (data.alignments == null || data.alignments.length > 0) {
							var color = colorScale();
							for (var i in data.results) {
								var db = data.results[i].db;
								data.results[i].color = color(db);
							}
							this.msa = data;
						} else {
							this.status = "error";
							this.error = "Failed";
						}
					});
				}, () => {
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

.db {
	border-left: 5px solid black;
}

a:not([href]) {
	color: #333;
}

a:not([href]):hover {
	text-decoration: none;
}
</style>

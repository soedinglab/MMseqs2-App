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
	
				<div v-if="resultState == 'RESULT'">
					<hits ref="hits" :ticket="ticket"></hits>
	
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
						<tbody v-for="entry in hits.results">
							<tr v-for="(item, index) in entry.alignments">
								<td class="db" v-if="index == 0" :rowspan="entry.alignments.length" :style="'border-color: ' + entry.color">{{ entry.db }}</id>
									<td>
										<a :href="item.href">{{item.target}}</a>
									</td>
									<td>{{ item.seqId }}</td>
									<td>{{ item.score }}</td>
									<td>{{ item.eval }}</td>
									<td>{{ item.qStartPos }}-{{ item.qEndPos }} ({{ item.qLen }})</td>
									<td>{{ item.dbStartPos }}-{{ item.dbEndPos }} ({{ item.dbLen }})</td>
							</tr>
						</tbody>
					</table>
				</div>
				<div v-else-if="resultState == 'PENDING'">
					<grid-loader class="loader" color="#000000">
					</grid-loader>
				</div>
				<div v-else-if="resultState == 'EMPTY'">
					No hits found! Start a
					<router-link to="/">New Search</router-link>?
				</div>
				<div v-else>
					Error! Start a
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

import Hits from './Hits.vue';
import Queries from './Queries.vue'
import colorScale from './ColorScale';

export default {
	name: 'result',
	components: { Queries, Hits, GridLoader, Popover, Affix },
	data() {
		return {
			ticket: "",
			error: "",
			entry: 0,
			hits: null,
			multiquery: false
		};
	},
	created() {
		this.fetchData();
	},
	updated() {
		if (this.$refs.hits) {
			this.$refs.hits.setData(this.hits);
		}
	},
	computed: {
		resultState() {
			if (this.hits == null && this.error == "") {
				return "PENDING";
			}

			if (!this.hits.results) {
				return "ERROR";
			}

			var hasResult = this.hits.results.length > 0;
			if (this.hits.results.length == 0) {
				return "EMPTY";
			}

			for (var i in this.hits.results) {
				if (this.hits.results[i].alignments != null) {
					return "RESULT";
				}
			}

			return "EMPTY";
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
			return null;
		},
		setMultiQuery(multi) {
			this.multiquery = multi;
		},
		fetchData(entry) {
			this.ticket = this.$route.params.ticket;
			this.entry = this.$route.params.entry;

			this.$http.get("api/result/" + this.ticket + '/' + this.entry)
				.then((response) => {
					this.error = "";
					response.json().then((data) => {
						if (data.alignments == null || data.alignments.length > 0) {
							var color = colorScale();
							for (var i in data.results) {
								var db = data.results[i].db;
								data.results[i].color = color(db);
								for (var j in data.results[i].alignments) {
									var item = data.results[i].alignments[j];
									item.href = this.tryLinkTargetToDB(item.target, db);
								}
							}
							this.hits = data;
						} else {
							this.error = "Failed";
						}
					});
				}, () => {
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

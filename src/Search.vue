<template>
	<div id="search"
	     class="container">
		<div class="row">
			<form>								
				<div class="col-xs-12 col-md-7">
					<fieldset>
						<legend>Queries
							<div class="pull-right">
								<popover effect="fade" placement="left" content="Enter your queries here or drag-and-drop a fasta file containing your queries into the textbox.">
									<a class="help" role="button"><span class="glyphicon glyphicon-question-sign" aria-hidden="true"></span></a>
								</popover>
							</div>
						</legend>
	
						<p v-if="error"
						   class="alert alert-danger">
							{{ status.message }}
						</p>
	
						<div class="form-group">
							<textarea class="form-control fasta"
							          v-model="query"
							          @dragover.prevent
							          @drop="fileDrop($event)"
							          placeholder="Please start a Search"
							          spellcheck="false"></textarea>
						</div>
	
						<div class="form-group">
							<button class="btn btn-primary"
							        v-on:click="search"
							        v-bind:disabled="searchDisabled">
								<span v-if="inSearch"
								      class="spinner">Spin</span> Search
							</button>
							<file-button id="file"
							             class="pull-right"
							             label="Upload FASTA File"
							             v-on:upload="upload" />
						</div>
					</fieldset>
				</div>
				<div class="col-xs-12 col-md-5">
					<fieldset>
						<legend>Databases
							<div class="pull-right">
								<popover effect="fade" placement="left" content="Select the databases you want to search against.">
									<a class="help" role="button"><span class="glyphicon glyphicon-question-sign" aria-hidden="true"></span></a>
								</popover>
							</div>
						</legend>
						<div class="row">
							<div class="col-sm-6">
								<h4>Sequences</h4>
								<div class="checkbox">
									<label>
										<input type="checkbox"
										       value="uniclust90_2017_02"
										       v-model="database"> Uniclust90
									</label>
								</div>
								<div class="checkbox">
									<label>
										<input type="checkbox"
										       value="uniclust30_2017_02"
										       v-model="database"> Uniclust30
									</label>
								</div>
							</div>
							<div class="col-sm-6">
								<h4>Domains</h4>
								<div class="checkbox">
									<label>
										<input type="checkbox"
										       value="eggnog_4.5"
										       v-model="database"> EggNOG
									</label>
								</div>
								<div class="checkbox">
									<label>
										<input type="checkbox"
										       value="pfam_30.0"
										       v-model="database"> Pfam
									</label>
								</div>
								<div class="checkbox">
									<label>
										<input type="checkbox"
										       value="pdb70_17Mar17"
										       v-model="database"> PDB70
									</label>
								</div>
							</div>
						</div>
					</fieldset>
					<fieldset>
						<legend>
							Result Mode
							<div class="pull-right">
								<popover effect="fade" placement="left" content="Select the search mode.">
									<a class="help" role="button"><span class="glyphicon glyphicon-question-sign" aria-hidden="true"></span></a>
								</popover>
							</div>
						</legend>
						<div class="row">
							<div class="col-md-12">
								<div class="form-group">
									<label for="accept">Top Hits</label>
									<div class="input-group"
									     style="width: 100%">
										<span class="input-group-addon">
												<input type="radio" value="accept" v-model="mode">
										</span>
										<input id="accept"
										       type="text"
										       class="form-control"
										       :disabled="mode == 'summary'"
										       v-model="accept" />
										<span class="input-group-addon">Hits</span>
									</div>
								</div>
	
								<div class="form-group">
									<label for="summary">Summarized</label>
									<div class="input-group"
									     style="width: 100%">
										<span class="input-group-addon">
															<input type="radio" value="summary" v-model="mode">
													</span>
										<input id="summary"
										       type="text"
										       class="form-control"
										       :disabled="mode == 'accept'"
										       v-model="eval" />
										<span class="input-group-addon">E-value Cutoff</span>
									</div>
								</div>
							</div>
						</div>
					</fieldset>
					<fieldset v-if="multiQuery">
						<legend>Notify</legend>
						<div class="row">
							<div class="col-md-12">
								<div class="form-group">
									<label for="email">E-mail</label>
									<div class="input-group"
									     style="width: 100%">
										<input id="email"
										       type="text"
										       class="form-control"
										       placeholder="you@example.org"
										       v-model="email" />
									</div>
								</div>
							</div>
						</div>
					</fieldset>
				</div>
			</form>				
		</div>
	</div>
</template>

<script>
import SearchResultItem from './SearchResultItem.vue';
import FileButton from './FileButton.vue';
import Popover from '../node_modules/vue-strap/src/Popover.vue';

export default {
	name: 'search',
	components: { SearchResultItem, FileButton, Popover },
	data() {
		return {
			searchPreset: 'normal',
			database: ['uniclust30_2017_02'],
			mode: 'accept',
			accept: 300,
			eval: 0.001,
			inSearch: false,
			email: '',
			query: ">TEST\nMPKIIEAIYENGVFKPLQKVDLKEGEKAKIVLESISDKTFGILKASETEIKKVLEEIDDFWGVC",
			status: {
				type: '',
				message: ''
			}
		};
	},
	computed: {
		searchDisabled() {
			return this.inSearch
				|| this.database.length == 0
				|| this.query.length == 0;
		},
		error() {
			return this.status.type == 'error';
		},
		multiQuery() {
			return this.query.match(/>.*[\s\S]+>/m) !== null;
		}
	},
	localStorage: {
        history: {
            type: Array,
            default: []
        }
    },
	methods: {
		search(event) {
			if (this.query.length == 0)
				return false;

			this.inSearch = true;
			const data = {
				q: this.query,
				database: this.database
			};
			this.$http.post('api/ticket', data, { emulateJSON: true })
				.then(function (response) {
					this.status.message = this.status.type = "";
					this.inSearch = false;
					const result = response.body;
					if (result.status == "PENDING" || result.status == "RUNNING") {
						this.addToHistory(result.ticket);						
						this.$router.push({ name: 'queue', params: { ticket: result.ticket } });
					} else if (result.status == "COMPLETED") {
						this.addToHistory(result.ticket);
						this.$router.push({ name: 'result', params: { ticket: result.ticket } });
					} else {
						this.status.type = "error";
						this.status.message = "Error loading search result";
					}
				})
				.catch(function () {
					this.status.type = "error";
					this.status.message = "Error loading search result";
					this.inSearch = false;
				});
		},
		fileDrop(event) {
			event.preventDefault();
			event.stopPropagation();

			var dataTransfer = event.dataTransfer || event.target;
			if (dataTransfer && dataTransfer.files && dataTransfer.files.length > 0) {
				this.upload(dataTransfer.files);
			}
		},
		upload(files) {
			var reader = new FileReader();
			reader.onload = function (e) {
				this.query = e.target.result;
			}.bind(this);
			reader.readAsText(files[0]);
		},
		addToHistory(uuid) {
            let history = this.$localStorage.get('history');
            history.unshift({ time: +(new Date()), ticket: uuid });
            this.$localStorage.set('history', history);
        }
	}
};
</script>

<style>
textarea.fasta {
	font-family: Inconsolata, Consolas, Inconsolata-dz, Courier New, Courier, monospace;
	min-height: 250px;
	resize: vertical;
	font-size: 16px;
}

@media (min-width: 768px) {
	textarea.fasta {
		height:65vh;
	}
}

fieldset h4 {
	margin-top: 0;
}

legend {
	margin-bottom: 10px;
}

fieldset {
	margin-top: 20px;
}

fieldset+fieldset {
	margin-top: 0;
}

.pull-right button {
	display: inline-block;
	vertical-align: bottom;
}

a.help {
	color:#ccc;
	text-decoration: none;
}

a.help:hover {
	color:#999;
	text-decoration: none;
}
</style>

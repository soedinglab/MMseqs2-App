<template>
	<div id="search"
	     class="container">
		<div class="row">
			<div class="col-xs-12 col-md-7">
				<fieldset>
					<legend>Queries
						<div class="pull-right">
							<popover effect="fade"
							         placement="left"
							         content="Enter your queries here or drag-and-drop a fasta file containing your queries into the textbox.">
								<a class="help"
								   role="button"><span class="glyphicon glyphicon-question-sign" aria-hidden="true"></span></a>
							</popover>
						</div>
					</legend>
	
					<p v-if="error"
					   class="alert alert-danger">
						{{ status.message }}
					</p>
	
					<div class="form-group">
						<textarea class="form-control fasta marv-bg"
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
							<popover effect="fade"
							         placement="left"
							         content="Select the databases you want to search against.">
								<a class="help"
								   role="button"><span class="glyphicon glyphicon-question-sign" aria-hidden="true"></span></a>
							</popover>
						</div>
					</legend>
					<div class="row">
						<div class="col-sm-6">
							<h4>Sequences</h4>
							<div class="checkbox"
							     v-for="db in databaseSettings.sequence">
								<label>
									<input type="checkbox"
									       :value="db"
									       v-model="database"> {{db}}
								</label>
							</div>
						</div>
						<div class="col-sm-6">
							<h4>Domains</h4>
							<div class="checkbox"
							     v-for="db in databaseSettings.domain">
								<label>
									<input type="checkbox"
									       :value="db"
									       v-model="database"> {{db}}
								</label>
							</div>
						</div>
					</div>
				</fieldset>
				<fieldset>
					<legend>
						Result Mode
						<div class="pull-right">
							<popover effect="fade"
							         placement="left"
							         content="Select the search mode.">
								<a class="help"
								   role="button"><span class="glyphicon glyphicon-question-sign" aria-hidden="true"></span></a>
							</popover>
						</div>
					</legend>
					<div class="row">
						<div class="col-md-6">
							<div class="form-group">
								<div class="radio">
									<label>
										<input type="radio"
										       value="accept"
										       v-model="mode"> Max <i>N</i>-Hits
									</label>
								</div>
							</div>
						</div>
						<div class="col-md-6">
							<div class="form-group">
								<div class="radio">
									<label>
										<input type="radio"
										       value="summary"
										       v-model="mode"> Annotate
									</label>
								</div>
							</div>
						</div>
					</div>
				</fieldset>
				<fieldset>
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
		</div>
	</div>
</template>

<script>
import SearchResultItem from './SearchResultItem.vue';
import FileButton from './FileButton.vue';
import Popover from '../node_modules/vue-strap/src/Popover.vue';
import Config from './config-cache.json';

var databaseSettings = { 'sequence': [], 'domain': [] };
for (var i in Config["search-databases"]) {
	var type = Config["search-databases-types"][i];
	databaseSettings[type].push(Config["search-databases"][i]);
}


export default {
	name: 'search',
	components: { SearchResultItem, FileButton, Popover },
	data() {
		return {
			databaseSettings: databaseSettings,
			database: [],
			mode: 'accept',
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
			const data = {
				q: this.query,
				database: this.database,
				mode: this.mode
			};
			this.inSearch = true;
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
		height: 65vh;
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
	color: #ccc;
	text-decoration: none;
}

a.help:hover {
	color: #999;
	text-decoration: none;
}

legend a.help span {
	display: inline-block;
	vertical-align: middle;
}

.popover.left .arrow {
	margin-top: -15px;
}

.marv-bg {
	background-image: url('/assets/marv-search_1x.png');
	background-repeat: no-repeat;
	background-position: right 15px bottom -10px;
	background-size: 200px;
}
</style>

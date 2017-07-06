<template>
	<div id="search"
	     class="container">
		<div class="row ">
			<div class="form form-horizontal">
				<div class="col-xs-12 col-md-7">
					<fieldset>
						<legend>Queries
							<div class="pull-right">
								<popover effect="fade"
								         trigger="hover"
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
							<modal title="cURL Submission Command" v-model="showCurl" @ok="showCurl = false">
								Use this command to get a submit a file with fasta entries to the MMseqs search server.
								Replace the 'PATH_TO_FILE' string with the path to the file.
								<br>
								<code>curl -X POST -F q=@PATH_TO_FILE <span v-if="email">-F 'email={{email}}'</span> -F 'mode={{mode}}' <span v-for="db in database">-F 'database[]={{db.path}}' </span> {{ origin() + '/api/ticket' }}</code>
								<br slot="modal-footer" />
							</modal>
							<div class="pull-right">
							<button class="btn btn-default"
							        v-on:click="showCurl = true"
									:disabled="searchDisabled"> Get cURL Command
							</button>
							<file-button id="file"
							             label="Upload FASTA File"
							             v-on:upload="upload">
							</file-button>
							</div>
						</div>
					</fieldset>
				</div>
				<div class="col-xs-12 col-md-5">
					<fieldset>
						<legend>Search Settings
							<div class="pull-right">
								<popover effect="fade"
								         trigger="hover"
								         placement="left"
								         content="Choose the databases to search against, the result mode, and optionally an email to notify you when the job is done.">
									<a class="help"
									   role="button"><span class="glyphicon glyphicon-question-sign" aria-hidden="true"></span></a>
								</popover>
							</div>
						</legend>
						<div class="form-group">
							<popover effect="fade"
							         placement="right"
							         trigger="hover"
							         content="Select the databases you want to search against.">
								<label class="control-label col-sm-3">Databases</label>
							</popover>
	
							<div v-if="databases.length == 0" class="col-sm-9">
								<div
							     :class="['alert', { 'alert-info': !dberror }, { 'alert-danger': dberror }]">
									<scale-loader v-if="!dberror"
												class="loader"
												color="#000000" />
									<span v-else>Could not query available databases!</span>
								</div>
							</div>
							<div v-else
							     class="col-sm-9">
								<div class="checkbox"
								     v-for="(db, index) in databases">
									<label>
										<input type="checkbox"
										       :value="db"
										       v-model="database">{{db.name}} <small class="text-muted">{{db.version}}</small>
									</label>
								</div>
							</div>
						</div>
	
						<div class="form-group">
							<popover effect="fade"
							         placement="right"
							         trigger="hover"
							         content="All shows all hits under an evalue cutoff. Annotations tries to cover the search query.">
								<label class="control-label col-sm-3">Result
									<br class="hidden-xs hidden-sm"> Mode</label>
							</popover>
							<div class="col-sm-9">
								<div class="radio">
									<label>
										<input type="radio"
										       value="accept"
										       v-model="mode"> All
									</label>
								</div>
								<div class="radio">
									<label>
										<input type="radio"
										       value="summary"
										       v-model="mode"> Annotations
									</label>
								</div>
							</div>
						</div>
	
						<div class="form-group">
							<popover effect="fade"
							         placement="right"
							         trigger="hover"
							         content="Send an email when the job is done.">
								<label class="control-label col-sm-3"
								       for="email">Email</label>
							</popover>
							<div class="col-sm-9">
								<input id="email"
								       type="text"
								       class="form-control input-sm"
								       placeholder="you@example.org (Optional)"
								       v-model="email" />
								<p class="help-block"></p>
							</div>
						</div>
					</fieldset>
					<fieldset>
						<legend>Reference</legend>
						<div class="col-sm-12">
						<p>Mirdita M., Söding J.#, and Steinegger M.#, <a href="#">MMseqs Webserver: Instant deployement, Instant searches</a>, <i>XXXX.</i> 201X.</p>
						<small class="text-muted"># corresponding authors</small>
						</div>
					</fieldset>
				</div>
			</div>
		</div>
	</div>
</template>

<script>
import FileButton from './FileButton.vue';
import Popover from '../node_modules/vue-strap/src/Popover.vue';
import Modal from '../node_modules/vue-strap/src/Modal.vue';
import ScaleLoader from '../node_modules/vue-spinner/src/ScaleLoader.vue';

export default {
	name: 'search',
	components: { FileButton, Popover, Modal, ScaleLoader },
	data() {
		return {
			dberror: false,
			databases: [],
			database: [],
			mode: 'accept',
			inSearch: false,
			email: '',
			query: ">TEST\nMPKIIEAIYENGVFKPLQKVDLKEGEKAKIVLESISDKTFGILKASETEIKKVLEEIDDFWGVC",
			status: {
				type: '',
				message: ''
			},
			showCurl: false
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
	created() {
		this.fetchData();
	},
	watch: {
		'$route': 'fetchData'
	},
	methods: {
		origin() {
			return window.location.protocol + "//" + window.location.hostname + (window.location.port ? ':' + window.location.port: '');
		},
		fetchData() {
			this.$http.get('api/databases').then((response) => {
				response.json().then((data) => {
					this.dberror = false;
					this.databases = data.databases;
					for (var i in this.databases) {
						if (this.databases[i].default == true) {
							this.database.push(this.databases[i]);
						}
					}
				})
			}, () => {
				this.dberror = true;
			});
		},
		search(event) {
			var data = {
				q: this.query,
				database: this.database.map(x => {
					return x.path;
				}),
				mode: this.mode
			};
			if (this.email != '') {
				data.email = this.email;
			}
			this.inSearch = true;
			this.$http.post('api/ticket', data, { emulateJSON : true })
				.then((response) => {
					response.json().then((data) => {
						this.status.message = this.status.type = "";
						this.inSearch = false;
						if (data.status == "PENDING" || data.status == "RUNNING") {
							this.addToHistory(data.ticket);
							this.$router.push({ name: 'queue', params: { ticket: data.ticket } });
						} else if (data.status == "COMPLETED") {
							this.addToHistory(data.ticket);
							this.$router.push({ name: 'result', params: { ticket: data.ticket } });
						} else {
							this.status.type = "error";
							this.status.message = "Error loading search result";
						}
					})
				}, 
				() => {
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
			reader.onload = (e) => {
				this.query = e.target.result;
			};
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
	min-height: 200px;
	resize: vertical;
	font-size: 16px;
}

@media (min-width: 768px) {
	textarea.fasta {
		height: 65vh !important;
	}
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
	background-image: url('/assets/marv-search-gray.png');
	background-repeat: no-repeat;
	background-position: right 15px bottom -10px;
	background-size: 200px;
}

code {
	font-size: 0.8em;
}
</style>

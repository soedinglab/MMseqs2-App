<template>
	<v-container grid-list-md>
		<v-layout row wrap>
			<v-flex xs12 md8>
				<panel class="query-panel d-flex fill-height" header="Queries" fill-height>
					<p slot="desc" v-if="error" class="alert alert-danger">
						{{ status.message }}
					</p>

					<template slot="content">
						<!-- Enter your queries here or drag-and-drop a fasta file containing your queries into the textbox. -->
						<v-text-field class="fasta marv-bg" hide-details multi-line v-model="query" @dragover.prevent @drop="fileDrop($event)" placeholder="Please start a Search" spellcheck="false">
						</v-text-field>

						<div class="actions">
						<v-dialog v-if="!$ELECTRON" v-model="showCurl" lazy absolute :disabled="searchDisabled">
							<v-btn slot="activator" :disabled="searchDisabled">
								Get cURL Command
							</v-btn>
							<v-card>
								<v-card-title>
									<div class="headline">cURL Command</div>
								</v-card-title>
								<v-card-text>
									Use this command to get a submit a file with fasta entries to the MMseqs search server. Replace the 'PATH_TO_FILE' string with the path to the file.
								<br>
								<code>curl -X POST -F q=@PATH_TO_FILE <span v-if="email">-F 'email={{email}}'</span> -F 'mode={{mode}}' <span v-for="(db, i) in selectedDatabases" :key="i">-F 'database[]={{db.path}}' </span> {{ origin() + '/api/ticket' }}</code>
								</v-card-text>
								<v-card-actions>
									<v-spacer></v-spacer>
									<v-btn color="green darken-1" flat="flat" @click.native="showCurl = false">Close</v-btn>
								</v-card-actions>
							</v-card>
						</v-dialog>

						<file-button id="file" label="Upload FASTA File" v-on:upload="upload"></file-button>
						</div>
					</template>
				</panel>
			</v-flex>
			<v-flex xs12 md4>
				<panel header="Search Settings">
					<div slot="content">
						<div class="input-group">
							<v-tooltip open-delay="300" top>
								<label slot="activator">Databases</label>
								<span v-if="$ELECTRON">Choose the databases to search against and the result mode.</span>
								<span v-else>Choose the databases to search against, the result mode, and optionally an email to notify you when the job is done.</span>
							</v-tooltip>
						</div>
							
						<div v-if="databases.length == 0">
							<div :class="['alert', { 'alert-info': !dberror }, { 'alert-danger': dberror }]">
								<span v-if="dberror">Could not query available databases!</span>
							</div>
						</div>
						<v-checkbox v-else v-for="(db, index) in databases" v-model="database" :key="index" :value="index" :label="db.name + ' ' + db.version" hide-details></v-checkbox>

						<v-radio-group v-model="mode">
							<v-tooltip open-delay="300" top>
							<label slot="activator">Mode</label>
							<span>'All' shows all hits under an e-value cutoff. 'Annotations' tries to cover the search query.</span>
							</v-tooltip>
							<v-radio value="accept" label="All" hide-details>All</v-radio>
							<v-radio value="summary" label="Annotations" hide-details></v-radio>
						</v-radio-group>

						<v-tooltip v-if="!$ELECTRON" open-delay="300" top>
							<v-text-field slot="activator" id="email" label="Notification Email (Optional)" placeholder="you@example.org" v-model="email"></v-text-field>
							<span>Send an email when the job is done.</span>
						</v-tooltip>

						<v-btn color="primary" :loading="inSearch" block large v-on:click="search" :disabled="searchDisabled"><v-icon>search</v-icon>Search</v-btn>
					</div>
				</panel>
			</v-flex>
		</v-layout>
	</v-container>

	<!-- 
	<fieldset>
		<legend>Reference</legend>
		<div class="col-sm-12">
		<p>Mirdita M., Söding J.#, and Steinegger M.#, <a href="#">MMseqs Webserver: Instant deployement, Instant searches</a>, <i>XXXX.</i> 201X.</p>
		<small class="text-muted"># corresponding authors</small>
		</div>
	</fieldset>-->
</template>

<script>
import Panel from './Panel.vue';
import FileButton from './FileButton.vue';

export default {
	name: 'search',
	components: { Panel, FileButton },
	data() {
		return {
			dberror: false,
			databases: [],
			inSearch: false,
			status: {
				type: '',
				message: ''
			},
			showCurl: false,

			mode_: null,
			email_: null,
			query_: null,
			database_: null,
		};
	},
	computed: {
		mode: {
			get: function() {
				this.mode_ = this.$localStorage.get('mode', 'accept');
				return this.mode_;
			},
			set: function(value) {
				this.$localStorage.set('mode', value);
				this.mode_ = value;
			}
		},
		email: {
			get: function() {
				this.email_ = this.$localStorage.get('email', '');
				return this.email_;
			},
			set: function(value) {
				this.$localStorage.set('email', value);
				this.email_ = value;
			}
		},
		query: {
			get: function() {
				if (this.query_ == null) {
					this.query_ = this.$localStorage.get('query', '>TEST\nMPKIIEAIYENGVFKPLQKVDLKEGEKAKIVLESISDKTFGILKASETEIKKVLEEIDDFWGVC');
				}
				return this.query_;
			},
			set: function(value) {
				this.$localStorage.set('query', value);
				this.query_ = value;
			}
		},
		database: {
			get: function() {
				if (this.database_ == null) {
					this.database_ = JSON.parse(this.$localStorage.get('database', '[]'));
				}
				return this.database_;
			},
			set: function(value) {
				this.$localStorage.set('database', JSON.stringify(value));
				this.database_ = value;
			}
		},
		selectedDatabases: {
			get: function() {
				return this.databases.filter((_, i) => { return i in this.database; });
			}
		},
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
			return window.location.protocol + "//" + window.location.hostname + (window.location.port ? ':' + window.location.port : '');
		},
		fetchData() {
			this.$http.get('api/databases').then((response) => {
				response.json().then((data) => {
					this.dberror = false;
					this.databases = data.databases;

					var dbs = [];
					for (var i in this.databases) {
						if (this.databases[i].default == true) {
							dbs.push(this.databases[i]);
						}
					}

					if (this.database_ === null) {
						this.database_ = Array.from(Array(this.databases.length).keys());
					}
				})
			}, () => {
				this.dberror = true;
			});
		},
		search(event) {
			var data = {
				q: this.query,
				database: this.selectedDatabases.map(x => {
					return x.path;
				}),
				mode: this.mode
			};
			if (!__ELECTRON__ && this.email != '') {
				data.email = this.email;
			}
			this.inSearch = true;
			this.$http.post('api/ticket', data, { emulateJSON: true })
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

			let found = -1;
			for (let i in history) {
				if (history[i].ticket == uuid) {
					found = i;
					break;
				}
			}

			if (found == -1) {
				history.unshift({ time: +(new Date()), ticket: uuid });
			} else {
				let tmp = history[found];
				tmp.time = +(new Date());
				history.splice(found, 1);
				history.unshift(tmp);
			}

			this.$localStorage.set('history', history);
		}
	}
};
</script>

<style>
.query-panel .actions {
	flex:0;
}

.query-panel textarea, .fasta .input-group__input {
	height: 100%;
}

.fasta {
	margin-bottom: 16px;
}

a.help {
	color: #ccc;
	text-decoration: none;
}

a.help:hover {
	color: #999;
	text-decoration: none;
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

.tooltip label {
	pointer-events: all;
}
</style>

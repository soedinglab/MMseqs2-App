<template>
	<div id="search"
	     class="container">
		<div class="row">
			<form>
				<div class="col-xs-12 col-md-7">
					<p :class="status.class">
						{{ status.message }}
					</p>
	
					<div class="form-group">
						<label for="query">FASTA-Query</label>
						<textarea class="form-control fasta"
						          v-model="query"
						          placeholder="Please start a Search"></textarea>
					</div>
	
					<div class="form-group">
	
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
				</div>
				<div class="col-xs-12 col-md-5">
					<fieldset>
						<div class="row">
							<div class="col-md-6">
								<div class="form-group">
									<legend>Database</legend>
									<div class="radio">
										<label>
											<input type="radio"
											       id="database-uc90"
											       value="uc90"
											       v-model="database"> Uniclust90
										</label>
									</div>
									<div class="radio">
										<label>
											<input type="radio"
											       id="database-uc30"
											       value="uc30"
											       v-model="database"> Uniclust30
										</label>
									</div>
									<div class="radio">
										<label>
											<input type="radio"
											       id="database-none"
											       value=""
											       v-model="database"> Annotations Only
										</label>
									</div>
								</div>
							</div>
							<div class="col-md-6">
								<div class="form-group">
									<legend>Annotations</legend>
									<div class="radio">
										<label>
											<input type="checkbox"
											       id="annotations"
											       value="eggnog"
											       v-model="annotations"> EggNOG
										</label>
									</div>
									<div class="radio">
										<label>
											<input type="checkbox"
											       id="annotations"
											       value="pfam"
											       v-model="annotations"> Pfam
										</label>
									</div>
									<div class="radio">
										<label>
											<input type="checkbox"
											       id="annotations"
											       value="pdb70"
											       v-model="annotations"> PDB70
										</label>
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

export default {
	name: 'search',
	components: { SearchResultItem, FileButton },
	data() {
		return {
			searchPreset: 'normal',
			database: 'uc30',
			annotations: ['pfam', 'pdb70', 'eggnog'],
			inSearch: false,
			query: ">TEST\nMPKIIEAIYENGVFKPLQKVDLKEGEKAKIVLESISDKTFGILKASETEIKKVLEEIDDFWGVC",
			status: {
				class: '',
				message: ''
			}
		};
	},
	computed: {
		searchDisabled: function () {
			return this.inSearch
				|| (this.database.length == 0 && this.annotations.length == 0)
				|| this.query.length == 0;
		}
	},
	methods: {
		search(event) {
			if (this.query.length == 0)
				return false;

			this.inSearch = true;
			const data = {
				q: this.query,
				database: this.database,
				annotations: this.annotations
			};
			this.$http.post('api/ticket', data, { emulateJSON: true }).then(function (response) {
				this.status.message = this.status.class = "";
				this.inSearch = false;

				const result = response.body;
				if (result.status == "PENDING") {
					this.$router.push({ name: 'search-result', params: { ticket: result.ticket } });
				} else {
					this.error("Error loading search result");
				}
			}, function () {
				this.error("Error loading search result");
			});
		},
		upload(files) {
			var reader = new FileReader();
			reader.onload = function (e) {
				this.query = e.target.result;
			}.bind(this);
			reader.readAsText(files[0]);
		},
		error(message) {
			this.status.message = message;
			this.status.class = "alert alert-danger";
			this.inSearch = false;
		}
	}
};
</script>

<style>
.fasta {
	font-family: Inconsolata, Consolas, Inconsolata-dz, Courier New, Courier, monospace;
	min-height: 200px;
	resize: both;
	font-size: 16px;
}
</style>

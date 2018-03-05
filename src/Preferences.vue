<template>
<v-container grid-list-md fluid>
	<v-layout row wrap>
	<v-flex xs12 md7>
		<panel>
			<template slot="header">
				Databases
			</template>

			<template slot="toolbar-extra">
				<v-toolbar-items>
					<v-btn v-if="inReorder == false" dark @click="inReorder = true">
						Reorder
					</v-btn>
					<v-btn dark primary v-else @click="saveOrder">
						Save Order
					</v-btn>
					<v-btn dark class="ml-1 mr-0" @click="dialog = true">New Database</v-btn>
				</v-toolbar-items>
			</template>

			<div slot="desc" v-if="error">
				<v-container fill-height grid-list-md>
					<v-layout row justify-center>
						<v-flex xs4>
							<img style="max-width:100%" src="./assets/marv-error_2x.png" srcset="./assets/marv-error_2x.png 2x, ./assets/marv-error_3x.png 3x" />
						</v-flex>
						<v-flex xs8>
							<h3>Error!</h3>
						</v-flex>
					</v-layout>
				</v-container>
			</div>

			<div slot="content">
				<v-list two-line subheader dense>
					<draggable v-model="databases" :options="{ handle: '.drag-handle' }">
					<v-list-tile v-for="(child, i) in databases" :key="i">
						<v-list-tile-action>
							<v-icon v-if="inReorder == false">dns</v-icon>
							<v-btn v-else style="cursor: move" icon class="drag-handle">
								<v-icon>reorder</v-icon>
							</v-btn>
						</v-list-tile-action>
						<v-list-tile-content>
							<v-list-tile-title>
								{{ child.name }}
							</v-list-tile-title>
							<v-list-tile-sub-title>
								{{ child.version }}
							</v-list-tile-sub-title>
						</v-list-tile-content>
						<v-list-tile-action>
							<v-btn icon>
								<v-icon>delete</v-icon>
							</v-btn>
						</v-list-tile-action>
					</v-list-tile>
					</draggable>
				</v-list>
			</div>
		</panel>
		</v-flex>
		<v-flex xs12 md5>
		<v-container grid-list-md fluid>
			<v-layout row wrap>
				<v-flex xs12>
					<v-card color="blue-grey darken-2" class="white--text">
						<v-card-title primary-title>
							<div>
								<div class="headline"><span v-if="!supportedPlatform">Un</span>Supported Platform</div>
								<span class="grey--text">Current Platform: {{ __OS__.platform }} - {{ __OS__.arch }} - {{ __SIMD__ }}</span>
							</div>
						</v-card-title>
					</v-card>
				</v-flex>
				<v-flex xs12>
					<v-card color="blue-grey darken-2" class="white--text">
						<v-card-title primary-title>
							<div>
								<div class="headline">MMseqs2</div>
								<span class="grey--text">Version: TODO</span>
							</div>
						</v-card-title>
					</v-card>
				</v-flex>
			</v-layout>
		</v-container>
		</v-flex>
	</v-layout>
	<v-dialog v-model="dialog" persistent max-width="500px">
      <panel>
		<template slot="header">
			New Database
		</template>
		<div slot="content">
        <v-card-text>
          <v-container grid-list-md>
            <v-layout wrap>
              <v-flex xs12 sm6>
                <v-text-field label="Name" required></v-text-field>
              </v-flex>
              <v-flex xs12 sm6>
                <v-text-field label="Version" hint="example of helper text only on focus"></v-text-field>
              </v-flex>
              <v-flex xs12>
                <v-text-field label="Email" required></v-text-field>
              </v-flex>
              <v-flex xs12>
                <v-text-field label="Password" type="password" required></v-text-field>
              </v-flex>
            </v-layout>
          </v-container>
          <small>*indicates required field</small>
        </v-card-text>
        <v-card-actions>
          <v-spacer></v-spacer>
          <v-btn color="blue darken-1" flat @click.native="dialog = false">Close</v-btn>
          <v-btn color="blue darken-1" flat @click.native="dialog = false">Save</v-btn>
        </v-card-actions>
		</div>
      </panel>
    </v-dialog>
</v-container>
</template>

<script>
import Panel from './Panel.vue';
import Draggable from 'vuedraggable';

export default {
	components: { Panel, Draggable },
	data() {
		return {
			databases: [],
			error: false,
			inReorder: false,
			dialog: false
		}
	},
	created() {
		this.fetchData();
	},
	watch: {
		$route: "fetchData"
	},
	computed: {
		supportedPlatform() {
			if (!__ELECTRON__) {
				return true;
			}
			
			var isSupportedOS = false;
			switch(this.__OS__.platform) {
				case "win32":
				case "darwin":
				case "linux":
				isSupportedOS = true;
				break;
				default:
				isSupportedOS = false;
			}

			var isSupportedArch = this.__OS__.arch == "x64";

			var isSupprtedSIMD = false;
			switch(this.__SIMD__) {
				case "avx2":
				case "sse41":
				isSupprtedSIMD = true;
				break;
				default:
				isSupprtedSIMD = false;
			}
			
			return isSupportedOS && isSupportedArch && isSupprtedSIMD;
		}
	},
	methods: {
		fetchData() {
			this.error = false;
			this.$http.get("api/databases").then(
				response => {
					response.json().then(data => {
						console.log(data);
						this.databases = data.databases;
						this.error = false;
					}).catch(() => {
						this.error = true;
					});				
				}).catch(() => {
					this.error = true;
				}
			);
		},
		saveOrder() {
			this.inReorder = false;
		}
	}
};
</script>
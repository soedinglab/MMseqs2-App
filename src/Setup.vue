<template>
<v-container fill-height grid-list-md fluid style="overflow:hidden">
	<v-layout row wrap>
		<v-flex xs12 md4>
			<v-card color="blue-grey darken-2" class="white--text">
				<v-card-title primary-title>
					<div>
						<div class="headline"><span v-if="!supportedPlatform">Un</span>Supported Platform</div>
						<span class="grey--text">Current Platform: {{ __OS__.platform }} - {{ __OS__.arch }} - {{ __SIMD__ }}</span>
					</div>
				</v-card-title>
			</v-card>
		</v-flex>
		<v-flex xs12 md4>
			<v-card color="blue-grey darken-2" class="white--text">
				<v-card-title primary-title>
					<div>
						<div class="headline">MMseqs2</div>
						<span class="grey--text">Version: TODO</span>
					</div>
				</v-card-title>
			</v-card>
		</v-flex>
		<v-flex xs12 md4>
			<v-card color="blue-grey darken-2" class="white--text">
				<v-card-title primary-title>
					<div>
						<div class="headline">MMseqs2</div>
						<span class="grey--text">Version: TODO</span>
					</div>
				</v-card-title>
				<v-spacer></v-spacer>
				<v-card-actions>
					<v-btn disabled flat dark>Update</v-btn>
				</v-card-actions>
			</v-card>
		</v-flex>
	</v-layout>
</v-container>
</template>

<script>
export default {
	created() {
		if (!__ELECTRON__) {
			this.$router.replace({ name: "search" });
		}
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
	}
};
</script>
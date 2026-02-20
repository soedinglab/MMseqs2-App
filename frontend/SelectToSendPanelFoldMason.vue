<template>
    <div>
        <!-- For displaying number of selected entries and buttons to switch -->
        <v-fade-transition>
            <v-sheet color="transparent" :style="{'position': 'fixed', 'width': $vuetify.breakpoint.smAndDown ? 'fit-content' : '40%', 
            'left': $vuetify.breakpoint.smAndDown ? '16px' : '30%',
            'bottom': '16px', 'z-index': 199, 'align-items': 'center', 'justify-content': $vuetify.breakpoint.smAndDown ? 'flex-start' : 'space-between'}" 
            class="d-flex pa-2" v-if="targetIndex >= 0" 
            >
                <v-chip label :close="selectedCounts > 0" color="primary" style="margin-right: 24px;" 
                class="elevation-8" 
                @click:close="clearAllMotifs" >
                    <span v-html="selectionBannerContent"></span>
                </v-chip>
                <v-flex shrink>
                    <template>
                        <v-tooltip top :color="errorFoldseekBtn ? 'error': 'primary'" :value="errorFoldseekBtn" :open-on-click="false">
                            <template v-slot:activator="{on, attrs}">
                                <v-btn :color="errorFoldseekBtn ? 'error': 'primary'" 
                                v-bind="attrs" v-on="on" fab 
                                class="mr-3 elevation-8" 
                                :loading="loading" 
                                @click.stop="sendToFoldseek">
                                    <v-icon>{{$MDI.Monomer}}</v-icon>
                                </v-btn>
                            </template> 
                            <span>{{ toFoldseekContent }}</span>
                        </v-tooltip>
                        <v-tooltip top :color="errorFoldDiscoBtn ? 'error' : '#eca800'" :value="errorFoldDiscoBtn" :open-on-click="false">
                            <template v-slot:activator="{on, attrs}">
                                <!-- TODO: change FoldDisco color! -->
                                <v-btn v-bind="attrs" v-on="on" fab class="elevation-8 fold-disco-btn" 
                                style="color: #fff"
                                :color="errorFoldDiscoBtn ? 'error' : '#eca800'" 
                                :loading="loading" 
                                @click.stop="sendToFoldDisco">
                                    <v-icon>{{$MDI.Motif}}</v-icon>
                                </v-btn>
                            </template>
                            <span v-html="toFoldDiscoContent"></span>
                        </v-tooltip>
                    </template>
                </v-flex>
            </v-sheet>
        </v-fade-transition>
        <portal>
            <v-dialog v-model="loading" persistent width="480px">
                <v-card :loading="loading">
                    <template slot="progress">
                        <v-progress-linear indeterminate color="primary"></v-progress-linear>
                    </template>
                    <v-card-title>Please Wait...!</v-card-title>
                    <v-card-text>
                        We're processing your request. It may take upto a minute...
                    </v-card-text>
                    <v-card-actions>
                        <v-btn color="primary" @click="cancelJob" text>Cancel</v-btn>
                    </v-card-actions>
                </v-card>
            </v-dialog>
        </portal>
    </div>
</template>

<script>
import { getAccession, mockPDB, getResidueIndices, decodeMultimer, storeChains, revertChainInfo } from './Utilities.js';
import { StorageWrapper} from './lib/HistoryMixin.js';
import { BlobDatabase } from './lib/BlobDatabase.js';
import { pulchra } from 'pulchra-wasm';
import AllAtomPredictMixin from './AllAtomPredictMixin.vue';

const localDb = BlobDatabase()

export default {
    name: 'SelectToSendPanelFoldMason',
    mixins: [ AllAtomPredictMixin ],
    data() {
        return {
            errorFoldseekBtn: false,
            errorFoldDiscoBtn: false,
            cancelCtl: null,
            loading: false,
        }
    },
    props: {
        entries: {
            type: Array,
            default: () => {[]},
        },
        ticket: {
            type: String,
            default: ""
        },
        targetIndex: {
            type: Number,
            default: 0,
        },
        selectedColumns: {
            type: Array,
            default: () => {[]},
        },
    },
    // mounted() {
    //     console.log(this.entries, this.targetIndex);        
    // },
    watch: {
        targetIndex() {
            this.errorFoldDiscoBtn=false
            this.errorFoldseekBtn=false
        },
    },
    methods: {
        async sendToFoldseek() {
            if (this.loading) {
                return
            }

            this.loading = true
            this.errorFoldseekBtn = false
            const entry = this.entries[this.targetIndex]

            let result
            try {
                result = await this.getMockPdb(entry)
            } catch (error) {
                if (error?.name == "AbortError") {
                    console.log("Job canceled")
                }  else {
                    console.error(error.message)
                    this.errorFoldseekBtn = true
                }
                this.loading = false
                return
            }
            const accession = getAccession(entry.name)
            const pdb = this.prependInformation(result, accession);
            this.loading = false
            await localDb.setItem('query', pdb)
            this.$router.push({name: "search"})
        },
        async sendToFoldDisco() {
            if (this.loading) { 
                return 
            }
            
            this.errorFoldDiscoBtn = false
            this.loading = true
            const target = this.entries[this.targetIndex]

            this.cancelCtl = new AbortController();
            let targetPdb
            let motifs
            try {
                const signal = this.cancelCtl.signal
                targetPdb = await this.getFullPdb(target, signal)
                motifs = this.motifStr
            } catch (error) {
                if (error?.name == 'AbortError') {
                    console.log('Job canceled')
                } else {
                    this.errorFoldDiscoBtn = true
                    console.error(error)
                }
                this.loading = false
                return
            }
            this.loading = false
            this.cancelCtl = null
            if (!targetPdb) {
                return
            }
            const storage = new StorageWrapper('folddisco')
            const accession = getAccession(target.name)

            await localDb.setItem('folddisco.query', this.prependInformation(targetPdb, accession))
            await storage.setItem('motif', motifs)
            this.$router.push({name: "folddisco"})
        },
        cancelJob() {
            this.cancelCtl?.abort()
        },
        clearAllMotifs() {
            if (this.loading) return
            this.$emit('clearAll')
        },
        prependInformation(structure, accession) {
            let prefix = 'REMARK  99 '
            let firstline = prefix + 'Accession: ' + accession
            if (firstline.length > 79) {
                firstline = firstline.slice(76) + '... '
            }

            firstline = firstline.padEnd(80, ' ') + '\n' + prefix + this.remarkStr
            return firstline + structure
        },
        async getMockPdb(entry) {
            const mock = mockPDB(entry.ca, entry.aa.replace(/-/g, ''), 'A');
            if (!entry.suffix) {
                return await pulchra(mock);
            } else {
                const decoded = decodeMultimer(mock, entry.suffix)
                return decoded
            }
        },
        async getFullPdb(entry, signal) {
            const mock = mockPDB(entry.ca, entry.aa.replace(/-/g, ''), 'A');
            if (!entry.suffix) {
                return await this.predictGivenPdb(mock, signal)
            } else {
                const decoded = decodeMultimer(mock, entry.suffix)
                const chains = storeChains(decoded)
                const pdb = await this.predictGivenPdb(decoded, signal)
                return revertChainInfo(pdb, chains)
            }
        },
    },
    computed: {
        selectedCounts() {
            return this.resnoStr.length
        },
        selectionBannerContent() {
            if (this.targetIndex < 0) { 
                return 'No selection' 
            } else {
                if (this.$vuetify.breakpoint.smAndDown) {
                    if (!this.selectedCounts) {
                        let str = this.entries[this.targetIndex].name
                        if (str.length >= 14) {
                            str = '<strong title="' + str + '" >'  + str.slice(0, 12) + '...</strong>'
                        }  else {
                            str = '<strong>' + str + "</strong>&nbsp;"
                        }
                        return str
                    } else {
                        return `<span title="${this.motifStr}">`
                            + String(this.selectedCounts) 
                            + (this.selectedCounts > 1 ? ' residues</span>' : ' residue</span>')
                    }
                } else if (this.$vuetify.breakpoint.xlOnly) {
                    let str = this.entries[this.targetIndex].name
                    if (this.selectedCounts > 0) {
                        str = '<strong>' + str + "</strong>&nbsp;"
                        return str + `/&nbsp;<span title="${this.motifStr}">`
                            + String(this.selectedCounts) + (this.selectedCounts > 1 ? ' residues</span>' : ' residue</span>')
                    } else {
                        str = '<strong>' + str + "</strong>"
                        return "Reference: " + str
                    }
                }

                let str = this.entries[this.targetIndex].name
                if (this.selectedCounts > 0) {
                    if (str.length >= 10) {
                        str = '<strong title="' + str + '" >'  + str.slice(0, 8) + '...</strong>&nbsp;'
                    } else {
                        str = '<strong>' + str + "</strong>&nbsp;"
                    }
                    return str + `/&nbsp;<span title="${this.motifStr}">`
                        + String(this.selectedCounts) + (this.selectedCounts > 1 ? ' residues</span>' : ' residue</span>')
                } else {
                    if (str.length >= 14) {
                        str = '<strong title="' + str + '" >'  + str.slice(0, 12) + '...</strong>'
                    } else {
                        str = '<strong>' + str + "</strong>"
                    }
                    return "Reference: " + str
                }
            }
        },
        toFoldseekContent() {
            if (this.errorFoldseekBtn) { 
                return 'Failed to load the structure file' 
            } else { 
                return 'Send to Foldseek' 
            }
        },
        toFoldDiscoContent() {
            if (this.errorFoldDiscoBtn) { 
                return 'Failed to load the structure file' 
            } else { 
                return 'Send to FoldDisco' 
            }
        },
        remarkStr() {
            let str = 'Imported from '
            let t = this.ticket
            if (t.length > 55) {
                t = t.slice(52) + '...'
            }
            return (str + t).padEnd(69, ' ') + '\n'
        },
        motifStr() {
            if (this.selectedColumns.length == 0) {
                return ""
            } else {
                return this.resnoStr
                    .map((i) => {
                        let entry = this.entries[this.targetIndex]
                        let chain = entry.chains[i]
                        let resno = i - entry.offsets[chain]
                        return chain + String(resno)
                    })
                    .join(", ")
            }
        },
        resnoStr() {
            if (this.selectedColumns.length == 0) {
                return []
            } else {
                return getResidueIndices
                    (this.entries[this.targetIndex].aa, 
                        this.selectedColumns)
                    .map((i) => i+1)
            }
        }
    }
}
</script>

<style lang="scss" scoped>

</style>

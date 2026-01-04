<template>
    <div>
        <!-- For displaying number of selected entries and buttons to switch -->
        <v-fade-transition>
            <v-sheet color="transparent" :style="{'position': 'fixed', 'width': $vuetify.breakpoint.smAndDown ? '80%' : '40%', 
            'left': $vuetify.breakpoint.smAndDown ? '16px' : '30%',
            'bottom': '16px', 'z-index': 99998, 'align-items': 'center', 'justify-content': $vuetify.breakpoint.smAndDown ? 'flex-start' : 'space-between', 'opacity': loading ? 0.4 : 1}" 
            class="d-flex pa-2" v-if="selectedCounts > 0" 
            >
                <v-chip label close color="primary" style="margin-right: 24px;" 
                class="elevation-8" 
                @click:close="clearAllEntries" >
                    <span v-html="selectionBannerContent"></span>
                </v-chip>
                <v-flex shrink>
                    <template v-if="selectedCounts == 1">
                        <v-tooltip top :color="errorFoldseekBtn ? 'error': 'primary'" :value="errorFoldseekBtn">
                            <template v-slot:activator="{on, attrs}">
                                <v-btn :color="errorFoldseekBtn ? 'error': 'primary'" 
                                v-bind="attrs" v-on="on" fab 
                                class="mr-3 elevation-8" 
                                :loading="loading" 
                                @click="sendToFoldseek">
                                    <v-icon>{{isSelectionComplex ?  $MDI.Multimer : $MDI.Monomer}}</v-icon>
                                </v-btn>
                            </template> 
                            <span>{{ toFoldseekContent }}</span>
                        </v-tooltip>
                        <v-tooltip top :color="errorFoldDiscoBtn ? 'error' : '#eca800'" :value="errorFoldDiscoBtn">
                            <template v-slot:activator="{on, attrs}">
                                <!-- TODO: change FoldDisco color! -->
                                <v-btn v-bind="attrs" v-on="on" fab class="elevation-8 fold-disco-btn" 
                                :class="{'btn-disabled':isSelectionUnableToFetch}" style="color: #fff"
                                :color="errorFoldDiscoBtn ? 'error' : '#eca800'" 
                                :loading="loading" 
                                @click="isSelectionUnableToFetch ? () => {} : sendToFoldDisco()">
                                    <v-icon>{{$MDI.Motif}}</v-icon>
                                </v-btn>
                            </template>
                            <span v-html="toFoldDiscoContent"></span>
                        </v-tooltip>
                    </template>
                    <template v-else>
                        <v-tooltip top :color="errorFoldMasonBtn ? 'error' : 'primary'" :value="errorFoldMasonBtn">
                            <template v-slot:activator="{on, attrs}">
                                <v-btn v-bind="attrs" v-on="on" fab 
                                class="elevation-8" :color="errorFoldMasonBtn ? 'error' : 'primary'" 
                                :loading="loading" @click="sendToFoldMason">
                                    <v-icon>{{$MDI.Wall}}</v-icon>
                                </v-btn>
                            </template>
                            <span v-html="toFoldMasonContent"></span>
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

import { StorageWrapper} from './lib/HistoryMixin.js';
import { getAccession, sleep } from './Utilities';
import { BlobDatabase } from './lib/BlobDatabase';

const localDb = BlobDatabase()

export default {
    name: 'SelectToSendPanel',
    data() {
        return {
            errorFoldseekBtn: false,
            errorFoldMasonBtn: false,
            errorFoldDiscoBtn: false,
            cancelCtl: null,
            loading: false,
        }
    },
    props: {
        hits: {
            type: Object,
            default: {}
        },
        ticket: {
            type: String,
            default: ""
        },
        selectedCounts: {
            type: Number,
            default: 0,
        },
        isComplex: {
            type: Boolean,
            default: false
        },
        selectUpperbound: {
            type: Number,
            default: 1000
        },
        dbToIdx: {
            type: Object,
            default: {}
        },
        banList: {
            type: Array,
            default: []
        },
        getSingleSelectionInfo: {
            type: Function,
            default: () => {}
        },
        getMultipleSelectionInfo: {
            type: Function,
            default: () => {}
        },
        getSinglePdb: {
            type: Function,
            default: async () => {}
        },
        getMockPdb: {
            type: Function,
            default: async () => {}
        },
        getFullPdb: {
            type: Function,
            default: async () => {}
        },
        getOrigPdb: {
            type: Function,
            default: async () => {}
        },
        batchSize: {
            type: Number,
            default: 256,
        },
        chunkSize: {
            type: Number,
            default: 128,
        },
    },
    watch: {
        selectedCounts() {
            this.errorFoldDiscoBtn=false
            this.errorFoldMasonBtn=false
            this.errorFoldseekBtn=false
        },
    },
    methods: {
        getEntry(db, idx) {
            let dbIdx = this.dbToIdx[db]
            return this.hits?.results[dbIdx]?.alignments?.[idx]
        },
        async sendToFoldseek() {
            if (this.loading) {
                return
            }

            this.loading = true
            this.errorFoldseekBtn = false
            let info = this.getSingleSelectionInfo()
            if (info.idx < 0) {
                console.log("Error in sendToFoldseek: no entry selected")
                this.loading = false
                return
            }

            let result
            this.cancelCtl = new AbortController()
            try {
                const signal = this.cancelCtl.signal
                result = await this.getSinglePdb(info, signal)
            } catch (error) {
                if (error?.name == "AbortError") {
                    console.log("Job canceled")
                }  else {
                    console.error(error.message)
                    this.errorFoldseekBtn = true
                }
                this.cancelCtl = null
                this.loading = false
                return
            }

            const pdb = this.prependRemark(result.pdb, result.name, info.db);
            const isMultimer = result.isMultimer;
            this.cancelCtl = null
            this.loading = false
            if (isMultimer) {
                await localDb.setItem('multimer.query', pdb)
                this.$router.push({name: "multimer"})
            } else {
                await localDb.setItem('query', pdb)
                this.$router.push({name: "search"})
            }
        },
        async sendToFoldMason() {
            if (this.loading) return
            
            const inBatches = async (items, k, fn, signal) => {
                const out = [];
                for (let p = 0; p < items.length; p += k) {
                    if (signal?.aborted) { 
                        throw new DOMException('Aborted', 'AbortError') 
                    }
                    
                    const chunk = items.slice(p, p + k);
                    const settled = await Promise.allSettled(chunk.map(x => fn(x, signal)));
                    out.push(...settled);
                    
                    await sleep(250)
                }
                return out;
            }
            
            const saveAsChunk = async (v /* v: Array[{text, name}] */, chunk_size, signal) => {
                if (signal?.aborted) throw new  DOMException('Aborted', 'AbortError')
                const SEP = '\0'
                const PREFIX = "msa.query."

                let texts = v.map(o => o.text)
                let names = v.map(o => o.name).join(SEP)
                let idx = 0;
                
                for (let i = 0; i < texts.length; i += chunk_size) {
                    const UPPER = Math.min(i + chunk_size, texts.length)
                    const key = PREFIX + "chunk:" + idx++
                    const value = texts.slice(i, UPPER).join(SEP)
                    await localDb.setItem(key, new Blob([ value ], {type: "text/plain"}))
                }

                await localDb.setItem(PREFIX + "names", names)
                await localDb.setItem(PREFIX + "size", idx)
            }

            this.errorFoldMasonBtn = false
            this.loading = true
            this.cancelCtl = new AbortController();
            try {
                const signal = this.cancelCtl.signal
                const settled = await inBatches(this.getMultipleSelectionInfo(), this.batchSize, async (i, s) => await this.getMockPdb(i, s), signal)
                settled.filter(r => r.status == 'rejected').map(r => console.warn(r.reason))
                const values = settled.filter(r => r.status == "fulfilled" && !(!r.value?.pdb)).map(r => {
                    return {text: r.value?.pdb, name: r.value?.name};
                })
                // const failed = settled.filter(r => r.status == "fulfilled" && !r.value?.pdb).map(r=> r.value?.name)
                await saveAsChunk(values, this.chunkSize, signal)
                this.loading = false
                this.cancelCtl = null
            } catch (e) {
                if (e?.name == 'AbortError') {
                    console.log("Job canceled")
                } else {
                    this.errorFoldMasonBtn = true
                    console.error(e)
                }
                this.loading = false
                this.cancelCtl = null
                return
            }
            this.$router.push({name:'foldmason'})
        },
        async sendToFoldDisco() {
            if (this.loading) { 
                return 
            }
            
            this.errorFoldDiscoBtn = false
            this.loading = true
            const selection = this.getSingleSelectionInfo()
            if (selection.idx == -1 || !this.dbToIdx) {
                this.loading = false
                return
            }

            this.cancelCtl = new AbortController();
            const target = this.hits.results[this.dbToIdx?.[selection.db]]?.alignments?.[selection.idx]?.[0]
            let targetPdb
            let motifs
            try {
                const signal = this.cancelCtl.signal
                let result = await this.getOrigPdb(target, selection.db, signal)
                if (!result) {
                    targetPdb = await this.getFullPdb(target.target, selection, signal)
                    motifs = ""
                } else {
                    [targetPdb, motifs] = result
                    motifs = motifs
                        .replace(/^_,(_,)*|(,_)*,_$/g, '')
                        .replace(/,_,(_,)*/g, ',')
                }
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
            const accession = getAccession(target.target)

            await localDb.setItem('folddisco.query', this.prependRemark(targetPdb, accession, selection.db))
            await storage.setItem('motif', motifs)
            this.$router.push({name: "folddisco"})
        },
        cancelJob() {
            this.cancelCtl?.abort()
        },
        clearAllEntries() {
            if (this.loading) return
            this.$emit('clearAll')
        },
        prependRemark(structure, accession, db) {
            let is_cif = false
            if (structure[0] == '#' || structure.startsWith('data_')) {
                is_cif = true
            }
            
            let prefix = is_cif ? '# ' : 'REMARK  99 '
            let firstline = prefix + 'Accession: ' + accession + ', DB: ' + db
            if (!is_cif && firstline.length > 79) {
                firstline = firstline.slice(76) + '... '
            }

            firstline = firstline.padEnd(80, ' ') + '\n' + prefix + this.remarkStr
            return firstline + structure
        },

    },
    computed: {
        isSelectionComplex() {
            if (this.selectedCounts != 1 || !this.isComplex) { 
                return false 
            }

            const selection = this.getSingleSelectionInfo();
            if (selection.idx == -1) { 
                return false 
            }

            if (this.getEntry(selection.db, selection.idx)?.length > 1) { 
                return true 
            } else { 
                return false 
            }
        },
        isSelectionUnableToFetch() {
            if (this.banList.length == 0 || this.selectedCounts != 1) { 
                return false 
            }
            const selection = this.getSingleSelectionInfo();
            if (selection.idx == -1) { 
                return false 
            }

            return this.banList.includes(selection.db)
        },
        selectionBannerContent() {
            if (this.selectedCounts == 0) { 
                return 'No selection' 
            } else if (this.selectedCounts > 1) {
                return '(' +  this.selectedCounts.toString() + " / " 
                    + this.selectUpperbound.toString() + ") entries" + " selected"
            } else {
                if (this.$vuetify.breakpoint.smAndDown) return "1 entry selected"

                const selection = this.getSingleSelectionInfo()
                if (selection.idx == -1) { 
                    return '' 
                }

                let str = (this.getEntry(selection.db, selection.idx)?.[0]?.target)
                if (!str) { 
                    return '' 
                }
                if (str.length >= 15) {
                    str = '<span title="' + str + '" >'  + str.slice(0, 16) + '...</span>&nbsp;'
                }
                return str + " selected"
            }
        },
        toFoldseekContent() {
            if (this.errorFoldseekBtn) { 
                return 'Failed to load the structure file' 
            } else { 
                return 'Send to Foldseek' + (this.isSelectionComplex ? ' Multimer' : "") 
            }
        },
        toFoldMasonContent() {
            if (this.errorFoldMasonBtn) { 
                return 'Failed to load the structure file' 
            } else { 
                return 'Send to FoldMason' + (this.isComplex ? "<br><i>*Combine multiple chains<br>into a single chain</i>" :  "")
            }
        },
        toFoldDiscoContent() {
            if (this.errorFoldDiscoBtn) { 
                return 'Failed to load the structure file' 
            } else if (this.isSelectionUnableToFetch) { 
                return 'This feature is not available<br>for the selected DB' 
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
    }
}
</script>

<style lang="scss" scoped>

.fold-disco-btn.btn-disabled {
    background-color: rgba(255,193,7,.12) !important;
    color: rgba(0,0,0,.24) !important;
}

</style>
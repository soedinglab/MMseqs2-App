<template>
    <modal-dialog
        v-model="inSelection"
        :icon="$MDI.Motif"
        :disabled="disabled"
        tooltip="Find motifs based on ligand proximity"
    >
        <template v-slot:title>
            Select Ligand-Based Motif
        </template>

        <template v-slot:toolbar-extra>
            <v-icon @click="inSelection = false">{{ $MDI.CloseCircle }}</v-icon>
        </template>

        <template v-slot:text>
            <div class="d-flex align-center mb-4">
                <span class="mr-4">Neighbor cutoff (Å)</span>
                <v-slider
                    v-model="cutoff"
                    :min="2.0"
                    :max="8.0"
                    :step="0.5"
                    :disabled="ligandMotifs.length === 0"
                    thumb-label="always"
                    hide-details
                ></v-slider>
            </div>

            <v-progress-circular
                v-if="loading"
                indeterminate
                color="primary"
                class="d-block mx-auto my-4"
            ></v-progress-circular>

            <div v-else-if="ligandMotifs.length === 0" class="text-center my-4">
                No ligands found in the structure.
            </div>

            <v-list v-else dense class="ligand-motif-list">
                <v-list-item
                    v-for="item in ligandMotifs"
                    :key="item.ligand"
                    @click="selectMotif(item.motifString)"
                    class="motif-item"
                >
                    <v-list-item-content>
                        <v-list-item-title>
                            <strong>Ligand:</strong> {{ item.ligand }}
                        </v-list-item-title>
                        <v-list-item-subtitle>
                           <strong>Neighbors ({{ item.neighbors.length }}):</strong> {{ item.neighbors.join(', ') }}
                        </v-list-item-subtitle>
                    </v-list-item-content>
                </v-list-item>
            </v-list>
        </template>
    </modal-dialog>
</template>

<script>
import ModalDialog from "./ModalDialog.vue";
import { Selection } from 'ngl';
import { splitAlphaNum } from "./Utilities";

function sortResidueStrings(a, b) {
    const [chainA, posA, _] = splitAlphaNum(a);
    const [chainB, posB, _1] = splitAlphaNum(b);
    if (chainA < chainB) return -1;
    if (chainA > chainB) return 1;
    return (posA - 0) - (posB - 0);
}


export default {
    name: "LigandMotifSelection",
    components: {
        ModalDialog,
    },
    props: {
        value: {
            type: String,
            default: '',
        },
        disabled: {
            type: Boolean,
            default: false,
        },
        queryStructure: {
            type: Object,
            required: false,
        },
    },
    data() {
        return {
            inSelection: false,
            loading: false,
            cutoff: 3.5, // Angstrom
            ligandMotifs: [], // { ligand: string, neighbors: string[], motifString: string }
        };
    },
    watch: {
        inSelection(isOpening) {
            if (isOpening) {
                this.calculateMotifs();
            }
        },
        queryStructure() {
            if (this.inSelection) {
                this.calculateMotifs();
            }
        },
        cutoff() {
             if (this.inSelection) {
                if (this.debounceTimer) clearTimeout(this.debounceTimer);
                this.debounceTimer = setTimeout(() => {
                    this.calculateMotifs();
                }, 200);
            }
        }
    },
    methods: {
        async calculateMotifs() {
            if (!this.queryStructure) {
                this.ligandMotifs = [];
                return;
            }

            this.loading = true;
            const structure = this.queryStructure;
            const foundMotifs = [];

            try {
                structure.eachResidue(res => {
                    if (res.isPolymer() || res.isWater()) return;

                    const chain = res.chainname || "_";
                    const ligID = `${res.resname} ${res.resno}:${chain}`;

                    const ligAtomIndices = [];
                    res.eachAtom(a => ligAtomIndices.push(a.index));
                    const ligSel = new Selection(`@${ligAtomIndices.join(",")}`);

                    // find all atoms within the cutoff distance of the ligand
                    const nearAtoms = structure.getAtomSetWithinSelection(ligSel, this.cutoff);

                    // expand this atom set to full residues
                    const nearResidueAtoms = structure.getAtomSetWithinGroup(nearAtoms);

                    // Collect the protein neighbors from the expanded set
                    const neighborResidues = new Set();
                    nearResidueAtoms.forEach(atomIndex => {
                        const atom = structure.getAtomProxy(atomIndex);
                        const neighborRes = atom.residue;

                        if (neighborRes.isPolymer() && neighborRes.resno !== res.resno) {
                            neighborResidues.add(`${neighborRes.chainname}${neighborRes.resno}`);
                        }
                    });

                    const neighborsArray = Array.from(neighborResidues).sort(sortResidueStrings);

                    if (neighborsArray.length > 0) {
                        foundMotifs.push({
                            ligand: ligID,
                            neighbors: neighborsArray,
                            motifString: neighborsArray.join(','),
                        });
                    }
                });
            } catch (error) {
                console.error("Error calculating ligand motifs:", error);
            } finally {
                this.ligandMotifs = foundMotifs.sort((a,b) => a.ligand.localeCompare(b.ligand));
                this.loading = false;
            }
        },
        selectMotif(motifString) {
            this.$emit('input', motifString);
            this.inSelection = false;
        }
    }
}
</script>

<style scoped>
.ligand-motif-list {
    max-height: 400px;
    overflow-y: auto;
}

.motif-item {
    cursor: pointer;
    border-bottom: 1px solid rgba(128, 128, 128, 0.2);
}

.motif-item:hover {
    background-color: rgba(128, 128, 128, 0.1);
}

.motif-item .v-list-item__subtitle {
    white-space: normal;
    overflow: hidden;
}
</style>

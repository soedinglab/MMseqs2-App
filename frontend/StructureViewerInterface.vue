<template>
<div class="structure-panel" v-if="alignments.length > 0 && 'tCa' in alignments[0]">
    <StructureViewerTooltip attach=".structure-panel" />
    <div v-if="fetchError" class="structure-error">
        <strong>Structure retrieval failed</strong>
        <div style="margin-top: 0.4em; font-size: 0.9em; opacity: 0.8;">{{ fetchError }}</div>
    </div>
    <div class="structure-wrapper" ref="structurepanel" v-show="!fetchError">
        <table v-if="tmAlignResults" class="tmscore-panel" v-bind="tmPanelBindings">
            <tr>
                <td class="left-cell">TM-Score:</td>
                <td class="right-cell">{{ tmAlignResults.tmScore }}</td>
            </tr>
            <tr>
                <td class="left-cell">RMSD:</td>
                <td class="right-cell">{{ tmAlignResults.rmsd  }}</td>
            </tr>
        </table>
        <StructureViewerToolbar
            :isFullscreen="isFullscreen"
            :isSpinning="isSpinning"
            :showQuery="showQuery"
            :showTarget="showTarget"
            :showArrows="showArrows"
            :disableQueryButton="!hasQuery"
            :disableArrowButton="!hasQuery"
            :queryColors="queryChainPalette"
            :targetColors="targetChainPalette"
            @makeImage="handleMakeImage"
            @makePDB="handleMakePDB"
            @resetView="handleResetView"
            @toggleFullscreen="handleToggleFullscreen"
            @toggleTarget="handleToggleTarget"
            @toggleQuery="handleToggleQuery"
            @toggleArrows="handleToggleArrows"
            @toggleSpin="handleToggleSpin"
        />
        <div class="structure-viewer" ref="viewport"></div>
    </div>
</div>
</template>

<script>
import StructureViewerTooltip from './StructureViewerTooltip.vue';
import StructureViewerToolbar from './StructureViewerToolbar.vue';
import StructureViewerMixin from './StructureViewerMixin.vue';
import { mockPDB, makeSubPDB, transformStructure, makeMatrix4, storeChains, revertChainInfo } from './Utilities.js';
import { pulchra } from 'pulchra-wasm';
import { tmalign, parse as parseTMOutput, parseMatrix as parseTMMatrix } from 'tmalign-wasm';

import Panel from './Panel.vue';
import { Shape, Selection, download, ColormakerRegistry, PdbWriter, Color, concatStructures, StructureComponent } from 'ngl';

// Create NGL arrows from array of ([X, Y, Z], [X, Y, Z]) pairs
// Get XYZ coordinates of CA of a given residue
const xyz = (structure, resIndex) => {
    var rp = structure.getResidueProxy();
    var ap = structure.getAtomProxy();
    rp.index = resIndex;
    ap.index = rp.getAtomIndexByName('CA');
    return [ap.x, ap.y, ap.z];
}

// Save indices of matching columns in an alignment
const getMatchingColumns = (alignment) => {
    let cols_q = [];
    let cols_t = [];
    let id_q = alignment.qStartPos;
    let id_t = alignment.dbStartPos;
    for (let i = 0; i < alignment.qAln.length; i++) {
        if (alignment.qAln[i] === '-' || alignment.dbAln[i] === '-') {
            if (alignment.qAln[i] === '-') id_t++;
            else id_q++;
        } else {
            cols_q.push(id_q);
            cols_t.push(id_t);
            id_q++;
            id_t++;
        }
    }
    return [cols_q, cols_t]
}

// Get chain from structure name like Structure_A
const getChainName = (name) => {
    // HACK FIXME fix AF chain names
    if (/_v[0-9]+$/.test(name)) {
        return 'A';
    }
    let pos = name.lastIndexOf('_');
    if (pos != -1) {
        let match = name.substring(pos + 1);
        return match.length >= 1 ? match[0] : 'A';
    }
    // fallback
    return 'A';
}

const getAccession = (name) => {
    // HACK FIXME fix AF chain names
    if (/_v[0-9]+$/.test(name)) {
        return name;
    }
    let pos = name.lastIndexOf('_');
    return pos != -1 ? name.substring(0, pos) : name;
}

// Get coordinates of all atoms found in given selection
// skip consecutive res indices as they are most likely alternative locations
// foldseek always chooses the first alt locations, so we mimic this behavior
const getAtomXYZ = (structure, sele) => {
    const xyz = [];
    let lastResidueIndex = -1;

    structure.eachAtom(ap => {
        if (ap.resno !== lastResidueIndex) {
            xyz.push([ap.x, ap.y, ap.z]);
            lastResidueIndex = ap.resno;
        }
    }, sele); 

    return xyz;
}

const colorblindColors = ColormakerRegistry.addScheme(function() {
    let colors = [0x991999, 0x00BFBF, 0xE9967A, 0x009E73, 0xF0E442, 0x0072B2, 0xD55E00, 0xCC79A7];
    this.atomColor = function(atom) {
        return colors[atom.chainIndex % colors.length];
    }
}, "colorblindColors")

const getPdbText = comp => {
    let pw = new PdbWriter(comp.structure, { renumberSerial: false });
    return pw.getData().split('\n').filter(line => line.startsWith('ATOM')).join('\n');
}

// Some exported multichain PDBs omit TER records between chains.
// Insert TER at chain boundaries so downstream tools keep chains separated.
const ensureTerBetweenChains = (pdbText) => {
    const out = [];
    let prevChain = null;
    for (const line of pdbText.split('\n')) {
        if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
            const chain = line.charAt(21);
            if (prevChain !== null && chain !== prevChain) {
                out.push('TER');
            }
            prevChain = chain;
        } else if (line.startsWith('TER')) {
            prevChain = null;
        }
        out.push(line);
    }
    return out.join('\n');
}

const getPdbChains = (pdbText) => {
    const chains = new Set();
    for (const line of pdbText.split('\n')) {
        if (line.startsWith('ATOM') || line.startsWith('HETATM')) {
            const c = line.charAt(21);
            if (c && c !== ' ') chains.add(c);
        }
    }
    return chains;
}

const extractChainPdb = (pdbText, chainName) => {
    const out = [];
    for (const line of pdbText.split('\n')) {
        if ((line.startsWith('ATOM') || line.startsWith('HETATM')) && line.charAt(21) === chainName) {
            out.push(line);
        }
    }
    if (out.length === 0) return null;
    out.push('TER');
    out.push('END');
    return out.join('\n');
}

// Parse a comma-separated CA coord string ("x1,y1,z1,x2,y2,z2,...") into
// an array of [x, y, z] triples. Empty/invalid input returns [].
const parseCaString = (str) => {
    if (!str) return [];
    const nums = str.split(',').map(parseFloat);
    const out = [];
    for (let i = 0; i + 2 < nums.length; i += 3) {
        if (Number.isFinite(nums[i]) && Number.isFinite(nums[i+1]) && Number.isFinite(nums[i+2])) {
            out.push([nums[i], nums[i+1], nums[i+2]]);
        }
    }
    return out;
}

// Match a list of interface CA coordinates (in interface-index order) to the
// residues of `chain` in `structure` by nearest-CA matching. Returns an array
// of resnos where entry `i` is the dimer resno corresponding to interface
// residue index `i+1` (1-based). This lets us convert interface-based indices
// coming from the alignment (qStartPos/dbStartPos, etc.) into real dimer resnos
// so highlights and selections are consistent with foldseek's interface DB.
const matchCaToResnos = (structure, caArr, chain, warnTolerance = 0.5) => {
    if (!caArr || caArr.length === 0) return [];
    const chainCa = [];
    structure.eachAtom(ap => {
        if (ap.atomname === 'CA') {
            chainCa.push({ resno: ap.resno, x: ap.x, y: ap.y, z: ap.z });
        }
    }, new Selection(`:${chain}.CA`));
    const resnos = new Array(caArr.length).fill(null);
    for (let i = 0; i < caArr.length; i++) {
        const [x, y, z] = caArr[i];
        let bestResno = null;
        let bestDist2 = Infinity;
        for (const c of chainCa) {
            const dx = c.x - x, dy = c.y - y, dz = c.z - z;
            const d2 = dx*dx + dy*dy + dz*dz;
            if (d2 < bestDist2) {
                bestDist2 = d2;
                bestResno = c.resno;
            }
        }
        if (bestResno !== null && bestDist2 <= warnTolerance * warnTolerance) {
            resnos[i] = bestResno;
        } else if (bestResno !== null) {
            // Coordinates should be identical between interface DB and dimer DB;
            // record the nearest resno but warn if the deviation is unexpectedly large.
            console.warn(`Interface CA match on chain ${chain} idx ${i+1} deviated by ${Math.sqrt(bestDist2).toFixed(3)} A`);
            resnos[i] = bestResno;
        }
    }
    return resnos;
}

// Compress an ordered list of resnos into an NGL range selection like
// "(12-18 or 25 or 30-33) and :A". Returns null if list is empty.
const resnosToSele = (resnos, chain) => {
    if (!resnos || resnos.length === 0) return null;
    const ranges = [];
    let start = resnos[0], prev = start;
    for (let i = 1; i < resnos.length; i++) {
        if (resnos[i] === prev + 1) { prev = resnos[i]; continue; }
        ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
        start = prev = resnos[i];
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    return `(${ranges.join(' or ')}) and :${chain}`;
}

export default {
    name: "StructureViewerInterface",
    components: {
        Panel,
        StructureViewerTooltip,
        StructureViewerToolbar,
    },
    mixins: [
        StructureViewerMixin,
    ],
    data() {
        return {
            selection: null,
            showArrows: false,
            showQuery: 0,
            showTarget: 0,
            tmAlignResults: null,
            hasQuery: true,
            fetchError: null,
            // Interface selections per chain, populated in mounted()
            interfaceSelesQuery: [],
            interfaceSelesTarget: [],
            // Per-alignment mapping: interface index (1-based) -> dimer resno.
            // targetIfaceToResno[i] is an array where index k (0-based) holds
            // the target dimer resno for interface residue k+1 in alignment i.
            targetIfaceToResno: [],
            queryIfaceToResno: [],
        }
    },
    props: {
        alignments: { type: Array },
        highlights: { type: Array },
        queryFile: { type: String },
        queryChainPalette: {
            type: Array,
            // Paired palette: queries are the LIGHT tone of their pair's hue.
            // alignments[i].query and alignments[i].target share a hue so it
            // is immediately obvious which query chain is aligned to which
            // target chain. Pair 0 = blue, pair 1 = orange (both are also
            // colorblind-safe against each other).
            default: () => (["#90CAF9", "#FFB74D"]),
        },
        targetChainPalette: {
            type: Array,
            // Paired palette: targets are the DARK tone of their pair's hue.
            // See queryChainPalette above. Pair 0 = deep blue, pair 1 = deep orange.
            default: () => (["#0D47A1", "#E65100"]),
        },
        qRepr: { type: String, default: "cartoon" },
        tRepr: { type: String, default: "cartoon" },
        hits: { type: Object },
        autoViewTime: { type: Number, default: 100 },
        searchType: { type: String, default: "" },
    },
    methods: {
        // Create arrows connecting CA coordinates for query/target in match columns
        async drawArrows(str1, str2) {
            if (!this.stage) return;
            const shape = new Shape('arrows');
            await Promise.all(this.alignments.map(async (alignment, idx) => {
                const chain_q = getChainName(alignment.query);
                const chain_t = getChainName(alignment.target);
                // getMatchingColumns returns 1-based indices into the interface
                // sequences (qStartPos.. and dbStartPos..). Translate them to
                // real dimer resnos via the CA-matched interface -> resno maps
                // so selections are consistent with the loaded structures.
                const [cols_q_iface, cols_t_iface] = getMatchingColumns(alignment);
                const qMap = this.queryIfaceToResno[idx] || [];
                const tMap = this.targetIfaceToResno[idx] || [];
                const cols_q_res = cols_q_iface.map(i => qMap[i - 1]).filter(v => v != null);
                const cols_t_res = cols_t_iface.map(i => tMap[i - 1]).filter(v => v != null);
                if (cols_q_res.length === 0 || cols_t_res.length === 0) return;
                const sele_q = cols_q_res.join(" or ");
                const sele_t = cols_t_res.join(" or ");

                const str1_xyz = getAtomXYZ(str1, new Selection(`(${sele_q}) and :${chain_q}.CA`));
                const str2_xyz = getAtomXYZ(str2, new Selection(`(${sele_t}) and :${chain_t}.CA`));

                // if (str1_xyz.length != str2_xyz.length) {
                //     console.warn("Different number of CA atoms in query and target", str1_xyz.length, str2_xyz.length);
                // }
                for (let i = 0; i < Math.min(str1_xyz.length, str2_xyz.length); i++) {
                    shape.addArrow(str1_xyz[i], str2_xyz[i], [0, 1, 1], 0.4);
                }
            }));
            let component = this.stage.addComponentFromObject(shape);
            component.addRepresentation('buffer');
            component.setVisibility(this.showArrows);
        },
        handleToggleArrows() {
            if (!this.stage) return;
            this.showArrows = !this.showArrows;
        },
        handleToggleQuery() {
            if (!this.stage) return;
            // 3-state cycle:
            //   0 = interface residues only (chain faded, highlight solid)
            //   1 = full aligned chains (chain faded, highlight solid)
            //   2 = entire dimer solid (no highlight)
            // __LOCAL__ keeps the original 2-state behavior since local mode
            // never had the mode-2 solid view.
            if (__LOCAL__) {
                this.showQuery = (this.showQuery === 0) ? 1 : 0;
            } else {
                this.showQuery = (this.showQuery === 2) ? 0 : this.showQuery + 1;
            }
        },
        handleResetView() {
            if (!this.stage) return;
            this.setQuerySelection();
        },
        handleToggleTarget() {
            if (!this.stage) return;
            // See handleToggleQuery for state semantics.
            if (__LOCAL__) {
                this.showTarget = (this.showTarget === 0) ? 1 : 0;
            } else {
                this.showTarget = (this.showTarget === 2) ? 0 : this.showTarget + 1;
            }
        },
        clearSelection() {
            if (!this.alignments || !this.stage) return;
            let repr = this.stage.getRepresentationsByName("targetHighlight");
            repr.setSelection()
            repr.setVisibility(false)
        },
        setSelectionData(selection) {
            // FIXME tube/cartoon representation cannot visualise <3 residues
            //       https://github.com/nglviewer/ngl/issues/759
            //       use licorice representation for this case? or just +1 to make 3
            if (!this.alignments || !this.stage) return;
            let repr = this.stage.getRepresentationsByName("targetHighlight");
            repr.setSelection()
            if (selection.length === 0) {
                repr.setVisibility(false);
                return;
            }
            let seles = [];
            for (let [i, start, length] of selection) {
                let chain = getChainName(this.alignments[i].target);
                // `start` is a 1-based index into the target's interface residues
                // and `length` is the number of non-gap residues selected. Map
                // those interface indices to real dimer resnos via the
                // interface-index -> resno table built from tCa matching.
                const map = this.targetIfaceToResno[i];
                if (!map || map.length === 0) continue;
                const resnos = [];
                for (let k = 0; k < length; k++) {
                    const r = map[start - 1 + k];
                    if (r != null) resnos.push(r);
                }
                if (resnos.length === 0) continue;
                resnos.sort((a, b) => a - b);
                const sele = resnosToSele(resnos, chain);
                if (sele) seles.push(sele);
            }
            if (seles.length === 0) {
                repr.setVisibility(false);
                return;
            }
            let sele = seles.join(" or ");
            repr.setSelection(sele);
            repr.setVisibility(true);
        },
        setQuerySelection() {
            if (!this.stage) return;
            const baseRepr = this.stage.getRepresentationsByName("queryStructure");
            if (!baseRepr) return;
            const sele = this.querySele;
            baseRepr.setSelection(sele);
            // Mode 2 = show entire structure as solid (no interface overlay);
            // otherwise keep the base cartoon faded and the interface overlay on top.
            const fullOpacity = this.showQuery === 2;
            baseRepr.setParameters({ opacity: fullOpacity ? 1.0 : 0.3, depthWrite: fullOpacity });
            const ifaceRepr = this.stage.getRepresentationsByName("queryStructureIface");
            if (ifaceRepr) ifaceRepr.setVisibility(!fullOpacity);
            if (baseRepr.list && baseRepr.list[0]) {
                baseRepr.list[0].parent.autoView(sele, this.autoViewTime);
            }
        },
        setTargetSelection() {
            if (!this.stage) return;
            const repr = this.stage.getRepresentationsByName("targetStructure");
            if (!repr) return;
            const sele = this.targetSele;
            repr.setSelection(sele);
            // Mode 2 = solid dimer, no interface overlay (see setQuerySelection).
            const fullOpacity = this.showTarget === 2;
            repr.setParameters({ opacity: fullOpacity ? 1.0 : 0.3, depthWrite: fullOpacity });
            const ifaceRepr = this.stage.getRepresentationsByName("targetStructureIface");
            if (ifaceRepr) ifaceRepr.setVisibility(!fullOpacity);
        },
        async handleMakeImage() {
            if (!this.stage)
                return;
            let wasSpinning = this.isSpinning;
            this.isSpinning = false;
            let title = this.alignments.map(aln => this.hasQuery ? `${aln.query}-${aln.target}` : aln.target).join("_");
            this.stage.viewer.setLight(undefined, undefined, undefined, 0.2)
            const blob = await this.stage.makeImage({
                trim: true,
                factor: (this.isFullscreen) ? 1 : 8,
                antialias: true,
                transparent: true,
            });
            this.stage.viewer.setLight(undefined, undefined, undefined, this.$vuetify.theme.dark ? 0.4 : 0.2)
            download(blob, `${title}.png`)
            this.isSpinning = wasSpinning;
        },
        handleMakePDB() {
            if (!this.stage)
                return;
            let qPDB = this.stage.getComponentsByName("queryStructure").list.map(getPdbText); 
            let tPDB = this.stage.getComponentsByName("targetStructure").list.map(getPdbText);
            if (qPDB.length === 0 && tPDB.length === 0)
                return;
            let title = this.alignments.map(aln => qPDB ? `${aln.query}-${aln.target}` : aln.target);
            let result = null;
            if (qPDB && tPDB) {
                result =
`TITLE     ${title.join(" ")}
REMARK     This file was generated by the Foldseek webserver:
REMARK       https://search.foldseek.com
REMARK     Please cite:
REMARK       https://doi.org/10.1101/2022.02.07.479398
REMARK     Warning: Non C-alpha atoms might have been re-generated by PULCHRA,
REMARK              if they are not present in the original PDB file.
MODEL        1
${qPDB.join('\n')}
ENDMDL
MODEL        2
${tPDB.join('\n')}
ENDMDL
END
`
            } else {
                result =
`TITLE     ${title.join(" ")}
REMARK     This file was generated by the Foldseek webserver:
REMARK       https://search.foldseek.com
REMARK     Please cite:
REMARK       https://doi.org/10.1101/2022.02.07.479398
REMARK     Warning: Non C-alpha atoms were re-generated by PULCHRA.
MODEL        1
${tPDB.join('\n')}
ENDMDL
END
`
            }
            download(new Blob([result], { type: 'text/plain' }), (title.join("_") + ".pdb"));
        }
    },
    watch: {
        'showArrows': function(val, _) {
            if (!this.stage) return
            this.stage.getComponentsByName("arrows").forEach(comp => { comp.setVisibility(val) });
        },
        'showQuery': function() {
            if (!this.stage) return;
            this.setQuerySelection();
        },
        'showTarget': function(val, _) {
            if (!this.stage) return;
            this.setTargetSelection();
        },
        'highlights': function(values) {
            if (!this.stage || !values) return;
            let selections = []
            values.forEach((value, i) => {
                if (!value) return;
                let [start, length] = value;
                selections.push([i, start, length]);
            })
            this.setSelectionData(selections)
        }
    },
    computed: {
        querySele: function() {
            // Mode 2 selects the entire structure (no NGL selection filter),
            // so the base rep -- now at full opacity -- renders the whole dimer.
            if (this.alignments.length === 0 || this.showQuery == 2) return '';
            if (this.showQuery === 0) {
                // Show only interface residues; fall back to full chain if not yet computed
                const iface = this.interfaceSelesQuery.filter(Boolean);
                return iface.length > 0
                    ? iface.join(' or ')
                    : this.alignments.map(a => `:${getChainName(a.query)}`).join(' or ');
            }
            if (this.showQuery === 1) {
                return this.alignments.map(a => `:${getChainName(a.query)}`).join(" or ");
            }
        },
        targetSele: function() {
            // See querySele.
            if (this.alignments.length === 0 || this.showTarget == 2) return '';
            if (this.showTarget === 0) {
                // Show only interface residues; fall back to full chain if not yet computed
                const iface = this.interfaceSelesTarget.filter(Boolean);
                return iface.length > 0
                    ? iface.join(' or ')
                    : this.alignments.map(a => `:${getChainName(a.target)}`).join(' or ');
            }
            if (this.showTarget === 1) {
                return this.alignments.map(a => `:${getChainName(a.target)}`).join(" or ");
            }
        },
        tmPanelBindings: function() {
            return (this.isFullscreen) ? { 'style': 'margin-top: 10px; font-size: 2em; line-height: 2em' } : {  }
        },
    },
    async mounted() {
        if (typeof(this.alignments[0].tCa) == "undefined")
            return;

        // Download from server --> full input PDB from /result/query endpoint, saved with JSON.stringify
        //                local --> qCa string
        // Tickets prefixed with 'user-' only occur on user uploaded files
        let queryPdb = "";
        this.hasQuery = true;

        if (this.$LOCAL) {
            if (this.hits.queries[0].hasOwnProperty('pdb')) {
                queryPdb = JSON.parse(this.hits.queries[0].pdb);
            } else {
                queryPdb = mockPDB(this.hits.queries[0].qCa, this.hits.queries[0].sequence, 'A');
            }
        } else if (this.$route.params.ticket.startsWith('user-')) {
            // Check for special 'user' ticket for when users have uploaded JSON
            if (this.hits.queries[0].hasOwnProperty('pdb')) {
                queryPdb = JSON.parse(this.hits.queries[0].pdb);
            } else {
                const localData = this.$root.userData[this.$route.params.entry];
                queryPdb = mockPDB(localData.queries[0].qCa, localData.queries[0].sequence, 'A');
            }
        } else {
            try {
                const request = await this.$axios.get("api/result/" + this.$route.params.ticket + '/query');
                queryPdb = request.data;
            } catch (e) {
                queryPdb = "";
                this.hasQuery = false;
            }
        }

        // Run PULCHRA per chain then concatenate Structure objects in first StructureComponent
        const targets = [];
        // Per-chain interface selections for the target structure.
        // Each entry: { chain, alignedSele, unalignedSele } so we can build a
        // selection scheme that gives every chain its own (aligned, unaligned)
        // color pair.
        const targetChainSeles = [];
        let renumber = 0;
        // Cache dimer PDBs by db+targetKey so we only fetch each dimer once
        const dimerPdbCache = new Map();
        // It is wrapped in order to make it handle when it is destroyed even before it is fully mounted
        try {
            for (let alignment of this.alignments) {
                const chain = getChainName(alignment.target);
                // Fetch the full dimer PDB from server (saved by worker via foldseek convert2pdb).
                let pdbText;
                if (alignment.target && alignment.db) {
                    const cacheKey = alignment.db + ':' + getAccession(alignment.target);
                    if (dimerPdbCache.has(cacheKey)) {
                        pdbText = dimerPdbCache.get(cacheKey);
                    } else {
                        const ticket = this.$route.params.ticket;
                        const url = "api/result/interface/" + ticket
                            + '?database=' + encodeURIComponent(alignment.db)
                            + '&id=' + encodeURIComponent(alignment.target);
                        const response = await this.$axios.get(url, {
                            headers: { 'Accept': 'text/plain' },
                            transformResponse: [(d) => d],
                        });
                        pdbText = response.data;
                        dimerPdbCache.set(cacheKey, pdbText);
                    }
                } else {
                    throw new Error(`Missing target/db for alignment ${alignment.target || '(unknown)'}`);
                }

                // Run pulchra per chain (requested behavior): isolate the
                // aligned chain, rebuild that chain only, then concatenate all
                // chains later via concatStructures.
                const normalizedPdb = ensureTerBetweenChains(pdbText);
                const chainPdb = extractChainPdb(normalizedPdb, chain);
                if (!chainPdb) {
                    throw new Error(`Chain ${chain} not found in target ${alignment.target}`);
                }
                const tChains = storeChains(chainPdb);
                let pdb = await pulchra(chainPdb);
                pdb = revertChainInfo(pdb, tChains);

                const component = await this.stage.loadFile(new Blob([pdb], { type: 'text/plain' }), {ext: 'pdb', firstModelOnly: true});
                component.structure.eachAtom(a => { a.serial = renumber++; });
                targets.push(component);

                targetChainSeles.push({
                    chain,
                    alignedSele: null,
                    unalignedSele: `:${chain}`,
                });
            }
        } catch (e) {
            this.fetchError = (e && e.message) ? e.message : String(e);
            return;
        }
        const structure = concatStructures(getAccession(this.alignments[0].target), ...targets.map(t => t.structure));
        const target = this.stage.addComponentFromObject(structure, { name: "targetStructure" });

        // Derive the target interface residues per alignment by matching the
        // CA coordinates coming from foldseek's interface DB (alignment.tCa)
        // to the CAs of the corresponding chain in the dimer structure. This
        // guarantees consistency with foldseek's own definition of the
        // interface (rather than a hard-coded distance cutoff).
        this.targetIfaceToResno = this.alignments.map((alignment, i) => {
            const chain = targetChainSeles[i].chain;
            const caArr = parseCaString(alignment.tCa);
            return matchCaToResnos(target.structure, caArr, chain);
        });
        targetChainSeles.forEach((entry, i) => {
            const resnos = (this.targetIfaceToResno[i] || []).filter(r => r != null);
            resnos.sort((a, b) => a - b);
            // Deduplicate while preserving sorted order
            const uniq = [];
            for (const r of resnos) {
                if (uniq.length === 0 || uniq[uniq.length - 1] !== r) uniq.push(r);
            }
            entry.alignedSele = resnosToSele(uniq, entry.chain);
        });
        // Expose target interface seles to computed (targetSele mode 0)
        this.interfaceSelesTarget = targetChainSeles.map(e => e.alignedSele);
        
        target.addRepresentation('tube', {
            color: 0x11FFEE,
            side: 'front',
            opacity: 0.5,
            radius: 0.8,
            visible: false,
            name: 'targetHighlight'
        });

        if (ColormakerRegistry.hasScheme("_targetScheme")) {
            ColormakerRegistry.removeScheme("_targetScheme")
        }

        // Single color per chain; unaligned regions are dimmed via a separate
        // low-opacity representation added below, not via a different color.
        const targetSchemeEntries = [];
        targetChainSeles.forEach((entry, i) => {
            const color = this.targetChainPalette[i] || this.targetChainPalette[this.targetChainPalette.length - 1];
            targetSchemeEntries.push([color, entry.unalignedSele]);
        });
        this.targetSchemeId = ColormakerRegistry.addSelectionScheme(targetSchemeEntries, "_targetScheme")

        if (this.hasQuery) {
            let ext = 'pdb';
            queryPdb = queryPdb.trimStart();
            if (queryPdb[0] == "#" || queryPdb.startsWith("data_")) {
                ext = 'cif';
                // NGL doesn't like AF3's _chem_comp entries
                queryPdb = queryPdb.replaceAll("_chem_comp.", "_chem_comp_SKIP_HACK.");
            } else {
                queryPdb = queryPdb.split('\n').map(line => line + ' '.repeat(Math.max(0, 80 - line.length))).join('\n');
            }

            let query = await this.stage.loadFile(new Blob([queryPdb], { type: 'text/plain' }), { ext: ext, firstModelOnly: true, name: 'queryStructure'});
            if (query && query.structure.getAtomProxy().isCg()) {
                if (ext == "cif") {
                    // FIXME: pulchra probably should learn mmCIF
                    queryPdb = getPdbText(query);
                }
                // As pulchra loses the chain information, it could result in mismatch between selection and pulchra-generated pdb
                // So we should store chain information of pdb structure information and recover it
                const chains = storeChains(queryPdb)
                queryPdb = await pulchra(queryPdb);
                queryPdb = revertChainInfo(queryPdb, chains)
                this.stage.removeComponent(query);
                query = await this.stage.loadFile(new Blob([queryPdb], { type: 'text/plain' }), {ext: 'pdb', firstModelOnly: true, name: 'queryStructure'}); 
            }

            // Derive the query interface residues per alignment by matching the
            // CA coordinates from foldseek's interface DB (alignment.qCa) to
            // the CAs of the corresponding chain in the query structure. We
            // keep the original resnos from the uploaded PDB so highlights and
            // sequence-to-structure mapping stay consistent with foldseek.
            this.queryIfaceToResno = this.alignments.map((alignment) => {
                const chain = getChainName(alignment.query);
                const caArr = parseCaString(alignment.qCa);
                return matchCaToResnos(query.structure, caArr, chain);
            });

            // Build one entry per unique query chain for coloring / selection.
            const seenQueryChains = new Map();
            this.alignments.forEach((alignment, i) => {
                const chain = getChainName(alignment.query);
                const resnos = (this.queryIfaceToResno[i] || []).filter(r => r != null);
                if (!seenQueryChains.has(chain)) {
                    seenQueryChains.set(chain, { chain, resnos: new Set(), unalignedSele: `:${chain}` });
                }
                const entry = seenQueryChains.get(chain);
                for (const r of resnos) entry.resnos.add(r);
            });
            const queryChainSeles = Array.from(seenQueryChains.values()).map(entry => {
                const sorted = Array.from(entry.resnos).sort((a, b) => a - b);
                return {
                    chain: entry.chain,
                    alignedSele: resnosToSele(sorted, entry.chain),
                    unalignedSele: entry.unalignedSele,
                };
            });
            // Expose query interface seles to computed (querySele mode 0)
            this.interfaceSelesQuery = queryChainSeles.map(e => e.alignedSele);
            if (ColormakerRegistry.hasScheme("_queryScheme")) {
                ColormakerRegistry.removeScheme("_queryScheme")
            }

            // Single color per chain; unaligned regions are dimmed via a separate
            // low-opacity representation added below, not via a different color.
            const querySchemeEntries = [];
            queryChainSeles.forEach((entry, i) => {
                const color = this.queryChainPalette[i] || this.queryChainPalette[this.queryChainPalette.length - 1];
                querySchemeEntries.push([color, entry.unalignedSele]);
            });
            this.querySchemeId = ColormakerRegistry.addSelectionScheme(querySchemeEntries, "_queryScheme")

            // Re-align target to query using TM-align for better superposition
            // Target 1st since TM-align generates superposition matrix for 1st structure
            if (this.alignments[0].hasOwnProperty("complexu") && this.alignments[0].hasOwnProperty("complext")) {
                const t = this.alignments[0].complext.split(',').map(x => parseFloat(x));
                let u = this.alignments[0].complexu.split(',').map(x => parseFloat(x));
                u = [
                    [u[0], u[1], u[2]],
                    [u[3], u[4], u[5]],
                    [u[6], u[7], u[8]],
                ];
                // Can't use setTransform since we need the actual transformed coordinates for arrows
                transformStructure(target.structure, t, u);
                // Full chain at low opacity (unaligned regions appear faded)
                query.addRepresentation(this.qRepr, { color: this.querySchemeId, smoothSheet: true, name: "queryStructure", opacity: 0.3, depthWrite: false });
                target.addRepresentation(this.tRepr, { color: this.targetSchemeId, smoothSheet: true, name: "targetStructure", opacity: 0.3, depthWrite: false });
                // Interface residues at full opacity on top
                const qIfaceSele = this.interfaceSelesQuery.filter(Boolean).join(' or ');
                const tIfaceSele = this.interfaceSelesTarget.filter(Boolean).join(' or ');
                if (qIfaceSele) query.addRepresentation(this.qRepr, { sele: qIfaceSele, color: this.querySchemeId, smoothSheet: true, name: "queryStructureIface" });
                if (tIfaceSele) target.addRepresentation(this.tRepr, { sele: tIfaceSele, color: this.targetSchemeId, smoothSheet: true, name: "targetStructureIface" });

                // Make three separate surface representations based on query toggle state:
                //   0: Aligned regions of aligned chains
                //   1: Unaligned regions of aligned chains (shown with 0)
                //   2: Full structure (all chains; shown with 0 and 1)
                // Then toggle visibility when showQuery is changed by the user.
                const surfaceSele0 = [];
                const surfaceSele1 = [];
                const surfaceSele2 = [];
                for (let alignment of this.alignments) {
                    let chain = getChainName(alignment.query);
                    // surfaceSele0.push(`${alignment.qStartPos}-${alignment.qEndPos}:${chain}`);
                    // surfaceSele1.push(`(not ${alignment.qStartPos}-${alignment.qEndPos} and :${chain})`);
                    // surfaceSele2.push(`:${chain}`);
                }
                // const surfaceParams = {
                //     color: colorblindColors,
                //     opacity: 0.1,
                //     opaqueBack: false,
                //     useWorker: false
                // }
                // query.addRepresentation("surface", { sele: surfaceSele0.join(" or "), name: "querySurface-0", ...surfaceParams });
                // query.addRepresentation("surface", { sele: surfaceSele1.join(" or "), name: "querySurface-1", visible: false, ...surfaceParams });
                // query.addRepresentation("surface", { sele: `not (${surfaceSele2.join(" or ")})`, name: "querySurface-2", visible: false, ...surfaceParams });
            } else {
                // Generate subsetted PDBs for TM-align
                let qSubPdb = makeSubPDB(query.structure, this.querySele);
                let tSubPdb = makeSubPDB(target.structure, this.targetSele);
                let alnFasta = `>target\n${this.alignments[0].dbAln}\n\n>query\n${this.alignments[0].qAln}`
                const tm = await tmalign(tSubPdb, qSubPdb, alnFasta);
                this.tmAlignResults = parseTMOutput(tm.output)
                let { t, u } = parseTMMatrix(tm.matrix)
                transformStructure(target.structure, t, u)
                query.addRepresentation(this.qRepr, { color: this.querySchemeId, name: "queryStructure", opacity: 0.3, depthWrite: false });
                target.addRepresentation(this.tRepr, { color: this.targetSchemeId, name: "targetStructure", opacity: 0.3, depthWrite: false });
                const qIfaceSele2 = this.interfaceSelesQuery.filter(Boolean).join(' or ');
                const tIfaceSele2 = this.interfaceSelesTarget.filter(Boolean).join(' or ');
                if (qIfaceSele2) query.addRepresentation(this.qRepr, { sele: qIfaceSele2, color: this.querySchemeId, name: "queryStructureIface" });
                if (tIfaceSele2) target.addRepresentation(this.tRepr, { sele: tIfaceSele2, color: this.targetSchemeId, name: "targetStructureIface" });
            }
            await this.drawArrows(query.structure, target.structure)
            this.setQuerySelection();
            this.setTargetSelection();
            query.autoView(this.querySele, this.autoViewTime)
        } else {
            target.addRepresentation(this.tRepr, { color: this.targetSchemeId, name: "targetStructure", opacity: 0.3, depthWrite: false });
            const tIfaceSeleNoQ = this.interfaceSelesTarget.filter(Boolean).join(' or ');
            if (tIfaceSeleNoQ) target.addRepresentation(this.tRepr, { sele: tIfaceSeleNoQ, color: this.targetSchemeId, name: "targetStructureIface" });
            this.setTargetSelection();
            this.stage.autoView(this.autoViewTime)
        }
        
    },
}
</script>

<style scoped>
.structure-wrapper {
    width: 500px;
    height: 400px;
    margin: 0 auto;
}
</style>

<style>
.theme--dark .structure-wrapper .v-tooltip__content {
    background: rgba(97, 97, 97, 0.3);
}
/* @media only screen and (max-width: 600px) {
    .structure-wrapper {
        width: 300px;
    }
} */
.structure-viewer {
    width: 100%;
    height: 100%;
}
.structure-viewer canvas {
    border-radius: 2px;
}
.structure-panel {
    position: relative;
}
.structure-error {
    width: 100%;
    margin: 0 auto;
    padding: 16px 20px;
    border: 1px solid #E57373;
    background: rgba(229, 115, 115, 0.08);
    color: #C62828;
    border-radius: 4px;
    text-align: center;
}
.theme--dark .structure-error {
    color: #FFCDD2;
    background: rgba(229, 115, 115, 0.15);
}
.toolbar-panel {
    display: inline-flex;
    flex-direction: row;
    position: absolute;
    justify-content: center;
    width: 100%;
    bottom: 0;
    z-index: 1;
    left: 0;
}
.tmscore-panel {
    position: absolute;
    width: 100%;
    top: 0;
    left: 0;
    z-index: 1;
    font-family: monospace;
    color: rgb(31, 119, 180);
}
.left-cell {
    text-align: right;
    width: 50%;
}
.right-cell {
    text-align: left;
    width: 50%;
    padding-left: 0.3em;
}
</style>
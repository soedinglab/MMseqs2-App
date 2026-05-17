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

// Return sorted resnos on `chain` whose CA is within `cutoff` Angstrom
// of any CA on a different chain. Used to define the interface.
const getInterfaceResnos = (structure, chain, cutoff = 10) => {
    const onChain = [];
    const offChain = [];
    structure.eachAtom(ap => {
        if (ap.atomname !== 'CA') return;
        const entry = { resno: ap.resno, x: ap.x, y: ap.y, z: ap.z };
        if (ap.chainname === chain) onChain.push(entry);
        else offChain.push(entry);
    });
    const c2 = cutoff * cutoff;
    const hits = new Set();
    for (const r of onChain) {
        for (const o of offChain) {
            const dx = r.x - o.x, dy = r.y - o.y, dz = r.z - o.z;
            if (dx*dx + dy*dy + dz*dz <= c2) { hits.add(r.resno); break; }
        }
    }
    return Array.from(hits).sort((a, b) => a - b);
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
        }
    },
    props: {
        alignments: { type: Array },
        highlights: { type: Array },
        queryFile: { type: String },
        queryChainPalette: {
            type: Array,
            default: () => (["#1E88E5", "#43A047"]), // chain 1: blue, chain 2: green
        },
        targetChainPalette: {
            type: Array,
            default: () => (["#FFC107", "#E53935"]), // chain 1: amber, chain 2: red
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
            await Promise.all(this.alignments.map(async (alignment) => {
                const chain_q = getChainName(alignment.query);
                const chain_t = getChainName(alignment.target);
                const [sele_q, sele_t] = getMatchingColumns(alignment).map(arr => arr.join(" or "));

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
                let end = start + length;
                seles.push(`${start}-${end}:${chain}`);
            } 
            let sele = seles.join(" or ");
            repr.setSelection(sele);
            repr.setVisibility(true);
        },
        setQuerySelection() {
            if (!this.stage) return;
            const fullOpacity = this.showQuery === 2;
            const baseRepr = this.stage.getRepresentationsByName("queryStructure");
            if (!baseRepr) return;
            const sele = this.querySele;
            baseRepr.setSelection(sele);
            // In mode 2 show entire structure at full opacity; otherwise keep it faded
            baseRepr.setParameters({ opacity: fullOpacity ? 1.0 : 0.3, depthWrite: fullOpacity });
            this.stage.getRepresentationsByName("queryStructureIface").setVisibility(!fullOpacity);
            if (baseRepr.list && baseRepr.list[0]) {
                baseRepr.list[0].parent.autoView(sele, this.autoViewTime);
            }
        },
        setTargetSelection() {
            if (!this.stage) return;
            const fullOpacity = this.showTarget === 2;
            const repr = this.stage.getRepresentationsByName("targetStructure");
            if (!repr) return;
            const sele = this.targetSele;
            repr.setSelection(sele);
            // In mode 2 show entire structure at full opacity; otherwise keep it faded
            repr.setParameters({ opacity: fullOpacity ? 1.0 : 0.3, depthWrite: fullOpacity });
            this.stage.getRepresentationsByName("targetStructureIface").setVisibility(!fullOpacity);
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
            if (this.alignments.length === 0 || this.showQuery == 2)
                return '';
            if (this.showQuery === 0) {
                // Show only interface residues; fall back to full chain if not yet computed
                const iface = this.interfaceSelesQuery.filter(Boolean);
                return iface.length > 0
                    ? iface.join(' or ')
                    : this.alignments.map(a => `:${getChainName(a.query)}`).join(' or ');
            }
            if (this.showQuery === 1)
                return this.alignments.map(a => `:${getChainName(a.query)}`).join(" or ");
        },
        targetSele: function() {
            if (this.alignments.length === 0 || this.showTarget == 2)
                return '';
            if (this.showTarget === 0) {
                // Show only interface residues; fall back to full chain if not yet computed
                const iface = this.interfaceSelesTarget.filter(Boolean);
                return iface.length > 0
                    ? iface.join(' or ')
                    : this.alignments.map(a => `:${getChainName(a.target)}`).join(' or ');
            }
            if (this.showTarget === 1)
                return this.alignments.map(a => `:${getChainName(a.target)}`).join(" or ");
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
        const interfaceCutoff = 10;
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

        // Now that all chains are concatenated into one structure, compute the
        // interface (CA-CA distance < cutoff) per chain.
        for (const entry of targetChainSeles) {
            const resnos = getInterfaceResnos(target.structure, entry.chain, interfaceCutoff);
            const sele = resnosToSele(resnos, entry.chain);
            entry.alignedSele = sele;
        }
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

            // Map 1-based indices to residue index/resno; only need for query structure
            // Use queryChainSele to make all selections based on actual query chain
            // Per-chain interface selections for the query structure (one entry per unique chain).
            const seenQueryChains = new Map();
            for (let alignment of this.alignments) {
                const chain = getChainName(alignment.query);
                if (seenQueryChains.has(chain)) continue;
                // Renumber once per chain to avoid residue gaps
                let renumber = 1;
                query.structure.eachResidue(function(rp) {
                    rp.resno = renumber++;
                }, new Selection(`:${chain}`));
                const resnos = getInterfaceResnos(query.structure, chain, interfaceCutoff);
                const sele = resnosToSele(resnos, chain);
                seenQueryChains.set(chain, { chain, alignedSele: sele, unalignedSele: `:${chain}` });
            }
            const queryChainSeles = Array.from(seenQueryChains.values());
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
    width: 500px;
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
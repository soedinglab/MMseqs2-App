require('./lib/d3/d3');
import feature from './lib/feature-viewer/feature-viewer.js';

import { Shape, Stage, Selection, download, ColormakerRegistry } from 'ngl';

const MDIDownload = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24"><path d="M14,2L20,8V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V4A2,2 0 0,1 6,2H14M18,20V9H13V4H6V20H18M12,19L8,15H10.5V12H13.5V15H16L12,19Z" /></svg>'
const MDICircle = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24"><path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2Z" /></svg>'
const MDICircleHalf = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24"><path d="M12 2A10 10 0 0 0 2 12A10 10 0 0 0 12 22V2Z" /></svg>'
const MDIArrowRightCircle = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24"><path d="M22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2A10,10 0 0,1 22,12M6,13H14L10.5,16.5L11.92,17.92L17.84,12L11.92,6.08L10.5,7.5L14,11H6V13Z" /></svg>'
const MDIArrowRightCircleOutline = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24"><path d="M6,13V11H14L10.5,7.5L11.92,6.08L17.84,12L11.92,17.92L10.5,16.5L14,13H6M22,12A10,10 0 0,1 12,22A10,10 0 0,1 2,12A10,10 0 0,1 12,2A10,10 0 0,1 22,12M20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12Z" /></svg>'
const MDIRestore = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24"><path d="M13,3A9,9 0 0,0 4,12H1L4.89,15.89L4.96,16.03L9,12H6A7,7 0 0,1 13,5A7,7 0 0,1 20,12A7,7 0 0,1 13,19C11.07,19 9.32,18.21 8.06,16.94L6.64,18.36C8.27,20 10.5,21 13,21A9,9 0 0,0 22,12A9,9 0 0,0 13,3Z" /></svg>'
const MDIFullscreen = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24"><path d="M5,5H10V7H7V10H5V5M14,5H19V10H17V7H14V5M17,14H19V19H14V17H17V14M10,17V19H5V14H7V17H10Z" /></svg>'
const MDIExpand = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" version="1.1" width="24" height="24" viewBox="0 0 24 24"><path d="M5,13H19V11H5M3,17H17V15H3M7,7V9H21V7"></path></svg>'

const blosum62Sim = [
    "AG", "AS", "DE", "DN",
    "ED", "EK", "EQ", "FL",
    "FM", "FW", "FY", "GA",
    "HN", "HQ", "HY", "IL",
    "IM", "IV", "KE", "KQ",
    "KR", "LF", "LI", "LM",
    "LV", "MF", "MI", "ML",
    "MV", "ND", "NH", "NQ",
    "NS", "QE", "QH", "QK",
    "QN", "QR", "RK", "RQ",
    "SA", "SN", "ST", "TS",
    "VI", "VL", "VM", "WF",
    "WY", "YF", "YH", "YW"
]

function formatAlnDiff(seq1, seq2, gapChar = '&nbsp;') {
    if (seq1.length != seq2.length) return ''
    var res = ''
    for (var i = 0; i < seq1.length; i++) {
        if (seq1[i] == seq2[i]) res += seq1[i];
        else if (blosum62Sim.indexOf(seq1[i] + seq2[i]) != -1) res += '+';
        else res += gapChar;
    }
    return res;
}

function padNumber(nr, n, str) {
    return Array(n - String(nr).length + 1).join(str || '0') + nr
}

function getFirstResidueNumber(map, i, lineLen) {
    let start = lineLen * (i - 1)
    while (map.get(start) === null) start--
    return map.get(start)
}

function e(tag, attributes, children) {
    const element = document.createElement(tag);
    for (const a in attributes) {
        if (attributes.hasOwnProperty(a)) {
            element.setAttribute(a, attributes[a]);
        }
    }
    const fragment = document.createDocumentFragment();
    children = Array.isArray(children) ? children : [children];
    for (const c in children) {
        if (children.hasOwnProperty(c)) {
            fragment.appendChild(children[c] instanceof HTMLElement ? children[c] : document.createTextNode(children[c] + ""));
        }
    }
    element.appendChild(fragment);
    return element;
}

// Get the first and last non-null values in a map between a range
function getRange(map, start, end) {
    let first = null, last = null
    for (let i = start; i <= end; i++) {
	let val = map.get(i)
	if (val !== null) {
	    if (first === null) first = val
	    last = val
	}
    }
    return [first, last]
}

function formatAln(alignment, lineLen, queryMap, targetMap) {
    const { qAln, dbAln, qStartPos, dbStartPos, alnLen } = alignment
    const lines = []
    for (let i = 1; i < Math.max(2, Math.ceil(alnLen / lineLen)); i++) {
        const qStart = getFirstResidueNumber(queryMap, i, lineLen)
        const tStart = getFirstResidueNumber(targetMap, i, lineLen)
        const maxLen = (Math.max(qStartPos, dbStartPos) + alnLen+"").length
        const qAlSeq = qAln.substring((i - 1) * lineLen, (i - 1) * lineLen + lineLen)
        const tAlSeq = dbAln.substring((i - 1) * lineLen, (i - 1) * lineLen + lineLen)
        const alnDif = formatAlnDiff(qAlSeq, tAlSeq, '\u00A0')

        const qRow = e("span", {}, [`Q\u00A0${padNumber(qStart, maxLen, '\u00A0')}\u00A0`, e("span", { class: "residues" }, qAlSeq), e("br")])
        const dRow = e("span", {}, ['\u00A0'.repeat(3 + maxLen), e("span", { class: "residues" }, alnDif), e("br")])
        const tRow = e("span", {}, [`T\u00A0${padNumber(tStart, maxLen, '\u00A0')}\u00A0`, e("span", { class: "residues target" }, tAlSeq)])
        const line = e("span", {class: "line"}, [qRow, dRow, tRow])

        const wrapper = e("div", { "class": "alignment-wrapper1" }, e("div", { "class": "alignment-wrapper2" }, line))
        lines.push(wrapper)
    }
    return lines;
}

function lerp(v0, v1, t) {
    return v0 * (1 - t) + v1 * t
}

function clamp(a, b, c) {
    return Math.max(b, Math.min(c, a));
}

function mapPosToSeq(seq, targetPos) {
    var counter = 0;
    var sequencePos = -1;
    for (var i = 0; i < seq.length; i++) {
        if (seq[i] != '-') {
            sequencePos++;
        }
        if (sequencePos == targetPos) {
            break;
        }
        counter++;
    }

    return counter;
}

function firstWord(str) {
    const spaceIndex = str.search(/\s/);
    return spaceIndex < 0 ? str : str.substr(0, spaceIndex);
}

var results = [];
var m = null;
var $queryList = document.getElementById("queryList");
var $tbody = document.getElementById("tableBody");
var $resetZoom = document.getElementById("resetZoom");
var $currentQuery = document.getElementById("currentQuery");
var currentAln = 0;

document.addEventListener('click', function (event) {
    if (event.target.matches('.show-alignment')) {
        alert("test");
    } else if (event.target.matches('#resetZoom')) {
        if (m) {
            m.resetAll();
        }
    } else if (event.target.matches('#toggleAlignments')) {
        document.querySelectorAll('.alignment').forEach((row) => {
            if (typeof(row.dataset.originalDisplay) === "undefined") {
                row.dataset.originalDisplay = row.style.display;
            }
            if (window.getComputedStyle(row).display == "none") {
                row.style.display = row.dataset.originalDisplay;
            } else {
                row.style.display = "none";
            }
        });
    } else if (event.target.matches('#toggleList')) {
        var classes = $queryList.classList;
        if (classes.contains('collapsed')) { 
            classes.remove('collapsed');
        } else {
            classes.add('collapsed');
        }
    } else if (event.target.matches('.query')) {
        showResults(results[event.target.dataset.index]);
    }
}, false);

const oneToThree = {
  "A":"ALA", "R":"ARG", "N":"ASN", "D":"ASP",
  "C":"CYS", "E":"GLU", "Q":"GLN", "G":"GLY",
  "H":"HIS", "I":"ILE", "L":"LEU", "K":"LYS",
  "M":"MET", "F":"PHE", "P":"PRO", "S":"SER",
  "T":"THR", "W":"TRP", "Y":"TYR", "V":"VAL",
  "U":"SEC", "O":"PHL", "X":"XAA"
};

/**
 * Create a mock PDB from Ca data
 * Follows the spacing spec from https://www.wwpdb.org/documentation/file-format-content/format33/sect9.html#ATOM
 * Will have to change if/when swapping to fuller data
 */
function mockPDB(ca, seq) {
    const atoms = ca.split(',')
    const pdb = new Array()
    let j = 1
    for (let i = 0; i < atoms.length; i += 3, j++) {
        let [x, y, z] = atoms.slice(i, i + 3).map(element => parseFloat(element))
        pdb.push(
            'ATOM  '
            + j.toString().padStart(5)
            + '  CA  ' + oneToThree[seq != "" && (atoms.length/3) == seq.length ? seq[i/3] : 'A'] + ' A'
            + j.toString().padStart(4)
            + '    '
            + x.toString().padStart(8)
            + y.toString().padStart(8)
            + z.toString().padStart(8)
            + '  1.00  0.00           C  '
        )
    }
    return pdb.join('\n')
}

// Map indices in the alignment to the corresponding indices in the structure
function makePositionMap(realStart, alnString) {
    let map = new Map()
    for (let i = 0, gaps = 0; i <= alnString.length; i++) {
        if (alnString[i] === '-') map.set(i, null) && gaps++
        else map.set(i, realStart + i - gaps)
    }
    return map
}

/* ------ The rotation matrix to rotate Chain_1 to Chain_2 ------ */
/* m               t[m]        u[m][0]        u[m][1]        u[m][2] */
/* 0     161.2708425765   0.0663961888  -0.6777150909  -0.7323208325 */
/* 1     109.4205584665  -0.9559071424  -0.2536229340   0.1480437178 */
/* 2      29.1924015422  -0.2860648199   0.6902011757  -0.6646722921 */
/* Code for rotating Structure A from (x,y,z) to (X,Y,Z): */
/* for(i=0; i<L; i++) */
/* { */
/*    X[i] = t[0] + u[0][0]*x[i] + u[0][1]*y[i] + u[0][2]*z[i]; */
/*    Y[i] = t[1] + u[1][0]*x[i] + u[1][1]*y[i] + u[1][2]*z[i]; */
/*    Z[i] = t[2] + u[2][0]*x[i] + u[2][1]*y[i] + u[2][2]*z[i]; */
/* } */
const transformStructure = (structure, t, u) => {
    structure.eachAtom(atom => {
        const [x, y, z] = [atom.x, atom.y, atom.z]
        atom.x = t[0] + u[0][0] * x + u[0][1] * y + u[0][2] * z
        atom.y = t[1] + u[1][0] * x + u[1][1] * y + u[1][2] * z
        atom.z = t[2] + u[2][0] * x + u[2][1] * y + u[2][2] * z
    })
    return structure
}

/**
 * Shift structure x, y, z coordinates by some offset
 * @param {StructureComponent} structure
 * @param {float} offset
 */
const offsetStructure = (structure, offset = 0.5) => {
    let count = 0
    structure.eachAtom(atom => {
        if (count % 3 === 0)
            offset *= -1
        atom.x = atom.x + offset;	
        atom.y = atom.y + offset;	
        atom.z = atom.z + offset;	
        count++
    })
    return structure
}

// Get XYZ coordinates of CA of a given residue
const xyz = (structure, resIndex) => {
    var rp = structure.getResidueProxy()
    var ap = structure.getAtomProxy()
    rp.index = resIndex
    ap.index = rp.getAtomIndexByName('CA')
    return [ap.x, ap.y, ap.z]
}

// Given an NGL AtomProxy, return the corresponding PDB line
const atomToPDBRow = (ap) => {
    const { serial, atomname, resname, chainname, resno, inscode, x, y, z } = ap
    return `ATOM  ${serial.toString().padStart(5)}${atomname.padStart(4)}  ${resname.padStart(3)} ${chainname.padStart(1)}${resno.toString().padStart(4)} ${inscode.padStart(1)}  ${x.toFixed(3).padStart(8)}${y.toFixed(3).padStart(8)}${z.toFixed(3).padStart(8)}`
}

// Generate a subsetted PDB file from a structure and selection
const makeSubPDB = (structure, sele) => {
    let pdb = []
    structure.eachAtom(ap => { pdb.push(atomToPDBRow(ap)) }, new Selection(sele))
    return pdb.join('\n')
}

function saveMatchingResidues(aln1, aln2, str1, str2, queryMap, targetMap) {
    if (aln1.length !== aln2.length) return
    let qMatches = []
    let tMatches = []
    for (let i = 0; i < aln1.length; i++) {
        if (aln1[i] === '-' || aln2[i] === '-') continue
        let qIdx = queryMap.get(i) - 1
        let tIdx = targetMap.get(i) - 1
        qMatches.push({ index: qIdx, xyz: () => xyz(str1, qIdx) })
        tMatches.push({ index: tIdx, xyz: () => xyz(str2, tIdx) })
    }
    return [qMatches, tMatches]
}

// Create NGL arrows from array of ([X, Y, Z], [X, Y, Z]) pairs
function createArrows(matches) {
    const shape = new Shape('shape')
    for (let i = 0; i < matches.length; i++) {
        const [a, b] = matches[i]
        shape.addArrow(a, b, [0, 1, 1], 0.4)
    }
    return shape
}

async function loadWASM() {
    let pulchra = await import('pulchra-wasm')
    let tmalign = await import('tmalign-wasm');
    return { pulchra, tmalign }
}

// Draw alignment panel and structure viewer
function alnHTML(queryData, alignment) {
    // Map alignment indices to sequence indices
    let qAlnToSeq = makePositionMap(alignment["qStartPos"], alignment["qAln"]);
    let tAlnToSeq = makePositionMap(alignment["dbStartPos"], alignment["dbAln"]);

    var config = {
        lineLen: 80,
        isFullscreen: false,
        showArrows: false,
        showFullQuery: false,
        showFullTarget: false,
        tSele: [ alignment["dbStartPos"], alignment["dbEndPos"] ],
        queryAlignedColour: "#1E88E5",
        queryUnalignedColour: "#A5CFF5",
        targetAlignedColour: "#FFC107",
        targetUnalignedColour: "#FFE699",
    }
    var lines = formatAln(alignment, config.lineLen, qAlnToSeq, tAlnToSeq)

    // If mmseqs, only need the alignment panel
    if (__APP__ === 'mmseqs')
        return [e("td", { "colspan": 7, "class": "alignment-panel" }, lines)]

    // Initial query/target selections based on alignment positions
    let qSele = `${alignment["qStartPos"]}-${alignment["qEndPos"]}`

    // NGL elements we need the references for later
    let stage,
        arrowShape,
        qRepr,
        tRepr

    // HTML elements
    function makeButton(svg, props) {
        let btn = e('button', { 'class': 'structure-btn', ...props }, '')
        btn.innerHTML = svg
        return btn
    }
    let dlButton = makeButton(MDIDownload)
    let qButton = makeButton(MDICircleHalf, { 'style': 'fill: grey;'})
    let tButton = makeButton(MDICircleHalf, { 'style': 'fill: red;'})
    let arrowButton = makeButton(MDIArrowRightCircleOutline)
    let resetButton = makeButton(MDIRestore)
    let fsButton = makeButton(MDIFullscreen)
    let toolbar = e("div", { "class": "structure-toolbar" }, [
        dlButton,
        qButton,
        tButton,
        arrowButton,
        resetButton,
        fsButton,
    ])
    let structureTMScore = e("div", { "class": "tm-score" }, "")
    let structureDiv = e("div", { "class": "structure-viewer" }, '')
    let structurePan = e("div", {"class": "structure-wrapper"}, [structureTMScore, toolbar, structureDiv])

    // Use a Proxy for configuration values to manage state
    let proxy = new Proxy(config, {
        get: (obj, prop) => obj[prop],
        set: (obj, prop, value) => {
            if (prop === 'isFullscreen') {
                if (!stage) return false
                obj.isFullscreen = value
                if (value) {
                    toolbar.querySelectorAll('.structure-btn').forEach(el => el.classList.add('fullscreen'))
                    structureTMScore.classList.add('fullscreen')
                } else {
                    toolbar.querySelectorAll('.structure-btn').forEach(el => el.classList.remove('fullscreen'))
                    structureTMScore.classList.remove('fullscreen')
                }
            } else if (prop === 'showArrows') {
                if (!stage || !arrowShape) return false
                obj.showArrows = value
                arrowShape.setVisibility(obj.showArrows)
            } else if (prop === 'showFullQuery') {
                if (!stage || !qRepr) return false
                obj.showFullQuery = value
                qRepr.setSelection(obj.showFullQuery ? '' : qSele)
            } else if (prop === 'showFullTarget') {
                if (!stage || !tRepr) return false
                obj.showFullTarget = value
                obj.tSele = obj.showFullTarget
                    ? [ 1, alignment["tseq"].length ]
                    : [ alignment["dbStartPos"], alignment["dbEndPos"] ]
            } else if (prop === 'tSele') {
                if (!Array.isArray(value)) return false
                let [start, end] = value
                if (start) obj.tSele[0] = start
                if (end) obj.tSele[1] = end
                obj.showFullTarget = false
            }
            if (['showFullTarget', 'tSele'].includes(prop)) {
                if (!stage) return false
                tRepr.setSelection(`${obj.tSele[0]}-${obj.tSele[1]}`)
            }
            return true
        }
    })

    const computed = {
        buttonHTML: (type) => {
            let text, icon
            if (type === 'arrow') {
                icon = proxy.showArrows ? MDIArrowRightCircleOutline : MDIArrowRightCircle
                text = 'Toggle arrows'
            } else if (type === 'query') {
                icon = proxy.showFullQuery ? MDICircle : MDICircleHalf
                text = 'Toggle query'
            } else if (type === 'target') {
                icon = proxy.showFullTarget ? MDICircle : MDICircleHalf
                text = 'Toggle target'
            } else if (type === 'download') {
                icon = MDIDownload
                text = 'Download'
            } else if (type === 'reset') {
                icon = MDIRestore
                text = 'Reset view'
            } else if (type === 'fullscreen') {
                icon = MDIFullscreen
                text = 'Fullscreen'
            }
            return proxy.isFullscreen ? `<span>${text}</span>${icon}` : icon
        },
    }

    loadWASM().then(({ pulchra, tmalign }) => {
        Promise.all([
            pulchra.pulchra(mockPDB(queryData.qca, queryData.sequence)),
            pulchra.pulchra(mockPDB(alignment["tca"], alignment["tseq"]))
        ]).then(function ([query, target]) {
            stage = new Stage(structureDiv, { backgroundColor: 'white' })
            return Promise.all([
                stage.loadFile(new Blob([query], { type: 'text/plain' }), {ext: 'pdb', name: 'query'}),
                stage.loadFile(new Blob([target], { type: 'text/plain' }), {ext: 'pdb', name: 'target'})
            ])
        }).then(function([query, target]) {
            let [qMatches, tMatches] = saveMatchingResidues(
                alignment["qAln"],
                alignment["dbAln"],
                query.structure,
                target.structure,
                qAlnToSeq,
                tAlnToSeq
            )

            // Generate colourschemes for query/target based on alignment
            let querySchemeId = ColormakerRegistry.addSelectionScheme([
                [config.queryAlignedColour, qSele],
                [config.queryUnalignedColour, "*"],
            ], "_queryScheme")
            let targetSchemeId = ColormakerRegistry.addSelectionScheme([
                [config.targetAlignedColour, `${alignment['dbStartPos']}-${alignment['dbEndPos']}`],
                [config.targetUnalignedColour, "*"]
            ], "_targetScheme")

            // Subset PDBs to only include residues in alignment
            let qSubPdb = makeSubPDB(query.structure, qSele)
            let tSubPdb = makeSubPDB(target.structure, `${alignment["dbStartPos"]}-${alignment["dbEndPos"]}`)
            let alnFasta = `>target\n${alignment['dbAln']}\n\n>query\n${alignment['qAln']}`

            // Re-align target to query using TM-align for better superposition
            // Target 1st since TM-align generates superposition matrix for 1st structure
            function renderArrows() {
                if (arrowShape) arrowShape.dispose()
                let matches = new Array()
                for (let i = 0; i < tMatches.length; i++) {
                    let qMatch = qMatches[i]
                    let tMatch = tMatches[i]
                    if (proxy.tSele && !(tMatch.index >= proxy.tSele[0] - 1 && tMatch.index < proxy.tSele[1])) {
                        continue
                    }
                    matches.push([qMatch.xyz(), tMatch.xyz()])
                }
                arrowShape = stage.addComponentFromObject(createArrows(matches))
                arrowShape.addRepresentation('buffer')
                arrowShape.setVisibility(proxy.showArrows)
            }

            function onSelectText(i) {
                var selection = window.getSelection()

                // In case of backwards selection
                var [offsetStart, offsetEnd] = [
                    selection.anchorOffset, selection.focusOffset
                ].sort((a, b) => a - b)

                var length = offsetEnd - offsetStart
                var relStart = i * proxy.lineLen + offsetStart
                var relEnd = relStart + length - 1 // the selection is inclusive

                proxy.tSele = getRange(tAlnToSeq, relStart, relEnd)
                renderArrows()
            }
            lines.forEach((line, i) => {
                line.querySelector('.target')
                    .addEventListener('mouseup', () => onSelectText(i))
            })

            // Bind functionality to buttons
            dlButton.addEventListener('click', function() {
                stage.viewer.setLight(undefined, undefined, undefined, 0.2)
                stage.makeImage({
                    trim: true,
                    factor: proxy.isFullscreen ? 1 : 4,
                    antialias: true,
                    transparent: true,
                }).then((blob) => {
                    stage.viewer.setLight(undefined, undefined, undefined, 0.2)
                    download(blob, `${queryData.accession}.png`)
                })
            })
            resetButton.addEventListener('click', function() { stage.autoView(1000) })
            fsButton.addEventListener('click', () => { stage.toggleFullscreen(structurePan) })
            arrowButton.addEventListener('click', () => {
                arrowButton.innerHTML = computed.buttonHTML('arrow')
                proxy.showArrows = !proxy.showArrows
            })
            qButton.addEventListener('click', () => {
                proxy.showFullQuery = !proxy.showFullQuery;
                qButton.innerHTML = computed.buttonHTML('query')
                renderArrows()
            })
            tButton.addEventListener('click', () => {
                proxy.showFullTarget = !proxy.showFullTarget;
                tButton.innerHTML = computed.buttonHTML('target')
                renderArrows()
            })

            // Align subset PDBs using TM-align
            tmalign.tmalign(tSubPdb, qSubPdb, alnFasta).then(out => {
                let tmAlignResults = tmalign.parse(out.output)
                let { t, u } = tmalign.parseMatrix(out.matrix)
                transformStructure(target.structure, t, u) 
                // Offset target slightly when 100% match, otherwise
                // viz will look bugged out
                if (tmAlignResults.tmScore === 1)
                    offsetStructure(target.structure, 0.1)
                qRepr = query.addRepresentation('cartoon', {color: querySchemeId})
                tRepr = target.addRepresentation('cartoon', {color: targetSchemeId})
                qRepr.setSelection(proxy.showFullQuery ? '' : qSele)
                tRepr.setSelection(proxy.showFullTarget ? '' : `${proxy.tSele[0]}-${proxy.tSele[1]}`)
                structureTMScore.replaceChildren([`TM-Score: ${tmAlignResults.tmScore}`])
                stage.autoView()
                renderArrows()
            })

            window.addEventListener('resize', () => stage.handleResize())
            stage.signals.fullscreenChanged.add((isFullscreen) => {
                if (isFullscreen) proxy.isFullscreen = true
                else proxy.isFullscreen = false

                // Adjust button HTML
                qButton.innerHTML = computed.buttonHTML('query')
                tButton.innerHTML = computed.buttonHTML('target')
                dlButton.innerHTML = computed.buttonHTML('download')
                fsButton.innerHTML = computed.buttonHTML('fullscreen')
                arrowButton.innerHTML = computed.buttonHTML('arrow')
                resetButton.innerHTML = computed.buttonHTML('reset')
            })
        })
    })

    return [
        e("td", { "colspan": 4, "class": "alignment-panel-foldseek" }, lines),
        e("td", { "colspan": 3, "class": "structure-panel" }, structurePan) 
    ]
}

// Return a function to create innerHTML of an alignment panel for a given query
function getToggleFn(data, index) {
    return function () {
        if (index === currentAln) return
        var aln = $tbody.querySelector('tr.alignment');
        var newChildren = alnHTML(data.query, data.alignments[index]);
        aln.replaceChildren(...newChildren)
        var parent = this.parentNode.parentNode;
        var next = parent.nextElementSibling;
        if (next) parent.parentNode.insertBefore(aln, next);
        else parent.parentNode.appendChild(aln);
        // Toggle class for the expand button
        let old = $tbody.querySelector(`#toggle-${currentAln}`)
        old.classList.toggle('active-aln');
        $tbody.querySelector(`#toggle-${index}`).classList.toggle('active-aln')
        currentAln = index;
    }
}

function showResults(data){
    $currentQuery.textContent = firstWord(data.query.accession);
    if (m != null) {
        $resetZoom.classList.add('hide');
        m.clearInstance();
        m = null;
    }
    m = new feature(data.query.accession, data.query.sequence, document.getElementById("hits"), {
        showAxis: true,
        showSequence: true,
        brushActive: true,
        zoomMax: 10,
        onZoom: (ev) => {
            var classes = $resetZoom.classList;
            if (ev.zoom > 1) { classes.remove('hide'); } else { classes.add('hide'); }
        },
        onHeightChanged: (newHeight) => {
            document.getElementById("hitsParent").style.minHeight = newHeight + "px";
        }
    });

    var fixSafariSvgLink = function (d, event) {
        if (typeof (d.href) !== "undefined" && d.href.startsWith('#result')) {
            window.location.hash = d.href;
        }
    }

    var color = d3.rgb("#1f77b4");
    var alignments = data.alignments;

    var features = [];
    var cnt = 0;

    var maxScore = 0;
    var minScore = Number.MAX_VALUE;
    for (var i in alignments) {
        if (!alignments.hasOwnProperty(i)) {
            continue;
        }
        var score = alignments[i]["eval"];
        if (score >= maxScore) {
            maxScore = score;
        }

        if (score <= minScore) {
            minScore = score;
        }
    }

    $tbody.textContent = "";
    for (var i in alignments) {
        if (!alignments.hasOwnProperty(i)) {
            continue;
        }
        var score = alignments[i]["eval"];
        var colorHsl = color.hsl();
        var r = lerp(minScore / maxScore, 1, score / maxScore);
        colorHsl.l = clamp(colorHsl.l * Math.pow(0.65, -r), 0.1, 0.9);

        var reverse = false;
        var start = alignments[i]["qStartPos"];
        var end = alignments[i]["qEndPos"]
        if (start > end) {
            start = [end, end = start][0];
            reverse = true;
        }

        var f = {
            "x": mapPosToSeq(data.query.sequence, start),
            "y": mapPosToSeq(data.query.sequence, end),
            "description": alignments[i]["target"] + " (E: " + alignments[i]["eval"] + ")",
            "id": cnt,
            "color": colorHsl.rgb(),
            "href": '#aln' + cnt,
            "reverse": reverse,
            "callback": fixSafariSvgLink
        }
        features.push(f);

        const qPos = alignments[i]["qStartPos"] + "-" + alignments[i]["qEndPos"] + " (" + alignments[i]["qLen"] + ")";
        const tPos = alignments[i]["dbStartPos"] + "-" + alignments[i]["dbEndPos"] + " (" + alignments[i]["dbLen"] + ")";

        const toggle = e('button', { 'id': `toggle-${cnt}`, 'class': 'toggle-btn' }, '')
        toggle.innerHTML = MDIExpand;
        toggle.onclick = getToggleFn(data, i);
        $tbody.appendChild(
            e("tr", {},
                [
                    e("td", { "data-label": "Target" }, [
                        e("a", { name: "aln" + cnt, class: "anchor" }, ""),
                        alignments[i]["target"]
                    ]),
                    e("td", { "data-label": "Sequence Identity" }, alignments[i]["seqId"]),
                    e("td", { "data-label": "Score" }, alignments[i]["score"]),
                    e("td", { "data-label": "E-value" }, alignments[i]["eval"]),
                    e("td", { "data-label": "Query Position" }, qPos),
                    e("td", { "data-label": "Target Position" }, tPos),
                    e("td", { "data-label": "Toggle" }, toggle)
                ]
            )
        );

        cnt++;
        if (i > 0) continue  // Only show the first alignment at startup
        var  alnPanel = e("tr", { "class": `alignment ${__APP__}`, }, alnHTML(data.query, alignments[i]));
        $tbody.appendChild(alnPanel)
        toggle.classList.toggle('active-aln');
    }

    m.addFeature({
        data: features,
        name: "",
        className: "test6",
        type: "rect",
        filter: "type2",
        shouldSort: false
    });
    m.finishRender();
}

window.render = function (res) {
    results = res;
    var queries = [];
    for (var r in results) {
        if (!results.hasOwnProperty(r)) {
            continue;
        }
        queries.push(e('li', {}, e("a", { class: 'query', 'data-index': r }, firstWord(results[r].query.accession) + " (" + results[r].alignments.length + ")")));
    }
    $queryList.appendChild(e("ul", {}, queries));
    if (queries.length < 50) {
        $queryList.classList.remove('collapsed');
        document.querySelectorAll("#toggleList").forEach(e => e.parentNode.removeChild(e));
    }
    showResults(results[0]);
}

import './result.css';

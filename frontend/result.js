require('./lib/d3/d3');
import feature from './lib/feature-viewer/feature-viewer.js';

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

function padNumber(nr, n, str) {
    return Array(n - String(nr).length + 1).join(str || '0') + nr;
}

var results = [];
var m = null;
var $queryList = document.getElementById("queryList");
var $tbody = document.getElementById("tableBody");
var $resetZoom = document.getElementById("resetZoom");
var $currentQuery = document.getElementById("currentQuery");
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

function showResults(data) {
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
                    e("td", { "data-label": "Target Position" }, tPos)
                ]
            )
        );

        const lineLen = 80;
        const totalLines = Math.max(1, (alignments[i]["alnLen"] / lineLen));
        const alnStrLength = (alignments[i]["alnLen"] + "").length;
        var lines = [];
        for (var l = 0; l < totalLines; l++) {
            var pos = " " + padNumber(l * lineLen, alnStrLength, " ") + " ";
            lines.push(
                e("div", { "class": "alignment-wrapper1" },
                    e("div", { "class": "alignment-wrapper2" },
                        e("span", { "class": "line" },
                            [
                                "Q", pos, e("span", { "class": "residues" }, alignments[i]["qAln"].substring(l * lineLen, l * lineLen + lineLen)), e("br", {}, ""),
                                "T", pos, e("span", { "class": "residues" }, alignments[i]["dbAln"].substring(l * lineLen, l * lineLen + lineLen))
                            ]
                        )
                    )
                )
            );
            if (l != totalLines - 1) {
                lines.push(e("br", {}, ""));
            }
        }

        $tbody.appendChild(
            e("tr", { "class": "alignment", },
                e("td", { "colspan": 6 }, lines)
            )
        );

        cnt++;
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
    console.log(queries.length);
    if (queries.length < 50) {
        $queryList.classList.remove('collapsed');
        document.querySelectorAll("#toggleList").forEach(e => e.parentNode.removeChild(e));
    }
    showResults(results[0]);
}

import './result.css';
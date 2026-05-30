export function downloadBlob(blob, name) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
}

export function makePositionMap(realStart, alnString) {
    const map = Array(alnString.length);
    for (let i = 0, gaps = 0; i < alnString.length; i++) {
        if (alnString[i] === '-') {
            map[i] = null;
            gaps++;
        } else {
            map[i] = realStart + i - gaps;
        }
    }
    return map;
}

export function calculateOffset(node) {
    const container = node.closest("span.residues");
    const children = container.querySelectorAll("span");
    let length = 0;
    for (const child of children) {
        if (child === node) break;
        length += child.textContent.length;
    }
    return length;
}

export function residueTextOffset(container, offset, defaultToEnd = false) {
    if (!container) return 0;
    if (container.nodeType === 3) return offset + calculateOffset(container.parentElement);

    const residues = container.closest?.("span.residues");
    if (!residues) return 0;
    if (container === residues) {
        let length = 0;
        const children = Array.from(residues.childNodes).slice(0, offset);
        for (const child of children) length += child.textContent.length;
        return length || (defaultToEnd ? residues.textContent.length : 0);
    }

    return calculateOffset(container) + (defaultToEnd ? container.textContent.length : 0);
}

export function getResiduePointerOffset(event, span) {
    let node = null;
    let offset = 0;

    if (document.caretPositionFromPoint) {
        const position = document.caretPositionFromPoint(event.clientX, event.clientY);
        node = position?.offsetNode;
        offset = position?.offset || 0;
    } else if (document.caretRangeFromPoint) {
        const range = document.caretRangeFromPoint(event.clientX, event.clientY);
        node = range?.startContainer;
        offset = range?.startOffset || 0;
    }

    if (!node || !span.contains(node)) return 0;
    return Math.max(0, Math.min(residueTextOffset(node, offset), span.textContent.length - 1));
}

export function exportAlignmentTitle(alignments, hasQueryStructure) {
    return alignments
        .map(aln => hasQueryStructure ? `${aln.query}-${aln.target}` : aln.target)
        .join('_');
}

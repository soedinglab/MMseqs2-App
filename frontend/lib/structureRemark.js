export function structureRemarkPrefix(text, number) {
    const cif = text[0] === '#' || text.startsWith('data_');
    return cif ? '# ' : `REMARK  ${number} `;
}

/** Format one PDB-width remark line, or an unbounded mmCIF comment. */
export function structureRemarkLine(text, content, number) {
    const prefix = structureRemarkPrefix(text, number);
    let line = `${prefix}${content}`;
    if (prefix !== '# ' && line.length > 79) line = `${line.slice(0, 76)}... `;
    return line.padEnd(80, ' ');
}

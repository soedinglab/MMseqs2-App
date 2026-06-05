export async function loadStructureFromData(plugin, source, label = source?.label) {
    const raw = await plugin.builders.data.rawData(
        { data: source.data, label },
        { state: { isGhost: true } },
    );
    const trajectory = await plugin.builders.structure.parseTrajectory(raw, source.format || 'pdb');
    const model = await plugin.builders.structure.createModel(trajectory);
    return plugin.builders.structure.createStructure(model);
}

export function detectStructureFormat(raw) {
    const text = raw?.trimStart?.() || '';
    return text[0] === '#' || text.startsWith('data_') ? 'mmcif' : 'pdb';
}

export function structureSourceFromText(raw, label) {
    const data = raw?.trimStart?.() || '';
    return {
        data,
        label,
        format: detectStructureFormat(data),
    };
}

export function normalizedPdbSourceFromText(raw, label, options = {}) {
    const data = raw?.trimStart?.() || '';
    const format = detectStructureFormat(data);
    return {
        data: format === 'pdb' ? normalizeWhitespacePdb(data, options) : data,
        label,
        format,
    };
}

function normalizeWhitespacePdb(text, options = {}) {
    return text
        .split(/\r?\n/)
        .map(line => {
            const trimmed = line.trim();
            if (!trimmed) return '';
            if (options.dropConect && trimmed.startsWith('CONECT')) return '';
            if (!trimmed.startsWith('ATOM') && !trimmed.startsWith('HETATM')) {
                return trimmed;
            }
            if (hasFixedAtomColumns(line)) return line.trimEnd();
            return formatWhitespaceAtom(trimmed.split(/\s+/));
        })
        .filter(Boolean)
        .join('\n');
}

function hasFixedAtomColumns(line) {
    return line.length >= 54
        && Number.isFinite(Number.parseInt(line.slice(22, 26), 10))
        && Number.isFinite(Number.parseFloat(line.slice(30, 38)))
        && Number.isFinite(Number.parseFloat(line.slice(38, 46)))
        && Number.isFinite(Number.parseFloat(line.slice(46, 54)));
}

function formatWhitespaceAtom(parts) {
    if (parts.length < 9) return null;
    const hasChain = !/^-?\d+$/.test(parts[4]);
    const resSeqIndex = hasChain ? 5 : 4;
    const coordIndex = hasChain ? 6 : 5;
    const serial = Number.parseInt(parts[1], 10) || 1;
    const atomName = parts[2] || 'CA';
    const resName = parts[3] || 'UNK';
    const chain = hasChain ? parts[4] : 'A';
    const resSeq = Number.parseInt(parts[resSeqIndex], 10);
    const x = Number.parseFloat(parts[coordIndex]);
    const y = Number.parseFloat(parts[coordIndex + 1]);
    const z = Number.parseFloat(parts[coordIndex + 2]);
    const occupancy = Number.parseFloat(parts[coordIndex + 3]);
    const bFactor = Number.parseFloat(parts[coordIndex + 4]);
    if (!Number.isFinite(resSeq) || !Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return null;

    const element = (parts[coordIndex + 5] || atomName.replace(/[^A-Za-z]/g, '').slice(0, 2)).toUpperCase();
    return [
        (parts[0] === 'HETATM' ? 'HETATM' : 'ATOM').padEnd(6),
        String(serial).padStart(5).slice(-5),
        ' ',
        formatAtomName(atomName, element),
        ' ',
        resName.padStart(3).slice(-3),
        ' ',
        chain.slice(0, 1),
        String(resSeq).padStart(4).slice(-4),
        ' ',
        '   ',
        x.toFixed(3).padStart(8),
        y.toFixed(3).padStart(8),
        z.toFixed(3).padStart(8),
        (Number.isFinite(occupancy) ? occupancy : 1).toFixed(2).padStart(6),
        (Number.isFinite(bFactor) ? bFactor : 0).toFixed(2).padStart(6),
        '          ',
        element.padStart(2).slice(-2),
        (parts[coordIndex + 6] || '').padStart(2).slice(-2),
    ].join('');
}

function formatAtomName(name, element) {
    const value = String(name || '').slice(0, 4);
    return element.length === 1 && value.length < 4
        ? ` ${value.padEnd(3)}`
        : value.padStart(4);
}

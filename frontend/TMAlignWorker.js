import { tmalign, parse as parseTMOutput, parseMatrix as parseTMMatrix } from 'tmalign-wasm';

onmessage = async function (e) {
    const data = e.data;
    const aln = await tmAlignToReference(data.refPDB, data.newPDB, data.alnFasta);
    postMessage(aln);
}

async function tmAlignToReference(refPDB, newPDB, alnFasta) {
    const { output, matrix } = await tmalign(refPDB, newPDB, alnFasta);
    const { t, u }  = parseTMMatrix(matrix);
    const tmResults = parseTMOutput(output);
    return { t, u, tmResults };
}
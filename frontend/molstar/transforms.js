import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms';
import { Mat4 } from 'molstar/lib/mol-math/linear-algebra';

function structureRef(structure) {
    return structure?.ref || structure;
}

export async function transformStructureConformation(plugin, structure, matrix, options = {}) {
    if (!matrix) return structure;
    const params = {
        transform: {
            name: 'matrix',
            params: { data: matrix, transpose: false },
        },
    };
    const stateOptions = options.tags ? { tags: options.tags } : undefined;
    const builder = plugin.state.data.build().to(structureRef(structure));
    const update = options.method === 'apply'
        ? builder.apply(StateTransforms.Model.TransformStructureConformation, params, stateOptions)
        : builder.insert(StateTransforms.Model.TransformStructureConformation, params, stateOptions);
    return update.commit();
}

export function mat4FromRotationTranslation(t, u) {
    return Mat4.ofRows([
        [u[0][0], u[0][1], u[0][2], t[0]],
        [u[1][0], u[1][1], u[1][2], t[1]],
        [u[2][0], u[2][1], u[2][2], t[2]],
        [0, 0, 0, 1],
    ]);
}

function matrixParamsFromCommaStrings(tmat, umat) {
    const t = String(tmat || '').split(',').map(Number);
    const u = String(umat || '').split(',').map(Number);
    if (t.length < 3 || u.length < 9 || t.some(Number.isNaN) || u.some(Number.isNaN)) return null;
    return {
        t,
        u: [
            [u[0], u[1], u[2]],
            [u[3], u[4], u[5]],
            [u[6], u[7], u[8]],
        ],
    };
}

export function mat4FromCommaStrings(tmat, umat) {
    const params = matrixParamsFromCommaStrings(tmat, umat);
    return params ? mat4FromRotationTranslation(params.t, params.u) : null;
}

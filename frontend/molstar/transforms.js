import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms';

export function structureRef(structure) {
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

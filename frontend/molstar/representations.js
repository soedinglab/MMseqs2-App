import { Color } from 'molstar/lib/mol-util/color';

const CartoonQualityPresets = {
    viewer: {
        quality: 'highest',
        linearSegments: 18,
        radialSegments: 36,
    },
    thumbnail: {
        quality: 'higher',
        linearSegments: 10,
        radialSegments: 16,
    },
};

export function cartoonParams(overrides = {}) {
    const { qualityPreset = 'viewer', ...typeOverrides } = overrides;
    const quality = CartoonQualityPresets[qualityPreset] || CartoonQualityPresets.viewer;
    return {
        ...quality,
        ignoreLight: false,
        sizeFactor: 0.25,
        visuals: ['polymer-trace', 'polymer-gap'],
        helixProfile: 'rounded',
        nucleicProfile: 'rounded',
        material: {
            metalness: 0,
            roughness: 1,
            bumpiness: 0,
        },
        ...typeOverrides,
    };
}

export function ballAndStickParams(overrides = {}) {
    return {
        quality: 'higher',
        sizeFactor: 0.28,
        sizeAspectRatio: 0.7,
        aromaticBonds: true,
        material: {
            metalness: 0,
            roughness: 0.5,
            bumpiness: 0,
        },
        ...overrides,
    };
}

export function representationParams(type, overrides = {}) {
    if (type === 'cartoon') return cartoonParams(overrides);
    if (type === 'ball-and-stick') return ballAndStickParams(overrides);
    return {
        quality: 'higher',
        ignoreLight: false,
        ...overrides,
    };
}

export async function addUniformRepresentation(plugin, structure, options) {
    if (!options?.expression) return null;
    const component = await plugin.builders.structure.tryCreateComponentFromExpression(
        structure,
        options.expression,
        options.label,
        { label: options.label },
    );
    if (!component) return null;

    const representation = await plugin.builders.structure.representation.addRepresentation(component, {
        type: options.type,
        color: 'uniform',
        colorParams: { value: Color(options.color) },
        typeParams: representationParams(options.type, options.typeParams || {}),
    }, options.state || {});
    return { component, representation };
}

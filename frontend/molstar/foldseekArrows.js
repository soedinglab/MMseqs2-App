import { Color } from 'molstar/lib/mol-util/color';
import { OrderedSet } from 'molstar/lib/mol-data/int';
import { Vec3 } from 'molstar/lib/mol-math/linear-algebra';
import { StructureElement, StructureProperties, Unit } from 'molstar/lib/mol-model/structure';
import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms';
import { PluginStateObject } from 'molstar/lib/mol-plugin-state/objects';
import { StateTransformer } from 'molstar/lib/mol-state';
import { Task } from 'molstar/lib/mol-task';
import { Shape } from 'molstar/lib/mol-model/shape';
import { Mesh } from 'molstar/lib/mol-geo/geometry/mesh/mesh';
import { MeshBuilder } from 'molstar/lib/mol-geo/geometry/mesh/mesh-builder';
import { addCylinder } from 'molstar/lib/mol-geo/geometry/mesh/builder/cylinder';
import { Sphere3D } from 'molstar/lib/mol-math/geometry';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition';
import { getChainName } from './foldseekUtilities.js';

const FoldseekTransform = StateTransformer.builderFactory('foldseek');
const FoldseekArrowsShape = FoldseekTransform({
    name: 'alignment-arrows-shape',
    display: { name: 'Alignment Arrows' },
    from: PluginStateObject.Root,
    to: PluginStateObject.Shape.Provider,
    params: {
        pairs: PD.Value([]),
        color: PD.Color(Color(0x00ffff)),
    },
})({
    apply({ params }) {
        return Task.create('Alignment Arrows', async () => new PluginStateObject.Shape.Provider({
            label: 'Alignment Arrows',
            data: params,
            params: Mesh.Params,
            geometryUtils: Mesh.Utils,
            getShape: (_, data, __, mesh) => Shape.create(
                'Alignment Arrows',
                data,
                createArrowMesh(data.pairs, mesh),
                () => data.color,
                () => 1,
                () => 'Aligned residue pair',
            ),
        }, { label: 'Alignment Arrows' }));
    },
});

export async function setArrows(plugin, state, input) {
    if (input?.structureMode === 'interface' || !input?.showArrows || !state.query || !state.target) {
        if (state.arrows?.ref) {
            await plugin.state.data.build().delete(state.arrows.ref).commit();
            state.arrows = null;
        }
        return;
    }

    if (state.arrows?.ref) return;

    const pairs = alignmentArrowPairs(state, input);
    if (pairs.length === 0) return;

    state.arrows = await plugin.state.data.build()
        .toRoot()
        .apply(FoldseekArrowsShape, {
            pairs,
            color: Color(input.arrowColor || 0x00ffff),
        }, {
            tags: ['foldseek-arrows'],
            state: { isCollapsed: true },
        })
        .apply(StateTransforms.Representation.ShapeRepresentation3D, {}, {
            tags: ['foldseek-arrows-representation'],
        })
        .commit();
}

function createArrowMesh(pairs, oldMesh) {
    const state = MeshBuilder.createState(Math.max(256, pairs.length * 64), Math.max(128, pairs.length * 32), oldMesh);
    const center = Vec3();
    let radius = 1;

    pairs.forEach(([startRaw, endRaw], i) => {
        const start = Vec3.create(startRaw[0], startRaw[1], startRaw[2]);
        const end = Vec3.create(endRaw[0], endRaw[1], endRaw[2]);
        const length = Vec3.distance(start, end);
        if (!Number.isFinite(length) || length < 0.5) return;

        state.currentGroup = i;
        addCylinder(state, start, end, 1, {
            radiusTop: 0.12,
            radiusBottom: 0.12,
            radialSegments: 16,
        });

        Vec3.add(center, center, start);
        Vec3.add(center, center, end);
    });

    if (pairs.length > 0) {
        Vec3.scale(center, center, 1 / (pairs.length * 2));
        radius = pairs.reduce((max, [start, end]) => Math.max(
            max,
            Vec3.distance(center, start),
            Vec3.distance(center, end),
        ), 1);
    }

    const mesh = MeshBuilder.getMesh(state);
    mesh.setBoundingSphere(Sphere3D.create(center, radius));
    return mesh;
}

function getMatchingResiduePairs(alignment) {
    const pairs = [];
    let queryPos = alignment.qStartPos;
    let targetPos = alignment.dbStartPos;

    for (let i = 0; i < alignment.qAln.length; i++) {
        const hasQuery = alignment.qAln[i] !== '-';
        const hasTarget = alignment.dbAln[i] !== '-';
        if (hasQuery && hasTarget) {
            pairs.push({ query: queryPos, target: targetPos });
        }
        if (hasQuery) queryPos++;
        if (hasTarget) targetPos++;
    }

    return pairs;
}

function caOrdinalCoordinateMap(structure) {
    const map = new Map();
    if (!structure) return map;

    const loc = StructureElement.Location.create(structure);
    const chainCounts = new Map();
    for (const unit of structure.units) {
        if (!Unit.isAtomic(unit)) continue;
        loc.unit = unit;

        const { elements } = unit;
        const size = OrderedSet.size(elements);
        for (let i = 0; i < size; i++) {
            loc.element = OrderedSet.getAt(elements, i);
            if (StructureProperties.atom.label_atom_id(loc) !== 'CA') continue;

            const authChain = StructureProperties.chain.auth_asym_id(loc);
            const labelChain = StructureProperties.chain.label_asym_id(loc);
            const coordinate = [
                StructureProperties.atom.x(loc),
                StructureProperties.atom.y(loc),
                StructureProperties.atom.z(loc),
            ];

            for (const chain of new Set([authChain, labelChain].filter(Boolean))) {
                const ordinal = (chainCounts.get(chain) || 0) + 1;
                chainCounts.set(chain, ordinal);
                map.set(`${chain}:${ordinal}`, coordinate);
            }
        }
    }

    return map;
}

function alignmentArrowPairs(state, input) {
    const queryStructure = state.query?.structure?.cell?.obj?.data;
    const targetStructure = state.target?.structure?.cell?.obj?.data;
    if (!queryStructure || !targetStructure) return [];

    const queryCoords = caOrdinalCoordinateMap(queryStructure);
    const targetCoords = caOrdinalCoordinateMap(targetStructure);
    const pairs = [];

    for (const alignment of input?.alignments || []) {
        const queryChain = getChainName(alignment.query);
        const targetChain = getChainName(alignment.target);

        for (const match of getMatchingResiduePairs(alignment)) {
            const query = queryCoords.get(`${queryChain}:${match.query}`);
            const target = targetCoords.get(`${targetChain}:${match.target}`);
            if (query && target) pairs.push([query, target]);
        }
    }

    return pairs;
}

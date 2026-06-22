import { Vec3 } from 'molstar/lib/mol-math/linear-algebra';
import { OrderedSet } from 'molstar/lib/mol-data/int';
import { StructureElement, StructureProperties } from 'molstar/lib/mol-model/structure';
import { Shape } from 'molstar/lib/mol-model/shape';
import { Text } from 'molstar/lib/mol-geo/geometry/text/text';
import { TextBuilder } from 'molstar/lib/mol-geo/geometry/text/text-builder';
import { PluginStateObject } from 'molstar/lib/mol-plugin-state/objects';
import { StateTransforms } from 'molstar/lib/mol-plugin-state/transforms';
import { StateTransformer } from 'molstar/lib/mol-state';
import { Task } from 'molstar/lib/mol-task';
import { ValueCell } from 'molstar/lib/mol-util';
import { Color } from 'molstar/lib/mol-util/color';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition';

const QueryChainLabelColor = Color(0x1e88e5);
const TargetChainLabelColor = Color(0xffc107);
const SeparatorChainLabelColor = Color(0xffffff);
const ChainLabelsRef = 'foldseek-chain-labels';
const ChainLabelsRepresentationRef = 'foldseek-chain-labels-representation';
const DefaultChainLabelScale = 5;

const ChainLabelTextParams = {
    ...Text.Params,
    chainScale: PD.Numeric(DefaultChainLabelScale, { min: 0.1, max: 20, step: 0.1 }),
};

const FoldseekChainLabelsShape = StateTransformer.builderFactory('foldseek')({
    name: 'chain-labels-shape',
    display: { name: 'Chain Labels' },
    from: PluginStateObject.Root,
    to: PluginStateObject.Shape.Provider,
    params: {
        labels: PD.Value([]),
    },
})({
    apply({ params }) {
        return Task.create('Chain Labels', async () => new PluginStateObject.Shape.Provider({
            label: 'Chain Labels',
            data: params,
            params: ChainLabelTextParams,
            geometryUtils: Text.Utils,
            getShape: (_, data, props, text) => {
                const groups = [];
                const geometry = buildChainLabelText(data.labels, props, text, groups);

                return Shape.create(
                    'Chain Labels',
                    data,
                    geometry,
                    group => groups[group]?.color || SeparatorChainLabelColor,
                    () => 1,
                    group => groups[group]?.tooltip || '',
                );
            },
        }, { label: 'Chain Labels' }));
    },
});

export async function setChainLabels(plugin, state, input) {
    const labels = chainLabelData(state, input);
    const enabled = input?.structureMode === 'multimer'
        && input?.showChainLabels !== false
        && labels.length > 0;

    if (!enabled) {
        await deleteChainLabels(plugin, state);
        return;
    }

    const chainScale = input?.chainLabelScale ?? input?.chainLabelSize ?? DefaultChainLabelScale;
    const key = chainLabelKey(labels, chainScale);
    if (state.chainLabels?.key === key) return;

    await deleteChainLabels(plugin, state);
    await plugin.state.data.build()
        .toRoot()
        .apply(FoldseekChainLabelsShape, { labels }, {
            ref: ChainLabelsRef,
            tags: ['foldseek-chain-labels'],
            state: { isCollapsed: true },
        })
        .apply(StateTransforms.Representation.ShapeRepresentation3D, {
            chainScale,
            background: false,
            attachment: 'middle-center',
        }, {
            ref: ChainLabelsRepresentationRef,
            tags: ['foldseek-chain-labels-representation'],
        })
        .commit();

    state.chainLabels = { ref: ChainLabelsRef, key };
}

async function deleteChainLabels(plugin, state) {
    if (!state.chainLabels?.ref) return;
    await plugin.state.data.build().delete(state.chainLabels.ref).commit();
    state.chainLabels = null;
}

function chainLabelData(state, input) {
    if (!state.query?.structure || !state.target?.structure) return [];

    const queryAnchors = structureChainAnchors(state.query.structure);
    const targetAnchors = structureChainAnchors(state.target.structure);
    const pairs = [];
    const seen = new Set();
    for (const [index, queryMap] of (state.alignmentMaps?.query || []).entries()) {
        const targetMap = state.alignmentMaps?.target?.[index];
        if (!queryMap || !targetMap) continue;

        const queryChain = queryMap.chain;
        const targetChain = targetMap.chain;
        const key = `${queryChain}:${targetChain}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const query = queryAnchors.byChain.get(queryChain) || queryAnchors.list[index];
        const target = targetAnchors.byChain.get(targetChain) || targetAnchors.list[index];
        if (!query || !target) continue;

        pairs.push({
            queryChain: query.chain || queryChain,
            targetChain: target.chain || targetChain,
            query,
            target,
        });
    }

    const sceneCenter = labelSceneCenter(pairs);
    return pairs.map(pair => chainLabelEntry(pair, sceneCenter, input));
}

function structureChainAnchors(structureRef) {
    const structure = structureRef?.cell?.obj?.data || structureRef;
    if (!structure?.units?.length) return { byChain: new Map(), list: [] };

    const byChain = new Map();
    const list = [];
    const loc = StructureElement.Location.create(structure);

    for (const unit of structure.units) {
        if (OrderedSet.size(unit.elements) === 0) continue;

        loc.unit = unit;
        loc.element = OrderedSet.getAt(unit.elements, 0);

        const auth = StructureProperties.chain.auth_asym_id(loc) || '';
        const label = StructureProperties.chain.label_asym_id(loc) || '';
        const chain = auth || label;
        if (!chain) continue;

        const { center, radius } = unit.lookup3d.boundary.sphere;
        const anchor = {
            chain,
            center: Vec3.transformMat4(Vec3(), center, unit.conformation.operator.matrix),
            radius,
        };

        list.push(anchor);
        if (auth && !byChain.has(auth)) byChain.set(auth, anchor);
        if (label && !byChain.has(label)) byChain.set(label, anchor);
    }

    return { byChain, list };
}

function chainLabelEntry({ queryChain, targetChain, query, target }, sceneCenter, input) {
    const pairCenter = Vec3.scale(Vec3(), Vec3.add(Vec3(), query.center, target.center), 0.5);
    const pairRadius = Math.max(query.radius, target.radius, Vec3.distance(pairCenter, query.center), Vec3.distance(pairCenter, target.center));
    const outward = outerLabelDirection(pairCenter, sceneCenter, query.center, target.center);
    const offset = pairRadius * (input?.chainLabelOffset ?? 1.05);

    return {
        queryChain,
        targetChain,
        position: Vec3.scaleAndAdd(Vec3(), pairCenter, outward, offset),
        depth: pairRadius,
        tooltip: `Query chain ${queryChain} / Target chain ${targetChain}`,
    };
}

function labelSceneCenter(pairs) {
    const center = Vec3();
    let count = 0;
    for (const { query, target } of pairs) {
        Vec3.add(center, center, query.center);
        Vec3.add(center, center, target.center);
        count += 2;
    }
    return count > 0 ? Vec3.scale(center, center, 1 / count) : center;
}

function outerLabelDirection(pairCenter, sceneCenter, queryCenter, targetCenter) {
    const outward = Vec3.sub(Vec3(), pairCenter, sceneCenter);
    if (Vec3.magnitude(outward) > 0.001) return Vec3.normalize(outward, outward);

    Vec3.sub(outward, queryCenter, targetCenter);
    if (Vec3.magnitude(outward) > 0.001) return Vec3.normalize(outward, outward);

    return Vec3.set(outward, 0, 1, 0);
}

function chainLabelKey(labels, chainScale) {
    return [
        chainScale,
        labels.map(label => [
            label.queryChain,
            label.targetChain,
            ...label.position.map(roundCoordinate),
        ].join(',')).join(';'),
    ].join(':');
}

function roundCoordinate(value) {
    return Number.isFinite(value) ? value.toFixed(2) : '';
}

function buildChainLabelText(labels, props, oldText, groupMeta) {
    const params = { ...PD.getDefaultValues(Text.Params), ...props };
    const characterCount = labels.reduce((sum, label) => sum + labelTextLength(label), 0);
    const textBuilder = TextBuilder.create(params, Math.max(1, characterCount), Math.max(1, labels.length), oldText);
    const quadGroups = [];
    const extraQuadCount = (params.background ? 1 : 0) + (params.tether ? 1 : 0);
    let quadOffset = 0;

    for (const label of labels) {
        const { text, groups } = chainLabelText(label, groupMeta);
        if (!text) continue;

        const [x, y, z] = label.position;
        const scale = label.scale ?? params.chainScale ?? DefaultChainLabelScale;
        const baseGroup = groups[0] ?? 0;

        textBuilder.add(text, x, y, z, label.depth, scale, baseGroup);

        for (let i = 0; i < extraQuadCount; i++) {
            quadGroups[quadOffset + i] = baseGroup;
        }
        for (let i = 0; i < groups.length; i++) {
            quadGroups[quadOffset + extraQuadCount + i] = groups[i];
        }
        quadOffset += extraQuadCount + text.length;
    }

    const text = textBuilder.getText();
    applyTextGroups(text, quadGroups);
    return text;
}

function labelTextLength(label) {
    return String(label.queryChain).length + String(label.targetChain).length + 1;
}

function chainLabelRuns(label) {
    return [
        { text: `${label.queryChain}`, color: QueryChainLabelColor },
        { text: '-', color: SeparatorChainLabelColor },
        { text: `${label.targetChain}`, color: TargetChainLabelColor },
    ];
}

function chainLabelText(label, groupMeta) {
    const text = [];
    const groups = [];
    for (const run of chainLabelRuns(label)) {
        const group = groupMeta.length;
        groupMeta.push({ color: run.color, tooltip: label.tooltip });
        text.push(run.text);
        for (let i = 0; i < run.text.length; i++) {
            groups.push(group);
        }
    }
    return { text: text.join(''), groups };
}

function applyTextGroups(text, quadGroups) {
    const groups = text.groupBuffer.ref.value;
    const quadCount = Math.min(quadGroups.length, text.charCount);

    for (let quad = 0; quad < quadCount; quad++) {
        const group = quadGroups[quad];
        if (group === undefined) continue;

        const offset = quad * 4;
        groups[offset] = group;
        groups[offset + 1] = group;
        groups[offset + 2] = group;
        groups[offset + 3] = group;
    }

    ValueCell.update(text.groupBuffer, groups);
}

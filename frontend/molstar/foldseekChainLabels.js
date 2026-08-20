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
import { structureResidueKeys } from './molstarStructure.js';

// Multimer cartoons use one color per structure. Interface results instead
// use the paired-chain palette from the interface viewer.
const MultimerQueryChainLabelColor = Color(0x1e88e5);
const MultimerTargetChainLabelColor = Color(0xffc107);
const InterfaceQueryChainLabelColors = [Color(0x90caf9), Color(0xffb74d)];
const InterfaceTargetChainLabelColors = [Color(0x0d47a1), Color(0xe65100)];
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
    const enabled = (input?.structureMode === 'multimer' || input?.structureMode === 'interface')
        && input?.showChainLabels !== false
        && labels.length > 0;

    if (!enabled) {
        await deleteChainLabels(plugin, state);
        return;
    }

    const isInterface = input?.structureMode === 'interface';
    const chainScale = input?.chainLabelScale ?? input?.chainLabelSize ?? (isInterface ? 3.5 : DefaultChainLabelScale);
    const key = chainLabelKey(labels, chainScale, isInterface);
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
            tether: isInterface,
            tetherLength: 1.2,
            tetherBaseWidth: 0.12,
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

    const queryAnchors = chainAnchorsForVisibleMode(state, input, 'query');
    const targetAnchors = chainAnchorsForVisibleMode(state, input, 'target');
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
            queryLabel: input?.structureMode === 'interface' ? `Q:${query.chain || queryChain}` : query.chain || queryChain,
            targetLabel: input?.structureMode === 'interface' ? `T:${target.chain || targetChain}` : target.chain || targetChain,
            query,
            target,
        });
    }

    const sceneCenter = labelSceneCenter(pairs);
    return pairs.map((pair, index) => chainLabelEntry(pair, sceneCenter, input, index, pairs.length));
}

function chainAnchorsForVisibleMode(state, input, side) {
    // Interface labels identify the colored interface pair. Keep them tied to
    // that pair even when a toggle reveals the faint full-chain context.
    if (input?.structureMode === 'interface') return interfaceChainAnchors(state, side);

    // Keep multimer labels attached to the matched chain region in every
    // visibility mode. In particular, mode 1 can reveal a long unaligned
    // target tail: its full-chain bounding sphere would otherwise push the
    // paired label far away from the highlighted query surface.
    if (input?.structureMode === 'multimer') {
        const aligned = alignedChainAnchors(state, side);
        if (aligned.list.length > 0) return aligned;
    }
    return structureChainAnchors(state[side]?.structure);
}

function alignedChainAnchors(state, side) {
    const residuesByChain = new Map();
    const seen = new Set();
    for (const map of state.alignmentMaps?.[side] || []) {
        for (const residue of map.toStructure.values()) {
            const key = `${map.chain}:${structureResidueKeys(residue).join('|')}`;
            if (!key || seen.has(key)) continue;
            seen.add(key);
            if (!residuesByChain.has(map.chain)) residuesByChain.set(map.chain, []);
            residuesByChain.get(map.chain).push(residue);
        }
    }
    return anchorsFromResidues(residuesByChain);
}

function interfaceChainAnchors(state, side) {
    const residuesByChain = new Map();
    const seen = new Set();
    for (const map of state.alignmentMaps?.[side] || []) {
        const interfaceKeys = state.interfaceSelections?.[side]?.get(map.chain)?.keys;
        if (!interfaceKeys?.size) continue;
        for (const residue of map.toStructure.values()) {
            if (!structureResidueKeys(residue, map.chain).some(key => interfaceKeys.has(key))) continue;
            const key = `${map.chain}:${structureResidueKeys(residue).join('|')}`;
            if (seen.has(key)) continue;
            seen.add(key);
            if (!residuesByChain.has(map.chain)) residuesByChain.set(map.chain, []);
            residuesByChain.get(map.chain).push(residue);
        }
    }

    return anchorsFromResidues(residuesByChain);
}

function anchorsFromResidues(residuesByChain) {
    const byChain = new Map();
    const list = [];
    for (const [chain, residues] of residuesByChain) {
        if (residues.length === 0) continue;
        const center = Vec3();
        for (const residue of residues) Vec3.add(center, center, [residue.x, residue.y, residue.z]);
        Vec3.scale(center, center, 1 / residues.length);
        const radius = residues.reduce((max, residue) => Math.max(
            max,
            Vec3.distance(center, [residue.x, residue.y, residue.z]),
        ), 1);
        const anchor = {
            chain,
            center,
            radius,
            // Keep the actual displayed residue positions. A bounding sphere
            // is adequate for camera fitting but not for label placement on
            // elongated chains.
            points: residues.map(residue => Vec3.create(residue.x, residue.y, residue.z)),
        };
        byChain.set(chain, anchor);
        list.push(anchor);
    }
    return { byChain, list };
}

function structureChainAnchors(structureRef) {
    const structure = structureRef?.cell?.obj?.data || structureRef;
    if (!structure?.units?.length) return { byChain: new Map(), list: [] };

    const residuesByChain = new Map();
    const aliases = new Map();
    const seen = new Set();
    const loc = StructureElement.Location.create(structure);

    for (const unit of structure.units) {
        if (OrderedSet.size(unit.elements) === 0) continue;
        for (const element of unit.elements) {
            loc.unit = unit;
            loc.element = element;

            const auth = StructureProperties.chain.auth_asym_id(loc) || '';
            const label = StructureProperties.chain.label_asym_id(loc) || '';
            const chain = auth || label;
            if (!chain) continue;

            const residueKey = `${unit.id}|${chain}|${StructureProperties.residue.auth_seq_id(loc)}|${StructureProperties.residue.label_seq_id(loc)}|${StructureProperties.residue.pdbx_PDB_ins_code(loc) || ''}`;
            if (seen.has(residueKey)) continue;
            seen.add(residueKey);

            const point = Vec3.transformMat4(Vec3(), [
                StructureProperties.atom.x(loc),
                StructureProperties.atom.y(loc),
                StructureProperties.atom.z(loc),
            ], unit.conformation.operator.matrix);
            if (!residuesByChain.has(chain)) residuesByChain.set(chain, []);
            residuesByChain.get(chain).push({ x: point[0], y: point[1], z: point[2] });
            if (!aliases.has(chain)) aliases.set(chain, new Set());
            if (auth) aliases.get(chain).add(auth);
            if (label) aliases.get(chain).add(label);
        }
    }

    const anchors = anchorsFromResidues(residuesByChain);
    for (const [chain, names] of aliases) {
        const anchor = anchors.byChain.get(chain);
        if (!anchor) continue;
        for (const name of names) {
            if (!anchors.byChain.has(name)) anchors.byChain.set(name, anchor);
        }
    }
    return anchors;
}

function chainLabelEntry({ queryChain, targetChain, queryLabel, targetLabel, query, target }, sceneCenter, input, index, total) {
    const pairCenter = Vec3.scale(Vec3(), Vec3.add(Vec3(), query.center, target.center), 0.5);
    const pairRadius = Math.max(query.radius, target.radius, Vec3.distance(pairCenter, query.center), Vec3.distance(pairCenter, target.center));
    const outward = outerLabelDirection(pairCenter, sceneCenter, query.center, target.center);
    const isInterface = input?.structureMode === 'interface';
    // Interface patches can be far apart. Their separation is not part of a
    // label's visible extent, even when faint context is shown.
    const visibleRadius = isInterface ? Math.max(query.radius, target.radius) : pairRadius;
    const points = [...(query.points || []), ...(target.points || [])];
    const outwardExtent = points.length > 0
        ? Math.max(0, ...points.map(point => Vec3.dot(Vec3.sub(Vec3(), point, pairCenter), outward)))
        : visibleRadius;
    const clearance = Math.max(3, visibleRadius * Math.max(0.1, (input?.chainLabelOffset ?? 1.25) - 1));
    const offset = outwardExtent + clearance;
    const position = Vec3.scaleAndAdd(Vec3(), pairCenter, outward, offset);
    spreadLabelPosition(position, outward, visibleRadius, index, total);

    return {
        queryChain,
        targetChain,
        queryLabel,
        targetLabel,
        queryColor: isInterface
            ? InterfaceQueryChainLabelColors[index % InterfaceQueryChainLabelColors.length]
            : MultimerQueryChainLabelColor,
        targetColor: isInterface
            ? InterfaceTargetChainLabelColors[index % InterfaceTargetChainLabelColors.length]
            : MultimerTargetChainLabelColor,
        position,
        depth: visibleRadius,
        tooltip: `Query chain ${queryChain} / Target chain ${targetChain}`,
    };
}

function spreadLabelPosition(position, outward, radius, index, total) {
    if (total < 2) return;
    const axis = Math.abs(outward[1]) < 0.9 ? Vec3.create(0, 1, 0) : Vec3.create(1, 0, 0);
    const lateral = Vec3.cross(Vec3(), outward, axis);
    if (Vec3.magnitude(lateral) < 0.001) return;
    Vec3.normalize(lateral, lateral);
    const lane = index - (total - 1) / 2;
    Vec3.scaleAndAdd(position, position, lateral, lane * Math.max(radius, 1) * 0.75);
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

function chainLabelKey(labels, chainScale, tether) {
    return [
        chainScale,
        tether ? 1 : 0,
        labels.map(label => [
            label.queryChain,
            label.targetChain,
            label.queryLabel || '',
            label.targetLabel || '',
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
    return String(label.queryLabel || label.queryChain).length + String(label.targetLabel || label.targetChain).length + 1;
}

function chainLabelRuns(label) {
    return [
        { text: `${label.queryLabel || label.queryChain}`, color: label.queryColor || MultimerQueryChainLabelColor },
        { text: '-', color: SeparatorChainLabelColor },
        { text: `${label.targetLabel || label.targetChain}`, color: label.targetColor || MultimerTargetChainLabelColor },
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

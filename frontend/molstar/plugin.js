import { PluginContext } from 'molstar/lib/mol-plugin/context';
import { PluginConfig } from 'molstar/lib/mol-plugin/config';
import { PluginSpec } from 'molstar/lib/mol-plugin/spec';
import { PluginBehaviors } from 'molstar/lib/mol-plugin/behavior';
import { SsaoParams } from 'molstar/lib/mol-canvas3d/passes/ssao';
import { Color } from 'molstar/lib/mol-util/color';
import { ParamDefinition as PD } from 'molstar/lib/mol-util/param-definition';

export const DEFAULT_SPIN_SPEED = 0.05;

const DefaultSsaoParams = PD.getDefaultValues(SsaoParams);

export async function createStructurePlugin(canvas, viewport, options = {}) {
    const plugin = createMolstarPlugin();
    await plugin.init();

    const ok = await plugin.initViewerAsync(canvas, viewport);
    if (ok === false) {
        throw new Error('Mol* viewer initialization failed');
    }

    applyViewerCanvasProps(plugin, options);
    return plugin;
}

export function createMolstarPlugin() {
    return new PluginContext({
        actions: [],
        behaviors: [
            PluginSpec.Behavior(PluginBehaviors.Representation.HighlightLoci),
            PluginSpec.Behavior(PluginBehaviors.Representation.SelectLoci),
            PluginSpec.Behavior(PluginBehaviors.Camera.FocusLoci),
            PluginSpec.Behavior(PluginBehaviors.Camera.CameraControls),
            PluginSpec.Behavior(PluginBehaviors.CustomProps.SecondaryStructure),
            PluginSpec.Behavior(PluginBehaviors.CustomProps.ValenceModel),
        ],
        animations: [],
        config: [
            [PluginConfig.General.Transparency, 'blended'],
        ],
    });
}

export function parseColor(value, fallback = 0xffffff) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return Color(value);
    }
    if (typeof value === 'string') {
        const hex = value.trim().replace(/^#/, '');
        const parsed = Number.parseInt(hex, 16);
        if (Number.isFinite(parsed)) {
            return Color(parsed);
        }
    }
    return Color(fallback);
}

export function applyViewerCanvasProps(plugin, options = {}) {
    const canvas3d = plugin?.canvas3d;
    if (!canvas3d) return;

    canvas3d.setProps({
        transparentBackground: true,
        sceneRadiusFactor: 3.0,
        cameraFog: { name: 'off', params: {} },
        renderer: {
            ...canvas3d.props.renderer,
            ...(options.renderer || {}),
        },
        marking: options.marking
            ? {
                ...canvas3d.props.marking,
                ...options.marking,
            }
            : canvas3d.props.marking,
        camera: {
            helper: { axes: { name: 'off', params: {} } },
            fov: 60,
        },
        cameraClipping: {
            radius: 100,
            far: false,
            minNear: 0.1,
        },
        postprocessing: {
            enabled: true,
            occlusion: options.occlusion || { name: 'on', params: DefaultSsaoParams },
            shadow: { name: 'off', params: {} },
            outline: options.outline || {
                name: 'on',
                params: {
                    scale: 0.5,
                    threshold: 0.1,
                    color: Color(0x111111),
                    includeTransparent: true,
                },
            },
            dof: { name: 'off', params: {} },
            bloom: {
                name: 'on',
                params: {
                    strength: 1,
                    radius: 0,
                    threshold: 0,
                    mode: 'emissive',
                },
            },
            antialiasing: {
                name: 'smaa',
                params: {
                    edgeThreshold: 0.1,
                    maxSearchSteps: 16,
                },
            },
        },
    });
}

export function setCanvasSpin(plugin, enabled) {
    if (!plugin?.canvas3d) return;
    const trackball = plugin.canvas3d.props.trackball;
    plugin.canvas3d.setProps({
        trackball: {
            ...trackball,
            animate: enabled
                ? { name: 'spin', params: { speed: DEFAULT_SPIN_SPEED, axis: [0, 1, 0] } }
                : { name: 'off', params: {} },
        },
    });
}

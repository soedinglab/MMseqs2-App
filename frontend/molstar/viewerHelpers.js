import { PluginContext } from 'molstar/lib/mol-plugin/context';
import { PluginConfig } from 'molstar/lib/mol-plugin/config';
import { Color } from 'molstar/lib/mol-util/color';

export const DEFAULT_SPIN_SPEED = 0.05;

export function createMolstarPlugin() {
    return new PluginContext({
        actions: [],
        behaviors: [],
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
            occlusion: { name: 'off', params: {} },
            shadow: { name: 'off', params: {} },
            outline: {
                name: 'on',
                params: {
                    scale: 0.5,
                    threshold: 0.1,
                    color: Color(0x111111),
                    includeTransparent: true,
                },
            },
            dof: { name: 'off', params: {} },
            bloom: { name: 'off', params: {} },
            antialiasing: { name: 'off', params: {} },
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

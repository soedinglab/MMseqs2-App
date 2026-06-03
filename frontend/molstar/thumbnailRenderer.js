import { captureViewportPng, drawStableFrame } from './screenshot.js';

export async function renderThumbnailScene(plugin, scene, sceneState, input) {
    await scene.update(plugin, sceneState, input);
    resetThumbnailCamera(plugin);
    await drawStableFrame(plugin);
}

export async function captureThumbnailPng(plugin, width, height) {
    return captureViewportPng(plugin, (screenshot, previousValues) => {
        screenshot.behaviors.values.next({
            ...previousValues,
            transparent: true,
            format: { name: 'png', params: {} },
            resolution: {
                name: 'custom',
                params: {
                    width: width * 2,
                    height: height * 2,
                },
            },
            axes: { name: 'off', params: {} },
        });
        screenshot.behaviors.cropParams.next({
            auto: false,
            relativePadding: 0,
        });
        screenshot.resetCrop();
    }, 'Generate Thumbnail');
}

export function resetThumbnailCamera(plugin) {
    plugin?.canvas3d?.requestCameraReset({ durationMs: 0 });
    plugin?.canvas3d?.commit(true);
}

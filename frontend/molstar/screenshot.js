import { Task } from 'molstar/lib/mol-task';
import { canvasToBlob } from 'molstar/lib/mol-canvas3d/util';

export async function drawStableFrame(plugin) {
    plugin?.canvas3d?.commit(true);
    await new Promise(resolve => requestAnimationFrame(resolve));
    plugin?.canvas3d?.commit(true);
    await new Promise(resolve => requestAnimationFrame(resolve));
}

export async function captureViewportPng(plugin, configure, taskName = 'Generate Image') {
    const screenshot = plugin?.helpers?.viewportScreenshot;
    if (!screenshot) return null;

    await drawStableFrame(plugin);

    const previousValues = screenshot.values;
    const previousCropParams = screenshot.cropParams;
    configure(screenshot, previousValues, previousCropParams);

    try {
        return await plugin.runTask(Task.create(taskName, async (ctx) => {
            await screenshot.draw(ctx);
            return canvasToBlob(screenshot.canvas, 'image/png');
        }));
    } finally {
        screenshot.behaviors.values.next(previousValues);
        screenshot.behaviors.cropParams.next(previousCropParams);
        screenshot.resetCrop();
    }
}

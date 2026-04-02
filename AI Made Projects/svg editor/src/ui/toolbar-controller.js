import { getCanvasMetrics } from '../state/document-selectors.js';

export function createToolbarController({ refs, commands }) {
    refs.shapeToolbar.addEventListener('click', (event) => {
        const trigger = event.target instanceof HTMLElement ? event.target.closest('[data-shape]') : null;
        if (!trigger) {
            return;
        }

        commands.addShape(trigger.dataset.shape);
    });

    refs.deleteButton.addEventListener('click', () => commands.deleteSelection());
    refs.duplicateButton.addEventListener('click', () => commands.duplicateSelection());
    refs.clearButton.addEventListener('click', () => commands.clearDocument());

    refs.importInput.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        try {
            commands.importSvgText(await file.text());
        } catch (error) {
            window.alert(error instanceof Error ? error.message : 'Unable to import SVG.');
        } finally {
            refs.importInput.value = '';
        }
    });

    refs.exportButton.addEventListener('click', () => commands.exportDocument());

    refs.canvasWidth.addEventListener('input', () => {
        const height = Number(refs.canvasHeight.value) || 1;
        const width = Number(refs.canvasWidth.value) || 1;
        commands.resizeCanvas(Math.max(1, width), Math.max(1, height));
    });

    refs.canvasHeight.addEventListener('input', () => {
        const width = Number(refs.canvasWidth.value) || 1;
        const height = Number(refs.canvasHeight.value) || 1;
        commands.resizeCanvas(Math.max(1, width), Math.max(1, height));
    });

    return {
        render(state) {
            const { width, height } = getCanvasMetrics(state.svgRoot);
            refs.canvasWidth.value = String(width);
            refs.canvasHeight.value = String(height);
        }
    };
}

import { getSelectedElementSnapshot } from '../state/document-selectors.js';

export function createEditorStatus({ refs, store }) {
    let baseMessage = 'No selection';
    let hoverMessage = null;

    function renderMessage() {
        refs.summary.textContent = hoverMessage ?? baseMessage;
    }

    function setMessage(message) {
        baseMessage = message;
        renderMessage();
    }

    function syncSelectionSummary(state = store.getState()) {
        const selected = getSelectedElementSnapshot(state);
        if (!selected) {
            setMessage('No selection');
            return;
        }

        setMessage(`${selected.tagName.toLowerCase()} selected`);
    }

    function showCanvasCoordinates(point) {
        hoverMessage = `x: ${Math.round(point.x)}, y: ${Math.round(point.y)}`;
        renderMessage();
    }

    function clearCanvasCoordinates() {
        hoverMessage = null;
        renderMessage();
    }

    return {
        clearCanvasCoordinates,
        setMessage,
        showCanvasCoordinates,
        syncSelectionSummary
    };
}

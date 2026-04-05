import { getSelectedElementSnapshot, getSelectedIds } from '../state/document-selectors.js';

export function createEditorStatus({ refs, store }) {
    let baseMessage = 'No selection';
    let hoverMessage = null;
    let actionMessage = null;
    let lastActionId = null;
    let clearActionTimer = null;

    function renderMessage() {
        refs.summary.textContent = actionMessage ?? hoverMessage ?? baseMessage;
    }

    function setMessage(message) {
        baseMessage = message;
        renderMessage();
    }

    function showAction(action) {
        if (!action || action.id === lastActionId) {
            return;
        }

        lastActionId = action.id;
        actionMessage = [action.name, ...action.args].join(' ');
        if (clearActionTimer !== null) {
            window.clearTimeout(clearActionTimer);
        }

        clearActionTimer = window.setTimeout(() => {
            clearActionTimer = null;
            actionMessage = null;
            renderMessage();
        }, 1200);
        renderMessage();
    }

    function syncSelectionSummary(state = store.getState()) {
        const selectedIds = getSelectedIds(state);
        if (selectedIds.length > 1) {
            baseMessage = `${selectedIds.length} elements selected`;
            showAction(state.lastAction);
            renderMessage();
            return;
        }

        const selected = getSelectedElementSnapshot(state);
        if (!selected) {
            baseMessage = 'No selection';
            showAction(state.lastAction);
            renderMessage();
            return;
        }

        baseMessage = `${selected.tagName.toLowerCase()} selected`;
        showAction(state.lastAction);
        renderMessage();
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

import { findElementByEditorId, getCanvasMetrics, getElementAttributes, isSelectableElement, resolveSelectableElement } from '../svg/document-dom.js';
import { getElementSourceMarker } from '../svg/serializer.js';

export { findElementByEditorId, getCanvasMetrics, getElementAttributes, isSelectableElement, resolveSelectableElement };

export function getSelectedElementSnapshot(state) {
    return findElementByEditorId(state.svgRoot, state.selectedId);
}

export function getSelectedElementSnapshots(state) {
    const selectedIds = Array.isArray(state.selectedIds) ? state.selectedIds : [];
    return selectedIds
        .map((editorId) => findElementByEditorId(state.svgRoot, editorId))
        .filter(Boolean);
}

export function getSelectionKey(state) {
    return getSelectedIds(state).join('|');
}

export function getSelectedIds(state) {
    return Array.isArray(state.selectedIds) ? state.selectedIds.filter(Boolean) : [];
}

export function getSelectedElementSourceMarker(state) {
    const selected = getSelectedElementSnapshot(state);
    if (!selected) {
        return null;
    }

    return getElementSourceMarker(selected);
}

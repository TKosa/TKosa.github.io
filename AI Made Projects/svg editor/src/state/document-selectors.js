import { findElementByEditorId, getCanvasMetrics, getElementAttributes, isSelectableElement, resolveSelectableElement } from '../svg/document-dom.js';
import { getElementSourceMarker } from '../svg/serializer.js';

export { findElementByEditorId, getCanvasMetrics, getElementAttributes, isSelectableElement, resolveSelectableElement };

export function getSelectedElementSnapshot(state) {
    return findElementByEditorId(state.svgRoot, state.selectedId);
}

export function getSelectedElementSourceMarker(state) {
    const selected = getSelectedElementSnapshot(state);
    if (!selected) {
        return null;
    }

    return getElementSourceMarker(selected);
}

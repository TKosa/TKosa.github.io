import { getSelectedElementSnapshot } from '../state/document-selectors.js';

export function createEditorStatus({ refs, store }) {
    function setMessage(message) {
        refs.summary.textContent = message;
    }

    function syncSelectionSummary(state = store.getState()) {
        const selected = getSelectedElementSnapshot(state);
        if (!selected) {
            setMessage('No selection');
            return;
        }

        setMessage(`${selected.tagName.toLowerCase()} selected`);
    }

    return {
        setMessage,
        syncSelectionSummary
    };
}

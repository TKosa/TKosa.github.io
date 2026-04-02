import { getSelectedElementSnapshot } from '../state/document-selectors.js';
import { clearSourceSelection, captureSelectionScroll, getChangedFields, highlightChangedFields, revealElementBlock, summarizeElement } from './source-selection.js';
import { syncSourceValue } from './source-sync.js';

const SOURCE_DEBOUNCE_MS = 350;
const SELECTION_REVEAL_MS = 250;
export function createSourceController({ store, refs, commands, status }) {
    let pushTimer = null;
    let pullTimer = null;
    let revealTimer = null;
    let sourceDirty = false;
    let lastSelectedId = null;
    let lastSelectedSummary = null;

    refs.sourceInput.addEventListener('input', () => {
        sourceDirty = true;
        clearTimeout(pullTimer);
        pullTimer = window.setTimeout(() => {
            try {
                commands.updateSourceDocument(refs.sourceInput.value);
                sourceDirty = false;
            } catch (error) {
                void error;
            }
        }, SOURCE_DEBOUNCE_MS);
    });

    refs.sourceInput.addEventListener('select', () => {
        captureSelectionScroll(refs.sourceInput);
        status?.syncSelectionSummary?.();
    });

    return {
        render(state) {
            if (sourceDirty) {
                return;
            }

            const nextSource = store.serialize();
            const selected = getSelectedElementSnapshot(state);
            const currentSummary = summarizeElement(selected);
            const selectionChanged = state.selectedId !== lastSelectedId;
            if (selectionChanged) {
                clearTimeout(pushTimer);
                syncSourceValue(refs.sourceInput, nextSource);
                clearTimeout(revealTimer);
                if (selected) {
                    revealTimer = window.setTimeout(() => {
                        if (!revealElementBlock(refs.sourceInput, selected)) {
                            clearSourceSelection(refs.sourceInput);
                        }
                    }, SELECTION_REVEAL_MS);
                } else {
                    clearSourceSelection(refs.sourceInput);
                }
                lastSelectedId = state.selectedId;
                lastSelectedSummary = currentSummary;
                return;
            }

            clearTimeout(pushTimer);
            pushTimer = window.setTimeout(() => {
                const didUpdateSource = syncSourceValue(refs.sourceInput, nextSource);

                if (selected) {
                    const changedFields = getChangedFields(lastSelectedSummary, currentSummary, true);
                    if (didUpdateSource && changedFields.length > 0) {
                        if (!highlightChangedFields(refs.sourceInput, selected, changedFields)) {
                            clearSourceSelection(refs.sourceInput);
                        }
                    } else {
                        clearSourceSelection(refs.sourceInput);
                    }
                } else {
                    clearSourceSelection(refs.sourceInput);
                }

                lastSelectedId = state.selectedId;
                lastSelectedSummary = currentSummary;
            }, SOURCE_DEBOUNCE_MS);
        }
    };
}

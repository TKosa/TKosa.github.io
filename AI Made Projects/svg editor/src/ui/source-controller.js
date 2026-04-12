import { getSelectedElementSnapshot, getSelectedIds, getSelectionKey } from '../state/document-selectors.js';
import { clearSourceSelection, getChangedFields, highlightChangedFields, renderSourceViewer, revealElementBlock, summarizeElement } from './source-selection.js';

const SOURCE_UPDATE_DEBOUNCE_MS = 350;
const SELECTION_REVEAL_MS = 250;
const MODE_SCROLL_SYNC_MS = 60;

export function createSourceController({ store, refs, commands }) {
    let pushTimer = null;
    let revealTimer = null;
    let modeSyncTimer = null;
    let isEditingSource = false;
    let lastSelectionKey = '';
    let lastSelectedSummary = null;
    let lastRenderedSource = '';

    const renderPlainSource = (source) => {
        renderSourceViewer(refs.sourceViewer, source);
        lastRenderedSource = source;
    };

    const clearSelection = () => {
        if (typeof store.setSelection === 'function') {
            store.setSelection([]);
            return;
        }

        store.selectElement?.(null);
    };

    const clearCanvasSelection = () => {
        if (getSelectedIds(store.getState()).length > 0) {
            clearSelection();
        }
    };

    const syncModeUi = () => {
        refs.sourceViewer.hidden = isEditingSource;
        refs.sourceInput.hidden = !isEditingSource;
        refs.sourceModeToggle.textContent = isEditingSource ? 'Apply Source' : 'Edit Source';
    };

    const getScrollState = (element) => ({
        top: element.scrollTop,
        left: element.scrollLeft
    });

    const applyScrollState = (element, scrollState) => {
        element.scrollTop = scrollState.top;
        element.scrollLeft = scrollState.left;
    };

    const scheduleModeScrollSync = (element, scrollState) => {
        clearTimeout(modeSyncTimer);
        modeSyncTimer = window.setTimeout(() => {
            applyScrollState(element, scrollState);
        }, MODE_SCROLL_SYNC_MS);
    };

    const enterEditMode = () => {
        clearTimeout(pushTimer);
        clearTimeout(revealTimer);
        const viewerScrollState = getScrollState(refs.sourceViewer);
        isEditingSource = true;
        refs.sourceInput.value = store.serialize();
        syncModeUi();
        scheduleModeScrollSync(refs.sourceInput, viewerScrollState);
        refs.sourceInput.focus({ preventScroll: true });
    };

    const exitEditMode = () => {
        const inputScrollState = getScrollState(refs.sourceInput);
        const selectedIds = getSelectedIds(store.getState());
        isEditingSource = false;
        syncModeUi();

        try {
            commands.updateSourceDocument(refs.sourceInput.value);
            if (selectedIds.length !== 1) {
                scheduleModeScrollSync(refs.sourceViewer, inputScrollState);
            }
        } catch (error) {
            isEditingSource = true;
            syncModeUi();
            window.alert(error instanceof Error ? error.message : 'Unable to apply SVG source.');
            scheduleModeScrollSync(refs.sourceInput, inputScrollState);
            refs.sourceInput.focus({ preventScroll: true });
        }
    };

    refs.sourceModeToggle.addEventListener('click', () => {
        if (isEditingSource) {
            exitEditMode();
            return;
        }

        enterEditMode();
    });

    refs.sourceViewer.addEventListener('pointerdown', clearCanvasSelection);
    refs.sourceInput.addEventListener('pointerdown', clearCanvasSelection);
    refs.sourceInput.addEventListener('focus', clearCanvasSelection);
    refs.sourceInput.addEventListener('select', clearCanvasSelection);

    syncModeUi();

    return {
        render(state) {
            if (isEditingSource) {
                return;
            }

            const nextSource = store.serialize();
            const sourceChanged = nextSource !== lastRenderedSource;
            const selectedIds = getSelectedIds(state);
            const selected = getSelectedElementSnapshot(state);
            const currentSummary = summarizeElement(selected);
            const selectionKey = getSelectionKey(state);
            const selectionChanged = selectionKey !== lastSelectionKey;

            if (selectionChanged) {
                clearTimeout(pushTimer);
                renderPlainSource(nextSource);
                clearTimeout(revealTimer);
                if (selectedIds.length === 1 && selected) {
                    revealTimer = window.setTimeout(() => {
                        if (!revealElementBlock(refs.sourceViewer, nextSource, selected)) {
                            clearSourceSelection(refs.sourceViewer, nextSource);
                        }
                    }, SELECTION_REVEAL_MS);
                } else {
                    clearSourceSelection(refs.sourceViewer, nextSource);
                }

                lastSelectionKey = selectionKey;
                lastSelectedSummary = currentSummary;
                return;
            }

            clearTimeout(pushTimer);
            pushTimer = window.setTimeout(() => {
                if (selectedIds.length === 1 && selected) {
                    const changedFields = getChangedFields(lastSelectedSummary, currentSummary, true);
                    if (sourceChanged && changedFields.length > 0) {
                        if (!highlightChangedFields(refs.sourceViewer, nextSource, selected, changedFields)) {
                            renderPlainSource(nextSource);
                        } else {
                            lastRenderedSource = nextSource;
                        }
                    } else if (sourceChanged) {
                        if (!revealElementBlock(refs.sourceViewer, nextSource, selected)) {
                            renderPlainSource(nextSource);
                        } else {
                            lastRenderedSource = nextSource;
                        }
                    }
                } else {
                    renderPlainSource(nextSource);
                }

                lastSelectionKey = selectionKey;
                lastSelectedSummary = currentSummary;
            }, SOURCE_UPDATE_DEBOUNCE_MS);
        }
    };
}

export function registerKeyboardShortcuts(commands, refs, store) {
    window.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();
        const isModifierShortcut = event.ctrlKey || event.metaKey;
        const sourceHasFocus = document.activeElement === refs.sourceInput;

        if (sourceHasFocus && isModifierShortcut && isSourceOwnedShortcut(key)) {
            return;
        }

        if (event.key === 'Delete') {
            if (shouldIgnoreShortcut(event.target, refs.sourceInput, refs.sourceViewer)) {
                return;
            }

            event.preventDefault();
            commands.deleteSelection();
            return;
        }

        if (!isModifierShortcut) {
            return;
        }

        if (isHistoryShortcut(key)) {
            if (hasPendingSourceChanges(refs.sourceInput, store)) {
                return;
            }

            event.preventDefault();
            if (key === 'y' || event.shiftKey) {
                commands.redo();
            } else {
                commands.undo();
            }
            return;
        }

        if (shouldIgnoreShortcut(event.target, refs.sourceInput, refs.sourceViewer)) {
            return;
        }

        if (key === 'c') {
            event.preventDefault();
            commands.copySelection();
            return;
        }

        if (key === 'v') {
            event.preventDefault();
            commands.pasteSelection();
        }
    });
}

function isHistoryShortcut(key) {
    return key === 'y' || key === 'z';
}

function isSourceOwnedShortcut(key) {
    return key === 'z' || key === 'x' || key === 'c' || key === 'v';
}

function shouldIgnoreShortcut(target, sourceInput, sourceViewer) {
    return target instanceof HTMLInputElement
        || (target instanceof HTMLTextAreaElement && target !== sourceInput)
        || (target instanceof HTMLElement && target.isContentEditable)
        || isSourceViewerSelectionActive(target, sourceViewer);
}

function hasPendingSourceChanges(sourceInput, store) {
    return !sourceInput.hidden && sourceInput.value !== store.serialize();
}

function refsSourceViewerContainsTarget(target, sourceViewer) {
    return sourceViewer instanceof HTMLElement && sourceViewer.contains(target);
}

function isSourceViewerSelectionActive(target, sourceViewer) {
    if (refsSourceViewerContainsTarget(target, sourceViewer)) {
        return true;
    }

    if (!(sourceViewer instanceof HTMLElement)) {
        return false;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
        return false;
    }

    const range = selection.getRangeAt(0);
    const startNode = range.startContainer;
    const endNode = range.endContainer;
    return sourceViewer.contains(startNode) || sourceViewer.contains(endNode);
}

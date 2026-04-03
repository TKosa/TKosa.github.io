export function registerKeyboardShortcuts(commands, refs, store) {
    window.addEventListener('keydown', (event) => {
        if (event.key === 'Delete') {
            if (shouldIgnoreShortcut(event.target, refs.sourceInput)) {
                return;
            }

            event.preventDefault();
            commands.deleteSelection();
            return;
        }

        if (!(event.ctrlKey || event.metaKey)) {
            return;
        }

        const key = event.key.toLowerCase();
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

        if (shouldIgnoreShortcut(event.target, refs.sourceInput)) {
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

function shouldIgnoreShortcut(target, sourceInput) {
    return target instanceof HTMLInputElement
        || (target instanceof HTMLTextAreaElement && target !== sourceInput)
        || (target instanceof HTMLElement && target.isContentEditable);
}

function hasPendingSourceChanges(sourceInput, store) {
    return sourceInput.value !== store.serialize();
}

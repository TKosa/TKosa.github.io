export function registerKeyboardShortcuts(commands, refs) {
    window.addEventListener('keydown', (event) => {
        if (shouldIgnoreShortcut(event.target, refs.sourceInput)) {
            return;
        }

        if (event.key === 'Delete') {
            event.preventDefault();
            commands.deleteSelection();
            return;
        }

        if (!(event.ctrlKey || event.metaKey)) {
            return;
        }

        const key = event.key.toLowerCase();
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

function shouldIgnoreShortcut(target, sourceInput) {
    return target instanceof HTMLInputElement
        || (target instanceof HTMLTextAreaElement && target !== sourceInput)
        || (target instanceof HTMLElement && target.isContentEditable);
}

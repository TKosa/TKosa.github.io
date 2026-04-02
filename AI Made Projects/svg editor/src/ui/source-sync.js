export function syncSourceValue(textarea, nextSource) {
    const didUpdateSource = textarea.value !== nextSource;
    if (!didUpdateSource) {
        return false;
    }

    const active = document.activeElement === textarea;
    const previousScrollTop = textarea.scrollTop;
    const previousScrollLeft = textarea.scrollLeft;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const selectionDirection = textarea.selectionDirection;

    textarea.value = nextSource;
    textarea.scrollTop = previousScrollTop;
    textarea.scrollLeft = previousScrollLeft;

    if (active) {
        textarea.setSelectionRange(selectionStart, selectionEnd, selectionDirection ?? 'none');
    }

    return true;
}

export function getScrollTopForSelectionEnd(textarea, index) {
    const mirror = document.createElement('div');
    const style = getComputedStyle(textarea);

    mirror.style.position = 'absolute';
    mirror.style.visibility = 'hidden';
    mirror.style.pointerEvents = 'none';
    mirror.style.zIndex = '-1';
    mirror.style.whiteSpace = 'pre-wrap';
    mirror.style.overflowWrap = 'break-word';
    mirror.style.wordBreak = 'break-word';
    mirror.style.boxSizing = 'border-box';
    mirror.style.left = '0';
    mirror.style.top = '0';
    mirror.style.width = `${textarea.clientWidth}px`;
    mirror.style.font = style.font;
    mirror.style.fontFamily = style.fontFamily;
    mirror.style.fontSize = style.fontSize;
    mirror.style.fontWeight = style.fontWeight;
    mirror.style.fontStyle = style.fontStyle;
    mirror.style.lineHeight = style.lineHeight;
    mirror.style.letterSpacing = style.letterSpacing;
    mirror.style.textTransform = style.textTransform;
    mirror.style.textIndent = style.textIndent;
    mirror.style.padding = style.padding;
    mirror.style.border = style.border;

    const before = document.createTextNode(textarea.value.slice(0, index));
    const marker = document.createElement('span');
    marker.textContent = '\u200b';
    const after = document.createTextNode(textarea.value.slice(index) || ' ');

    mirror.append(before, marker, after);
    document.body.appendChild(mirror);

    const mirrorRect = mirror.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const offsetTop = markerRect.top - mirrorRect.top - paddingTop;

    mirror.remove();

    return Math.max(0, Math.round(offsetTop));
}

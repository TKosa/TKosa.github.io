import { getElementSourceMarker } from '../svg/serializer.js';

const REVEAL_TOP_PADDING_PX = 100;

export function summarizeElement(element) {
    if (!element) {
        return null;
    }

    const attributes = new Map();
    Array.from(element.attributes).forEach((attribute) => {
        if (attribute.name !== 'data-editor-id') {
            attributes.set(attribute.name, attribute.value);
        }
    });

    return {
        tagName: element.tagName.toLowerCase(),
        attributes,
        content: element.textContent ?? ''
    };
}

export function getChangedFields(previous, current, sameSelection) {
    if (!sameSelection || !previous || !current || previous.tagName !== current.tagName) {
        return [];
    }

    const changed = [];
    const names = new Set([...previous.attributes.keys(), ...current.attributes.keys()]);
    names.forEach((name) => {
        if ((previous.attributes.get(name) ?? '') !== (current.attributes.get(name) ?? '')) {
            changed.push(name);
        }
    });

    if (previous.content !== current.content) {
        changed.push('content');
    }

    return changed;
}

export function renderSourceViewer(viewer, source, focusRange = null, mode = 'plain') {
    const range = normalizeRange(source, focusRange);
    if (!range) {
        viewer.innerHTML = escapeHtml(source);
        return;
    }

    const before = escapeHtml(source.slice(0, range.start));
    const content = escapeHtml(source.slice(range.start, range.end));
    const after = escapeHtml(source.slice(range.end));
    const focusClass = mode === 'highlight'
        ? 'source-range source-range-highlight'
        : 'source-range source-range-selected';
    viewer.innerHTML = `${before}<span class="${focusClass}" data-source-focus="true">${content}</span>${after}`;
    scrollToFocusedRange(viewer);
}

export function revealElementBlock(viewer, source, element) {
    const markerRange = getElementMarkerRange(source, element);
    if (!markerRange) {
        return false;
    }

    renderSourceViewer(viewer, source, markerRange, 'selection');
    return true;
}

export function highlightChangedFields(viewer, source, element, changedFields) {
    const markerRange = getElementMarkerRange(source, element);
    if (!markerRange) {
        return false;
    }

    const changedRange = findChangedRangeWithinMarker(markerRange.marker, changedFields);
    if (!changedRange) {
        return false;
    }

    renderSourceViewer(viewer, source, {
        start: markerRange.start + changedRange.start,
        end: markerRange.start + changedRange.start + changedRange.length
    }, 'highlight');
    return true;
}

export function clearSourceSelection(viewer, source) {
    renderSourceViewer(viewer, source);
}

function normalizeRange(source, range) {
    if (!range) {
        return null;
    }

    const start = Math.max(0, Math.min(source.length, range.start));
    const end = Math.max(start, Math.min(source.length, range.end));
    if (end <= start) {
        return null;
    }

    return { start, end };
}

function getElementMarkerRange(source, element) {
    const marker = getElementSourceMarker(element);
    if (!marker) {
        return null;
    }

    const normalizedMarker = marker.trim();
    if (!normalizedMarker) {
        return null;
    }

    const exactStart = source.indexOf(normalizedMarker);
    if (exactStart !== -1) {
        return {
            start: exactStart,
            end: exactStart + normalizedMarker.length,
            marker: normalizedMarker
        };
    }

    const elementId = element.getAttribute('id');
    if (!elementId) {
        return null;
    }

    const idToken = `id="${elementId}"`;
    const idIndex = source.indexOf(idToken);
    if (idIndex === -1) {
        return null;
    }

    const lineStart = source.lastIndexOf('<', idIndex);
    const lineEnd = source.indexOf('\n', idIndex);
    const end = lineEnd === -1 ? source.length : lineEnd;
    if (lineStart === -1) {
        return null;
    }

    return {
        start: lineStart,
        end,
        marker: source.slice(lineStart, end)
    };
}

function findChangedRangeWithinMarker(marker, changedFields) {
    let start = Number.POSITIVE_INFINITY;
    let end = -1;

    changedFields.forEach((field) => {
        if (field === 'content') {
            const textStart = marker.indexOf('>');
            const textEnd = marker.lastIndexOf('<');
            if (textStart !== -1 && textEnd !== -1 && textEnd > textStart + 1) {
                start = Math.min(start, textStart + 1);
                end = Math.max(end, textEnd);
            }
            return;
        }

        const fieldIndex = marker.indexOf(`${field}=`);
        if (fieldIndex === -1) {
            return;
        }

        const quoteStart = marker.indexOf('"', fieldIndex);
        const quoteEnd = quoteStart === -1 ? -1 : marker.indexOf('"', quoteStart + 1);
        start = Math.min(start, fieldIndex);
        end = Math.max(end, quoteEnd === -1 ? fieldIndex + field.length : quoteEnd + 1);
    });

    if (!Number.isFinite(start) || end <= start) {
        return null;
    }

    return {
        start,
        length: end - start
    };
}

function scrollToFocusedRange(viewer) {
    requestAnimationFrame(() => {
        const focused = viewer.querySelector('[data-source-focus="true"]');
        if (!(focused instanceof HTMLElement)) {
            return;
        }

        const nextScrollTop = Math.max(0, focused.offsetTop - REVEAL_TOP_PADDING_PX);
        viewer.scrollTop = nextScrollTop;
    });
}

function escapeHtml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

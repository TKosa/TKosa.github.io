import { getElementSourceMarker } from '../svg/serializer.js';

const REVEAL_BOTTOM_PADDING_PX = 0;

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
        logSourceMatchMiss('selection-range-not-found', element);
        return false;
    }

    renderSourceViewer(viewer, source, markerRange, 'selection');
    return true;
}

export function highlightChangedFields(viewer, source, element, changedFields) {
    const markerRange = getElementMarkerRange(source, element);
    if (!markerRange) {
        logSourceMatchMiss('highlight-range-not-found', element, { changedFields });
        return false;
    }

    const changedRange = findChangedRangeWithinMarker(markerRange.marker, changedFields);
    if (!changedRange) {
        logSourceMatchMiss('changed-fields-not-found-in-marker', element, { changedFields, markerPreview: markerRange.marker.slice(0, 240) });
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
        logSourceMatchMiss('marker-serialization-empty', element);
        return null;
    }

    const normalizedMarker = marker.trim();
    if (!normalizedMarker) {
        logSourceMatchMiss('marker-trimmed-empty', element);
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
        logSourceMatchMiss('exact-match-missed-and-no-id-fallback', element, { markerPreview: normalizedMarker.slice(0, 240) });
        return null;
    }

    const fallbackRange = findElementRangeById(source, element.tagName.toLowerCase(), elementId);
    if (!fallbackRange) {
        logSourceMatchMiss('id-fallback-range-not-found', element, { markerPreview: normalizedMarker.slice(0, 240) });
        return null;
    }

    return {
        start: fallbackRange.start,
        end: fallbackRange.end,
        marker: source.slice(fallbackRange.start, fallbackRange.end)
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

        const focusedTop = focused.offsetTop;
        const focusedBottom = focusedTop + focused.offsetHeight;
        const visibleTop = viewer.scrollTop;
        const visibleBottom = visibleTop + viewer.clientHeight;

        if (focusedBottom !== visibleBottom - REVEAL_BOTTOM_PADDING_PX) {
            viewer.scrollTop = Math.max(0, focusedBottom - viewer.clientHeight + REVEAL_BOTTOM_PADDING_PX);
        }
    });
}

function findElementRangeById(source, tagName, elementId) {
    const idToken = `id="${elementId}"`;
    const idIndex = source.indexOf(idToken);
    if (idIndex === -1) {
        return null;
    }

    const start = source.lastIndexOf(`<${tagName}`, idIndex);
    if (start === -1) {
        return null;
    }

    const openEnd = findTagEnd(source, start);
    if (openEnd === -1) {
        return null;
    }

    const openingTag = source.slice(start, openEnd + 1);
    if (openingTag.endsWith('/>')) {
        return { start, end: openEnd + 1 };
    }

    const closeTag = `</${tagName}>`;
    let depth = 1;
    let cursor = openEnd + 1;

    while (cursor < source.length) {
        const nextOpen = source.indexOf(`<${tagName}`, cursor);
        const nextClose = source.indexOf(closeTag, cursor);

        if (nextClose === -1) {
            return null;
        }

        if (nextOpen !== -1 && nextOpen < nextClose) {
            const nestedOpenEnd = findTagEnd(source, nextOpen);
            if (nestedOpenEnd === -1) {
                return null;
            }

            if (!source.slice(nextOpen, nestedOpenEnd + 1).endsWith('/>')) {
                depth += 1;
            }
            cursor = nestedOpenEnd + 1;
            continue;
        }

        depth -= 1;
        const end = nextClose + closeTag.length;
        if (depth === 0) {
            return { start, end };
        }
        cursor = end;
    }

    return null;
}

function findTagEnd(source, start) {
    let quote = '';

    for (let index = start; index < source.length; index += 1) {
        const char = source[index];
        if ((char === '"' || char === '\'') && (!quote || quote === char)) {
            quote = quote ? '' : char;
            continue;
        }

        if (!quote && char === '>') {
            return index;
        }
    }

    return -1;
}

function logSourceMatchMiss(reason, element, extra = {}) {
    const tagName = element?.tagName?.toLowerCase?.() ?? 'unknown';
    const id = element?.getAttribute?.('id') ?? null;
    const editorId = element?.getAttribute?.('data-editor-id') ?? null;

    console.warn('[svg-editor] Source highlight miss', {
        reason,
        tagName,
        id,
        editorId,
        ...extra
    });
}

function escapeHtml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

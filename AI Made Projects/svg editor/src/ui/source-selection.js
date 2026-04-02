import { getElementSourceMarker } from '../svg/serializer.js';
import { getScrollTopForSelectionEnd } from './source-textarea-measure.js';

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

export function revealElementBlock(textarea, element) {
    const markerRange = getElementMarkerRange(textarea.value, element);
    if (!markerRange) {
        return false;
    }

    revealTextareaRange(textarea, markerRange.start, markerRange.end, false);
    return true;
}

export function highlightChangedFields(textarea, element, changedFields) {
    const markerRange = getElementMarkerRange(textarea.value, element);
    if (!markerRange) {
        return false;
    }

    const changedRange = findChangedRangeWithinMarker(markerRange.marker, changedFields);
    if (!changedRange) {
        return false;
    }

    const selectionStart = markerRange.start + changedRange.start;
    const selectionEnd = selectionStart + changedRange.length;
    revealTextareaRange(textarea, selectionStart, selectionEnd, true);
    return true;
}

export function clearSourceSelection(textarea) {
    textarea.classList.remove('is-change-highlight');
    textarea.setSelectionRange(0, 0);
}

export function captureSelectionScroll(textarea) {
    textarea.dataset.lastSelectedSourceY = String(
        Math.round(getScrollTopForSelectionEnd(textarea, textarea.selectionEnd))
    );
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

function revealTextareaRange(textarea, start, end, highlight) {
    requestAnimationFrame(() => {
        textarea.classList.toggle('is-change-highlight', highlight);
        textarea.focus({ preventScroll: true });
        textarea.setSelectionRange(start, end);
        const targetScrollTop = getScrollTopForSelectionEnd(textarea, end);
        const maxScrollTop = Math.max(0, textarea.scrollHeight - textarea.clientHeight);
        textarea.scrollTop = Math.min(maxScrollTop, Math.max(0, targetScrollTop - REVEAL_TOP_PADDING_PX));
    });
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

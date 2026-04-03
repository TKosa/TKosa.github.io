import { INTERACTABLE_TAGS, walkElements } from './document-dom.js';

export function refreshElementIds(root, startingId) {
    let nextId = startingId;

    walkElements(root, (element) => {
        if (!(element instanceof SVGElement)) {
            return;
        }

        element.removeAttribute('data-editor-id');
        if (INTERACTABLE_TAGS.has(element.tagName.toLowerCase())) {
            element.setAttribute('id', String(nextId));
            nextId += 1;
        }
    });
}

export function nudgeElement(element, deltaX, deltaY) {
    translateElement(element, deltaX, deltaY);
}

export function translateElement(element, deltaX, deltaY) {
    const tag = element.tagName.toLowerCase();

    if (tag === 'rect' || tag === 'text') {
        bumpAttribute(element, 'x', deltaX);
        bumpAttribute(element, 'y', deltaY);
        return;
    }

    if (tag === 'circle' || tag === 'ellipse') {
        bumpAttribute(element, 'cx', deltaX);
        bumpAttribute(element, 'cy', deltaY);
        return;
    }

    if (tag === 'line') {
        bumpAttribute(element, 'x1', deltaX);
        bumpAttribute(element, 'x2', deltaX);
        bumpAttribute(element, 'y1', deltaY);
        bumpAttribute(element, 'y2', deltaY);
        return;
    }

    applyTranslateTransform(element, deltaX, deltaY);
}

export function sanitizeClipboardElement(element) {
    walkElements(element, (current) => {
        current.removeAttribute?.('data-editor-id');
    });

    return element;
}

export function insertClipboardClone(svgRoot, target, clone) {
    if (!target || target === svgRoot) {
        svgRoot.appendChild(clone);
        return;
    }

    if (target.tagName.toLowerCase() === 'g') {
        target.appendChild(clone);
        return;
    }

    target.parentNode?.insertBefore(clone, target.nextSibling);
}

export function setElementTransform(element, transform) {
    if (!transform) {
        element.removeAttribute('transform');
        return;
    }

    element.setAttribute('transform', transform);
}

export function parsePointList(element) {
    const points = element.getAttribute('points') ?? '';
    const result = [];
    const values = points.trim().split(/[\s,]+/);

    for (let index = 0; index < values.length - 1; index += 2) {
        const x = Number(values[index]);
        const y = Number(values[index + 1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            continue;
        }

        result.push({ x, y });
    }

    return result;
}

export function serializePointList(points) {
    return points
        .map(({ x, y }) => `${Number(x.toFixed(3))},${Number(y.toFixed(3))}`)
        .join(' ');
}

export function movePoint(element, index, x, y) {
    const points = parsePointList(element);
    if (!points[index]) {
        return false;
    }

    points[index] = { x, y };
    element.setAttribute('points', serializePointList(points));
    return true;
}

export function insertPoint(element, index, x, y) {
    const points = parsePointList(element);
    const safeIndex = Math.max(0, Math.min(index, points.length));
    points.splice(safeIndex, 0, { x, y });
    element.setAttribute('points', serializePointList(points));
}

export function removePoint(element, index) {
    const tag = element.tagName.toLowerCase();
    const points = parsePointList(element);
    const minimumPoints = tag === 'polygon' ? 3 : 2;
    if (points.length <= minimumPoints || !points[index]) {
        return false;
    }

    points.splice(index, 1);
    element.setAttribute('points', serializePointList(points));
    return true;
}

function bumpAttribute(element, name, delta) {
    const current = Number.parseFloat(element.getAttribute(name) ?? '0');
    element.setAttribute(name, String(current + delta));
}

function applyTranslateTransform(element, deltaX, deltaY) {
    const transform = element.getAttribute('transform') ?? '';
    const match = transform.match(/translate\(([-\d.]+)[ ,]([-\d.]+)\)/);

    if (match) {
        const nextX = Number.parseFloat(match[1]) + deltaX;
        const nextY = Number.parseFloat(match[2]) + deltaY;
        element.setAttribute('transform', transform.replace(match[0], `translate(${nextX} ${nextY})`));
        return;
    }

    const prefix = transform.trim();
    element.setAttribute('transform', `${prefix ? `${prefix} ` : ''}translate(${deltaX} ${deltaY})`);
}

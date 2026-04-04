import { DEFAULT_DOCUMENT, SHAPE_DEFINITIONS, SVG_NS } from '../core/constants.js';

export const INTERACTABLE_TAGS = new Set(['g', 'rect', 'circle', 'ellipse', 'line', 'text', 'path', 'polygon', 'polyline']);

const NUMERIC_ID_PATTERN = /^\d+$/;

export function createBaseSvgRoot() {
    const svgRoot = document.createElementNS(SVG_NS, 'svg');
    svgRoot.setAttribute('xmlns', SVG_NS);
    svgRoot.setAttribute('width', String(DEFAULT_DOCUMENT.width));
    svgRoot.setAttribute('height', String(DEFAULT_DOCUMENT.height));
    svgRoot.setAttribute('viewBox', `0 0 ${DEFAULT_DOCUMENT.width} ${DEFAULT_DOCUMENT.height}`);
    return svgRoot;
}

export function createDefaultSvg() {
    const svgRoot = createBaseSvgRoot();
    ['rect', 'circle', 'text'].forEach((type, index) => {
        const element = createShapeElement(type);
        element.setAttribute('id', String(index + 1));
        svgRoot.appendChild(element);
    });
    return svgRoot;
}

export function createShapeElement(type) {
    const element = document.createElementNS(SVG_NS, type);
    const defaults = SHAPE_DEFINITIONS[type]?.defaults ?? {};

    Object.entries(defaults).forEach(([key, value]) => {
        if (key === 'content') {
            element.textContent = String(value);
            return;
        }

        if (key !== 'elementId') {
            element.setAttribute(toSvgAttributeName(key), String(value));
        }
    });

    return element;
}

export function cloneSvgRoot(svgRoot) {
    return svgRoot.cloneNode(true);
}

export function assignEditorIds(svgRoot) {
    let counter = 1;
    const usedEditorIds = new Set();

    walkElements(svgRoot, (element) => {
        if (!(element instanceof Element) || element === svgRoot) {
            return;
        }

        const currentEditorId = element.getAttribute('data-editor-id');
        if (currentEditorId && !usedEditorIds.has(currentEditorId)) {
            usedEditorIds.add(currentEditorId);
            counter += 1;
            return;
        }

        while (usedEditorIds.has(`editor-${counter}`)) {
            counter += 1;
        }

        const nextEditorId = `editor-${counter}`;
        element.setAttribute('data-editor-id', nextEditorId);
        usedEditorIds.add(nextEditorId);
        counter += 1;
    });
}

export function removeEditorIds(root) {
    walkElements(root, (element) => {
        element.removeAttribute?.('data-editor-id');
    });

    return root;
}

export function computeNextElementId(svgRoot) {
    let maxId = 0;

    walkElements(svgRoot, (element) => {
        const id = element.getAttribute?.('id');
        if (id && NUMERIC_ID_PATTERN.test(id)) {
            maxId = Math.max(maxId, Number(id));
        }
    });

    return maxId + 1;
}

export function walkElements(root, visitor) {
    visitor(root);
    Array.from(root.children).forEach((child) => walkElements(child, visitor));
}

export function findElementByEditorId(root, editorId) {
    if (!editorId) {
        return null;
    }

    return root.querySelector(`[data-editor-id="${editorId}"]`);
}

export function getElementAttributes(element) {
    if (!element) {
        return [];
    }

    return Array.from(element.attributes)
        .filter((attribute) => attribute.name !== 'data-editor-id')
        .map((attribute) => ({ name: attribute.name, value: attribute.value }));
}

export function getCanvasMetrics(svgRoot) {
    const viewBox = svgRoot.getAttribute('viewBox')?.trim().split(/\s+/).map(Number);
    const width = parseSize(svgRoot.getAttribute('width')) ?? viewBox?.[2] ?? DEFAULT_DOCUMENT.width;
    const height = parseSize(svgRoot.getAttribute('height')) ?? viewBox?.[3] ?? DEFAULT_DOCUMENT.height;
    return { width, height };
}

export function isInteractableElement(element) {
    return Boolean(element && INTERACTABLE_TAGS.has(element.tagName.toLowerCase()));
}

export function getFirstSelectableEditorId(svgRoot) {
    const first = svgRoot.querySelector(Array.from(INTERACTABLE_TAGS).join(','));
    return first?.getAttribute('data-editor-id') ?? null;
}

export function toSvgAttributeName(property) {
    return property.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

function parseSize(value) {
    const parsed = Number.parseFloat(value ?? '');
    return Number.isFinite(parsed) ? parsed : null;
}

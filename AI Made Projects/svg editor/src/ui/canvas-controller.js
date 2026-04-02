import { clampNumber, toNumber } from '../core/utils.js';
import { findElementByEditorId, getCanvasMetrics, isInteractableElement } from '../state/document-selectors.js';

export function createCanvasController({ store, refs }) {
    let dragState = null;
    let zoom = 1;

    refs.canvasStage.addEventListener('wheel', (event) => {
        event.preventDefault();

        const previousZoom = zoom;
        const nextZoom = clampNumber(previousZoom * Math.exp(-event.deltaY * 0.0015), 0.2, 6);
        if (nextZoom === previousZoom) {
            return;
        }

        const stageRect = refs.canvasStage.getBoundingClientRect();
        const pointerOffsetX = event.clientX - stageRect.left;
        const pointerOffsetY = event.clientY - stageRect.top;
        const contentX = refs.canvasStage.scrollLeft + pointerOffsetX;
        const contentY = refs.canvasStage.scrollTop + pointerOffsetY;
        const ratio = nextZoom / previousZoom;

        zoom = nextZoom;
        applyCanvasZoom(refs, store.getState(), zoom);
        refs.canvasStage.scrollLeft = (contentX * ratio) - pointerOffsetX;
        refs.canvasStage.scrollTop = (contentY * ratio) - pointerOffsetY;
    }, { passive: false });

    refs.canvas.addEventListener('pointerdown', (event) => {
        const target = event.target instanceof SVGElement ? event.target.closest('[data-editor-id]') : null;
        if (!target || !isInteractableElement(target)) {
            store.selectElement(null);
            return;
        }

        const editorId = target.getAttribute('data-editor-id');
        const point = getSvgPoint(event, refs.canvas);
        store.selectElement(editorId);
        dragState = {
            editorId,
            pointerId: event.pointerId,
            previous: point
        };
        refs.canvas.setPointerCapture(event.pointerId);
    });

    refs.canvas.addEventListener('pointermove', (event) => {
        if (!dragState || dragState.pointerId !== event.pointerId) {
            return;
        }

        event.preventDefault();
        const point = getSvgPoint(event, refs.canvas);
        const deltaX = point.x - dragState.previous.x;
        const deltaY = point.y - dragState.previous.y;
        if (deltaX === 0 && deltaY === 0) {
            return;
        }

        store.moveElement(dragState.editorId, deltaX, deltaY);
        dragState.previous = point;
    });

    const endDrag = (event) => {
        if (!dragState || dragState.pointerId !== event.pointerId) {
            return;
        }

        if (refs.canvas.hasPointerCapture(event.pointerId)) {
            refs.canvas.releasePointerCapture(event.pointerId);
        }

        dragState = null;
    };

    refs.canvas.addEventListener('pointerup', endDrag);
    refs.canvas.addEventListener('pointercancel', endDrag);

    return {
        render(state) {
            renderSvg(refs.canvas, state);
            applyCanvasZoom(refs, state, zoom);
        }
    };
}

function renderSvg(canvas, state) {
    syncSvgRoot(canvas, state.svgRoot);
    const selected = findElementByEditorId(canvas, state.selectedId);
    if (selected) {
        renderSelectionOutline(canvas, selected);
    }
}

function syncSvgRoot(target, source) {
    Array.from(target.attributes).forEach((attribute) => {
        if (attribute.name !== 'id') {
            target.removeAttribute(attribute.name);
        }
    });

    Array.from(source.attributes).forEach((attribute) => {
        if (attribute.name !== 'id') {
            target.setAttribute(attribute.name, attribute.value);
        }
    });

    target.replaceChildren(...Array.from(source.childNodes).map((child) => child.cloneNode(true)));
}

function applyCanvasZoom(refs, state, zoom) {
    const { width, height } = getCanvasMetrics(state.svgRoot);
    refs.canvas.style.width = `${width * zoom}px`;
    refs.canvas.style.height = `${height * zoom}px`;
}

function renderSelectionOutline(canvas, selected) {
    try {
        const box = getTransformedBox(selected);
        if (!Number.isFinite(box.x) || !Number.isFinite(box.y) || box.width < 0 || box.height < 0) {
            return;
        }

        const outline = document.createElementNS(canvas.namespaceURI, 'rect');
        outline.setAttribute('x', String(box.x));
        outline.setAttribute('y', String(box.y));
        outline.setAttribute('width', String(box.width));
        outline.setAttribute('height', String(box.height));
        outline.setAttribute('fill', 'none');
        outline.setAttribute('stroke', '#2d7ff9');
        outline.setAttribute('stroke-width', '1.5');
        outline.setAttribute('stroke-dasharray', '5 4');
        outline.setAttribute('vector-effect', 'non-scaling-stroke');
        outline.setAttribute('pointer-events', 'none');
        outline.classList.add('selection-outline');
        canvas.appendChild(outline);
    } catch (error) {
        void error;
    }
}

function getTransformedBox(element) {
    const box = element.getBBox();
    const matrix = element.getCTM();

    if (!matrix) {
        return box;
    }

    const corners = [
        new DOMPoint(box.x, box.y),
        new DOMPoint(box.x + box.width, box.y),
        new DOMPoint(box.x, box.y + box.height),
        new DOMPoint(box.x + box.width, box.y + box.height)
    ].map((point) => point.matrixTransform(matrix));

    const xs = corners.map((point) => point.x);
    const ys = corners.map((point) => point.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);

    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
    };
}

function getSvgPoint(event, svg) {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;

    const matrix = svg.getScreenCTM();
    if (!matrix) {
        return { x: 0, y: 0 };
    }

    const transformed = point.matrixTransform(matrix.inverse());
    return {
        x: toNumber(transformed.x, 0),
        y: toNumber(transformed.y, 0)
    };
}

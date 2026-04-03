import { clampNumber, toNumber } from '../core/utils.js';
import { findElementByEditorId, getCanvasMetrics, isInteractableElement } from '../state/document-selectors.js';

export function createCanvasController({ store, refs, status }) {
    let dragState = null;
    let zoom = 1;
    let panX = 0;
    let panY = 0;
    let viewportInitialized = false;

    const updateHoverCoordinates = (event) => {
        const point = getSvgPoint(event, refs.canvas);
        status?.showCanvasCoordinates?.(point);
    };

    const handleDragMove = (event) => {
        if (!dragState || dragState.pointerId !== event.pointerId) {
            return;
        }

        if (dragState.mode === 'pan') {
            event.preventDefault();
            const nextPanX = dragState.startPanX + (event.clientX - dragState.startClientX);
            const nextPanY = dragState.startPanY + (event.clientY - dragState.startClientY);
            panX = nextPanX;
            panY = nextPanY;
            applyCanvasViewport(refs, store.getState(), zoom, panX, panY);
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
    };

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
        const worldX = (pointerOffsetX - panX) / previousZoom;
        const worldY = (pointerOffsetY - panY) / previousZoom;

        zoom = nextZoom;
        panX = pointerOffsetX - (worldX * nextZoom);
        panY = pointerOffsetY - (worldY * nextZoom);
        applyCanvasViewport(refs, store.getState(), zoom, panX, panY);
    }, { passive: false });

    refs.canvasStage.addEventListener('pointerdown', (event) => {
        const target = event.target instanceof SVGElement ? event.target.closest('[data-editor-id]') : null;
        if (!target || !isInteractableElement(target)) {
            store.selectElement(null);
            dragState = {
                mode: 'pan',
                pointerId: event.pointerId,
                startClientX: event.clientX,
                startClientY: event.clientY,
                startPanX: panX,
                startPanY: panY
            };
            refs.canvasStage.setPointerCapture(event.pointerId);
            return;
        }

        const editorId = target.getAttribute('data-editor-id');
        const point = getSvgPoint(event, refs.canvas);
        store.selectElement(editorId);
        dragState = {
            mode: 'move-element',
            editorId,
            pointerId: event.pointerId,
            previous: point
        };
        refs.canvas.setPointerCapture(event.pointerId);
    });

    refs.canvasStage.addEventListener('pointermove', updateHoverCoordinates);
    refs.canvasStage.addEventListener('pointermove', handleDragMove);

    const endDrag = (event) => {
        if (!dragState || dragState.pointerId !== event.pointerId) {
            return;
        }

        if (dragState.mode === 'pan' && refs.canvasStage.hasPointerCapture(event.pointerId)) {
            refs.canvasStage.releasePointerCapture(event.pointerId);
        }

        if (dragState.mode === 'move-element' && refs.canvas.hasPointerCapture(event.pointerId)) {
            refs.canvas.releasePointerCapture(event.pointerId);
        }

        dragState = null;
    };

    refs.canvas.addEventListener('pointerup', endDrag);
    refs.canvas.addEventListener('pointercancel', endDrag);
    refs.canvasStage.addEventListener('pointerup', endDrag);
    refs.canvasStage.addEventListener('pointercancel', endDrag);
    refs.canvasStage.addEventListener('pointerleave', () => status?.clearCanvasCoordinates?.());

    return {
        render(state) {
            renderSvg(refs.canvas, state);
            initializeViewportIfNeeded(refs, state, zoom, viewportInitialized, (nextPanX, nextPanY) => {
                panX = nextPanX;
                panY = nextPanY;
                viewportInitialized = true;
            });
            applyCanvasViewport(refs, state, zoom, panX, panY);
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

function applyCanvasViewport(refs, state, zoom, panX, panY) {
    const { width, height } = getCanvasMetrics(state.svgRoot);
    refs.canvas.style.width = `${width}px`;
    refs.canvas.style.height = `${height}px`;
    refs.canvas.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    refs.canvasStage.style.backgroundPosition = `${panX}px ${panY}px, ${panX}px ${panY}px, ${panX}px ${panY}px, ${panX}px ${panY}px, 0 0`;
    refs.canvasStage.style.backgroundSize = `${80 * zoom}px ${80 * zoom}px, ${80 * zoom}px ${80 * zoom}px, ${20 * zoom}px ${20 * zoom}px, ${20 * zoom}px ${20 * zoom}px, auto`;
}

function initializeViewportIfNeeded(refs, state, zoom, viewportInitialized, setViewport) {
    if (viewportInitialized) {
        return;
    }

    const { width, height } = getCanvasMetrics(state.svgRoot);
    const availableWidth = refs.canvasStage.clientWidth;
    const availableHeight = refs.canvasStage.clientHeight;
    setViewport(
        Math.round((availableWidth - (width * zoom)) / 2),
        Math.round((availableHeight - (height * zoom)) / 2)
    );
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
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
        return { x: 0, y: 0 };
    }

    const viewBox = svg.viewBox.baseVal;

    return {
        x: toNumber(viewBox.x + (((event.clientX - rect.left) / rect.width) * viewBox.width), 0),
        y: toNumber(viewBox.y + (((event.clientY - rect.top) / rect.height) * viewBox.height), 0)
    };
}

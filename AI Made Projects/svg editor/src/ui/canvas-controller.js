import { toNumber } from '../core/utils.js';
import { findElementByEditorId, getCanvasMetrics, getSelectedIds, resolveSelectableElement } from '../state/document-selectors.js';
import { parsePointList } from '../svg/element-operations.js';

const HANDLE_DIRECTIONS = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
const ROTATION_DIRECTIONS = ['nw', 'ne', 'se', 'sw'];
const HANDLE_CURSORS = {
    n: 'ns-resize',
    ne: 'nesw-resize',
    e: 'ew-resize',
    se: 'nwse-resize',
    s: 'ns-resize',
    sw: 'nesw-resize',
    w: 'ew-resize',
    nw: 'nwse-resize'
};
const ROTATE_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'%3E%3Cpath d='M19.5 7.5A8.5 8.5 0 1 0 22 14' fill='none' stroke='%232d7ff9' stroke-width='2.4' stroke-linecap='round'/%3E%3Cpath d='M17.5 4.5h5v5' fill='none' stroke='%232d7ff9' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") 14 14, grab`;

export function createCanvasController({ store, refs, status }) {
    let dragState = null;
    let zoom = 1;
    let panX = 0;
    let panY = 0;
    let viewportInitialized = false;
    let marqueeOverlay = null;

    const getElementLabel = (element) => element.tagName.toLowerCase();

    const formatPointArgs = (elementName, ...values) => [
        elementName,
        ...values.map((value) => Math.round(value))
    ];

    const applySelection = (editorIds) => {
        if (typeof store.setSelection === 'function') {
            store.setSelection(editorIds);
            return;
        }

        store.selectElement?.(editorIds.at(-1) ?? null);
    };

    const applyElementTransform = (actionName, actionArgs, editorId, transform) => {
        if (typeof store.setElementTransform === 'function') {
            store.setElementTransform(actionName, actionArgs, editorId, transform);
            return;
        }

        if (typeof store.updateElementAttribute === 'function') {
            store.updateElementAttribute(actionName, actionArgs, editorId, 'transform', transform ?? '');
        }
    };

    const applyMultipleElementTransforms = (actionName, actionArgs, updates) => {
        if (updates.length === 0) {
            return;
        }

        if (typeof store.setMultipleElementTransforms === 'function') {
            store.setMultipleElementTransforms(actionName, actionArgs, updates);
            return;
        }

        updates.forEach(({ editorId, transform }) => {
            applyElementTransform(actionName, actionArgs, editorId, transform);
        });
    };

    const clearMarqueeOverlay = () => {
        marqueeOverlay?.remove();
        marqueeOverlay = null;
    };

    const setStageMode = (mode = '') => {
        if (mode) {
            refs.canvasStage.dataset.mode = mode;
            return;
        }

        delete refs.canvasStage.dataset.mode;
    };

    const renderMarqueeOverlay = (bounds) => {
        if (!bounds) {
            clearMarqueeOverlay();
            return;
        }

        if (!marqueeOverlay) {
            marqueeOverlay = document.createElement('div');
            marqueeOverlay.classList.add('marquee-selection-outline');
            refs.canvasStage.appendChild(marqueeOverlay);
        }

        marqueeOverlay.style.left = `${panX + (bounds.x * zoom)}px`;
        marqueeOverlay.style.top = `${panY + (bounds.y * zoom)}px`;
        marqueeOverlay.style.width = `${bounds.width * zoom}px`;
        marqueeOverlay.style.height = `${bounds.height * zoom}px`;
    };

    const getMarqueeBounds = (startPoint, endPoint) => ({
        x: Math.min(startPoint.x, endPoint.x),
        y: Math.min(startPoint.y, endPoint.y),
        width: Math.abs(endPoint.x - startPoint.x),
        height: Math.abs(endPoint.y - startPoint.y)
    });

    const getElementsInMarquee = (bounds) => Array.from(refs.canvas.querySelectorAll('[data-editor-id]'))
        .filter((element) => element instanceof SVGGraphicsElement)
        .filter((element) => {
            const box = getTransformedBox(element);
            return boxesIntersect(bounds, box);
        })
        .map((element) => element.getAttribute('data-editor-id'))
        .filter(Boolean);

    const beginVertexDrag = (event, handleNode) => {
        if (!(handleNode instanceof SVGElement)) {
            return;
        }

        if (event.button !== 0) {
            return;
        }

        const editorId = handleNode.getAttribute('data-vertex-editor-id');
        const index = Number(handleNode.getAttribute('data-vertex-index'));
        const selected = editorId ? findElementByEditorId(refs.canvas, editorId) : null;
        const matrix = selected?.getCTM();
        const inverseMatrix = invertMatrix(toDomMatrix(matrix));
        if (!selected || !Number.isInteger(index) || !matrix || !inverseMatrix) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        dragState = {
            mode: 'move-vertex',
            editorId,
            elementName: getElementLabel(selected),
            pointerId: event.pointerId,
            index,
            inverseMatrix
        };
        refs.canvas.setPointerCapture(event.pointerId);
    };

    const insertVertexAtHandle = (event, handleNode) => {
        if (!(handleNode instanceof SVGElement)) {
            return;
        }

        const editorId = handleNode.getAttribute('data-edge-editor-id');
        const insertIndex = Number(handleNode.getAttribute('data-edge-insert-index'));
        const x = Number(handleNode.getAttribute('data-edge-local-x'));
        const y = Number(handleNode.getAttribute('data-edge-local-y'));
        const selected = editorId ? findElementByEditorId(refs.canvas, editorId) : null;
        if (!selected || !Number.isInteger(insertIndex) || !Number.isFinite(x) || !Number.isFinite(y)) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        store.insertElementPoint('insert-vertex', [getElementLabel(selected), insertIndex, Math.round(x), Math.round(y)], editorId, insertIndex, x, y);
    };

    const removeVertexFromHandle = (event, handleNode) => {
        if (!(handleNode instanceof SVGElement)) {
            return;
        }

        const editorId = handleNode.getAttribute('data-vertex-editor-id');
        const index = Number(handleNode.getAttribute('data-vertex-index'));
        const x = Number(handleNode.getAttribute('data-vertex-local-x'));
        const y = Number(handleNode.getAttribute('data-vertex-local-y'));
        const selected = editorId ? findElementByEditorId(refs.canvas, editorId) : null;
        if (!selected || !Number.isInteger(index)) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        store.removeElementPoint('remove-vertex', [getElementLabel(selected), index, Math.round(x), Math.round(y)], editorId, index);
    };

    const beginResizeDrag = (event, handleNode) => {
        if (!(handleNode instanceof SVGElement)) {
            return;
        }

        const editorId = handleNode.getAttribute('data-resize-editor-id') ?? store.getState().selectedId;
        const selected = editorId ? findElementByEditorId(refs.canvas, editorId) : null;
        const handle = handleNode.getAttribute('data-resize-handle');
        const box = selected ? getTransformedBox(selected) : null;
        const currentMatrix = selected ? toDomMatrix(selected.getCTM()) : null;
        const parentMatrix = selected ? getParentMatrix(selected) : null;
        if (!selected || !handle || !box || !currentMatrix || !parentMatrix) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        refs.canvasStage.style.cursor = HANDLE_CURSORS[handle];
        dragState = {
            mode: 'resize-element',
            editorId,
            pointerId: event.pointerId,
            handle,
            box,
            anchor: getResizeAnchor(box, handle),
            movingPoint: getMovingPoint(box, handle),
            currentMatrix,
            parentMatrix,
            originalTransform: selected.getAttribute('transform') ?? '',
            elementName: getElementLabel(selected)
        };
        refs.canvas.setPointerCapture(event.pointerId);
    };

    const beginRotateDrag = (event, handleNode) => {
        if (!(handleNode instanceof SVGElement) || event.button !== 0) {
            return;
        }

        const editorId = handleNode.getAttribute('data-rotate-editor-id') ?? store.getState().selectedId;
        const selected = editorId ? findElementByEditorId(refs.canvas, editorId) : null;
        const currentMatrix = selected ? toDomMatrix(selected.getCTM()) : null;
        const parentMatrix = selected ? getParentMatrix(selected) : null;
        if (!selected || !currentMatrix || !parentMatrix) {
            return;
        }

        const localBox = selected.getBBox();
        const centerPoint = new DOMPoint(
            localBox.x + (localBox.width / 2),
            localBox.y + (localBox.height / 2)
        ).matrixTransform(currentMatrix);
        const point = getSvgPoint(event, refs.canvas);
        const center = {
            x: centerPoint.x,
            y: centerPoint.y
        };
        const startAngle = Math.atan2(point.y - center.y, point.x - center.x);
        if (!Number.isFinite(startAngle)) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        refs.canvasStage.style.cursor = ROTATE_CURSOR;
        dragState = {
            mode: 'rotate-element',
            editorId,
            pointerId: event.pointerId,
            center,
            startAngle,
            currentMatrix,
            parentMatrix,
            originalTransform: selected.getAttribute('transform') ?? '',
            elementName: getElementLabel(selected)
        };
        refs.canvas.setPointerCapture(event.pointerId);
    };

    const updateHoverCoordinates = (event) => {
        const point = getSvgPoint(event, refs.canvas);
        store.setLastPointerPosition?.(point);
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

        if (dragState.mode === 'marquee-select') {
            const point = getSvgPoint(event, refs.canvas);
            const bounds = getMarqueeBounds(dragState.startPoint, point);
            dragState.currentPoint = point;
            renderMarqueeOverlay(bounds);
            return;
        }

        if (dragState.mode === 'resize-element') {
            const point = getSvgPoint(event, refs.canvas);
            const transform = getResizeTransform(dragState, point);
            if (transform === null) {
                return;
            }

            applyElementTransform(
                'resize',
                [dragState.elementName, dragState.handle, Math.round(point.x), Math.round(point.y)],
                dragState.editorId,
                transform
            );
            return;
        }

        if (dragState.mode === 'rotate-element') {
            const point = getSvgPoint(event, refs.canvas);
            const transform = getRotationTransform(dragState, point);
            if (transform === null) {
                return;
            }

            applyElementTransform(
                'rotate',
                [dragState.elementName, Math.round(point.x), Math.round(point.y)],
                dragState.editorId,
                transform
            );
            return;
        }

        if (dragState.mode === 'move-vertex') {
            const point = getSvgPoint(event, refs.canvas);
            const localPoint = toLocalPoint(point, dragState.inverseMatrix);
            if (!localPoint || !Number.isFinite(localPoint.x) || !Number.isFinite(localPoint.y)) {
                return;
            }

            store.moveElementPoint(
                'move-vertex',
                [dragState.elementName, dragState.index, Math.round(localPoint.x), Math.round(localPoint.y)],
                dragState.editorId,
                dragState.index,
                localPoint.x,
                localPoint.y
            );
            return;
        }

        const point = getSvgPoint(event, refs.canvas);
        if (dragState.transformDrag) {
            const transform = getTranslateTransform(dragState, point);
            if (transform !== null) {
                applyElementTransform('drag', formatPointArgs(dragState.elementName, point.x, point.y), dragState.editorId, transform);
            }
            return;
        }

        const deltaX = point.x - dragState.previous.x;
        const deltaY = point.y - dragState.previous.y;
        if (deltaX === 0 && deltaY === 0) {
            return;
        }

        if (dragState.mode === 'move-selection') {
            if (dragState.selectionTransformDrags?.length) {
                const updates = dragState.selectionTransformDrags
                    .map((entry) => ({
                        editorId: entry.editorId,
                        transform: getTranslateTransform({ transformDrag: entry.transformDrag }, point)
                    }))
                    .filter((entry) => entry.transform !== null);
                applyMultipleElementTransforms(
                    'drag',
                    formatPointArgs(`${dragState.editorIds.length}-elements`, point.x, point.y),
                    updates
                );
            }

            if (dragState.plainSelectionIds?.length) {
                store.moveSelectedElements(
                    'drag',
                    formatPointArgs(`${dragState.plainSelectionIds.length}-elements`, point.x, point.y),
                    dragState.plainSelectionIds,
                    deltaX,
                    deltaY
                );
            }

            dragState.previous = point;
            return;
        }

        store.moveElement('drag', formatPointArgs(dragState.elementName, point.x, point.y), dragState.editorId, deltaX, deltaY);
        dragState.previous = point;
    };

    refs.canvasStage.addEventListener('wheel', (event) => {
        event.preventDefault();

        const previousZoom = zoom;
        const nextZoom = previousZoom * Math.exp(-event.deltaY * 0.0015);
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
        if (event.button !== 0) {
            return;
        }

        if (document.activeElement === refs.sourceInput) {
            refs.sourceInput.blur();
        }

        const point = getSvgPoint(event, refs.canvas);
        store.setLastPointerPosition?.(point);
        const target = event.target instanceof SVGElement
            ? resolveSelectableElement(event.target, refs.canvas)
            : null;
        const isModifierSelection = event.ctrlKey || event.metaKey;
        if (!target) {
            if (isModifierSelection) {
                dragState = {
                    mode: 'marquee-select',
                    pointerId: event.pointerId,
                    startPoint: point,
                    currentPoint: point,
                    initialSelection: getSelectedIds(store.getState())
                };
                setStageMode('marquee');
                renderMarqueeOverlay(getMarqueeBounds(point, point));
            } else {
                applySelection([]);
                dragState = {
                    mode: 'pan',
                    pointerId: event.pointerId,
                    startClientX: event.clientX,
                    startClientY: event.clientY,
                    startPanX: panX,
                    startPanY: panY
                };
            }
            refs.canvasStage.setPointerCapture(event.pointerId);
            return;
        }

        const editorId = target.getAttribute('data-editor-id');
        const selectedIds = getSelectedIds(store.getState());
        const targetAlreadySelected = editorId ? selectedIds.includes(editorId) : false;

        if (isModifierSelection && editorId) {
            store.selectElement(editorId, { additive: true, toggle: true });
            dragState = null;
            return;
        }

        const transformDrag = target.hasAttribute('transform')
            ? createTransformDragState(target, point)
            : null;
        const dragSelectionIds = targetAlreadySelected && selectedIds.length > 1
            ? selectedIds
            : editorId
                ? [editorId]
                : [];
        const { plainSelectionIds, selectionTransformDrags } = dragSelectionIds.length > 1
            ? partitionSelectionDragTargets(refs.canvas, dragSelectionIds, point)
            : { plainSelectionIds: [], selectionTransformDrags: [] };
        applySelection(dragSelectionIds);
        dragState = {
            mode: dragSelectionIds.length > 1 ? 'move-selection' : 'move-element',
            editorId,
            editorIds: dragSelectionIds,
            elementName: getElementLabel(target),
            pointerId: event.pointerId,
            previous: point,
            plainSelectionIds,
            selectionTransformDrags,
            transformDrag: dragSelectionIds.length === 1 ? transformDrag : null
        };
        refs.canvas.setPointerCapture(event.pointerId);
    });

    refs.canvasStage.addEventListener('pointermove', updateHoverCoordinates);
    refs.canvasStage.addEventListener('pointermove', handleDragMove);
    refs.canvasStage.addEventListener('contextmenu', (event) => event.preventDefault());

    const endDrag = (event) => {
        if (!dragState || dragState.pointerId !== event.pointerId) {
            return;
        }

        if (dragState.mode === 'pan' && refs.canvasStage.hasPointerCapture(event.pointerId)) {
            refs.canvasStage.releasePointerCapture(event.pointerId);
        }

        if (dragState.mode === 'marquee-select') {
            const bounds = getMarqueeBounds(dragState.startPoint, dragState.currentPoint ?? dragState.startPoint);
            applySelection([
                ...dragState.initialSelection,
                ...getElementsInMarquee(bounds)
            ]);
            clearMarqueeOverlay();
            setStageMode();
            if (refs.canvasStage.hasPointerCapture(event.pointerId)) {
                refs.canvasStage.releasePointerCapture(event.pointerId);
            }
        }

        if ((dragState.mode === 'move-element' || dragState.mode === 'move-selection') && refs.canvas.hasPointerCapture(event.pointerId)) {
            refs.canvas.releasePointerCapture(event.pointerId);
        }

        if (dragState.mode === 'move-vertex' && refs.canvas.hasPointerCapture(event.pointerId)) {
            refs.canvas.releasePointerCapture(event.pointerId);
        }

        if (dragState.mode === 'resize-element' && refs.canvas.hasPointerCapture(event.pointerId)) {
            refs.canvas.releasePointerCapture(event.pointerId);
        }

        if (dragState.mode === 'rotate-element' && refs.canvas.hasPointerCapture(event.pointerId)) {
            refs.canvas.releasePointerCapture(event.pointerId);
        }

        refs.canvasStage.style.cursor = '';
        setStageMode();
        dragState = null;
    };

    refs.canvas.addEventListener('pointerup', endDrag);
    refs.canvas.addEventListener('pointercancel', endDrag);
    refs.canvasStage.addEventListener('pointerup', endDrag);
    refs.canvasStage.addEventListener('pointercancel', endDrag);
    refs.canvasStage.addEventListener('pointerleave', () => status?.clearCanvasCoordinates?.());

    return {
        render(state) {
            renderSvg(refs.canvas, state, zoom, {
                beginRotateDrag,
                beginResizeDrag,
                beginVertexDrag,
                insertVertexAtHandle,
                removeVertexFromHandle
            });
            initializeViewportIfNeeded(refs, state, zoom, viewportInitialized, (nextPanX, nextPanY) => {
                panX = nextPanX;
                panY = nextPanY;
                viewportInitialized = true;
            });
            applyCanvasViewport(refs, state, zoom, panX, panY);
        }
    };
}

function renderSvg(canvas, state, zoom, overlayHandlers) {
    syncSvgRoot(canvas, state.svgRoot);
    const selectedIds = getSelectedIds(state);
    const selectedElements = selectedIds
        .map((editorId) => findElementByEditorId(canvas, editorId))
        .filter(Boolean);
    if (selectedElements.length === 0) {
        return;
    }

    if (selectedElements.length === 1) {
        renderSelectionOverlay(canvas, selectedElements[0], selectedIds[0], zoom, overlayHandlers);
        return;
    }

    selectedElements.forEach((selected) => {
        renderSelectionOutline(canvas, selected);
    });
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

function renderSelectionOverlay(canvas, selected, editorId, zoom, overlayHandlers) {
    try {
        const box = getTransformedBox(selected);
        if (!Number.isFinite(box.x) || !Number.isFinite(box.y) || box.width < 0 || box.height < 0) {
            return;
        }

        const overlay = document.createElementNS(canvas.namespaceURI, 'g');
        overlay.classList.add('selection-overlay');
        overlay.setAttribute('pointer-events', 'none');

        const outline = createSelectionOutlineNode(canvas, box);
        overlay.appendChild(outline);

        const handleSize = 12 / Math.max(zoom, 0.001);
        HANDLE_DIRECTIONS.forEach((handle) => {
            overlay.appendChild(createResizeHandle(canvas, box, handle, editorId, handleSize, overlayHandlers.beginResizeDrag));
        });
        ROTATION_DIRECTIONS.forEach((handle) => {
            overlay.appendChild(createRotationHandle(canvas, box, handle, handleSize, editorId, overlayHandlers.beginRotateDrag));
        });

        canvas.appendChild(overlay);

        if (isPointEditableElement(selected)) {
            try {
                renderPointEditingOverlay(
                    canvas,
                    overlay,
                    selected,
                    editorId,
                    handleSize,
                    overlayHandlers.beginVertexDrag,
                    overlayHandlers.insertVertexAtHandle,
                    overlayHandlers.removeVertexFromHandle
                );
            } catch (error) {
                void error;
            }
        }
    } catch (error) {
        void error;
    }
}

function renderSelectionOutline(canvas, selected) {
    try {
        const box = getTransformedBox(selected);
        if (!Number.isFinite(box.x) || !Number.isFinite(box.y) || box.width < 0 || box.height < 0) {
            return;
        }

        const overlay = document.createElementNS(canvas.namespaceURI, 'g');
        overlay.classList.add('selection-overlay');
        overlay.setAttribute('pointer-events', 'none');
        overlay.appendChild(createSelectionOutlineNode(canvas, box));
        canvas.appendChild(overlay);
    } catch (error) {
        void error;
    }
}

function createSelectionOutlineNode(canvas, box) {
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
    return outline;
}

function getTransformedBox(element) {
    const tag = element.tagName.toLowerCase();
    if (tag === 'polygon' || tag === 'polyline') {
        return getPointElementBox(element);
    }

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

function getPointElementBox(element) {
    const matrix = element.getCTM();
    const points = parsePointList(element);
    if (points.length === 0) {
        return element.getBBox();
    }

    const transformedPoints = matrix
        ? points.map((point) => new DOMPoint(point.x, point.y).matrixTransform(matrix))
        : points;
    const xs = transformedPoints.map((point) => point.x);
    const ys = transformedPoints.map((point) => point.y);
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

function createResizeHandle(canvas, box, handle, editorId, size, beginResizeDrag) {
    const point = getHandlePoint(box, handle);
    const handleNode = document.createElementNS(canvas.namespaceURI, 'rect');
    handleNode.setAttribute('x', String(point.x - (size / 2)));
    handleNode.setAttribute('y', String(point.y - (size / 2)));
    handleNode.setAttribute('width', String(size));
    handleNode.setAttribute('height', String(size));
    handleNode.setAttribute('fill', '#fffdf8');
    handleNode.setAttribute('stroke', '#2d7ff9');
    handleNode.setAttribute('stroke-width', '1.5');
    handleNode.setAttribute('vector-effect', 'non-scaling-stroke');
    handleNode.setAttribute('pointer-events', 'all');
    handleNode.setAttribute('data-resize-handle', handle);
    handleNode.setAttribute('data-resize-editor-id', editorId);
    handleNode.style.cursor = HANDLE_CURSORS[handle];
    handleNode.addEventListener('pointerdown', (event) => beginResizeDrag(event, handleNode));
    return handleNode;
}

function createRotationHandle(canvas, box, handle, size, editorId, beginRotateDrag) {
    const hitSize = Math.max(size, 12);
    const point = getRotationHandlePoint(box, handle, Math.max(size * 1.8, 18));
    const handleNode = document.createElementNS(canvas.namespaceURI, 'rect');
    handleNode.setAttribute('x', String(point.x - (hitSize / 2)));
    handleNode.setAttribute('y', String(point.y - (hitSize / 2)));
    handleNode.setAttribute('width', String(hitSize));
    handleNode.setAttribute('height', String(hitSize));
    handleNode.setAttribute('fill', '#ffffff');
    handleNode.setAttribute('fill-opacity', '0.001');
    handleNode.setAttribute('stroke', 'none');
    handleNode.setAttribute('pointer-events', 'all');
    handleNode.setAttribute('data-rotate-editor-id', editorId);
    handleNode.setAttribute('data-rotate-handle', handle);
    handleNode.style.cursor = ROTATE_CURSOR;
    handleNode.addEventListener('pointerdown', (event) => beginRotateDrag(event, handleNode));
    return handleNode;
}

function renderPointEditingOverlay(canvas, overlay, element, editorId, handleSize, beginVertexDrag, insertVertexAtHandle, removeVertexFromHandle) {
    const localPoints = parsePointList(element);
    const matrix = element.getCTM();
    if (!matrix || localPoints.length === 0) {
        return;
    }

    const worldPoints = localPoints.map((point) => new DOMPoint(point.x, point.y).matrixTransform(matrix));
    const edgeSize = Math.max(handleSize * 0.66, 8);
    const isClosed = element.tagName.toLowerCase() === 'polygon';
    const edgeCount = isClosed ? worldPoints.length : Math.max(0, worldPoints.length - 1);

    for (let index = 0; index < edgeCount; index += 1) {
        const nextIndex = (index + 1) % worldPoints.length;
        const localMidpoint = {
            x: (localPoints[index].x + localPoints[nextIndex].x) / 2,
            y: (localPoints[index].y + localPoints[nextIndex].y) / 2
        };
        const worldMidpoint = {
            x: (worldPoints[index].x + worldPoints[nextIndex].x) / 2,
            y: (worldPoints[index].y + worldPoints[nextIndex].y) / 2
        };
        overlay.appendChild(
            createEdgeInsertHandle(canvas, worldMidpoint, localMidpoint, editorId, index + 1, edgeSize, insertVertexAtHandle)
        );
    }

    worldPoints.forEach((point, index) => {
        overlay.appendChild(
            createVertexHandle(canvas, point, localPoints[index], editorId, index, handleSize, beginVertexDrag, removeVertexFromHandle)
        );
    });
}

function createVertexHandle(canvas, worldPoint, localPoint, editorId, index, size, beginVertexDrag, removeVertexFromHandle) {
    const handleNode = document.createElementNS(canvas.namespaceURI, 'circle');
    handleNode.setAttribute('cx', String(worldPoint.x));
    handleNode.setAttribute('cy', String(worldPoint.y));
    handleNode.setAttribute('r', String(size / 2));
    handleNode.setAttribute('fill', '#fffdf8');
    handleNode.setAttribute('stroke', '#d9663d');
    handleNode.setAttribute('stroke-width', '1.5');
    handleNode.setAttribute('vector-effect', 'non-scaling-stroke');
    handleNode.setAttribute('pointer-events', 'all');
    handleNode.setAttribute('data-vertex-editor-id', editorId);
    handleNode.setAttribute('data-vertex-index', String(index));
    handleNode.setAttribute('data-vertex-local-x', String(localPoint.x));
    handleNode.setAttribute('data-vertex-local-y', String(localPoint.y));
    handleNode.style.cursor = 'move';
    handleNode.addEventListener('pointerdown', (event) => beginVertexDrag(event, handleNode));
    handleNode.addEventListener('dblclick', (event) => removeVertexFromHandle(event, handleNode));
    handleNode.addEventListener('contextmenu', (event) => removeVertexFromHandle(event, handleNode));
    return handleNode;
}

function createEdgeInsertHandle(canvas, worldPoint, localPoint, editorId, insertIndex, size, insertVertexAtHandle) {
    const handleNode = document.createElementNS(canvas.namespaceURI, 'rect');
    handleNode.setAttribute('x', String(worldPoint.x - (size / 2)));
    handleNode.setAttribute('y', String(worldPoint.y - (size / 2)));
    handleNode.setAttribute('width', String(size));
    handleNode.setAttribute('height', String(size));
    handleNode.setAttribute('fill', '#5f8ef2');
    handleNode.setAttribute('stroke', '#fffdf8');
    handleNode.setAttribute('stroke-width', '1.5');
    handleNode.setAttribute('vector-effect', 'non-scaling-stroke');
    handleNode.setAttribute('transform', `rotate(45 ${worldPoint.x} ${worldPoint.y})`);
    handleNode.setAttribute('pointer-events', 'all');
    handleNode.setAttribute('data-edge-editor-id', editorId);
    handleNode.setAttribute('data-edge-insert-index', String(insertIndex));
    handleNode.setAttribute('data-edge-local-x', String(localPoint.x));
    handleNode.setAttribute('data-edge-local-y', String(localPoint.y));
    handleNode.style.cursor = 'copy';
    handleNode.addEventListener('pointerdown', (event) => insertVertexAtHandle(event, handleNode));
    return handleNode;
}

function isPointEditableElement(element) {
    const tag = element.tagName.toLowerCase();
    return tag === 'polygon' || tag === 'polyline';
}

function getHandlePoint(box, handle) {
    const centerX = box.x + (box.width / 2);
    const centerY = box.y + (box.height / 2);

    return {
        x: handle.includes('w') ? box.x : handle.includes('e') ? box.x + box.width : centerX,
        y: handle.includes('n') ? box.y : handle.includes('s') ? box.y + box.height : centerY
    };
}

function getResizeAnchor(box, handle) {
    return {
        x: handle.includes('w') ? box.x + box.width : handle.includes('e') ? box.x : box.x + (box.width / 2),
        y: handle.includes('n') ? box.y + box.height : handle.includes('s') ? box.y : box.y + (box.height / 2)
    };
}

function getMovingPoint(box, handle) {
    return getHandlePoint(box, handle);
}

function getRotationHandlePoint(box, handle, distance) {
    const point = getHandlePoint(box, handle);
    const centerX = box.x + (box.width / 2);
    const centerY = box.y + (box.height / 2);
    const deltaX = point.x - centerX;
    const deltaY = point.y - centerY;
    const length = Math.hypot(deltaX, deltaY) || 1;

    return {
        x: point.x + ((deltaX / length) * distance),
        y: point.y + ((deltaY / length) * distance)
    };
}

function getResizeTransform(dragState, point) {
    const scaleX = getAxisScale(point.x, dragState.anchor.x, dragState.movingPoint.x, hasHorizontalResize(dragState.handle));
    const scaleY = getAxisScale(point.y, dragState.anchor.y, dragState.movingPoint.y, hasVerticalResize(dragState.handle));
    if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY)) {
        return null;
    }

    if ((hasHorizontalResize(dragState.handle) && Math.abs(scaleX) < 0.0001)
        || (hasVerticalResize(dragState.handle) && Math.abs(scaleY) < 0.0001)) {
        return null;
    }

    if (approximatelyEqual(scaleX, 1) && approximatelyEqual(scaleY, 1)) {
        return dragState.originalTransform;
    }

    const worldTransform = new DOMMatrix()
        .translateSelf(dragState.anchor.x, dragState.anchor.y)
        .scaleSelf(scaleX, scaleY)
        .translateSelf(-dragState.anchor.x, -dragState.anchor.y);
    const nextMatrix = dragState.parentMatrix.inverse().multiply(worldTransform).multiply(dragState.currentMatrix);
    return toTransformMatrix(nextMatrix);
}

function getRotationTransform(dragState, point) {
    const angle = Math.atan2(point.y - dragState.center.y, point.x - dragState.center.x);
    if (!Number.isFinite(angle)) {
        return null;
    }

    const deltaDegrees = ((angle - dragState.startAngle) * 180) / Math.PI;
    if (approximatelyEqual(deltaDegrees, 0)) {
        return dragState.originalTransform;
    }

    const worldTransform = new DOMMatrix()
        .translateSelf(dragState.center.x, dragState.center.y)
        .rotateSelf(deltaDegrees)
        .translateSelf(-dragState.center.x, -dragState.center.y);
    const nextMatrix = dragState.parentMatrix.inverse().multiply(worldTransform).multiply(dragState.currentMatrix);
    return toTransformMatrix(nextMatrix);
}

function getTranslateTransform(dragState, point) {
    const deltaX = point.x - dragState.transformDrag.startPoint.x;
    const deltaY = point.y - dragState.transformDrag.startPoint.y;
    if (approximatelyEqual(deltaX, 0) && approximatelyEqual(deltaY, 0)) {
        return dragState.transformDrag.originalTransform;
    }

    const worldTransform = new DOMMatrix().translateSelf(deltaX, deltaY);
    const nextMatrix = dragState.transformDrag.parentMatrix
        .inverse()
        .multiply(worldTransform)
        .multiply(dragState.transformDrag.currentMatrix);
    return toTransformMatrix(nextMatrix);
}

function getAxisScale(pointerValue, anchorValue, movingValue, isActive) {
    if (!isActive) {
        return 1;
    }

    const initialDelta = movingValue - anchorValue;
    if (Math.abs(initialDelta) < 0.0001) {
        return 1;
    }

    return (pointerValue - anchorValue) / initialDelta;
}

function hasHorizontalResize(handle) {
    return handle.includes('e') || handle.includes('w');
}

function hasVerticalResize(handle) {
    return handle.includes('n') || handle.includes('s');
}

function approximatelyEqual(left, right) {
    return Math.abs(left - right) < 0.000001;
}

function getParentMatrix(element) {
    if (!(element.parentNode instanceof SVGGraphicsElement)) {
        return new DOMMatrix();
    }

    return toDomMatrix(element.parentNode.getCTM());
}

function createTransformDragState(element, startPoint) {
    const currentMatrix = toDomMatrix(element.getCTM());
    const parentMatrix = getParentMatrix(element);
    if (!currentMatrix || !parentMatrix) {
        return null;
    }

    return {
        startPoint,
        currentMatrix,
        parentMatrix,
        originalTransform: element.getAttribute('transform') ?? ''
    };
}

function partitionSelectionDragTargets(canvas, editorIds, startPoint) {
    const selectionTransformDrags = editorIds
        .map((editorId) => {
            const element = findElementByEditorId(canvas, editorId);
            if (!element?.hasAttribute('transform')) {
                return null;
            }

            const transformDrag = createTransformDragState(element, startPoint);
            if (!transformDrag) {
                return null;
            }

            return { editorId, transformDrag };
        })
        .filter(Boolean);
    const transformedIds = new Set(selectionTransformDrags.map((entry) => entry.editorId));

    return {
        plainSelectionIds: editorIds.filter((editorId) => !transformedIds.has(editorId)),
        selectionTransformDrags
    };
}

function toDomMatrix(matrix) {
    if (!matrix) {
        return null;
    }

    return new DOMMatrix([matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f]);
}

function invertMatrix(matrix) {
    if (!matrix) {
        return null;
    }

    try {
        const inverse = matrix.inverse();
        return [inverse.a, inverse.b, inverse.c, inverse.d, inverse.e, inverse.f].every(Number.isFinite)
            ? inverse
            : null;
    } catch (error) {
        void error;
        return null;
    }
}

function toTransformMatrix(matrix) {
    const values = [matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f]
        .map((value) => (Math.abs(value) < 0.0000001 ? 0 : Number(value.toFixed(6))));
    return `matrix(${values.join(' ')})`;
}

function toLocalPoint(point, inverseMatrix) {
    if (!inverseMatrix) {
        return null;
    }

    const localPoint = new DOMPoint(point.x, point.y).matrixTransform(inverseMatrix);
    if (!Number.isFinite(localPoint.x) || !Number.isFinite(localPoint.y)) {
        return null;
    }

    return localPoint;
}

function boxesIntersect(left, right) {
    return Number.isFinite(left?.x)
        && Number.isFinite(left?.y)
        && Number.isFinite(left?.width)
        && Number.isFinite(left?.height)
        && Number.isFinite(right?.x)
        && Number.isFinite(right?.y)
        && Number.isFinite(right?.width)
        && Number.isFinite(right?.height)
        && left.x <= right.x + right.width
        && left.x + left.width >= right.x
        && left.y <= right.y + right.height
        && left.y + left.height >= right.y;
}

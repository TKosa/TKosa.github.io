import {
    assignEditorIds,
    cloneSvgRoot,
    computeNextElementId,
    createBaseSvgRoot,
    createDefaultSvg,
    createShapeElement,
    findElementByEditorId,
    getFirstSelectableEditorId
} from '../svg/document-dom.js';
import {
    insertPoint,
    movePoint,
    nudgeElement,
    refreshElementIds,
    removePoint,
    sanitizeClipboardElement,
    setElementTransform,
    translateElement
} from '../svg/element-operations.js';
import { parseSvgString } from '../svg/parser.js';
import { serializeSvg } from '../svg/serializer.js';

const HISTORY_DEBOUNCE_MS = 250;
const HISTORY_LIMIT = 100;

export function createStore() {
    let state = createInitialState();
    const listeners = new Set();
    let clipboardSnapshot = null;
    let lastPointerPosition = null;
    const history = {
        present: createHistoryEntry(state),
        undoStack: [],
        redoStack: [],
        timerId: null
    };

    function notify() {
        listeners.forEach((listener) => listener(state));
    }

    function setState(nextState) {
        state = nextState;
        notify();
    }

    function formatActionArgs(actionArgs = []) {
        return actionArgs
            .filter((value) => value !== null && value !== undefined && value !== '')
            .map((value) => String(value).trim())
            .filter(Boolean);
    }

    function createAction(actionName, actionArgs = []) {
        if (typeof actionName !== 'string' || actionName.trim() === '') {
            throw new Error('SVG mutations that record history require a non-empty action name.');
        }

        return {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name: actionName.trim(),
            args: formatActionArgs(actionArgs)
        };
    }

    function resolveSelection(selection) {
        if (Array.isArray(selection)) {
            return normalizeSelection(selection, state.svgRoot);
        }

        if (selection instanceof Element) {
            return normalizeSelection([selection.getAttribute('data-editor-id')], state.svgRoot);
        }

        return normalizeSelection(selection ? [selection] : [], state.svgRoot);
    }

    function createHistoryEntry(snapshotState = state) {
        return {
            svgRoot: cloneSvgRoot(snapshotState.svgRoot),
            selectedId: snapshotState.selectedId,
            selectedIds: [...(snapshotState.selectedIds ?? [])]
        };
    }

    function recordAction(actionName, actionArgs = []) {
        setState({
            ...state,
            lastAction: createAction(actionName, actionArgs)
        });
    }

    function clearHistoryTimer() {
        if (history.timerId !== null) {
            window.clearTimeout(history.timerId);
            history.timerId = null;
        }
    }

    function hasPendingHistoryChanges() {
        return !history.present.svgRoot.isEqualNode(state.svgRoot);
    }

    function pushHistoryEntry(stack, entry) {
        stack.push(entry);
        if (stack.length > HISTORY_LIMIT) {
            stack.shift();
        }
    }

    function commitPendingHistory() {
        clearHistoryTimer();
        if (!hasPendingHistoryChanges()) {
            return false;
        }

        pushHistoryEntry(history.undoStack, history.present);
        history.present = createHistoryEntry();
        return true;
    }

    function scheduleHistoryCommit() {
        clearHistoryTimer();
        history.timerId = window.setTimeout(() => {
            history.timerId = null;
            commitPendingHistory();
        }, HISTORY_DEBOUNCE_MS);
    }

    function restoreHistoryEntry(entry) {
        commitSvg(cloneSvgRoot(entry.svgRoot), entry.selectedIds ?? entry.selectedId, { recordHistory: false });
    }

    function commitSvg(svgRoot, selection = state.selectedIds, options = {}) {
        const { recordHistory = true, actionName = null, actionArgs = [] } = options;
        assignEditorIds(svgRoot);
        const resolvedSelection = normalizeSelection(selection, svgRoot);
        const svgChanged = !state.svgRoot.isEqualNode(svgRoot);
        const action = recordHistory && svgChanged
            ? createAction(actionName, actionArgs)
            : state.lastAction;

        if (recordHistory && svgChanged) {
            history.redoStack = [];
        }

        setState({
            ...state,
            svgRoot,
            selectedId: resolvedSelection.selectedId,
            selectedIds: resolvedSelection.selectedIds,
            nextElementId: computeNextElementId(svgRoot),
            lastAction: action
        });

        if (recordHistory && svgChanged) {
            scheduleHistoryCommit();
        }
    }

    function updateSvg(actionName, actionArgs, mutator, selection = state.selectedIds) {
        const svgRoot = cloneSvgRoot(state.svgRoot);
        mutator(svgRoot);
        commitSvg(svgRoot, selection, { actionName, actionArgs });
    }

    return {
        getState() {
            return state;
        },
        subscribe(listener) {
            listeners.add(listener);
            listener(state);
            return () => listeners.delete(listener);
        },
        setLastPointerPosition(point) {
            if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
                lastPointerPosition = null;
                return;
            }

            lastPointerPosition = {
                x: point.x,
                y: point.y
            };
        },
        setSelection(selection) {
            const resolvedSelection = normalizeSelection(selection, state.svgRoot);
            setState({
                ...state,
                selectedId: resolvedSelection.selectedId,
                selectedIds: resolvedSelection.selectedIds
            });
        },
        selectElement(editorId, options = {}) {
            const { additive = false, toggle = false } = options;
            if (!editorId) {
                this.setSelection([]);
                return;
            }

            if (!additive && !toggle) {
                this.setSelection([editorId]);
                return;
            }

            const nextSelection = [...state.selectedIds];
            const existingIndex = nextSelection.indexOf(editorId);
            if (existingIndex !== -1) {
                if (toggle) {
                    nextSelection.splice(existingIndex, 1);
                } else {
                    nextSelection.splice(existingIndex, 1);
                    nextSelection.push(editorId);
                }
            } else {
                nextSelection.push(editorId);
            }

            this.setSelection(nextSelection);
        },
        isElementSelected(editorId) {
            return state.selectedIds.includes(editorId);
        },
        importFromString(actionName, actionArgs, source) {
            commitSvg(parseSvgString(source), null, { actionName, actionArgs });
        },
        addElement(actionName, actionArgs, type) {
            const svgRoot = cloneSvgRoot(state.svgRoot);
            const element = createShapeElement(type);

            if (!element.hasAttribute('id')) {
                element.setAttribute('id', String(state.nextElementId));
            }

            const selected = findElementByEditorId(svgRoot, state.selectedId);
            const parent = selected && selected.tagName.toLowerCase() === 'g' ? selected : svgRoot;
            parent.appendChild(element);
            commitSvg(svgRoot, element, { actionName, actionArgs });
        },
        deleteSelectedElement(actionName, actionArgs) {
            if (state.selectedIds.length === 0) {
                return false;
            }

            const svgRoot = cloneSvgRoot(state.svgRoot);
            const selectedElements = getElementsBySelection(svgRoot, state.selectedIds);
            if (selectedElements.length === 0) {
                return false;
            }

            selectedElements.forEach((selected) => selected.remove());
            commitSvg(svgRoot, null, { actionName, actionArgs });
            return true;
        },
        duplicateSelectedElement(actionName, actionArgs) {
            if (state.selectedIds.length === 0) {
                return false;
            }

            const clipboardData = createClipboardSnapshot(state.svgRoot, state.selectedIds, lastPointerPosition);
            if (!clipboardData) {
                return false;
            }
            return pasteClipboardSnapshot(clipboardData, {
                state,
                lastPointerPosition,
                actionName,
                actionArgs,
                commitSvg
            });
        },
        copySelectedElement(actionName, actionArgs) {
            if (state.selectedIds.length === 0) {
                clipboardSnapshot = null;
                return false;
            }

            clipboardSnapshot = createClipboardSnapshot(state.svgRoot, state.selectedIds, lastPointerPosition);
            if (!clipboardSnapshot) {
                clipboardSnapshot = null;
                return false;
            }
            recordAction(actionName, actionArgs);
            return true;
        },
        pasteClipboardElement(actionName, actionArgs) {
            if (!clipboardSnapshot) {
                return false;
            }

            const didPaste = pasteClipboardSnapshot(clipboardSnapshot, {
                state,
                lastPointerPosition,
                actionName,
                actionArgs,
                commitSvg,
                onSnapshotUpdated(nextSnapshot) {
                    clipboardSnapshot = nextSnapshot;
                }
            });
            return didPaste;
        },
        updateCanvasSize(actionName, actionArgs, width, height) {
            updateSvg(actionName, actionArgs, (svgRoot) => {
                svgRoot.setAttribute('width', String(width));
                svgRoot.setAttribute('height', String(height));
                svgRoot.setAttribute('viewBox', `0 0 ${width} ${height}`);
            });
        },
        updateElementAttribute(actionName, actionArgs, editorId, name, value) {
            updateSvg(actionName, actionArgs, (svgRoot) => {
                const element = findElementByEditorId(svgRoot, editorId);
                if (!element) {
                    return;
                }

                if (name === 'content') {
                    element.textContent = value;
                    return;
                }

                if (value === '') {
                    element.removeAttribute(name);
                } else {
                    element.setAttribute(name, value);
                }
            });
        },
        moveElement(actionName, actionArgs, editorId, deltaX, deltaY) {
            updateSvg(actionName, actionArgs, (svgRoot) => {
                const element = findElementByEditorId(svgRoot, editorId);
                if (!element) {
                    return;
                }

                translateElement(element, deltaX, deltaY);
            });
        },
        moveSelectedElements(actionName, actionArgs, editorIds, deltaX, deltaY) {
            updateSvg(actionName, actionArgs, (svgRoot) => {
                getElementsBySelection(svgRoot, editorIds).forEach((element) => {
                    translateElement(element, deltaX, deltaY);
                });
            }, editorIds);
        },
        setElementTransform(actionName, actionArgs, editorId, transform) {
            updateSvg(actionName, actionArgs, (svgRoot) => {
                const element = findElementByEditorId(svgRoot, editorId);
                if (!element) {
                    return;
                }

                setElementTransform(element, transform);
            });
        },
        moveElementPoint(actionName, actionArgs, editorId, index, x, y) {
            updateSvg(actionName, actionArgs, (svgRoot) => {
                const element = findElementByEditorId(svgRoot, editorId);
                if (!element) {
                    return;
                }

                movePoint(element, index, x, y);
            });
        },
        insertElementPoint(actionName, actionArgs, editorId, index, x, y) {
            updateSvg(actionName, actionArgs, (svgRoot) => {
                const element = findElementByEditorId(svgRoot, editorId);
                if (!element) {
                    return;
                }

                insertPoint(element, index, x, y);
            });
        },
        removeElementPoint(actionName, actionArgs, editorId, index) {
            let didRemove = false;
            updateSvg(actionName, actionArgs, (svgRoot) => {
                const element = findElementByEditorId(svgRoot, editorId);
                if (!element) {
                    return;
                }

                didRemove = removePoint(element, index);
            });
            return didRemove;
        },
        clear(actionName, actionArgs) {
            commitSvg(createBaseSvgRoot(), null, { actionName, actionArgs });
        },
        serialize() {
            return serializeSvg(state.svgRoot);
        },
        undo() {
            clearHistoryTimer();

            if (hasPendingHistoryChanges()) {
                pushHistoryEntry(history.redoStack, createHistoryEntry());
                restoreHistoryEntry(history.present);
                return true;
            }

            const previous = history.undoStack.pop();
            if (!previous) {
                return false;
            }

            pushHistoryEntry(history.redoStack, createHistoryEntry());
            history.present = previous;
            restoreHistoryEntry(previous);
            return true;
        },
        redo() {
            clearHistoryTimer();
            if (hasPendingHistoryChanges()) {
                return false;
            }

            const next = history.redoStack.pop();
            if (!next) {
                return false;
            }

            pushHistoryEntry(history.undoStack, history.present);
            history.present = next;
            restoreHistoryEntry(next);
            return true;
        },
        canUndo() {
            return hasPendingHistoryChanges() || history.undoStack.length > 0;
        },
        canRedo() {
            return !hasPendingHistoryChanges() && history.redoStack.length > 0;
        }
    };
}

function normalizeSelection(selection, svgRoot) {
    const selectionValues = Array.isArray(selection)
        ? selection
        : selection
            ? [selection]
            : [];

    const selectedIds = Array.from(new Set(
        selectionValues
            .map((value) => {
                if (value instanceof Element) {
                    return value.getAttribute('data-editor-id');
                }

                return typeof value === 'string' ? value : null;
            })
            .filter(Boolean)
            .filter((editorId) => findElementByEditorId(svgRoot, editorId))
    ));
    const topLevelSelection = selectedIds.filter((editorId) => {
        const element = findElementByEditorId(svgRoot, editorId);
        let current = element?.parentElement;
        while (current) {
            const currentId = current.getAttribute?.('data-editor-id');
            if (currentId && selectedIds.includes(currentId)) {
                return false;
            }

            current = current.parentElement;
        }

        return true;
    });

    return {
        selectedId: topLevelSelection.at(-1) ?? null,
        selectedIds: topLevelSelection
    };
}

function getElementsBySelection(svgRoot, editorIds) {
    return (editorIds ?? [])
        .map((editorId) => findElementByEditorId(svgRoot, editorId))
        .filter(Boolean);
}

function createClipboardSnapshot(svgRoot, editorIds, pointerPositionAtCopy) {
    const measuredRoot = cloneSvgRoot(svgRoot);
    const selectedElements = getElementsBySelection(measuredRoot, editorIds);
    if (selectedElements.length === 0) {
        return null;
    }

    const selectionBounds = measureSelectionBounds(measuredRoot, selectedElements);
    const pointer = clonePoint(pointerPositionAtCopy);

    return {
        items: selectedElements.map((element) => {
            const box = measureElementBox(measuredRoot, element);
            const center = box
                ? { x: box.x + (box.width / 2), y: box.y + (box.height / 2) }
                : getElementOrigin(element);
            return {
                element: sanitizeClipboardElement(element.cloneNode(true)),
                centerOffsetFromPointer: pointer && center
                    ? { x: center.x - pointer.x, y: center.y - pointer.y }
                    : null
            };
        }),
        anchor: selectionBounds
            ? { x: selectionBounds.x + selectionBounds.width, y: selectionBounds.y + selectionBounds.height }
            : null,
        pointerPositionAtCopy: pointer
    };
}

function pasteClipboardSnapshot(snapshot, context) {
    const { state, lastPointerPosition, actionName, actionArgs, commitSvg, onSnapshotUpdated = null } = context;
    const svgRoot = cloneSvgRoot(state.svgRoot);
    const clones = snapshot.items.map((item) => item.element.cloneNode(true));
    if (clones.length === 0) {
        return false;
    }

    let nextElementId = computeNextElementId(svgRoot);
    clones.forEach((clone) => {
        refreshElementIds(clone, nextElementId);
        nextElementId = computeNextElementId(clone);
    });
    insertClipboardClones(svgRoot, findElementByEditorId(svgRoot, state.selectedId), clones);

    const shouldUsePointerPosition = shouldPasteAtPointer(lastPointerPosition, snapshot.pointerPositionAtCopy);
    if (shouldUsePointerPosition) {
        clones.forEach((clone, index) => {
            const centerOffset = snapshot.items[index]?.centerOffsetFromPointer;
            const anchor = centerOffset && lastPointerPosition
                ? {
                    x: lastPointerPosition.x + centerOffset.x,
                    y: lastPointerPosition.y + centerOffset.y
                }
                : lastPointerPosition;
            if (!alignElementCenterToAnchor(svgRoot, clone, anchor)) {
                nudgeElement(clone, 24, 24);
            }
        });
    } else {
        const selectionBounds = measureSelectionBounds(svgRoot, clones);
        const didAlign = snapshot.anchor && selectionBounds
            ? alignSelectionTopLeftToAnchor(svgRoot, clones, snapshot.anchor, selectionBounds)
            : false;
        if (!didAlign) {
            clones.forEach((clone) => nudgeElement(clone, 24, 24));
        }
    }

    assignEditorIds(svgRoot);
    const nextSnapshot = createClipboardSnapshot(svgRoot, clones.map((clone) => clone.getAttribute('data-editor-id')), lastPointerPosition)
        ?? snapshot;
    onSnapshotUpdated?.(nextSnapshot);
    commitSvg(svgRoot, clones, { actionName, actionArgs });
    return true;
}

function insertClipboardClones(svgRoot, target, clones) {
    if (!target || target === svgRoot) {
        svgRoot.append(...clones);
        return;
    }

    if (target.tagName.toLowerCase() === 'g') {
        target.append(...clones);
        return;
    }

    const parent = target.parentNode;
    const referenceNode = target.nextSibling;
    clones.forEach((clone) => parent?.insertBefore(clone, referenceNode));
}

function alignSelectionTopLeftToAnchor(svgRoot, elements, anchor, selectionBounds = null) {
    const bounds = selectionBounds ?? measureSelectionBounds(svgRoot, elements);
    if (!bounds || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) {
        return false;
    }

    elements.forEach((element) => {
        const localDelta = toParentLocalDelta(element, anchor.x - bounds.x, anchor.y - bounds.y);
        translateElement(element, localDelta.x, localDelta.y);
    });
    return true;
}

function measureSelectionBounds(svgRoot, elements) {
    const boxes = elements
        .map((element) => measureElementBox(svgRoot, element))
        .filter(Boolean);
    if (boxes.length === 0) {
        return null;
    }

    const minX = Math.min(...boxes.map((box) => box.x));
    const minY = Math.min(...boxes.map((box) => box.y));
    const maxX = Math.max(...boxes.map((box) => box.x + box.width));
    const maxY = Math.max(...boxes.map((box) => box.y + box.height));
    return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY
    };
}

function getClipboardAnchor(svgRoot, editorId) {
    const measuredRoot = cloneSvgRoot(svgRoot);
    const selected = findElementByEditorId(measuredRoot, editorId);
    return selected
        ? getElementBottomRight(measuredRoot, selected) ?? getElementOrigin(selected)
        : null;
}

function alignElementTopLeftToAnchor(svgRoot, element, anchor) {
    const box = measureElementBox(svgRoot, element);
    if (!box || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) {
        return false;
    }

    const localDelta = toParentLocalDelta(element, anchor.x - box.x, anchor.y - box.y);
    translateElement(element, localDelta.x, localDelta.y);
    return true;
}

function alignElementCenterToAnchor(svgRoot, element, anchor) {
    const box = measureElementBox(svgRoot, element);
    if (!box || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y)) {
        return false;
    }

    const centerX = box.x + (box.width / 2);
    const centerY = box.y + (box.height / 2);
    const localDelta = toParentLocalDelta(element, anchor.x - centerX, anchor.y - centerY);
    translateElement(element, localDelta.x, localDelta.y);
    return true;
}

function getElementBottomRight(svgRoot, element) {
    const box = measureElementBox(svgRoot, element);
    if (!box) {
        return null;
    }

    return {
        x: box.x + box.width,
        y: box.y + box.height
    };
}

function measureElementBox(svgRoot, element) {
    if (!(svgRoot instanceof SVGSVGElement) || !(element instanceof SVGGraphicsElement)) {
        return null;
    }

    const host = document.createElement('div');
    host.style.position = 'absolute';
    host.style.left = '-100000px';
    host.style.top = '-100000px';
    host.style.visibility = 'hidden';
    host.style.pointerEvents = 'none';
    document.body.appendChild(host);
    host.appendChild(svgRoot);

    try {
        const tag = element.tagName.toLowerCase();
        const box = element.getBBox();
        if (tag === 'polygon' || tag === 'polyline' || tag === 'line' || element.hasAttribute('transform')) {
            const matrix = element.getCTM();
            if (matrix) {
                const corners = [
                    new DOMPoint(box.x, box.y),
                    new DOMPoint(box.x + box.width, box.y),
                    new DOMPoint(box.x, box.y + box.height),
                    new DOMPoint(box.x + box.width, box.y + box.height)
                ].map((point) => point.matrixTransform(matrix));
                const xs = corners.map((point) => point.x);
                const ys = corners.map((point) => point.y);
                return {
                    x: Math.min(...xs),
                    y: Math.min(...ys),
                    width: Math.max(...xs) - Math.min(...xs),
                    height: Math.max(...ys) - Math.min(...ys)
                };
            }
        }

        return box;
    } catch (error) {
        void error;
        return null;
    } finally {
        host.remove();
    }
}

function getElementOrigin(element) {
    const tag = element.tagName.toLowerCase();

    if (tag === 'rect' || tag === 'text') {
        return {
            x: Number.parseFloat(element.getAttribute('x') ?? '0'),
            y: Number.parseFloat(element.getAttribute('y') ?? '0')
        };
    }

    if (tag === 'circle') {
        const cx = Number.parseFloat(element.getAttribute('cx') ?? '0');
        const cy = Number.parseFloat(element.getAttribute('cy') ?? '0');
        const r = Number.parseFloat(element.getAttribute('r') ?? '0');
        return { x: cx - r, y: cy - r };
    }

    if (tag === 'ellipse') {
        const cx = Number.parseFloat(element.getAttribute('cx') ?? '0');
        const cy = Number.parseFloat(element.getAttribute('cy') ?? '0');
        const rx = Number.parseFloat(element.getAttribute('rx') ?? '0');
        const ry = Number.parseFloat(element.getAttribute('ry') ?? '0');
        return { x: cx - rx, y: cy - ry };
    }

    if (tag === 'line') {
        const x1 = Number.parseFloat(element.getAttribute('x1') ?? '0');
        const y1 = Number.parseFloat(element.getAttribute('y1') ?? '0');
        const x2 = Number.parseFloat(element.getAttribute('x2') ?? '0');
        const y2 = Number.parseFloat(element.getAttribute('y2') ?? '0');
        return { x: Math.min(x1, x2), y: Math.min(y1, y2) };
    }

    return null;
}

function clonePoint(point) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        return null;
    }

    return {
        x: point.x,
        y: point.y
    };
}

function shouldPasteAtPointer(lastPoint, pointerPositionAtCopy) {
    return Boolean(
        lastPoint
        && Number.isFinite(lastPoint.x)
        && Number.isFinite(lastPoint.y)
        && (!pointerPositionAtCopy
            || lastPoint.x !== pointerPositionAtCopy.x
            || lastPoint.y !== pointerPositionAtCopy.y)
    );
}

function toParentLocalDelta(element, deltaX, deltaY) {
    const parent = element.parentNode;
    if (!(parent instanceof SVGGraphicsElement)) {
        return { x: deltaX, y: deltaY };
    }

    try {
        const matrix = parent.getCTM();
        if (!matrix) {
            return { x: deltaX, y: deltaY };
        }

        const inverse = new DOMMatrix([matrix.a, matrix.b, matrix.c, matrix.d, matrix.e, matrix.f]).inverse();
        const origin = new DOMPoint(0, 0).matrixTransform(inverse);
        const delta = new DOMPoint(deltaX, deltaY).matrixTransform(inverse);
        return {
            x: delta.x - origin.x,
            y: delta.y - origin.y
        };
    } catch (error) {
        void error;
        return { x: deltaX, y: deltaY };
    }
}

export function createInitialState() {
    const svgRoot = createDefaultSvg();
    assignEditorIds(svgRoot);
    const selectedId = getFirstSelectableEditorId(svgRoot);
    return {
        svgRoot,
        selectedId,
        selectedIds: selectedId ? [selectedId] : [],
        nextElementId: computeNextElementId(svgRoot),
        lastAction: null
    };
}

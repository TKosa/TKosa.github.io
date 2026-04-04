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
    insertClipboardClone,
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
        if (selection instanceof Element) {
            return selection.getAttribute('data-editor-id');
        }

        return selection ?? null;
    }

    function createHistoryEntry(snapshotState = state) {
        return {
            svgRoot: cloneSvgRoot(snapshotState.svgRoot),
            selectedId: snapshotState.selectedId
        };
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
        commitSvg(cloneSvgRoot(entry.svgRoot), entry.selectedId, { recordHistory: false });
    }

    function commitSvg(svgRoot, selection = state.selectedId, options = {}) {
        const { recordHistory = true, actionName = null, actionArgs = [] } = options;
        assignEditorIds(svgRoot);
        const resolvedSelection = resolveSelection(selection);
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
            selectedId: resolvedSelection,
            nextElementId: computeNextElementId(svgRoot),
            lastAction: action
        });

        if (recordHistory && svgChanged) {
            scheduleHistoryCommit();
        }
    }

    function updateSvg(actionName, actionArgs, mutator, selection = state.selectedId) {
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
        selectElement(editorId) {
            setState({
                ...state,
                selectedId: editorId
            });
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
            if (!state.selectedId) {
                return false;
            }

            const svgRoot = cloneSvgRoot(state.svgRoot);
            const selected = findElementByEditorId(svgRoot, state.selectedId);
            if (!selected) {
                return false;
            }

            selected.remove();
            commitSvg(svgRoot, null, { actionName, actionArgs });
            return true;
        },
        duplicateSelectedElement(actionName, actionArgs) {
            if (!state.selectedId) {
                return false;
            }

            const svgRoot = cloneSvgRoot(state.svgRoot);
            const selected = findElementByEditorId(svgRoot, state.selectedId);
            if (!selected) {
                return false;
            }

            const clone = selected.cloneNode(true);
            const anchor = getElementBottomRight(svgRoot, selected) ?? getElementOrigin(selected);
            refreshElementIds(clone, state.nextElementId);
            selected.parentNode?.insertBefore(clone, selected.nextSibling);
            if (anchor && !alignElementTopLeftToAnchor(svgRoot, clone, anchor)) {
                nudgeElement(clone, 24, 24);
            }
            commitSvg(svgRoot, clone, { actionName, actionArgs });
            return true;
        },
        copySelectedElement() {
            if (!state.selectedId) {
                clipboardSnapshot = null;
                return false;
            }

            const selected = findElementByEditorId(state.svgRoot, state.selectedId);
            if (!selected) {
                clipboardSnapshot = null;
                return false;
            }

            clipboardSnapshot = {
                element: sanitizeClipboardElement(selected.cloneNode(true)),
                anchor: getClipboardAnchor(state.svgRoot, state.selectedId)
            };
            return true;
        },
        pasteClipboardElement(actionName, actionArgs) {
            if (!clipboardSnapshot) {
                return false;
            }

            const svgRoot = cloneSvgRoot(state.svgRoot);
            const clone = clipboardSnapshot.element.cloneNode(true);
            refreshElementIds(clone, state.nextElementId);

            const target = findElementByEditorId(svgRoot, state.selectedId);
            insertClipboardClone(svgRoot, target, clone);
            if (clipboardSnapshot.anchor && !alignElementTopLeftToAnchor(svgRoot, clone, clipboardSnapshot.anchor)) {
                nudgeElement(clone, 24, 24);
            }

            clipboardSnapshot = {
                element: sanitizeClipboardElement(clone.cloneNode(true)),
                anchor: getElementBottomRight(svgRoot, clone) ?? clipboardSnapshot.anchor
            };
            commitSvg(svgRoot, clone, { actionName, actionArgs });
            return true;
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
    return {
        svgRoot,
        selectedId: getFirstSelectableEditorId(svgRoot),
        nextElementId: computeNextElementId(svgRoot),
        lastAction: null
    };
}

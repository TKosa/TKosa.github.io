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
import { insertClipboardClone, nudgeElement, refreshElementIds, sanitizeClipboardElement, setElementTransform, translateElement } from '../svg/element-operations.js';
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
            refreshElementIds(clone, state.nextElementId);
            nudgeElement(clone, 24, 24);
            selected.parentNode?.insertBefore(clone, selected.nextSibling);
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

            clipboardSnapshot = sanitizeClipboardElement(selected.cloneNode(true));
            return true;
        },
        pasteClipboardElement(actionName, actionArgs) {
            if (!clipboardSnapshot) {
                return false;
            }

            const svgRoot = cloneSvgRoot(state.svgRoot);
            const clone = clipboardSnapshot.cloneNode(true);
            refreshElementIds(clone, state.nextElementId);
            nudgeElement(clone, 24, 24);

            const target = findElementByEditorId(svgRoot, state.selectedId);
            insertClipboardClone(svgRoot, target, clone);
            clipboardSnapshot = sanitizeClipboardElement(clone.cloneNode(true));
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

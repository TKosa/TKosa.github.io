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
import { insertClipboardClone, nudgeElement, refreshElementIds, sanitizeClipboardElement, translateElement } from '../svg/element-operations.js';
import { parseSvgString } from '../svg/parser.js';
import { serializeSvg } from '../svg/serializer.js';

export function createStore() {
    let state = createInitialState();
    const listeners = new Set();
    let clipboardSnapshot = null;

    function notify() {
        listeners.forEach((listener) => listener(state));
    }

    function setState(nextState) {
        state = nextState;
        notify();
    }

    function resolveSelection(selection) {
        if (selection instanceof Element) {
            return selection.getAttribute('data-editor-id');
        }

        return selection ?? null;
    }

    function commitSvg(svgRoot, selection = state.selectedId) {
        assignEditorIds(svgRoot);
        setState({
            svgRoot,
            selectedId: resolveSelection(selection),
            nextElementId: computeNextElementId(svgRoot)
        });
    }

    function updateSvg(mutator, selection = state.selectedId) {
        const svgRoot = cloneSvgRoot(state.svgRoot);
        mutator(svgRoot);
        commitSvg(svgRoot, selection);
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
        importFromString(source) {
            commitSvg(parseSvgString(source), null);
        },
        addElement(type) {
            const svgRoot = cloneSvgRoot(state.svgRoot);
            const element = createShapeElement(type);

            if (!element.hasAttribute('id')) {
                element.setAttribute('id', String(state.nextElementId));
            }

            const selected = findElementByEditorId(svgRoot, state.selectedId);
            const parent = selected && selected.tagName.toLowerCase() === 'g' ? selected : svgRoot;
            parent.appendChild(element);
            commitSvg(svgRoot, element);
        },
        deleteSelectedElement() {
            if (!state.selectedId) {
                return false;
            }

            const svgRoot = cloneSvgRoot(state.svgRoot);
            const selected = findElementByEditorId(svgRoot, state.selectedId);
            if (!selected) {
                return false;
            }

            selected.remove();
            commitSvg(svgRoot, null);
            return true;
        },
        duplicateSelectedElement() {
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
            commitSvg(svgRoot, clone);
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
        pasteClipboardElement() {
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
            commitSvg(svgRoot, clone);
            return true;
        },
        updateCanvasSize(width, height) {
            updateSvg((svgRoot) => {
                svgRoot.setAttribute('width', String(width));
                svgRoot.setAttribute('height', String(height));
                svgRoot.setAttribute('viewBox', `0 0 ${width} ${height}`);
            });
        },
        updateElementAttribute(editorId, name, value) {
            updateSvg((svgRoot) => {
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
        moveElement(editorId, deltaX, deltaY) {
            updateSvg((svgRoot) => {
                const element = findElementByEditorId(svgRoot, editorId);
                if (!element) {
                    return;
                }

                translateElement(element, deltaX, deltaY);
            });
        },
        clear() {
            commitSvg(createBaseSvgRoot(), null);
        },
        serialize() {
            return serializeSvg(state.svgRoot);
        }
    };
}

export function createInitialState() {
    const svgRoot = createDefaultSvg();
    assignEditorIds(svgRoot);
    return {
        svgRoot,
        selectedId: getFirstSelectableEditorId(svgRoot),
        nextElementId: computeNextElementId(svgRoot)
    };
}

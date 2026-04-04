import { downloadTextFile } from '../core/utils.js';
import { getSelectedElementSnapshot } from '../state/document-selectors.js';

export function createEditorCommands({ store, status }) {
    const getSelectedElementName = () => {
        const selected = getSelectedElementSnapshot(store.getState());
        return selected ? selected.tagName.toLowerCase() : null;
    };

    return {
        addShape(type) {
            store.addElement('add-shape', [type], type);
        },
        undo() {
            if (store.undo()) {
                status.setMessage('Change undone');
                return true;
            }

            return false;
        },
        redo() {
            if (store.redo()) {
                status.setMessage('Change restored');
                return true;
            }

            return false;
        },
        duplicateSelection() {
            const selectedId = store.getState().selectedId;
            if (store.duplicateSelectedElement('duplicate-selection', [selectedId])) {
                status.setMessage('Element duplicated');
            }
        },
        deleteSelection() {
            const selectedId = store.getState().selectedId;
            if (store.deleteSelectedElement('delete-selection', [selectedId])) {
                status.setMessage('Element deleted');
            }
        },
        copySelection() {
            const elementName = getSelectedElementName();
            if (store.copySelectedElement('copy-selection', [elementName])) {
                status.setMessage('Element copied');
                return true;
            }

            return false;
        },
        pasteSelection() {
            const selectedId = store.getState().selectedId;
            if (store.pasteClipboardElement('paste-selection', [selectedId])) {
                status.setMessage('Element pasted');
                return true;
            }

            return false;
        },
        clearDocument() {
            store.clear('clear-document', []);
            status.setMessage('Canvas cleared');
        },
        importSvgText(source) {
            store.importFromString('import-svg', ['file'], source);
            status.setMessage('SVG imported');
        },
        updateSourceDocument(source) {
            store.importFromString('edit-source', [source.length], source);
        },
        exportDocument() {
            downloadTextFile('vector-workshop.svg', store.serialize());
            status.setMessage('SVG exported');
        },
        resizeCanvas(width, height) {
            store.updateCanvasSize('resize-canvas', [width, height], width, height);
        }
    };
}

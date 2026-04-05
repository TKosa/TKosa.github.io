import { downloadTextFile } from '../core/utils.js';
import { getSelectedElementSnapshot, getSelectedElementSnapshots, getSelectedIds } from '../state/document-selectors.js';

export function createEditorCommands({ store, status }) {
    const getSelectedElementName = () => {
        const selectedElements = getSelectedElementSnapshots(store.getState());
        if (selectedElements.length === 1) {
            return selectedElements[0].tagName.toLowerCase();
        }

        return selectedElements.length > 1 ? `${selectedElements.length}-elements` : null;
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
            const selectedIds = getSelectedIds(store.getState());
            if (store.duplicateSelectedElement('duplicate-selection', [selectedIds.length])) {
                status.setMessage(selectedIds.length > 1 ? 'Selection duplicated' : 'Element duplicated');
            }
        },
        deleteSelection() {
            const selectedIds = getSelectedIds(store.getState());
            if (store.deleteSelectedElement('delete-selection', [selectedIds.length])) {
                status.setMessage(selectedIds.length > 1 ? 'Selection deleted' : 'Element deleted');
            }
        },
        copySelection() {
            const elementName = getSelectedElementName();
            if (store.copySelectedElement('copy-selection', [elementName])) {
                const selectionCount = getSelectedIds(store.getState()).length;
                status.setMessage(selectionCount > 1 ? 'Selection copied' : 'Element copied');
                return true;
            }

            return false;
        },
        pasteSelection() {
            const selectedIds = getSelectedIds(store.getState());
            if (store.pasteClipboardElement('paste-selection', [selectedIds.length])) {
                status.setMessage('Selection pasted');
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

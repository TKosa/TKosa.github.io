import { downloadTextFile } from '../core/utils.js';

export function createEditorCommands({ store, status }) {
    return {
        addShape(type) {
            store.addElement(type);
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
            if (store.duplicateSelectedElement()) {
                status.setMessage('Element duplicated');
            }
        },
        deleteSelection() {
            if (store.deleteSelectedElement()) {
                status.setMessage('Element deleted');
            }
        },
        copySelection() {
            if (store.copySelectedElement()) {
                status.setMessage('Element copied');
                return true;
            }

            return false;
        },
        pasteSelection() {
            if (store.pasteClipboardElement()) {
                status.setMessage('Element pasted');
                return true;
            }

            return false;
        },
        clearDocument() {
            store.clear();
            status.setMessage('Canvas cleared');
        },
        importSvgText(source) {
            store.importFromString(source);
            status.setMessage('SVG imported');
        },
        updateSourceDocument(source) {
            store.importFromString(source);
        },
        exportDocument() {
            downloadTextFile('vector-workshop.svg', store.serialize());
            status.setMessage('SVG exported');
        },
        resizeCanvas(width, height) {
            store.updateCanvasSize(width, height);
        }
    };
}

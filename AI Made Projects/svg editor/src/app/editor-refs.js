const REF_SELECTORS = {
    canvas: 'editor-canvas',
    canvasStage: 'canvas-stage',
    shapeToolbar: 'shape-toolbar',
    deleteButton: 'delete-button',
    duplicateButton: 'duplicate-button',
    exportButton: 'export-button',
    importInput: 'import-input',
    savedSvgSelect: 'saved-svg-select',
    clearButton: 'clear-button',
    form: 'property-form',
    emptyState: 'empty-state',
    summary: 'selection-summary',
    sourceInput: 'source-input',
    sourceViewer: 'source-viewer',
    sourceModeToggle: 'source-mode-toggle',
    canvasWidth: 'canvas-width',
    canvasHeight: 'canvas-height'
};

export function createEditorRefs(root = document) {
    const refs = Object.fromEntries(
        Object.entries(REF_SELECTORS).map(([name, id]) => [name, root.getElementById(id)])
    );

    Object.entries(refs).forEach(([name, node]) => {
        if (!node) {
            throw new Error(`Missing editor DOM node: ${name}`);
        }
    });

    return refs;
}

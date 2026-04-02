import { createStore } from '../state/document-model.js';
import { createCanvasController } from '../ui/canvas-controller.js';
import { createPropertyPanel } from '../ui/property-panel.js';
import { createSourceController } from '../ui/source-controller.js';
import { createToolbarController } from '../ui/toolbar-controller.js';
import { createEditorCommands } from './editor-commands.js';
import { createEditorRefs } from './editor-refs.js';
import { createEditorStatus } from './editor-status.js';
import { registerKeyboardShortcuts } from './keyboard-shortcuts.js';

export function startEditorApp(root = document) {
    const refs = createEditorRefs(root);
    const store = createStore();
    const status = createEditorStatus({ refs, store });
    const appContext = { store, refs, status };
    const commands = createEditorCommands(appContext);
    const controllers = createControllers({ ...appContext, commands });

    registerKeyboardShortcuts(commands, refs);

    store.subscribe((state) => {
        controllers.forEach((controller) => controller.render(state));
        status.syncSelectionSummary(state);
    });
}

function createControllers(appContext) {
    return [
        createCanvasController(appContext),
        createSourceController(appContext),
        createPropertyPanel(appContext),
        createToolbarController(appContext)
    ];
}

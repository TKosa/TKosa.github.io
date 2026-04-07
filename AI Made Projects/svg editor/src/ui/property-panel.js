import { findElementByEditorId, getElementAttributes, getSelectedElementSnapshot, getSelectedIds } from '../state/document-selectors.js';

export function createPropertyPanel({ store, refs }) {
    let lastSelectedId = null;
    const draftValues = new Map();

    const getDraftKey = (editorId, attributeName) => `${editorId}:${attributeName}`;

    const updateDraft = (target) => {
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
            return;
        }

        const editorId = target.dataset.editorId;
        const { name, value } = target;

        if (!editorId || !name) {
            return;
        }

        draftValues.set(getDraftKey(editorId, name), value);
    };

    const commitField = (target) => {
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
            return;
        }

        const editorId = target.dataset.editorId;
        if (!editorId) {
            return;
        }

        const attributeName = target.name;
        draftValues.delete(getDraftKey(editorId, attributeName));

        const element = findElementByEditorId(store.getState().svgRoot, editorId);
        if (!element) {
            return;
        }

        const currentValue = attributeName === 'content'
            ? (element.textContent ?? '')
            : (element.getAttribute(attributeName) ?? '');

        if (currentValue === target.value) {
            return;
        }

        store.updateElementAttribute('set-attribute', [editorId, attributeName, target.value], editorId, attributeName, target.value);
    };

    refs.form.addEventListener('input', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
            return;
        }

        updateDraft(target);
    });

    refs.form.addEventListener('focusout', (event) => {
        commitField(event.target);
    });

    refs.form.addEventListener('change', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement) || target.type !== 'color') {
            return;
        }

        commitField(target);
    });

    refs.form.addEventListener('keydown', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)) {
            return;
        }

        if (event.key !== 'Enter') {
            return;
        }

        event.preventDefault();
        target.blur();
    });

    refs.form.addEventListener('click', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLButtonElement)) {
            return;
        }

        const editorId = target.dataset.editorId;
        if (!editorId) {
            return;
        }

        if (target.dataset.action === 'normalize-position' && typeof store.normalizeSelectedElementPosition === 'function') {
            store.normalizeSelectedElementPosition('normalize-position', [editorId], editorId);
            return;
        }

        if (target.dataset.action === 'clear-transform') {
            store.setElementTransform?.('clear-transform', [editorId], editorId, '');
        }
    });

    return {
        render(state) {
            const selectedIds = getSelectedIds(state);
            if (selectedIds.length > 1) {
                draftValues.clear();
                lastSelectedId = null;
                refs.form.replaceChildren();
                refs.emptyState.hidden = false;
                refs.emptyState.textContent = 'Multiple elements selected. Select one element to edit its properties.';
                return;
            }

            const selected = getSelectedElementSnapshot(state);
            const selectedId = selected?.getAttribute('data-editor-id') ?? null;

            if (selectedId !== lastSelectedId) {
                draftValues.clear();
                lastSelectedId = selectedId;
            }

            refs.form.replaceChildren();

            if (!selected) {
                refs.emptyState.hidden = false;
                refs.emptyState.textContent = 'Select an element to edit its properties.';
                return;
            }

            refs.emptyState.hidden = true;

            const grid = document.createElement('div');
            grid.className = 'property-grid';

            const transformValue = selected.getAttribute('transform') ?? '';

            getElementAttributes(selected)
                .filter(({ name }) => name !== 'transform')
                .forEach(({ name, value }) => {
                const draftValue = draftValues.get(getDraftKey(selectedId, name));
                grid.appendChild(createPropertyField(name, draftValue ?? value, selectedId));
                });

            if (selected.tagName.toLowerCase() === 'text') {
                const draftValue = draftValues.get(getDraftKey(selectedId, 'content'));
                grid.appendChild(createPropertyField('content', draftValue ?? (selected.textContent ?? ''), selectedId, true));
            }

            refs.form.appendChild(grid);

            if (transformValue) {
                refs.form.appendChild(createTransformSection(selectedId, canNormalizeElementPosition(selected)));
            }
        }
    };
}

function createPropertyField(name, value, editorId, multiline = false) {
    const row = document.createElement('div');
    row.className = 'property-row';

    const label = document.createElement('label');
    label.textContent = name;
    label.htmlFor = `prop-${cssSafeId(name)}`;

    const input = multiline ? document.createElement('textarea') : document.createElement('input');
    if (input instanceof HTMLInputElement) {
        input.type = inferInputType(name, value);
    }

    input.id = `prop-${cssSafeId(name)}`;
    input.name = name;
    input.value = value;
    input.dataset.editorId = editorId;

    row.append(label, input);
    return row;
}

function createTransformSection(editorId, canNormalizePosition) {
    const section = document.createElement('section');
    section.className = 'transform-section';

    const heading = document.createElement('h3');
    heading.className = 'transform-section-title';
    heading.textContent = 'Transform';

    const actions = document.createElement('div');
    actions.className = 'property-actions';

    const clearButton = document.createElement('button');
    clearButton.type = 'button';
    clearButton.className = 'secondary-button';
    clearButton.dataset.action = 'clear-transform';
    clearButton.dataset.editorId = editorId;
    clearButton.textContent = 'Clear Transform';

    actions.append(clearButton);

    if (canNormalizePosition) {
        const flattenButton = document.createElement('button');
        flattenButton.type = 'button';
        flattenButton.className = 'secondary-button';
        flattenButton.dataset.action = 'normalize-position';
        flattenButton.dataset.editorId = editorId;
        flattenButton.textContent = 'Bake Translation';
        actions.append(flattenButton);
    }

    section.append(heading, actions);
    return section;
}

function canNormalizeElementPosition(element) {
    if (!(element instanceof SVGGraphicsElement) || !element.hasAttribute('transform')) {
        return false;
    }

    return ['rect', 'text', 'image', 'use', 'circle', 'ellipse', 'line', 'polygon', 'polyline']
        .includes(element.tagName.toLowerCase());
}
function inferInputType(name, value) {
    if (isHexColor(value) && name !== 'id') {
        return 'color';
    }

    if (isNumeric(value) && !['id', 'viewBox', 'points', 'd'].includes(name)) {
        return 'number';
    }

    return 'text';
}

function isHexColor(value) {
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value);
}

function isNumeric(value) {
    return /^-?\d*\.?\d+$/.test(value);
}

function cssSafeId(value) {
    return value.replace(/[^a-z0-9_-]+/gi, '-');
}

import { getElementAttributes, getSelectedElementSnapshot } from '../state/document-selectors.js';

export function createPropertyPanel({ store, refs }) {
    refs.form.addEventListener('input', (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
            return;
        }

        const selected = getSelectedElementSnapshot(store.getState());
        if (!selected) {
            return;
        }

        const attributeName = target.name;
        store.updateElementAttribute(
            selected.getAttribute('data-editor-id'),
            attributeName,
            target.value
        );
    });

    return {
        render(state) {
            const selected = getSelectedElementSnapshot(state);
            refs.form.replaceChildren();

            if (!selected) {
                refs.emptyState.hidden = false;
                return;
            }

            refs.emptyState.hidden = true;

            const grid = document.createElement('div');
            grid.className = 'property-grid';

            getElementAttributes(selected).forEach(({ name, value }) => {
                grid.appendChild(createPropertyField(name, value));
            });

            if (selected.tagName.toLowerCase() === 'text') {
                grid.appendChild(createPropertyField('content', selected.textContent ?? '', true));
            }

            refs.form.appendChild(grid);
        }
    };
}

function createPropertyField(name, value, multiline = false) {
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

    row.append(label, input);
    return row;
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

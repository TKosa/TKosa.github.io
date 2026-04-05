import { getCanvasMetrics } from '../state/document-selectors.js';

const SAVED_SVGS_STORAGE_KEY = 'vector-workshop:saved-svgs';
const MAX_SAVED_SVGS = 20;

export function createToolbarController({ refs, commands }) {
    const readSavedEntries = () => {
        try {
            const raw = window.localStorage.getItem(SAVED_SVGS_STORAGE_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed)
                ? parsed.filter(isValidSavedEntry)
                : [];
        } catch (error) {
            void error;
            return [];
        }
    };

    const writeSavedEntries = (entries) => {
        try {
            window.localStorage.setItem(SAVED_SVGS_STORAGE_KEY, JSON.stringify(entries.slice(0, MAX_SAVED_SVGS)));
        } catch (error) {
            void error;
        }
    };

    const renderSavedSvgOptions = () => {
        const entries = readSavedEntries();
        refs.savedSvgSelect.replaceChildren(createSavedSvgPlaceholderOption());
        entries.forEach((entry, index) => {
            const option = document.createElement('option');
            option.value = String(index);
            option.textContent = `${entry.name} (${formatSavedDate(entry.savedAt)})`;
            refs.savedSvgSelect.appendChild(option);
        });
    };

    const persistImportedSvg = (name, source) => {
        const nextEntry = {
            name: sanitizeEntryName(name),
            source,
            savedAt: Date.now()
        };
        const nextEntries = [
            nextEntry,
            ...readSavedEntries().filter((entry) => entry.source !== source)
        ];
        writeSavedEntries(nextEntries);
        renderSavedSvgOptions();
    };

    refs.shapeToolbar.addEventListener('click', (event) => {
        const trigger = event.target instanceof HTMLElement ? event.target.closest('[data-shape]') : null;
        if (!trigger) {
            return;
        }

        commands.addShape(trigger.dataset.shape);
    });

    refs.deleteButton.addEventListener('click', () => commands.deleteSelection());
    refs.duplicateButton.addEventListener('click', () => commands.duplicateSelection());
    refs.clearButton.addEventListener('click', () => commands.clearDocument());

    refs.importInput.addEventListener('change', async (event) => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }

        try {
            const source = await file.text();
            commands.importSvgText(source);
            persistImportedSvg(file.name, source);
        } catch (error) {
            window.alert(error instanceof Error ? error.message : 'Unable to import SVG.');
        } finally {
            refs.importInput.value = '';
        }
    });

    refs.savedSvgSelect.addEventListener('change', () => {
        const selectedIndex = Number(refs.savedSvgSelect.value);
        if (!Number.isInteger(selectedIndex) || selectedIndex < 0) {
            return;
        }

        const entry = readSavedEntries()[selectedIndex];
        if (!entry) {
            refs.savedSvgSelect.value = '';
            return;
        }

        try {
            commands.importSvgText(entry.source);
        } catch (error) {
            window.alert(error instanceof Error ? error.message : 'Unable to load saved SVG.');
        } finally {
            refs.savedSvgSelect.value = '';
        }
    });

    refs.exportButton.addEventListener('click', () => commands.exportDocument());

    refs.canvasWidth.addEventListener('input', () => {
        const height = Number(refs.canvasHeight.value) || 1;
        const width = Number(refs.canvasWidth.value) || 1;
        commands.resizeCanvas(Math.max(1, width), Math.max(1, height));
    });

    refs.canvasHeight.addEventListener('input', () => {
        const width = Number(refs.canvasWidth.value) || 1;
        const height = Number(refs.canvasHeight.value) || 1;
        commands.resizeCanvas(Math.max(1, width), Math.max(1, height));
    });

    renderSavedSvgOptions();

    return {
        render(state) {
            const { width, height } = getCanvasMetrics(state.svgRoot);
            refs.canvasWidth.value = String(width);
            refs.canvasHeight.value = String(height);
        }
    };
}

function createSavedSvgPlaceholderOption() {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'Saved SVGs';
    return option;
}

function sanitizeEntryName(name) {
    const trimmed = String(name ?? '').trim();
    return trimmed || 'Imported SVG';
}

function isValidSavedEntry(entry) {
    return Boolean(
        entry
        && typeof entry.name === 'string'
        && typeof entry.source === 'string'
        && Number.isFinite(entry.savedAt)
    );
}

function formatSavedDate(timestamp) {
    try {
        return new Intl.DateTimeFormat(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        }).format(new Date(timestamp));
    } catch (error) {
        void error;
        return 'saved';
    }
}

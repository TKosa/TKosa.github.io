const DEFAULT_OPTIONS = {
    stylesheets: []
};

export class OverlayHost {
    constructor(rootId, baseModuleUrl, options = DEFAULT_OPTIONS) {
        const root = document.getElementById(rootId);
        if (!root) {
            throw new Error(`Overlay root element '${rootId}' not found.`);
        }
        this.root = root;
        this.baseUrl = baseModuleUrl;
        this.stylesheets = Array.isArray(options.stylesheets) ? options.stylesheets : [];
        this.loaded = false;
    }

    ensureStylesheets(additional = []) {
        const styles = [...this.stylesheets, ...additional];
        styles.forEach(path => this.attachStylesheet(path));
    }

    attachStylesheet(relativePath) {
        if (!relativePath) {
            return;
        }
        try {
            const href = new URL(relativePath, this.baseUrl).href;
            const alreadyLinked = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
                .some(link => link.href === href);
            if (alreadyLinked) {
                return;
            }
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            document.head.appendChild(link);
        } catch (error) {
            console.warn('Failed to attach stylesheet', relativePath, error);
        }
    }

    async injectTemplate(relativePath, fallbackMarkup = '') {
        const markup = await this.loadMarkup(relativePath, fallbackMarkup);
        if (markup) {
            this.root.innerHTML = markup.trim();
            this.loaded = true;
        }
    }

    async loadMarkup(relativePath, fallbackMarkup = '') {
        if (!relativePath) {
            return fallbackMarkup;
        }
        try {
            const url = new URL(relativePath, this.baseUrl);
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`Failed to load template: ${response.status}`);
            }
            return await response.text();
        } catch (error) {
            console.warn('Falling back to inline template', error);
            return fallbackMarkup;
        }
    }

    showHost() {
        this.root.hidden = false;
    }

    hideHost() {
        this.root.hidden = true;
    }

    query(selector) {
        return this.root.querySelector(selector);
    }
}

class ImageRegistry {
    constructor() {
        this.sources = new Map();
        this.defaultId = null;
    }

    register(id, src, options = {}) {
        if (!id || typeof id !== 'string' || !src) {
            return;
        }
        const trimmedId = id.trim();
        if (!trimmedId) {
            return;
        }
        this.sources.set(trimmedId, src);
        if (options.isDefault || !this.defaultId) {
            this.defaultId = trimmedId;
        }
    }

    resolveId(id) {
        if (id && this.sources.has(id)) {
            return id;
        }
        return this.defaultId;
    }

    getUrl(id) {
        if (!id) return null;

        // If the ID is directly registered, use it
        if (this.sources.has(id)) {
            return this.sources.get(id);
        }

        // If it looks like a path (contains / or .), use it directly
        if (id.includes('/') || id.includes('.')) {
            return id;
        }

        const resolvedId = this.resolveId(id);
        if (!resolvedId) {
            return null;
        }
        return this.sources.get(resolvedId) ?? null;
    }

    createImageElement(id, { alt = '', className = '' } = {}) {
        const url = this.getUrl(id);
        if (!url) {
            return null;
        }
        const img = new Image();
        img.src = url;
        img.alt = alt;
        img.loading = 'lazy';
        img.decoding = 'async';
        img.draggable = false;
        if (className) {
            img.className = className;
        }
        return img;
    }
}

export const imageRegistry = new ImageRegistry();

imageRegistry.register('item-not-found', 'assets/item_icon/item_not_found.png', { isDefault: true });
imageRegistry.register('shield', 'assets/item_icon/shield.png');
imageRegistry.register('campfire', 'assets/item_icon/campfire.png');
imageRegistry.register('bomb', 'assets/item_icon/bomb.png');
imageRegistry.register('turret', 'assets/item_icon/turret.png');
imageRegistry.register('laserTurret', 'assets/item_icon/laserTurret.png');
imageRegistry.register('accelerator', 'assets/item_icon/accelerator.png');
imageRegistry.register('shield2', 'assets/item_icon/shield2.png');
imageRegistry.register('shield3', 'assets/item_icon/shield3.png');
imageRegistry.register('speedBoost', 'assets/item_icon/speedBoost.png');



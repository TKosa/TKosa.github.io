import { eventBus } from './eventBus.js';
import { craftingSystem } from './crafting.js';

export class Inventory {
    constructor(itemPool, itemFactory, scheduler) {
        this.size = 10;
        this.items = [];
        this.cooldownStates = new Array(this.size).fill(null);
        this.cooldownVisuals = new Array(this.size).fill(0);
        this.defaultCooldown = 10;
        this.itemPool = itemPool;
        this.itemFactory = itemFactory;
        this.scheduler = scheduler;

        this.itemTemplates = new Map();
        if (Array.isArray(this.itemPool)) {
            this.itemPool.forEach(item => {
                if (item && item.id) {
                    this.itemTemplates.set(item.id, item);
                }
            });
        }

        eventBus.on('requestInventoryItem', () => this.addRandomItem());
        eventBus.on('craftingCommit', (data) => this.handleCraftingCommit(data));
    }

    update() {
        this.updateCooldownVisuals();
    }

    getItem(index) {
        return this.items[index];
    }

    getItemCooldown(item) {
        if (!item || !item.id) return this.defaultCooldown;

        const template = this.itemTemplates.get(item.id);
        const source = template || item;

        const raw = source && Object.prototype.hasOwnProperty.call(source, 'cooldown')
            ? Number(source.cooldown)
            : Number(this.defaultCooldown);
        if (!Number.isFinite(raw) || raw <= 0) {
            return 0;
        }
        return raw;
    }

    useItem(index) {
        const item = this.items[index];
        if (!item || !item.id) return;

        const template = this.itemTemplates.get(item.id);
        // We don't check for template.onuse anymore as logic is handled by Map via event

        const now = this.scheduler ? this.scheduler.now() : 0;
        const cooldown = this.getItemCooldown(item);
        const state = this.cooldownStates[index];
        if (cooldown > 0 && state && (now - state.lastUsed) < state.duration) {
            return;
        }

        eventBus.emit('itemUsed', item.id);

        const isOnce = template ? template.once : item.once;

        if (isOnce) {
            this.items.splice(index, 1);
            this.cooldownStates.splice(index, 1);
            this.cooldownStates.push(null);
            this.cooldownVisuals.splice(index, 1);
            this.cooldownVisuals.push(0);
            eventBus.emit('inventoryUpdated', [...this.items]);
            this.updateCooldownVisuals(true);
        } else {
            if (cooldown > 0) {
                this.cooldownStates[index] = { lastUsed: now, duration: cooldown };
            } else {
                this.cooldownStates[index] = null;
            }

            this.updateCooldownVisuals(true);
        }
    }

    updateCooldownVisuals(forceEmit = false) {
        if (!Array.isArray(this.cooldownStates)) {
            this.cooldownStates = new Array(this.size).fill(null);
        }
        if (!Array.isArray(this.cooldownVisuals)) {
            this.cooldownVisuals = new Array(this.size).fill(0);
        }

        const now = this.scheduler ? this.scheduler.now() : 0;
        let changed = Boolean(forceEmit);

        for (let i = 0; i < this.size; i++) {
            const hasItem = Boolean(this.items[i]);
            if (!hasItem) {
                if (this.cooldownStates[i] !== null) {
                    this.cooldownStates[i] = null;
                }
            }

            const state = hasItem ? this.cooldownStates[i] : null;
            let visual = 0;

            if (state) {
                const elapsed = now - state.lastUsed;
                if (elapsed >= state.duration) {
                    this.cooldownStates[i] = null;
                } else {
                    visual = Math.max(0, 1 - (elapsed / state.duration));
                }
            }

            if (this.cooldownVisuals[i] !== visual) {
                this.cooldownVisuals[i] = visual;
                changed = true;
            }
        }

        if (changed) {
            eventBus.emit('updateInventoryCooldowns', this.cooldownVisuals);
        }
    }


    addRandomItem() {
        if (this.items.length >= this.size) {
            return;
        }

        if (this.itemPool.length === 0) {
            return;
        }

        const item = this.itemPool[Math.floor(Math.random() * this.itemPool.length)];
        if (!item) {
            return;
        }

        this.addItem(item);
    }

    addItem(item) {
        this.items.push(item);
        const slotIndex = this.items.length - 1;
        if (slotIndex >= 0 && slotIndex < this.cooldownStates.length) {
            this.cooldownStates[slotIndex] = null;
            this.cooldownVisuals[slotIndex] = 0;
        }
        this.updateCooldownVisuals(true);
        eventBus.emit('inventoryUpdated', [...this.items]);


    }

    handleCraftingCommit(data) {
        const { result, consumedIndices } = data;
        if (!result || !Array.isArray(consumedIndices)) {
            return;
        }

        const newItems = [];
        const newCooldownStates = [];

        // Rebuild inventory, skipping consumed indices
        for (let i = 0; i < this.items.length; i++) {
            if (!consumedIndices.includes(i)) {
                newItems.push(this.items[i]);
                newCooldownStates.push(this.cooldownStates[i]);
            }
        }

        // Add the result item
        const itemDef = this.itemFactory.getItemDefinition(result);
        if (itemDef) {
            newItems.push(itemDef);
            newCooldownStates.push(null); // New item starts with no cooldown
        }

        // Pad the cooldown states to match inventory size
        while (newCooldownStates.length < this.size) {
            newCooldownStates.push(null);
        }

        this.items = newItems;
        this.cooldownStates = newCooldownStates;

        this.updateCooldownVisuals(true);
        eventBus.emit('inventoryUpdated', [...this.items]);
    }
}

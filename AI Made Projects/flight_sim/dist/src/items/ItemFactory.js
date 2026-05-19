import { ItemRegistry } from './ItemRegistry.js';

export class ItemFactory {
    constructor() {
        this.game = null;
        this.initialized = false;
    }

    init(scene, scheduler, game = null) {
        // Keep these for backward compatibility, but we primarily use game
        this.game = game;
        this.initialized = true;
    }

    createItem(itemType, position) {
        if (!this.initialized) {
            console.error("ItemFactory not initialized!");
            return null;
        }
        const definition = ItemRegistry[itemType];
        const ItemClass = definition ? definition.class : null;

        if (ItemClass) {
            return new ItemClass(this.game, position);
        }
        return null;
    }

    getItemDefinition(itemId) {
        return ItemRegistry[itemId];
    }

    getAllItemDefinitions() {
        return Object.values(ItemRegistry);
    }
}


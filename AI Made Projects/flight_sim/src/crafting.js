import { eventBus } from './eventBus.js';
import { getIconToken } from './items/icon-utils.js';

export const RECIPES = [
    {
        ingredients: ['shield', 'campfire'],
        result: 'bomb'
    },
    {
        ingredients: ['shield', 'bomb'],
        result: 'turret'
    },
    {
        ingredients: ['shield', 'shield', 'shield'],
        result: 'shield2'
    },
    {
        ingredients: ['shield2', 'shield2', 'shield2'],
        result: 'shield3'
    }
];

class CraftingSystem {
    constructor(recipes) {
        this.recipes = recipes;
        this.combination = [null, null, null];
        this.result = null;
        this.resultRecipe = null;
        this.itemIconCache = new Map();
    }

    getCombination() {
        return this.combination;
    }

    getResult() {
        return this.result;
    }

    setCombination(index, item) {
        if (!Number.isInteger(index) || index < 0 || index >= this.combination.length) {
            return;
        }

        this.combination[index] = item ?? null;
        if (item && item.id) {
            this.rememberItemIcon(item);
        }
        this.notifyCombinationChanged();
    }

    clearCombination() {
        this.combination = [null, null, null];
        this.notifyCombinationChanged();
    }

    rememberItemIcon(item) {
        if (!item || !item.id) {
            return;
        }

        const token = this.extractIconToken(item);
        if (token) {
            this.itemIconCache.set(item.id, token);
        }
    }

    notifyCombinationChanged() {
        eventBus.emit('craftingUpdated');
        this.checkRecipes();
    }

    checkRecipes() {
        const activeItems = this.combination.filter(item => item);
        if (activeItems.length === 0) {
            this.updateResult(null);
            return;
        }

        const signatures = this.buildActiveSignatures(activeItems);
        const matchedRecipe = this.findMatchingRecipe(signatures);
        this.updateResult(matchedRecipe ?? null);
    }

    buildActiveSignatures(items) {
        return {
            icon: this.createSignature(items.map(item => this.getIconToken(item))),
            id: this.createSignature(items.map(item => this.getIdToken(item)))
        };
    }

    getIconToken(item) {
        if (!item) {
            return '';
        }

        const token = this.extractIconToken(item);
        if (token) {
            if (item.id && !this.itemIconCache.has(item.id)) {
                this.itemIconCache.set(item.id, token);
            }
            return token;
        }

        return this.getIdToken(item);
    }

    extractIconToken(item) {
        if (!item) {
            return '';
        }

        const token = getIconToken(item);
        if (token) {
            return token;
        }

        if (item.id && this.itemIconCache.has(item.id)) {
            return this.itemIconCache.get(item.id);
        }

        return '';
    }

    getIdToken(item) {
        if (!item || typeof item.id !== 'string') {
            return '';
        }
        return item.id.trim();
    }

    createSignature(tokens) {
        const cleaned = tokens
            .map(token => (typeof token === 'string' ? token.trim() : ''))
            .filter(token => token.length > 0);
        if (cleaned.length === 0) {
            return '';
        }

        cleaned.sort((a, b) => a.localeCompare(b));
        return cleaned.join('|');
    }

    findMatchingRecipe(signatures) {
        for (const recipe of this.recipes) {
            if (!recipe.idSignature) {
                recipe.idSignature = this.createSignature(recipe.ingredients);
            }

            if (signatures.id && signatures.id === recipe.idSignature) {
                return recipe;
            }
        }
        return null;
    }

    updateResult(recipe) {
        if (!recipe) {
            this.result = null;
            this.resultRecipe = null;
            eventBus.emit('craftingResult', null);
            return;
        }

        this.result = recipe.result;
        this.resultRecipe = recipe;
        eventBus.emit('craftingResult', {
            resultId: recipe.result,
            recipe
        });
    }

    craft() {
        if (!this.result) {
            return;
        }

        const craftedItems = this.combination.filter(item => item);
        if (craftedItems.length === 0) {
            return;
        }

        eventBus.emit('itemCrafted', {
            ingredients: craftedItems,
            result: this.result
        });
        this.clearCombination();
    }
}

export const craftingSystem = new CraftingSystem(RECIPES);

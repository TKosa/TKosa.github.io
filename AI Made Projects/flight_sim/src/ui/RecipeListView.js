import { imageRegistry } from '../ImageRegistry.js';
import { getIconDescriptor } from '../items/icon-utils.js';

export class RecipeListView {
    constructor(container, recipes = []) {
        this.container = container;
        this.recipes = Array.isArray(recipes) ? recipes : [];
        this.rendered = false;
    }

    setRecipes(recipes) {
        this.recipes = Array.isArray(recipes) ? recipes : [];
        this.rendered = false;
    }

    render() {
        if (!this.container || !Array.isArray(this.recipes)) {
            return;
        }

        this.container.innerHTML = '';

        if (this.recipes.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.classList.add('recipe-item');
            emptyState.textContent = 'No recipes discovered yet.';
            this.container.appendChild(emptyState);
            this.rendered = true;
            return;
        }

        this.recipes.forEach(recipe => {
            this.container.appendChild(this.createRecipeRow(recipe));
        });
        this.rendered = true;
    }

    createRecipeRow(recipe) {
        const recipeItem = document.createElement('div');
        recipeItem.classList.add('recipe-item');

        recipeItem.appendChild(this.buildInputsRow(recipe));
        recipeItem.appendChild(this.createRecipeOperator('→', 'recipe-arrow'));
        recipeItem.appendChild(this.buildOutputCell(recipe));

        return recipeItem;
    }

    buildInputsRow(recipe) {
        const inputsContainer = document.createElement('div');
        inputsContainer.className = 'recipe-inputs';

        if (!recipe || !Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
            inputsContainer.textContent = 'Unknown';
            return inputsContainer;
        }

        recipe.ingredients.forEach((ingredient, index) => {
            inputsContainer.appendChild(this.createRecipeItemBox(ingredient));
            if (index < recipe.ingredients.length - 1) {
                inputsContainer.appendChild(this.createRecipeOperator('+', 'recipe-plus'));
            }
        });

        return inputsContainer;
    }

    buildOutputCell(recipe) {
        const outputContainer = document.createElement('div');
        outputContainer.className = 'recipe-output';
        outputContainer.appendChild(this.createRecipeItemBox(recipe?.result ?? null, { isOutput: true }));
        return outputContainer;
    }

    createRecipeItemBox(item, { isOutput = false } = {}) {
        const box = document.createElement('div');
        box.className = 'recipe-item-box item-slot';
        if (isOutput) {
            box.classList.add('output-item-box');
        }

        const label = this.formatItemName(item);
        const iconDescriptor = getIconDescriptor(item, { fallbackToId: true });
        const iconElement = this.createItemIconElement(iconDescriptor, label);

        if (iconElement) {
            box.appendChild(iconElement);
        } else {
            const fallback = document.createElement('span');
            fallback.className = 'item-slot-text-icon';
            fallback.textContent = label && label !== 'Unknown' ? label.charAt(0) : '?';
            box.appendChild(fallback);
        }

        if (label && label !== 'Unknown') {
            box.title = label;
        }

        return box;
    }

    createRecipeOperator(symbol, className = '') {
        const span = document.createElement('span');
        span.className = ['recipe-operator', className].filter(Boolean).join(' ');
        span.textContent = symbol;
        return span;
    }

    createItemIconElement(iconDescriptor, label) {
        if (!iconDescriptor) {
            return null;
        }
        if (iconDescriptor.type === 'text') {
            const span = document.createElement('span');
            span.className = 'item-slot-text-icon';
            span.textContent = iconDescriptor.value;
            return span;
        }
        return imageRegistry.createImageElement(iconDescriptor.value, {
            alt: label,
            className: 'item-slot-icon'
        });
    }

    formatItemName(item) {
        if (!item) {
            return 'Unknown';
        }

        if (typeof item === 'object') {
            if (typeof item.name === 'string' && item.name.trim().length > 0) {
                return item.name.trim();
            }
            if (typeof item.id === 'string' && item.id.trim().length > 0) {
                return this.formatReadableId(item.id.trim());
            }
        }

        if (typeof item === 'string') {
            const trimmed = item.trim();
            if (trimmed.length > 0) {
                return this.formatReadableId(trimmed);
            }
        }

        return 'Unknown';
    }

    formatReadableId(value) {
        return value
            .split(/[-_\s]+/)
            .filter(Boolean)
            .map(part => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }
}

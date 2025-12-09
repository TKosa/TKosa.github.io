import { eventBus } from '../eventBus.js';
import { craftingSystem } from '../crafting.js';
import { imageRegistry } from '../ImageRegistry.js';
import { getIconDescriptor } from '../items/icon-utils.js';

export class CraftingMenuView {
    constructor(container) {
        this.container = container;
        this.inputsContainer = null;
        this.outputContainer = null;
        this.inventoryContainer = null;
        this.localInventory = []; // Array of { item, originalIndex } or null
        this.craftingSlots = [null, null, null]; // Array of { item, originalIndex } or null
        this.rendered = false;

        this.boundEvents = {
            craftingUpdated: () => this.renderCraftingSlots(),
            craftingResult: (result) => this.renderOutputSlot(result),
            resume: () => this.teardown(),
            inventoryUpdated: (inventory) => this.handleInventoryUpdate(inventory),
        };

        eventBus.on('craftingUpdated', this.boundEvents.craftingUpdated);
        eventBus.on('craftingResult', this.boundEvents.craftingResult);
        // eventBus.on('resume', this.boundEvents.resume); // Removed to prevent teardown
        eventBus.on('inventoryUpdated', this.boundEvents.inventoryUpdated);
    }

    render(inventoryItems) {
        if (!this.container) return;

        this.updateLocalInventory(inventoryItems);

        // Clear crafting system slots
        this.resetCraftingState();

        // Find sub-containers
        this.inputsContainer = this.container.querySelector('#crafting-inputs');
        this.outputContainer = this.container.querySelector('#crafting-output');
        this.inventoryContainer = this.container.querySelector('#crafting-inventory');

        if (!this.inputsContainer || !this.outputContainer || !this.inventoryContainer) {
            console.warn('CraftingMenuView: Missing required containers in template');
            return;
        }

        this.renderAll();
        this.rendered = true;
    }

    handleInventoryUpdate(inventoryItems) {
        this.updateLocalInventory(inventoryItems);
        this.renderInventory();
    }

    updateLocalInventory(inventoryItems) {
        this.localInventory = (inventoryItems || []).map((item, index) => ({
            item: item,
            originalIndex: index
        }));
        // Pad to size 10
        while (this.localInventory.length < 10) {
            this.localInventory.push(null);
        }
    }

    resetCraftingState() {
        craftingSystem.clearCombination();
        this.craftingSlots = [null, null, null];
    }

    renderAll() {
        this.renderCraftingSlots();
        this.renderOutputSlot(null);
        this.renderInventory();
    }

    renderCraftingSlots() {
        if (!this.inputsContainer) return;

        this.inputsContainer.innerHTML = '';
        // Use local craftingSlots state
        const combination = this.craftingSlots;

        combination.forEach((slotData, index) => {
            // slotData is { item, originalIndex } or null
            const item = slotData ? slotData.item : null;
            const slot = this.createItemSlot(item, index, false, false);
            this.inputsContainer.appendChild(slot);

            // Add plus sign between slots
            if (index < combination.length - 1) {
                const plus = document.createElement('span');
                plus.className = 'recipe-operator recipe-plus';
                plus.textContent = '+';
                this.inputsContainer.appendChild(plus);
            }
        });
    }

    renderOutputSlot(resultData) {
        if (!this.outputContainer) return;

        this.outputContainer.innerHTML = '';

        const resultId = resultData?.resultId;
        const item = resultId ? { id: resultId } : null;

        const slot = this.createItemSlot(item, -1, true);

        if (resultId) {
            slot.classList.add('active-output');
            slot.onclick = () => {
                this.handleOutputClick();
            };
        } else {
            slot.classList.add('disabled-output');
        }

        this.outputContainer.appendChild(slot);
    }

    renderInventory() {
        if (!this.inventoryContainer) return;

        this.inventoryContainer.innerHTML = '';
        const size = 10;

        for (let i = 0; i < size; i++) {
            const slotData = this.localInventory[i];
            const item = slotData ? slotData.item : null;
            const slot = this.createItemSlot(item, i, false, true);
            this.inventoryContainer.appendChild(slot);
        }
    }

    createItemSlot(item, index, isOutput, isInventory = false) {
        const box = document.createElement('div');
        box.className = 'item-slot';

        if (isOutput) {
            box.classList.add('output-item-box');
        }

        if (item) {
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

            box.title = label;

            if (!isOutput) {
                box.onclick = () => {
                    if (isInventory) {
                        this.handleInventoryItemClick(index);
                    } else {
                        this.handleCraftingSlotClick(index);
                    }
                };
                box.style.cursor = 'pointer';
            }
        }

        return box;
    }

    handleInventoryItemClick(inventoryIndex) {
        const slotData = this.localInventory[inventoryIndex];
        if (!slotData) return;

        // Find first empty crafting slot
        const emptySlotIndex = this.craftingSlots.findIndex(s => s === null);
        if (emptySlotIndex !== -1) {
            // Move to crafting slot
            this.craftingSlots[emptySlotIndex] = slotData;
            this.localInventory[inventoryIndex] = null;

            // Update system
            craftingSystem.setCombination(emptySlotIndex, slotData.item);

            this.renderInventory();
            this.renderCraftingSlots();
        }
    }

    handleCraftingSlotClick(slotIndex) {
        const slotData = this.craftingSlots[slotIndex];
        if (!slotData) return;

        // Move back to inventory at original index if possible, or find first empty?
        // The user said "copied in", so we should probably try to put it back where it was
        // to maintain the visual "gap" if we want, OR just put it back in the array.
        // Since we are using a fixed size array with nulls, we can put it back at originalIndex
        // IF that spot is still null (it should be, unless we have complex logic).
        // Actually, since we only move FROM inventory TO crafting, the spot at originalIndex MUST be null.

        // Wait, if we have multiple items of same type, originalIndex is unique.
        // So yes, we can put it back at originalIndex.

        // However, if we want to be robust:
        if (this.localInventory[slotData.originalIndex] === null) {
            this.localInventory[slotData.originalIndex] = slotData;
        } else {
            // Fallback: find any empty slot
            const emptyIndex = this.localInventory.findIndex(s => s === null);
            if (emptyIndex !== -1) {
                this.localInventory[emptyIndex] = slotData;
            } else {
                console.error('No space to return item to inventory');
                return;
            }
        }

        this.craftingSlots[slotIndex] = null;
        craftingSystem.setCombination(slotIndex, null);

        this.renderInventory();
        this.renderCraftingSlots();
    }

    handleOutputClick() {
        const resultId = craftingSystem.getResult();
        if (!resultId) return;

        // Collect consumed indices
        const consumedIndices = this.craftingSlots
            .filter(s => s !== null)
            .map(s => s.originalIndex);

        // Emit commit event
        eventBus.emit('craftingCommit', {
            result: resultId,
            consumedIndices: consumedIndices
        });

        // Reset the crafting slots and update the UI
        this.resetCraftingState();
        this.renderCraftingSlots();
        this.renderOutputSlot(null);
    }

    teardown() {
        // Teardown removed as per user request to fix event listener issues
        this.rendered = false;
        craftingSystem.clearCombination();
    }

    // Helpers copied/adapted from RecipeListView
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
        if (!item) return 'Unknown';
        if (typeof item === 'object') {
            if (typeof item.name === 'string' && item.name.trim().length > 0) return item.name.trim();
            if (typeof item.id === 'string' && item.id.trim().length > 0) return this.formatReadableId(item.id.trim());
        }
        if (typeof item === 'string') {
            const trimmed = item.trim();
            if (trimmed.length > 0) return this.formatReadableId(trimmed);
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

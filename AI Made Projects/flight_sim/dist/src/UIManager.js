import { eventBus } from './eventBus.js';
import * as THREE from 'three';
import { imageRegistry } from './ImageRegistry.js';
import { getIconDescriptor, getIconSignature } from './items/icon-utils.js';

export class UIManager {
    constructor(itemFactory) {
        this.itemFactory = itemFactory;
        this.starCount = document.getElementById('star-count');
        this.healthDisplay = document.getElementById('health');
        this.healthFill = document.getElementById('health-fill');
        this.healthText = document.getElementById('health-text');
        this.lastKnownHealth = 0;
        this.lastKnownMaxHealth = 1;
        this.statSpeed = document.getElementById('stat-speed');
        this.statSize = document.getElementById('stat-size');
        this.statRotation = document.getElementById('stat-rotation');
        this.statMaxSpeed = document.getElementById('stat-max-speed');
        this.statAcceleration = document.getElementById('stat-acceleration');
        this.minimapContainer = document.getElementById('minimap');
        this.statsOverlay = document.getElementById('hud-stats');
        this.inventorySlotsContainer = document.getElementById('inventory-slots');
        this.inventoryAddBtn = document.getElementById('inventory-add');
        this.inventorySize = 10;
        this.inventoryItems = [];
        this.inventoryCooldownValues = new Array(this.inventorySize).fill(0);
        this.inventoryCooldownOverlays = new Array(this.inventorySize).fill(null);
        this.inventorySlotElements = new Array(this.inventorySize).fill(null);
        this.inventorySlotStates = new Array(this.inventorySize).fill(null);
        this.inventorySlotsInitialized = false;

        this.buildingCounter = document.getElementById('building-counter');
        this.shieldOverlay = document.getElementById('shield-overlay');

        this.dots = [];
        this.statsVisible = false;

        eventBus.on('updateStarDisplay', (starCount) => this.updateStarDisplay(starCount));
        eventBus.on('updateHealthDisplay', (health, maxHealth) => this.updateHealthDisplay(health, maxHealth));
        eventBus.on('updateStatsPanel', (stats) => this.updateStatsPanel(stats));
        eventBus.on('renderMinimap', (dots) => this.renderMinimap(dots));
        eventBus.on('toggleStatsOverlay', () => this.toggleStatsOverlay());
        eventBus.on('updateBuildingCounter', (current, total) => this.updateBuildingCounter(current, total));
        eventBus.on('shieldStateChanged', (payload) => {
            const isActive = Boolean(payload && Object.prototype.hasOwnProperty.call(payload, 'active') ? payload.active : payload);
            this.updateShieldOverlay(isActive);
        });
        if (this.inventoryAddBtn) {
            this.inventoryAddBtn.addEventListener('click', () => eventBus.emit('requestInventoryItem'));
        }

        eventBus.on('inventoryUpdated', (items) => this.renderInventory(items));
        eventBus.on('updateInventoryCooldowns', (cooldowns) => this.updateInventoryCooldowns(cooldowns));

        this.renderInventory([]);
        this.updateHealthDisplay(100, 100);
        this.updateShieldOverlay(false);
    }

    updateStarDisplay(starCount) {
        if (this.starCount) {
            this.starCount.textContent = `${starCount}`;
        }
    }

    updateHealthDisplay(health, maxHealth) {
        if (!this.healthFill || !this.healthText) return;
        const incomingMax = Number(maxHealth);
        if (Number.isFinite(incomingMax) && incomingMax > 0) {
            this.lastKnownMaxHealth = incomingMax;
        }

        const safeMax = Math.max(1, this.lastKnownMaxHealth);
        if (Number.isFinite(health)) {
            this.lastKnownHealth = Math.max(0, health);
        }

        const safeHealth = this.lastKnownHealth;
        const percent = THREE.MathUtils.clamp(safeHealth / safeMax, 0, 1);
        this.healthFill.style.width = `${(percent * 100).toFixed(1)}%`;

        const intensity = Math.max(0.25, percent);
        const backgroundAlpha = 0.45 + 0.4 * intensity;
        this.healthFill.style.backgroundColor = `rgba(200, 30, 30, ${backgroundAlpha.toFixed(2)})`;
        const roundedHealth = Math.round(safeHealth);
        const roundedMax = Math.round(safeMax);
        this.healthText.textContent = `${roundedHealth}/${roundedMax}`;
    }

    updateStatsPanel(stats) {
        if (!stats || !this.statSpeed || !this.statSize || !this.statRotation || !this.statMaxSpeed || !this.statAcceleration) return;
        this.statSpeed.textContent = `Speed: ${stats.speed.toFixed(2)}`;
        this.statSize.textContent = `Size: ${stats.size.toFixed(2)}`;
        const rotationDeg = THREE.MathUtils.radToDeg(stats.rotationSpeed);
        this.statRotation.textContent = `Rotation: ${rotationDeg.toFixed(1)}°/s`;
        this.statMaxSpeed.textContent = `Max Speed: ${stats.maxSpeed.toFixed(2)}`;
        this.statAcceleration.textContent = `Acceleration: ${stats.acceleration.toFixed(2)}`;
    }

    toggleStatsOverlay() {
        this.setStatsVisible(!this.statsVisible);
    }

    setStatsVisible(visible) {
        this.statsVisible = visible;
        if (!this.statsOverlay) return;
        this.statsOverlay.style.visibility = visible ? 'visible' : 'hidden';
    }



    renderInventory(items) {
        if (!this.inventorySlotsContainer) return;
        this.inventoryItems = items ?? [];

        if (!this.inventorySlotsInitialized) {
            this.inventorySlotsContainer.innerHTML = '';
            this.inventorySlotsInitialized = true;
        }

        if (!Array.isArray(this.inventorySlotElements) || this.inventorySlotElements.length !== this.inventorySize) {
            this.inventorySlotElements = new Array(this.inventorySize).fill(null);
        }
        if (!Array.isArray(this.inventorySlotStates) || this.inventorySlotStates.length !== this.inventorySize) {
            this.inventorySlotStates = new Array(this.inventorySize).fill(null);
        }

        for (let i = 0; i < this.inventorySize; i++) {
            const item = this.inventoryItems[i];
            const slot = this.ensureInventorySlot(i);
            this.updateInventorySlot(slot, item, i);
        }
    }

    ensureInventorySlot(index) {
        if (!this.inventorySlotElements[index] || !this.inventorySlotElements[index].isConnected) {
            const slot = document.createElement('div');
            slot.className = 'inventory-slot item-slot';
            const content = document.createElement('div');
            content.className = 'inventory-slot-content';
            slot.appendChild(content);

            const highlight = document.createElement('div');
            highlight.className = 'inventory-highlight';
            slot.appendChild(highlight);

            slot._contentElement = content;
            slot._highlightElement = highlight;

            this.inventorySlotElements[index] = slot;
            this.inventoryCooldownOverlays[index] = highlight;
            this.inventorySlotsContainer.appendChild(slot);
        }

        return this.inventorySlotElements[index];
    }

    updateInventorySlot(slot, item, index) {
        if (!slot) {
            return;
        }

        const signature = this.computeItemSignature(item);
        if (this.inventorySlotStates[index] !== signature) {
            this.inventorySlotStates[index] = signature;
            const content = slot._contentElement || slot;
            while (content.firstChild) {
                content.removeChild(content.firstChild);
            }

            if (item) {
                slot.dataset.itemId = item.id;
                slot.dataset.itemIndex = index;
                const title = this.getItemTitle(item);
                if (title) {
                    slot.title = title;
                } else {
                    slot.removeAttribute('title');
                }

                const iconElement = this.createItemIconElement(item, title);
                if (iconElement) {
                    content.appendChild(iconElement);
                } else {
                    content.textContent = title || '?';
                }
            } else {
                delete slot.dataset.itemId;
                delete slot.dataset.itemIndex;
                slot.removeAttribute('title');
                (slot._contentElement || slot).textContent = '';
            }
        }

        const highlight = slot._highlightElement;
        const storedValue = this.inventoryCooldownValues[index] ?? 0;
        this.applyCooldownToOverlay(highlight, storedValue);
    }

    computeItemSignature(item) {
        if (!item) {
            return '';
        }
        const id = item.id ?? '';
        const name = this.getItemTitle(item);
        const iconSignature = getIconSignature(item);
        return `${id}|${name}|${iconSignature}`;
    }

    createItemIconElement(item, title) {
        if (!item) {
            return null;
        }

        const descriptor = getIconDescriptor(item, { fallbackToId: true });
        if (!descriptor) {
            return null;
        }

        if (descriptor.type === 'image') {
            const img = imageRegistry.createImageElement(descriptor.value, { alt: title, className: 'item-slot-icon' });
            if (img) {
                return img;
            }
            return null;
        }

        const span = document.createElement('span');
        span.textContent = descriptor.value;
        span.className = 'item-slot-text-icon';
        return span;
    }

    getItemTitle(item) {
        if (!item) {
            return '';
        }
        const name = typeof item.name === 'string' ? item.name.trim() : '';
        if (name) {
            return name;
        }
        const id = typeof item.id === 'string' ? item.id.trim() : '';
        return id;
    }

    updateInventoryCooldowns(cooldowns) {
        if (!Array.isArray(cooldowns)) {
            return;
        }

        if (!Array.isArray(this.inventoryCooldownValues) || this.inventoryCooldownValues.length !== this.inventorySize) {
            this.inventoryCooldownValues = new Array(this.inventorySize).fill(0);
        }

        const limit = Math.min(this.inventorySize, cooldowns.length);
        for (let i = 0; i < this.inventorySize; i++) {
            const value = i < limit ? Number(cooldowns[i]) : 0;
            const clamped = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
            this.inventoryCooldownValues[i] = clamped;

            const overlay = this.inventoryCooldownOverlays[i];
            this.applyCooldownToOverlay(overlay, clamped);
        }
    }

    applyCooldownToOverlay(overlay, value) {
        if (!overlay) {
            return;
        }

        const clamped = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
        if (clamped <= 0) {
            overlay.style.height = '0%';
            overlay.style.opacity = '0';
        } else {
            overlay.style.height = `${(clamped * 100).toFixed(1)}%`;
            overlay.style.opacity = '1';
        }
    }

    clearMinimap() {
        // Hide all existing dots instead of removing them
        this.dots.forEach(dot => {
            dot.style.display = 'none';
        });
    }

    renderMinimap(dots) {
        if (!this.minimapContainer) return;

        // Reuse existing DOM elements instead of creating new ones every frame
        let dotIndex = 0;

        dots.forEach(dotInfo => {
            let dot;

            // Reuse existing dot or create new one if needed
            if (dotIndex < this.dots.length) {
                dot = this.dots[dotIndex];
                dot.style.display = 'block';
                // Update className if it changed
                const expectedClass = `minimap-dot ${dotInfo.className}`;
                if (dot.className !== expectedClass) {
                    dot.className = expectedClass;
                }
            } else {
                // Create new dot only if we don't have enough
                dot = document.createElement('div');
                dot.className = `minimap-dot ${dotInfo.className}`;
                // Set initial positioning
                dot.style.position = 'absolute';
                dot.style.left = '0';
                dot.style.top = '0';
                this.minimapContainer.appendChild(dot);
                this.dots.push(dot);
            }

            // Use transform instead of left/top for better performance
            dot.style.transform = `translate(${dotInfo.x}px, ${dotInfo.z}px)`;
            dotIndex++;
        });

        // Hide any extra dots we didn't use
        for (let i = dotIndex; i < this.dots.length; i++) {
            this.dots[i].style.display = 'none';
        }
    }

    updateBuildingCounter(current, total) {
        if (!this.buildingCounter) return;
        this.buildingCounter.textContent = `Buildings: ${current}/${total}`;
    }

    updateShieldOverlay(isActive) {
        if (!this.shieldOverlay) {
            return;
        }

        if (isActive) {
            this.shieldOverlay.classList.add('active');
        } else {
            this.shieldOverlay.classList.remove('active');
        }
    }
}




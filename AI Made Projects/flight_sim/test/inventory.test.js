
import { describe, it, expect } from './test-framework.js';
import { Inventory } from '../src/inventory.js';
import { eventBus } from '../src/eventBus.js';

describe('Inventory', () => {
    it('should add an item when requestInventoryItem event is emitted', () => {
        // Setup
        const itemPool = [{ id: 'test-item', name: 'Test Item' }];
        const itemFactory = { getItemDefinition: () => ({}) };
        const scheduler = { now: () => 0 };
        const inventory = new Inventory(itemPool, itemFactory, scheduler);

        // Initial state check
        expect(inventory.items.length).toBe(0);

        // Simulate event
        eventBus.emit('requestInventoryItem');

        // Verify state
        expect(inventory.items.length).toBe(1);
        expect(inventory.items[0].id).toBe('test-item');
    });

    it('should not add items when inventory is full', () => {
        // Setup
        const itemPool = [{ id: 'test-item', name: 'Test Item' }];
        const itemFactory = { getItemDefinition: () => ({}) };
        const scheduler = { now: () => 0 };
        const inventory = new Inventory(itemPool, itemFactory, scheduler);

        // Fill inventory (default size is 10)
        for (let i = 0; i < 10; i++) {
            eventBus.emit('requestInventoryItem');
        }

        expect(inventory.items.length).toBe(10);

        // Try to add one more
        eventBus.emit('requestInventoryItem');

        // Verify it didn't change
        expect(inventory.items.length).toBe(10);
    });
});

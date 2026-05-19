import { describe, it, expect } from './test-harness.js';
import { BuildingManager } from '../src/building.js';
import { eventBus } from '../src/eventBus.js';

describe('Building Item Persistence', () => {
    it('should remove item from scene when building is destroyed', () => {
        const scene = new THREE.Scene();
        const renderer = { capabilities: {} };
        const buildingManager = new BuildingManager(scene, renderer);

        // Mock building collider
        const building = {
            cx: 0, cy: 0, cz: 0,
            hx: 5, hy: 5, hz: 5,
            health: 100,
            maxHealth: 100,
            destroyed: false,
            item: null,
            instancedMesh: new THREE.InstancedMesh(),
            instanceId: 0
        };
        buildingManager.buildingColliders.push(building);

        // Mock item
        const item = {
            mesh: new THREE.Mesh(),
            dispose: () => { },
            building: null
        };

        // Add item to building
        buildingManager.addItemToBuilding(building, item);

        // Verify item is attached
        expect(building.item).to.equal(item);
        expect(item.building).to.equal(building);

        // Track scene removal via mock
        scene.add(item.mesh); // Simulate item being in the scene
        expect(scene.children).to.contain(item.mesh);

        // Destroy building
        buildingManager.destroyBuilding(building);

        // Verify building is destroyed
        expect(building.destroyed).to.be.true;
        expect(building.item).to.be.null;

        // Verify item removal from scene
        expect(scene.children).to.not.contain(item.mesh);
    });
});

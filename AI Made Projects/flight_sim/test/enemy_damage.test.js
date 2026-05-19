
import { describe, it, expect } from './test-framework.js';
import * as THREE from 'three';
import { RedEnemy } from '../src/enemies/RedEnemy.js';
import { OrangeEnemy } from '../src/enemies/OrangeEnemy.js';
import { BlackEnemy } from '../src/enemies/BlackEnemy.js';
import { BuildingManager } from '../src/building.js';

// Mock Scheduler
class MockScheduler {
    constructor() {
        this.currentTime = 0;
    }
    now() {
        return this.currentTime;
    }
    setTimeout(fn, delay) {
        // For this test we might not need actual timeouts, 
        // or we can just execute them immediately if needed.
        // But enemies use it for flashing, which is visual.
        return { cancel: () => { } };
    }
    tick(delta) {
        this.currentTime += delta;
    }
}

// Mock Scene
class MockScene {
    add() { }
    remove() { }
}

// Mock Renderer
class MockRenderer {
    constructor() {
        this.capabilities = { getMaxAnisotropy: () => 1 };
    }
}

describe('Enemy Building Damage', () => {
    it('should cause damage to buildings when enemies are nearby', () => {
        const scheduler = new MockScheduler();
        const scene = new MockScene();
        const renderer = new MockRenderer();

        // Setup BuildingManager
        const buildingManager = new BuildingManager(scene, renderer, scheduler);

        // Manually add 3 buildings far apart
        // Building 1: Near (0, 0, 0)
        const b1 = {
            cx: 10, cy: 10, cz: 10,
            hx: 5, hy: 10, hz: 5,
            health: 100, maxHealth: 100,
            destroyed: false,
            instancedMesh: { setColorAt: () => { }, instanceColor: { needsUpdate: false } }, // Mock mesh
            instanceId: 0
        };

        // Building 2: Near (1000, 0, 0)
        const b2 = {
            cx: 1010, cy: 10, cz: 10,
            hx: 5, hy: 10, hz: 5,
            health: 100, maxHealth: 100,
            destroyed: false,
            instancedMesh: { setColorAt: () => { }, instanceColor: { needsUpdate: false } },
            instanceId: 1
        };

        // Building 3: Near (2000, 0, 0)
        const b3 = {
            cx: 2010, cy: 10, cz: 10,
            hx: 5, hy: 10, hz: 5,
            health: 100, maxHealth: 100,
            destroyed: false,
            instancedMesh: { setColorAt: () => { }, instanceColor: { needsUpdate: false } },
            instanceId: 2
        };

        buildingManager.buildingColliders = [b1, b2, b3];

        // Setup Enemies with 0 movement speed so they stay put
        // Red Enemy near b1
        const redEnemy = new RedEnemy({
            position: new THREE.Vector3(0, 10, 0),
            movementSpeed: 0,
            scheduler: scheduler,
            buildingShootCooldown: 1 // Fast cooldown for testing
        });

        // Orange Enemy near b2
        const orangeEnemy = new OrangeEnemy({
            position: new THREE.Vector3(1000, 10, 0),
            movementSpeed: 0,
            scheduler: scheduler,
            buildingShootCooldown: 1
        });

        // Black Enemy near b3
        const blackEnemy = new BlackEnemy({
            position: new THREE.Vector3(2000, 10, 0),
            movementSpeed: 0,
            scheduler: scheduler,
            buildingShootCooldown: 1
        });

        const enemies = [redEnemy, orangeEnemy, blackEnemy];

        // Simulation Loop
        const dt = 0.1;
        const totalTime = 5.0; // Run for 5 seconds

        // Initial check
        expect(b1.health).toBe(100);
        expect(b2.health).toBe(100);
        expect(b3.health).toBe(100);

        for (let t = 0; t < totalTime; t += dt) {
            scheduler.tick(dt);

            // Update enemies
            enemies.forEach(enemy => {
                enemy.update(dt, null, buildingManager.buildingColliders);

                // Manually update bullets since we don't have the full map loop
                enemy.bullets.forEach(bullet => {
                    if (bullet.update) bullet.update(dt);
                });
            });

            // Check collisions
            buildingManager.checkEnemyBulletsAgainstBuildings(enemies);
        }

        // Verify damage
        // Each enemy should have fired at least once (cooldown 1s, run 5s)
        // And bullets should have hit (distance ~17 units, speed ~22, time < 1s)

        expect(b1.health).toBeLessThan(100);
        expect(b2.health).toBeLessThan(100);
        expect(b3.health).toBeLessThan(100);

        // Optional: Ensure they didn't damage each other's buildings (too far)
        // Since we reset the loop and they are far apart, this is implicitly tested by the setup,
        // but we can't easily check "who damaged who" without more complex logic.
        // But we know they are 1000 units apart and range is 150.
    });
});

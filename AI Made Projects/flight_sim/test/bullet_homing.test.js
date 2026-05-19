import { describe, it, expect } from './test-framework.js';
import * as THREE from 'three';
import { PlayerBullet } from '../src/playerBullet.js';
import { Plane } from '../src/plane.js'; // Import the real Plane

// Mock Enemy
class MockEnemy {
    constructor(position) {
        this.position = position.clone();
        this.isLive = true;
        this.hitRadius = 5;
        this.health = 100;
        this.movementSpeed = 0;
    }

    takeDamage(amount) {
        this.health -= amount;
        return this.health <= 0;
    }
}

// Mock Game
class MockGame {
    constructor() {
        this.enemies = [];
        this.enemyManager = {
            getEnemies: () => this.enemies
        };
    }
}

// Refined Mock Plane that uses the actual Plane's fire method
class MockPlaneForBulletSpawn extends Plane {
    constructor(game) {
        super(game);
        this.game = game;
        this.homing_radius = 10;
        this.bullets = [];
        this.position = new THREE.Vector3(0, 0, 0); // Set a known starting position
        this.moveDirection = new THREE.Vector3(0, 0, -1); // Set a known move direction
        this.speed = 10; // Set a known speed
        this.bulletSpawnOffset = 2.0; // Ensure this is set for the test
    }

    // Override methods that interact with the scene or other managers not mocked
    registerBullet(bullet) {
        this.bullets.push(bullet);
        return true;
    }

    removeBullet(bullet) {
        const index = this.bullets.indexOf(bullet);
        if (index !== -1) {
            this.bullets.splice(index, 1);
        }
    }

    handleBulletDestroyed(bullet) {
        this.removeBullet(bullet);
    }
}


describe('Bullet Homing', () => {
    it('should hit enemy directly in front', async () => {
        const game = new MockGame();
        const enemy = new MockEnemy(new THREE.Vector3(0, 0, -50));
        game.enemies.push(enemy);

        const plane = new MockPlaneForBulletSpawn(game); // Use the refined mock
        const startPos = new THREE.Vector3(0, 0, 0); // This will be ignored by the refined mock
        const direction = new THREE.Vector3(0, 0, -1);

        const bullet = new PlayerBullet({
            plane: plane,
            position: startPos, // This initial position will be overridden by the fire method's logic
            direction: direction,
            speed: 50, // fast enough to hit quickly
            damage: 10
        });
        plane.bullets.push(bullet);

        // Simulate
        const delta = 0.1;
        // 50 units distance / 50 speed = 1 second. 
        // Let's run for 1.5 seconds to be sure.
        for (let i = 0; i < 15; i++) {
            bullet.update(delta);

            // Manually check collision since we don't have the full Plane.updateBullets loop
            const dist = bullet.position.distanceTo(enemy.position);
            if (dist < enemy.hitRadius) {
                enemy.takeDamage(bullet.damage);
                break;
            }
        }

        expect(enemy.health).toBe(90); // Started at 100, took 10 damage
    });

    it('should home in on enemy within radius', async () => {
        const game = new MockGame();
        const enemy = new MockEnemy(new THREE.Vector3(0, 0, -50));
        game.enemies.push(enemy);

        const plane = new MockPlaneForBulletSpawn(game); // Use the refined mock
        // Position slightly to the left, within homing radius (10)
        // 9 units left
        const startPos = new THREE.Vector3(-9, 0, 0); // This will be ignored by the refined mock
        const direction = new THREE.Vector3(0, 0, -1); // Firing straight forward, parallel to enemy

        const bullet = new PlayerBullet({
            plane: plane,
            position: startPos, // This initial position will be overridden by the fire method's logic
            direction: direction,
            speed: 50,
            damage: 10
        });
        plane.bullets.push(bullet);

        // Simulate
        const delta = 0.1;
        for (let i = 0; i < 20; i++) {
            bullet.update(delta);

            const dist = bullet.position.distanceTo(enemy.position);
            if (dist < enemy.hitRadius) {
                enemy.takeDamage(bullet.damage);
                break;
            }
        }

        expect(enemy.health).toBe(90);
    });

    it('should NOT home in on enemy outside radius', async () => {
        const game = new MockGame();
        const enemy = new MockEnemy(new THREE.Vector3(0, 0, -50));
        game.enemies.push(enemy);

        const plane = new MockPlaneForBulletSpawn(game); // Use the refined mock
        // Position further to the left, outside homing radius (10)
        // 15 units left
        const startPos = new THREE.Vector3(-15, 0, 0); // This will be ignored by the refined mock
        const direction = new THREE.Vector3(0, 0, -1);

        const bullet = new PlayerBullet({
            plane: plane,
            position: startPos, // This initial position will be overridden by the fire method's logic
            direction: direction,
            speed: 50,
            damage: 10
        });
        plane.bullets.push(bullet);

        // Simulate
        const delta = 0.1;
        for (let i = 0; i < 20; i++) {
            bullet.update(delta);

            const dist = bullet.position.distanceTo(enemy.position);
            if (dist < enemy.hitRadius) {
                enemy.takeDamage(bullet.damage);
                break;
            }
        }

        expect(enemy.health).toBe(100); // Should not have hit
    });

    it('should spawn bullet ahead of plane by bulletSpawnOffset', () => {
        const game = new MockGame();
        const plane = new MockPlaneForBulletSpawn(game);
        plane.position.set(10, 20, 30); // Set a distinct plane position
        plane.moveDirection.set(0, 0, -1); // Plane moving forward along -Z

        const fireDirection = new THREE.Vector3(0, 0, -1); // Firing straight ahead

        const bullet = plane.fire(fireDirection, 10);

        if (!bullet) {
            throw new Error("Expected bullet to be created");
        }

        // Calculate expected position: plane.position + fireDirection * bulletSpawnOffset
        const expectedPosition = new THREE.Vector3().copy(plane.position).addScaledVector(fireDirection, plane.bulletSpawnOffset);

        // Check if the bullet's position is close to the expected position
        const tolerance = 0.001;
        if (Math.abs(bullet.position.x - expectedPosition.x) > tolerance) {
             throw new Error(`Expected bullet x to be ${expectedPosition.x}, got ${bullet.position.x}`);
        }
        if (Math.abs(bullet.position.y - expectedPosition.y) > tolerance) {
             throw new Error(`Expected bullet y to be ${expectedPosition.y}, got ${bullet.position.y}`);
        }
        if (Math.abs(bullet.position.z - expectedPosition.z) > tolerance) {
             throw new Error(`Expected bullet z to be ${expectedPosition.z}, got ${bullet.position.z}`);
        }
    });
});
import * as THREE from 'three';
import { RedEnemy } from './RedEnemy.js';
import { OrangeEnemy } from './OrangeEnemy.js';
import { BlackEnemy } from './BlackEnemy.js';
import { GameScheduler } from '../GameScheduler.js';
import { tier1Items } from '../items/ItemRegistry.js';


const ENEMY_RESPAWN_DELAY = 1.5;

export class EnemyManager {
    // Private fields
    #game;
    #enemies;
    #pendingEnemySpawns;
    #enemySpawnRadius;
    #enemyPatrolRadius;
    #enemyApproachRadius;
    #enemyFlightAltitude;
    #enemyMovementSpeed;
    #enemyBuildingTargetRange;
    #enemyBuildingBulletDamage;
    #cityBoundary;

    constructor(game) {
        this.#game = game;
        this.#enemies = [];
        this.#pendingEnemySpawns = [];

        this.#enemySpawnRadius = 720;
        this.#enemyPatrolRadius = 650;
        this.#enemyApproachRadius = this.#enemyPatrolRadius * 0.35;
        this.#enemyFlightAltitude = 12;
        this.#enemyMovementSpeed = 12;
        this.#enemyBuildingTargetRange = 150;
        this.#enemyBuildingBulletDamage = 10;
        this.#cityBoundary = 600;

        this.spawnTimer = 0;
        this.redKillCount = 0;
        this.orangeKillCount = 0;
    }

    // ========== PUBLIC METHODS ==========

    getEnemies() {
        return this.#enemies;
    }

    init() {
        this.#spawnInitialWave();
    }

    update(delta, playerPosition, playerVelocity) {
        this.#updateSpawnTimer(delta);
        this.#updateEnemyRespawns(delta);
        this.#updateEnemies(delta, playerPosition, playerVelocity);
        this.#updateBullets(delta);
    }

    spawnEnemyAtEdge() {
        this.#spawnEnemy('red');
    }

    // Check collisions between player bullets and enemies
    checkPlayerBulletCollisions(playerBullets, removeBulletCallback) {
        if (!playerBullets || playerBullets.length === 0) {
            return;
        }

        for (let i = playerBullets.length - 1; i >= 0; i--) {
            const bullet = playerBullets[i];
            for (let j = this.#enemies.length - 1; j >= 0; j--) {
                const enemy = this.#enemies[j];
                if (enemy.isDestroyed) {
                    this.#enemies.splice(j, 1);
                    continue;
                }

                const distance = bullet.position.distanceTo(enemy.position);
                if (distance <= enemy.hitRadius) {
                    const destroyed = enemy.takeDamage(bullet.damage);
                    if (destroyed) {
                        this.handleEnemyDestruction(enemy);
                    }
                    if (removeBulletCallback) {
                        removeBulletCallback(bullet);
                    }
                    break;
                }
            }
        }
    }

    // Check collisions between turret bullets and enemies
    checkTurretBulletCollisions(turretBullets) {
        if (!turretBullets || turretBullets.length === 0) {
            return;
        }

        for (let i = turretBullets.length - 1; i >= 0; i--) {
            const bullet = turretBullets[i];
            let removeBullet = false;

            for (let j = this.#enemies.length - 1; j >= 0; j--) {
                const enemy = this.#enemies[j];
                if (enemy.isDestroyed) {
                    this.#enemies.splice(j, 1);
                    continue;
                }

                const distance = bullet.position.distanceTo(enemy.position);
                if (distance <= enemy.hitRadius) {
                    const destroyed = enemy.takeDamage(bullet.damage);
                    if (destroyed) {
                        this.handleEnemyDestruction(enemy);
                    }
                    removeBullet = true;
                    break;
                }
            }

            if (removeBullet) {
                bullet.destroy();
                turretBullets.splice(i, 1);
            }
        }
    }

    handleEnemyDestruction(enemy) {
        if (!enemy) {
            return;
        }

        const index = this.#enemies.indexOf(enemy);
        if (index !== -1) {
            this.#enemies.splice(index, 1);
        }

        if (enemy.type === 'red') {
            this.redKillCount++;
            if (this.redKillCount % 5 === 0) {
                this.#spawnEnemy('orange');
            }
        } else if (enemy.type === 'orange') {
            this.orangeKillCount++;
            if (this.orangeKillCount % 5 === 0) {
                this.#spawnEnemy('black');
            }

            // Drop random tier 1 item if inventory has space
            this.#dropTier1Item();
        }

        if (this.#game && typeof this.#game.onEnemyDestroyed === 'function') {
            this.#game.onEnemyDestroyed(enemy);
        }
    }

    // ========== PRIVATE METHODS ==========

    #updateSpawnTimer(delta) {
        this.spawnTimer += delta;
        if (this.spawnTimer >= 5.0) {
            this.spawnTimer = 0;
            this.#spawnEnemy('red');
        }
    }

    #createEnemies() {
        this.#spawnEnemy('red');
    }

    #spawnInitialWave() {
        const orangeCount = 5;
        const totalCount = 20;
        const altitude = this.#enemyFlightAltitude;

        for (let i = 0; i < orangeCount; i++) {
            const x = (Math.random() * this.#cityBoundary * 2) - this.#cityBoundary;
            const z = (Math.random() * this.#cityBoundary * 2) - this.#cityBoundary;
            const position = new THREE.Vector3(x, altitude, z);
            this.#spawnEnemy('orange', position);
        }

        const remaining = Math.max(0, totalCount - orangeCount);
        for (let i = 0; i < remaining; i++) {
            const x = (Math.random() * this.#cityBoundary * 2) - this.#cityBoundary;
            const z = (Math.random() * this.#cityBoundary * 2) - this.#cityBoundary;
            const position = new THREE.Vector3(x, altitude, z);
            this.#spawnEnemy('red', position);
        }
    }

    #spawnMediumEnemy() {
        this.#spawnEnemy('orange');
    }

    #spawnBlackEnemy() {
        this.#spawnEnemy('black', new THREE.Vector3(0, this.#enemyFlightAltitude, 0));
    }

    #updateEnemies(delta, playerPosition, playerVelocity) {
        for (let i = this.#enemies.length - 1; i >= 0; i--) {
            const enemy = this.#enemies[i];
            if (enemy.isDestroyed) {
                this.#enemies.splice(i, 1);
                continue;
            }

            enemy.update(delta, playerPosition, this.#game.buildingManager.buildingColliders, playerVelocity);

            // Check if red enemies have flown out of bounds
            if (enemy.type === 'red' && typeof enemy.isOutOfBounds === 'function' && enemy.isOutOfBounds()) {
                enemy.destroy();
                this.#enemies.splice(i, 1);
                this.spawnEnemyAtEdge();
            }
        }
    }

    #updateBullets(delta) {
        const bulletDelta = Math.min(delta, 0.2);

        for (let i = this.#enemies.length - 1; i >= 0; i--) {
            const enemy = this.#enemies[i];
            if (enemy.isDestroyed) {
                this.#enemies.splice(i, 1);
                continue;
            }

            for (let j = enemy.bullets.length - 1; j >= 0; j--) {
                const bullet = enemy.bullets[j];
                bullet.update(bulletDelta);
                if (bullet.isExpired()) {
                    if (bullet && typeof bullet.destroy === 'function') {
                        bullet.destroy();
                    }
                    enemy.bullets.splice(j, 1);
                }
            }
        }
    }

    #scheduleEnemySpawn(type, delay = ENEMY_RESPAWN_DELAY) {
        if (!type) {
            return;
        }

        if (!Number.isFinite(delay) || delay <= 0) {
            this.#spawnScheduledEnemy(type);
            return;
        }

        this.#pendingEnemySpawns.push({ type, time: delay });
    }

    #updateEnemyRespawns(delta) {
        if (this.#pendingEnemySpawns.length === 0) {
            return;
        }

        for (let i = this.#pendingEnemySpawns.length - 1; i >= 0; i--) {
            const entry = this.#pendingEnemySpawns[i];
            entry.time -= delta;
            if (entry.time <= 0) {
                this.#spawnScheduledEnemy(entry.type);
                this.#pendingEnemySpawns.splice(i, 1);
            }
        }
    }

    #spawnScheduledEnemy(type) {
        if (type === 'medium') {
            this.#spawnMediumEnemy();
        } else if (type === 'basic') {
            this.spawnEnemyAtEdge();
        }
    }

    #spawnEnemy(enemyType, position = null, initialDirection = null) {
        const altitude = this.#enemyFlightAltitude;
        if (!position) {
            const angle = Math.random() * Math.PI * 2;
            const radius = this.#cityBoundary - 10;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            position = new THREE.Vector3(x, altitude, z);
        }

        let enemy;
        const commonOptions = {
            position,
            flightAltitude: altitude,
            baseMovementSpeed: this.#enemyMovementSpeed,
            baseBuildingBulletDamage: this.#enemyBuildingBulletDamage,
            buildingTargetRange: this.#enemyBuildingTargetRange,
            scheduler: this.#game.scheduler,
            cityBoundary: this.#cityBoundary,
        };

        // Behavior options for enemies that need them
        const behaviorOptions = {
            center: new THREE.Vector3(0, altitude, 0),
            patrolRadius: this.#enemyPatrolRadius,
            approachRadius: this.#enemyApproachRadius,
            turnSpeed: 1.0,
            speed: this.#enemyMovementSpeed,
            cityBoundary: this.#cityBoundary,
        };

        switch (enemyType) {
            case 'red':
                enemy = new RedEnemy({
                    ...commonOptions,
                    behaviorOptions,
                });
                break;
            case 'orange':
                enemy = new OrangeEnemy({
                    ...commonOptions,
                    behaviorOptions,
                });
                break;
            case 'black':
                enemy = new BlackEnemy({
                    position,
                    flightAltitude: altitude,
                });
                break;
            default:
                console.warn(`Unknown enemy type: ${enemyType}`);
                return;
        }

        this.#enemies.push(enemy);
    }

    #dropTier1Item() {
        // Check if player has inventory space
        if (!this.#game || !this.#game.plane || !this.#game.plane.inventory) {
            return;
        }

        const inventory = this.#game.plane.inventory;

        // Check if inventory has space
        if (inventory.items.length >= inventory.size) {
            return;
        }

        // Pick a random tier 1 item
        const randomItemId = tier1Items[Math.floor(Math.random() * tier1Items.length)];
        const itemDef = inventory.itemTemplates.get(randomItemId);

        if (itemDef) {
            inventory.addItem(itemDef);
        }
    }

}

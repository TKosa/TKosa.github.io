import * as THREE from 'three';
import { enemyGrid } from './SpatialGrid.js';
import { eventBus } from './eventBus.js';
import { Inventory } from './inventory.js';
import { PlayerBullet } from './playerBullet.js';
import { MovementSystem1 } from './MovementSystem1.js';
import { MovementSystem2 } from './MovementSystem2.js';

const UPGRADABLE_PROPERTIES_CONFIG = Object.freeze({
    yawChangeRate: { base: 0.0157, cur: 0.0157, max: 0.0157 * 2.5, alias: 'rotation' },
    maxSpeed: { base: 2.0, cur: 2.0, max: 2.0 * 2.5, alias: 'maxSpeed' },
    throttleAcceleration: { base: 0.02, cur: 0.02, max: 0.02 * 2.5, alias: 'acceleration' },
    size: { base: 1.5, cur: 1.5, min: 1.5 * 0.6, max: 1.5 * 2.5, alias: 'hitbox' },
    starCollectRadius: { base: 3, cur: 3, max: 3 * 2.5, alias: 'starRadius' },
    bulletLifetimeTicks: { base: 1020, cur: 1020, max: 1020 * 2.5, alias: 'bulletLifetime' },
    homing_radius: { base: 10, cur: 10, max: 10 * 2.5, alias: 'homing_radius' },
});

export class Plane {
    static resolveUpgradeId(upgradeId) {
        if (UPGRADABLE_PROPERTIES_CONFIG[upgradeId]) {
            return upgradeId;
        }
        for (const key in UPGRADABLE_PROPERTIES_CONFIG) {
            if (UPGRADABLE_PROPERTIES_CONFIG[key].alias === upgradeId) {
                return key;
            }
        }
        return null;
    }

    constructor(game = null, itemPool, itemFactory, scheduler) {
        this.game = game;
        this.inventory = new Inventory(itemPool, itemFactory, scheduler);

        this.position = new THREE.Vector3(0, 10, 20); // Initial position
        this.quaternion = new THREE.Quaternion();

        this.speed = 0.1;
        this.minSpeed = 0;
        this.throttleDeceleration = 0.04;
        this.maxSpeed = 2.0;
        this.throttleAcceleration = 0.02;
        this.size = 1.5;
        this.starCollectRadius = 3;
        this.bulletLifetimeTicks = 1020;
        this.yawChangeRate = 0.0157;
        this.homing_radius = 10;

        this.pitch = 0;
        this.yaw = 0;
        this.roll = 0;

        this.maxPitch = Infinity;
        this.maxRoll = Math.PI / 4;

        this.globalSensitivity = 1;
        this.horizontalSensitivity = 1;
        this.leftRightRotationBonus = 1;

        this.pitchChangeRate = 0.01;

        this.globalSnapBack = 1;
        this.leftRightSnapBack = 1;

        this.rootDecay = 1;

        this.rollSnapBackRate = 0.022;
        this.rollTiltFactor = 0.45;

        this.minAltitude = 2.0;

        this.maxBullets = 10;
        this.bullets = [];
        this.isShielded = false;

        this.starCollectRadiusSq = this.starCollectRadius * this.starCollectRadius;
        this.controls = {
            throttle: false,
            descend: false,
            pitchUp: false,
            pitchDown: false,
            turnLeft: false,
            turnRight: false,
            rotateLeft: false,
            rotateRight: false
        };

        this.forwardVector = new THREE.Vector3(0, 0, -1);
        this.moveDirection = new THREE.Vector3();
        this.horizontalDirection = new THREE.Vector3();
        this.axisYaw = new THREE.Vector3(0, 1, 0);
        this.axisPitch = new THREE.Vector3(1, 0, 0);
        this.axisRoll = new THREE.Vector3(0, 0, 1);
        this.tempQuaternion = new THREE.Quaternion();
        this.yawQuaternion = new THREE.Quaternion();
        this.pitchQuaternion = new THREE.Quaternion();
        this.rollQuaternion = new THREE.Quaternion();

        this.movementSystem = new MovementSystem1(this);

        this.tempVec1 = new THREE.Vector3();
        this.tempVec2 = new THREE.Vector3();
        this.tempVec3 = new THREE.Vector3();
        this.bulletSpawnOffset = 2.0;
    }

    input(action, isPressed) {
        if (this.movementSystem) {
            return this.movementSystem.input(action, isPressed);
        }
    }

    resetControls() {
        if (this.movementSystem) {
            return this.movementSystem.resetControls();
        }
    }

    update(deltaMultiplier) {
        if (this.movementSystem) {
            return this.movementSystem.update(deltaMultiplier);
        }
    }

    updateOrientation() {
        this.yawQuaternion.setFromAxisAngle(this.axisYaw, this.yaw);
        this.pitchQuaternion.setFromAxisAngle(this.axisPitch, this.pitch);
        this.rollQuaternion.setFromAxisAngle(this.axisRoll, this.roll);

        this.tempQuaternion
            .copy(this.yawQuaternion)
            .multiply(this.pitchQuaternion)
            .multiply(this.rollQuaternion);

        this.quaternion.copy(this.tempQuaternion);
        this.quaternion.normalize();
    }

    toStats() {
        return {
            speed: this.speed,
            size: this.size,
            rotationSpeed: this.yawChangeRate,
            maxSpeed: this.maxSpeed,
            acceleration: this.throttleAcceleration,
        };
    }

    canFire() {
        return true;
    }

    registerBullet(bullet) {
        if (!bullet) {
            return false;
        }
        if (!this.bullets.includes(bullet)) {
            bullet.plane = this;
            this.bullets.push(bullet);
        }
        return true;
    }

    fire(direction, damage, speedMultiplier = 1.0) {
        const bulletSpeed = 45 * speedMultiplier;

        const planeVelocity = this.tempVec1;
        const bulletVelocity = this.tempVec2;
        const origin = this.tempVec3;

        planeVelocity.copy(this.moveDirection).multiplyScalar(this.speed);
        bulletVelocity.copy(direction).multiplyScalar(bulletSpeed);
        bulletVelocity.add(planeVelocity);

        const newSpeed = bulletVelocity.length();
        const newDirection = bulletVelocity.normalize();

        origin.copy(this.position).addScaledVector(direction, this.bulletSpawnOffset);

        const bullet = new PlayerBullet({
            plane: this,
            position: origin,
            direction: newDirection,
            speed: newSpeed,
            damage: damage,
            maxTicks: this.bulletLifetimeTicks,
        });

        if (this.registerBullet(bullet)) {
            return bullet;
        } else {
            bullet.destroy();
            return null;
        }
    }

    handleBulletDestroyed(bullet) {
        const index = this.bullets.indexOf(bullet);
        if (index !== -1) {
            this.bullets.splice(index, 1);
        }
        if (bullet && bullet.plane === this) {
            bullet.plane = null;
        }
    }

    removeBullet(bullet) {
        if (!bullet) {
            return;
        }

        if (typeof bullet.destroy === 'function') {
            bullet.destroy();
        } else {
            this.handleBulletDestroyed(bullet);
        }
    }

    clearBullets() {
        while (this.bullets.length > 0) {
            const bullet = this.bullets[this.bullets.length - 1];
            this.removeBullet(bullet);
        }
    }

    checkBulletEnemyCollision(bullet, enemy) {
        if (!enemy || enemy.isDestroyed || typeof enemy.hitRadius !== 'number') {
            return false;
        }

        const distance = bullet.position.distanceTo(enemy.position);
        if (distance > enemy.hitRadius) {
            return false;
        }

        const destroyed = typeof enemy.takeDamage === 'function'
            ? enemy.takeDamage(bullet.damage)
            : false;
        if (destroyed) {
            const manager = this.game?.enemyManager;
            if (manager && typeof manager.handleEnemyDestruction === 'function') {
                manager.handleEnemyDestruction(enemy);
            } else if (typeof this.game?.onEnemyDestroyed === 'function') {
                // Fallback for unexpected states
                this.game.onEnemyDestroyed(enemy);
            }
        }

        return true;
    }

    updateBullets(delta) {
        if (this.bullets.length === 0) {
            return;
        }

        const bulletDelta = Math.min(Math.max(delta, 0), 0.2);
        const enemies = this.game?.enemies;

        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            if (!bullet) {
                continue;
            }

            if (typeof bullet.update === 'function') {
                bullet.update(bulletDelta);
            }

            let removeBullet = false;

            const candidates = enemyGrid.checkArea(bullet.position, 30);
            for (const enemy of candidates) {
                if (this.checkBulletEnemyCollision(bullet, enemy)) {
                    removeBullet = true;
                    break;
                }
            }

            if (!removeBullet && Number.isFinite(bullet.range) && bullet.travelled >= bullet.range && !bullet.target) {
                removeBullet = true;
            }

            if (
                !removeBullet &&
                typeof bullet.hasExceededLifetime === 'function' &&
                bullet.hasExceededLifetime()
            ) {
                removeBullet = true;
            }

            if (removeBullet) {
                this.removeBullet(bullet);
            }
        }
    }

    dispose() {
        this.clearBullets();
    }
}

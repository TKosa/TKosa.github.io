import * as THREE from 'three';
import { BasicEnemyBehavior } from '../behaviors.js';
import { Bullet } from '../Bullet.js';

import { enemyGrid } from '../SpatialGrid.js';

export class Enemy extends THREE.Object3D {
    constructor(options = {}) {
        super();
        // this.scene = scene; // Removed
        // Mesh creation removed - handled by WorldRenderer

        const initialPosition = options.position ?? new THREE.Vector3(0, 10, -50);
        this.position.copy(initialPosition); // Object3D already has this.position

        this.flightAltitude = options.flightAltitude ?? initialPosition.y;
        this.position.y = this.flightAltitude;

        this.movementSpeed = options.movementSpeed ?? 12;

        // this.scene.add(this.mesh); // Removed
        this.maxHealth = 25;
        this.health = this.maxHealth;
        this.hitRadius = 1.5;
        this.isDestroyed = false;
        this.isLive = true;
        this.shootCooldown = options.playerShootCooldown ?? 1;
        this.lastShotTime = 0;
        this.buildingShootCooldown = options.buildingShootCooldown ?? 5;
        this.lastBuildingShotTime = 0;
        this.buildingTargetRange = options.buildingTargetRange ?? 150;
        this.buildingBulletDamage = options.buildingBulletDamage ?? 10;
        this.bulletSpeed = options.bulletSpeed ?? 22;
        this.bulletLifetime = options.bulletLifetime ?? 3.5;
        this.maxActiveBullets = options.maxActiveBullets ?? 5;
        this.bullets = [];
        this.tempTarget = new THREE.Vector3();
        this.tempAimVector = new THREE.Vector3();
        this.tempAimVelocity = new THREE.Vector3();
        this.tempInterceptPoint = new THREE.Vector3();
        this.type = 'normal';
        this.isFlashing = false;
        this.flashTimeout = null;
        this.scheduler = options.scheduler;  // Game scheduler for tick-based timing

        const behaviorFactory = options.behaviorFactory ?? ((enemyInstance) => new BasicEnemyBehavior(enemyInstance, options.behaviorOptions));
        this.behavior = options.behavior ?? behaviorFactory?.(this) ?? new BasicEnemyBehavior(this, options.behaviorOptions);
        if (this.behavior && typeof this.behavior.onAttach === 'function') {
            this.behavior.onAttach(this);
        }

        // Add to spatial grid
        enemyGrid.add(this);
    }

    update(delta, playerPosition, buildings = [], playerVelocity = null) {
        if (this.isDestroyed) {
            return;
        }

        if (this.behavior && typeof this.behavior.update === 'function') {
            this.behavior.update(delta, { playerPosition, buildings, playerVelocity });
        }

        // Update position in spatial grid
        enemyGrid.updateClient(this);

        const now = this.scheduler ? this.scheduler.now() : 0;
        if (playerPosition && now - this.lastShotTime > this.shootCooldown) {
            this.shoot(playerPosition, undefined, playerVelocity);
            this.lastShotTime = now;
        }

        if (now - this.lastBuildingShotTime > this.buildingShootCooldown) {
            const target = this.findBuildingTarget(buildings);
            if (target) {
                this.shoot(target, this.buildingBulletDamage);
                this.lastBuildingShotTime = now;
            }
        }
    }

    findBuildingTarget(buildings) {
        if (!Array.isArray(buildings) || buildings.length === 0) {
            return null;
        }

        let closest = null;
        let closestDistSq = this.buildingTargetRange * this.buildingTargetRange;

        for (let i = 0; i < buildings.length; i++) {
            const collider = buildings[i];
            if (!collider || collider.destroyed) {
                continue;
            }

            const dx = collider.cx - this.position.x;
            const dy = collider.cy - this.position.y;
            const dz = collider.cz - this.position.z;
            const distSq = dx * dx + dy * dy + dz * dz;

            if (distSq <= closestDistSq) {
                closestDistSq = distSq;
                closest = this.tempTarget.set(collider.cx, collider.cy + collider.hy, collider.cz).clone();
            }
        }

        return closest;
    }

    shoot(targetPosition, damage = 10, targetVelocity = null) {
        if (this.isDestroyed || !targetPosition) {
            return;
        }

        const resolvedDamage = Number.isFinite(damage) ? damage : 10;
        const shooterPosition = this.position;
        const direction = new THREE.Vector3();
        let aimPoint = null;
        const bulletSpeed = Number(this.bulletSpeed);
        if (targetVelocity && Number.isFinite(bulletSpeed) && bulletSpeed > 0) {
            aimPoint = this.computeInterceptPoint(shooterPosition, targetPosition, targetVelocity, bulletSpeed);
        }

        if (aimPoint) {
            direction.subVectors(aimPoint, shooterPosition);
        } else {
            direction.subVectors(targetPosition, shooterPosition);
        }

        if (direction.lengthSq() === 0) {
            return;
        }
        direction.normalize();

        while (this.bullets.length >= this.maxActiveBullets) {
            const stale = this.bullets.shift();
            if (stale && typeof stale.destroy === 'function') {
                stale.destroy();
            }
        }

        // Bullet creation needs to be decoupled too, but for now let's assume Bullet is still hybrid or we refactor it next
        // Ideally Bullet should just be data
        const bullet = new Bullet(
            null, // No scene passed
            this.position.clone(),
            direction,
            resolvedDamage,
            {
                speed: this.bulletSpeed,
                maxLifetime: this.bulletLifetime,
            }
        );
        this.bullets.push(bullet);
    }

    computeInterceptPoint(shooterPosition, targetPosition, targetVelocity, projectileSpeed) {
        if (!targetVelocity) {
            return null;
        }
        const relativePos = this.tempAimVector.copy(targetPosition).sub(shooterPosition);
        const velocity = this.tempAimVelocity.copy(targetVelocity);
        const speedSq = projectileSpeed * projectileSpeed;
        const a = velocity.lengthSq() - speedSq;
        const b = 2 * relativePos.dot(velocity);
        const c = relativePos.lengthSq();
        const EPSILON = 1e-6;

        let t;
        if (Math.abs(a) < EPSILON) {
            if (Math.abs(b) < EPSILON) {
                return null;
            }
            t = -c / b;
        } else {
            const discriminant = b * b - 4 * a * c;
            if (discriminant < 0) {
                return null;
            }
            const sqrtDisc = Math.sqrt(discriminant);
            const t1 = (-b - sqrtDisc) / (2 * a);
            const t2 = (-b + sqrtDisc) / (2 * a);
            t = Math.min(t1, t2);
            if (t < EPSILON) {
                t = Math.max(t1, t2);
            }
            if (t < EPSILON) {
                return null;
            }
        }

        return this.tempInterceptPoint
            .copy(targetPosition)
            .add(velocity.multiplyScalar(t));
    }

    takeDamage(amount) {
        const value = Number(amount);
        if (!Number.isFinite(value) || value <= 0 || this.isDestroyed) {
            return false;
        }

        this.health = Math.max(0, this.health - value);

        // Trigger flash effect
        this.isFlashing = true;
        if (this.flashTimeout) {
            this.flashTimeout.cancel();
        }

        if (this.scheduler) {
            this.flashTimeout = this.scheduler.setTimeout(() => {
                this.isFlashing = false;
            }, 0.1); // 100ms = 0.1 seconds
        } else {
            // Fallback if scheduler not provided
            this.isFlashing = false;
        }

        if (this.health === 0) {
            this.destroy();
            return true;
        }

        return false;
    }

    destroy() {
        if (this.isDestroyed) {
            return;
        }

        // Remove from spatial grid
        enemyGrid.remove(this);

        if (this.flashTimeout) {
            if (typeof this.flashTimeout.cancel === 'function') {
                this.flashTimeout.cancel();
            }
            this.flashTimeout = null;
        }
        this.isDestroyed = true;
        this.isLive = false;
        this.health = 0;

        // Clean up all bullets and release their pool slots
        while (this.bullets.length > 0) {
            const bullet = this.bullets.pop();
            if (bullet && typeof bullet.destroy === 'function') {
                bullet.destroy();
            }
        }

        if (this.behavior && typeof this.behavior.dispose === 'function') {
            this.behavior.dispose();
        }
        this.behavior = null;
    }

    dispose() {
        this.destroy();
    }


}

import * as THREE from 'three';
import { Bullet } from './Bullet.js';
import { enemyGrid } from './SpatialGrid.js';

const tempEnemyVector = new THREE.Vector3();

export class PlayerBullet {
    static bulletPool = null;

    static initialize(pool) {
        PlayerBullet.bulletPool = pool;
    }

    constructor({ plane = null, position, direction, speed = 45, range = 90, damage = 10, maxTicks = Infinity }) {
        this.plane = plane;
        this.position = position.clone();
        this.direction = direction.clone();
        this.speed = speed;
        this.range = range;
        this.damage = damage;
        this.travelled = 0;
        this.tickCount = 0;
        this.maxTicks = Number.isFinite(maxTicks) ? Math.max(0, maxTicks) : Infinity;
        this.target = null;
        this.hasLockedTarget = false;

        this.poolIndex = null;
        if (PlayerBullet.bulletPool) {
            this.poolIndex = PlayerBullet.bulletPool.acquireSlot(
                this.position,
                this.direction,
                0x00ff00 // Green for player bullets
            );
        }
    }

    acquireTarget() {
        if (this.hasLockedTarget) {
            return;
        }

        const game = this.plane?.game;
        if (!game) return;

        // Use spatial grid if available
        let candidates = enemyGrid.checkArea(this.position, this.plane.homing_radius);
        if (candidates.length === 0) {
            if (game.enemyManager) {
                candidates = game.enemyManager.getEnemies();
            } else {
                candidates = game.enemies || [];
            }
        }

        if (candidates.length === 0) {
            return;
        }

        let closestEnemy = null;
        let minDistanceSq = Infinity;
        const homingRadiusSq = this.plane.homing_radius * this.plane.homing_radius;

        for (const enemy of candidates) {
            if (!enemy || enemy.isLive === false) {
                continue;
            }

            tempEnemyVector.copy(enemy.position).sub(this.position);
            const distanceSq = tempEnemyVector.lengthSq();

            if (distanceSq < minDistanceSq && distanceSq < homingRadiusSq) {
                minDistanceSq = distanceSq;
                closestEnemy = enemy;
            }
        }

        if (closestEnemy) {
            this.target = closestEnemy;
            this.hasLockedTarget = true;
        }
    }

    update(delta) {
        if (!this.direction || !Number.isFinite(delta) || delta <= 0) {
            return;
        }


        if (!this.target && !this.hasLockedTarget) {
            const homingRadiusSq = this.plane.homing_radius * this.plane.homing_radius;
            if (homingRadiusSq > 0) {
                this.acquireTarget();
            }
        }

        if (this.target) {
            if (this.target.isLive) {
                tempEnemyVector.copy(this.target.position).sub(this.position);
                if (tempEnemyVector.lengthSq() > 0) {
                    const desiredDirection = tempEnemyVector.normalize();
                    this.direction.copy(desiredDirection);
                }
            } else {
                this.target = null;
                this.die();
                return;
            }
        }

        const step = this.speed * delta;
        this.position.addScaledVector(this.direction, step);
        this.travelled += step;
        this.tickCount += 1;

        if (this.poolIndex !== null && PlayerBullet.bulletPool) {
            PlayerBullet.bulletPool.updateSlot(this.poolIndex, this.position);
        }

        // Ground collision check
        if (this.position.y <= 0) {
            this.die();
            return;
        }

        // Altitude check: remove if beyond ceiling
        if (this.position.y > 50) {
            this.travelled = this.range; // Force expiration
        }
    }

    hasExceededLifetime() {
        if (this.target && this.target.isLive) {
            return false;
        }
        return Number.isFinite(this.maxTicks) && this.tickCount >= this.maxTicks;
    }

    die() {
        if (this.plane && typeof this.plane.removeBullet === 'function') {
            this.plane.removeBullet(this);
        }
    }

    destroy() {
        if (this.poolIndex !== null && PlayerBullet.bulletPool) {
            PlayerBullet.bulletPool.releaseSlot(this.poolIndex);
            this.poolIndex = null;
        }

        // This method is called by removeBullet in Plane.js
        // No need to call removeBullet again here to avoid infinite loop
        if (this.plane && typeof this.plane.handleBulletDestroyed === 'function') {
            this.plane.handleBulletDestroyed(this);
        }
    }
}

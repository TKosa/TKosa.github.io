import * as THREE from 'three';

export class TurretBullet {
    static bulletPool = null;

    static initialize(pool) {
        TurretBullet.bulletPool = pool;
    }

    constructor({ turret, position, direction, speed, range = 30, damage = 10, maxTicks }) {
        this.turret = turret;
        // this.mesh = mesh; // Removed
        this.position = position.clone(); // Track position manually now
        this.direction = direction.clone();
        this.speed = speed;
        this.range = range;
        this.damage = damage;
        this.travelled = 0;
        this.tickCount = 0;
        this.maxTicks = Number.isFinite(maxTicks) ? Math.max(0, maxTicks) : Infinity;

        this.poolIndex = null;
        if (TurretBullet.bulletPool) {
            this.poolIndex = TurretBullet.bulletPool.acquireSlot(
                this.position,
                this.direction,
                0xffff00 // Yellow for turret bullets
            );
        }
    }

    update(delta) {
        if (!this.direction || !Number.isFinite(delta) || delta <= 0) {
            return;
        }

        const step = this.speed * delta;
        this.position.addScaledVector(this.direction, step);

        if (this.poolIndex !== null && TurretBullet.bulletPool) {
            TurretBullet.bulletPool.updateSlot(this.poolIndex, this.position);
        }

        this.travelled += step;
        this.tickCount += 1;

        // Altitude check
        if (this.position.y < 0 || (this.position.y > 50 && this.direction.y > 0)) {
            // Mark for destruction, will be handled in Game.js updateTurretBullets
            this.travelled = this.range; // Force expiration
        }
    }

    hasExceededLifetime() {
        return Number.isFinite(this.maxTicks) && this.tickCount >= this.maxTicks;
    }

    destroy() {
        if (this.poolIndex !== null && TurretBullet.bulletPool) {
            TurretBullet.bulletPool.releaseSlot(this.poolIndex);
            this.poolIndex = null;
        }

        if (this.turret) {
            this.turret.decrementBulletCount();
        }
    }
}

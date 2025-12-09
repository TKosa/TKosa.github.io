import * as THREE from 'three';

export class Bullet {
    static bulletPool = null;

    static initialize(pool) {
        Bullet.bulletPool = pool;
    }

    constructor(scene, position, direction, damage = 10, options = {}) {
        // scene param is deprecated but kept for signature compatibility if needed
        this.position = position.clone ? position.clone() : new THREE.Vector3().copy(position);
        this.direction = direction.clone();
        this.speed = options.speed ?? 22;
        this.range = 400;
        this.travelled = 0;
        this.damage = damage;
        this.age = 0;
        this.maxLifetime = options.maxLifetime ?? 3.5;

        this.poolIndex = null;

        if (Bullet.bulletPool) {
            this.poolIndex = Bullet.bulletPool.acquireSlot(
                this.position,
                this.direction,
                options.color || 0xff0000 // Default red for enemy bullets
            );
        }
    }

    update(delta) {
        const step = this.speed * delta;
        this.position.addScaledVector(this.direction, step);

        if (this.poolIndex !== null && Bullet.bulletPool) {
            Bullet.bulletPool.updateSlot(this.poolIndex, this.position);
        }

        this.travelled += step;
        this.age += delta;
    }

    isExpired() {
        return this.travelled >= this.range || this.age >= this.maxLifetime;
    }

    destroy() {
        if (this.poolIndex !== null && Bullet.bulletPool) {
            Bullet.bulletPool.releaseSlot(this.poolIndex);
            this.poolIndex = null;
        }
    }
}

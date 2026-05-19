import * as THREE from 'three';

export class Turret {
    static turretPool = null;

    static initialize(pool) {
        Turret.turretPool = pool;
    }

    constructor(game, position) {
        this.game = game;
        this.position = position.clone ? position.clone() : new THREE.Vector3().copy(position);

        // Acquire a slot from the pool
        this.poolIndex = null;
        this.isDisposed = false;

        if (Turret.turretPool) {
            this.poolIndex = Turret.turretPool.acquireSlot(this.position, this);
            if (this.poolIndex === null) {
                // If pool exists but returned null (likely not loaded), wait for it
                Turret.turretPool.onReady(() => this.acquireFromPool());
            }
        } else {
            console.error('Turret pool not initialized!');
        }

        this.fireRate = 1; // Shots per second
        this.fireRangeSq = 10000; // Squared range for firing (100 units)
        this.lastFireTime = 0;
        this.maxBullets = 5;
        this.currentBulletCount = 0;
        this.bulletSpeed = 50;
        this.bulletRange = 120;
        this.bulletDamage = 1;
        this.bulletMaxTicks = 180;

        this.tempMuzzlePos = new THREE.Vector3();
        this.tempAimVector = new THREE.Vector3();
        this.tempAimVelocity = new THREE.Vector3();
        this.tempInterceptPoint = new THREE.Vector3();
        this.tempBulletDir = new THREE.Vector3();
        this.dummy = new THREE.Object3D(); // Helper for rotation calculations
    }

    use() {
        return this.game.itemDeploymentManager.tryDeployItemToClosestBuilding(this);
    }

    setPosition(pos) {
        this.position.copy(pos);
        if (this.poolIndex !== null && Turret.turretPool) {
            Turret.turretPool.releaseSlot(this.poolIndex);
            this.poolIndex = null;
            this.acquireFromPool();
        }
    }

    getMuzzlePosition(target) {
        const out = target || new THREE.Vector3();
        if (this.mesh && this.mesh.userData.head) {
            this.mesh.userData.head.getWorldPosition(out);
        } else {
            out.copy(this.position);
        }
        return out;
    }

    /**
     * Get the visual mesh instance for this turret
     */
    get mesh() {
        if (this.poolIndex !== null && Turret.turretPool) {
            return Turret.turretPool.getInstance(this.poolIndex);
        }
        return null;
    }

    update(delta, context) {
        const now = this.game.scheduler ? this.game.scheduler.now() : 0;

        // Always try to find a target to rotate towards, even if on cooldown
        let closestEnemy = null;
        let minDistanceSq = this.fireRangeSq;

        for (const enemy of context.enemies) {
            if (enemy.isDestroyed) continue;
            const distanceSq = this.position.distanceToSquared(enemy.position);
            if (distanceSq < minDistanceSq) {
                minDistanceSq = distanceSq;
                closestEnemy = enemy;
            }
        }

        if (closestEnemy) {
            this.trackAndFire(closestEnemy, now, context);
        }
    }

    trackAndFire(enemy, now, context) {
        const mesh = this.mesh;
        if (!mesh) return;

        // Calculate enemy velocity for predictive aiming
        // Reuse tempAimVelocity instead of creating new Vector3
        this.tempAimVelocity.set(0, 0, 0);
        if (enemy.behavior && enemy.behavior.heading) {
            const speed = enemy.behavior.speed ?? enemy.movementSpeed ?? 12;
            this.tempAimVelocity.copy(enemy.behavior.heading).multiplyScalar(speed);
        }

        // Predictive aiming
        this.getMuzzlePosition(this.tempMuzzlePos);
        const interceptPoint = this.computeInterceptPoint(
            this.tempMuzzlePos,
            enemy.position,
            this.tempAimVelocity,
            this.bulletSpeed
        );

        const targetPos = interceptPoint || enemy.position;

        // Calculate target rotation
        this.dummy.position.copy(this.position);
        this.dummy.lookAt(targetPos);
        const targetQuaternion = this.dummy.quaternion;

        // Rotate towards target
        const step = THREE.MathUtils.degToRad(5);
        const head = mesh.userData.head;
        if (head) {
            // We need to rotate the head to look at the target
            // Since the head is a child of the base (which might be rotated), 
            // we should ideally use world space lookAt, but Three.js lookAt is local.
            // However, if the base is just placed and not rotated wildly, 
            // we can try using the dummy helper in local space or just direct lookAt if the hierarchy allows.

            // Simplest approach first: Use the dummy to calculate the desired world rotation
            this.dummy.position.copy(head.getWorldPosition(new THREE.Vector3()));
            this.dummy.lookAt(targetPos);

            // Rotate head towards that world rotation
            head.quaternion.rotateTowards(this.dummy.quaternion, step);
        } else {
            // Fallback for old models or errors
            mesh.quaternion.rotateTowards(targetQuaternion, step);
        }

        // Check if we can fire
        if (now - this.lastFireTime < 1 / this.fireRate) {
            return;
        }

        if (this.currentBulletCount >= this.maxBullets) {
            return;
        }

        // Check angle difference
        let currentQuat = mesh.quaternion;
        if (head) {
            currentQuat = head.quaternion;
        }
        const angle = currentQuat.angleTo(targetQuaternion);
        const maxAngle = THREE.MathUtils.degToRad(15);

        if (angle <= maxAngle) {
            this.fire(targetPos, now, context);
        }
    }

    fire(targetPos, now, context) {
        this.lastFireTime = now;

        this.getMuzzlePosition(this.tempMuzzlePos);
        this.tempBulletDir
            .subVectors(targetPos, this.tempMuzzlePos)
            .normalize();

        context.spawnTurretBullet(this, this.tempBulletDir);
        this.currentBulletCount++;
    }

    computeInterceptPoint(shooterPosition, targetPosition, targetVelocity, projectileSpeed) {
        if (!targetVelocity) {
            return this.tempInterceptPoint.copy(targetPosition);
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

    decrementBulletCount() {
        this.currentBulletCount = Math.max(0, this.currentBulletCount - 1);
    }

    acquireFromPool() {
        if (this.isDisposed) return;
        if (this.poolIndex !== null) return;
        if (!Turret.turretPool) return;

        this.poolIndex = Turret.turretPool.acquireSlot(this.position, this);
    }

    dispose() {
        this.isDisposed = true;
        // Release the pool slot (moves turret underground)
        if (this.poolIndex !== null && Turret.turretPool) {
            Turret.turretPool.releaseSlot(this.poolIndex);
            this.poolIndex = null;
        }
    }
}

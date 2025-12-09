import * as THREE from 'three';

const BEAM_AXIS = new THREE.Vector3(0, 1, 0);

export class LaserTurret {
    static turretPool = null;
    static sharedBeamGeometry = null;

    static initialize(pool) {
        LaserTurret.turretPool = pool;
    }

    static getSharedBeamGeometry() {
        if (!LaserTurret.sharedBeamGeometry) {
            LaserTurret.sharedBeamGeometry = new THREE.CylinderGeometry(0.12, 0.18, 1, 12, 1, true);
        }
        return LaserTurret.sharedBeamGeometry;
    }

    constructor(game, position) {
        this.game = game;
        this.position = position.clone ? position.clone() : new THREE.Vector3().copy(position);

        this.poolIndex = null;
        this.isDisposed = false;
        this.target = null;

        if (LaserTurret.turretPool) {
            this.poolIndex = LaserTurret.turretPool.acquireSlot(this.position, this);
            if (this.poolIndex === null) {
                LaserTurret.turretPool.onReady(() => this.acquireFromPool());
            }
        } else {
            console.error('Laser turret pool not initialized!');
        }

        this.fireRangeSq = 16000; // ~126 units
        this.maxBeamDistance = Math.sqrt(this.fireRangeSq);
        this.rotationStep = THREE.MathUtils.degToRad(6);
        this.maxAimError = THREE.MathUtils.degToRad(10);
        this.damagePerSecond = 1;

        this.tempEnemyPos = new THREE.Vector3();
        this.tempMuzzlePos = new THREE.Vector3();
        this.tempHeadWorldPosition = new THREE.Vector3();
        this.tempDirection = new THREE.Vector3();
        this.tempQuaternion = new THREE.Quaternion();
        this.dummy = new THREE.Object3D();

        this.beamPulseTime = 0;
        this.beamMesh = this.createBeamMesh();
        if (this.game.scene && this.beamMesh) {
            this.game.scene.add(this.beamMesh);
        }
    }

    use() {
        return this.game.itemDeploymentManager.tryDeployItemToClosestBuilding(this);
    }

    setPosition(pos) {
        this.position.copy(pos);
        if (this.poolIndex !== null && LaserTurret.turretPool) {
            LaserTurret.turretPool.releaseSlot(this.poolIndex);
            this.poolIndex = null;
            this.acquireFromPool();
        }
    }

    get mesh() {
        if (this.poolIndex !== null && LaserTurret.turretPool) {
            return LaserTurret.turretPool.getInstance(this.poolIndex);
        }
        return null;
    }

    getMuzzlePosition(target) {
        const out = target || new THREE.Vector3();
        const mesh = this.mesh;
        if (mesh && mesh.userData.head) {
            mesh.userData.head.getWorldPosition(out);
        } else {
            out.copy(this.position);
        }
        return out;
    }

    update(delta, context = {}) {
        if (this.isDisposed) {
            return;
        }

        const mesh = this.mesh;
        if (!mesh || !context.enemies) {
            this.clearBeam();
            return;
        }

        const target = this.resolveTarget(context.enemies);
        if (!target) {
            this.clearBeam();
            return;
        }

        const targetPos = this.tempEnemyPos.copy(target.position);
        const aligned = this.rotateTowardTarget(targetPos);
        if (!aligned) {
            this.clearBeam();
            return;
        }

        const muzzlePosition = this.getMuzzlePosition(this.tempMuzzlePos);
        this.drawBeam(muzzlePosition, targetPos, delta);
        this.applyDamage(target, delta, context);
    }

    resolveTarget(enemies) {
        if (!Array.isArray(enemies) || enemies.length === 0) {
            this.target = null;
            return null;
        }

        if (this.target && (this.target.isDestroyed || !enemies.includes(this.target))) {
            this.target = null;
        }

        if (this.target) {
            const distanceSq = this.position.distanceToSquared(this.target.position);
            if (distanceSq <= this.fireRangeSq) {
                return this.target;
            }
            this.target = null;
        }

        let closest = null;
        let minDistanceSq = this.fireRangeSq;
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            if (!enemy || enemy.isDestroyed) {
                continue;
            }
            const distanceSq = this.position.distanceToSquared(enemy.position);
            if (distanceSq <= minDistanceSq) {
                minDistanceSq = distanceSq;
                closest = enemy;
            }
        }

        this.target = closest;
        return closest;
    }

    rotateTowardTarget(targetPosition) {
        const mesh = this.mesh;
        if (!mesh) {
            return false;
        }

        const head = mesh.userData.head;
        this.dummy.position.copy(head ? head.getWorldPosition(this.tempHeadWorldPosition) : this.position);
        this.dummy.lookAt(targetPosition);
        const desiredQuaternion = this.dummy.quaternion;

        if (head) {
            head.quaternion.rotateTowards(desiredQuaternion, this.rotationStep);
            const angle = head.quaternion.angleTo(desiredQuaternion);
            return angle <= this.maxAimError;
        }

        mesh.quaternion.rotateTowards(desiredQuaternion, this.rotationStep);
        const angle = mesh.quaternion.angleTo(desiredQuaternion);
        return angle <= this.maxAimError;
    }

    drawBeam(start, end, delta) {
        if (!this.beamMesh) {
            return;
        }

        this.tempDirection.subVectors(end, start);
        const distance = this.tempDirection.length();
        if (distance <= 0.01) {
            this.clearBeam();
            return;
        }

        const clampedDistance = Math.min(distance, this.maxBeamDistance);
        const direction = this.tempDirection.normalize();

        this.beamMesh.visible = true;
        this.beamMesh.position.copy(start).addScaledVector(direction, clampedDistance * 0.5);
        this.beamMesh.scale.set(1, clampedDistance, 1);
        this.beamMesh.quaternion.copy(this.tempQuaternion.setFromUnitVectors(BEAM_AXIS, direction));

        this.beamPulseTime += delta;
        const opacity = THREE.MathUtils.clamp(0.35 + 0.25 * Math.sin(this.beamPulseTime * 8), 0.2, 0.75);
        this.beamMesh.material.opacity = opacity;
        const hueShift = 0.48 + 0.04 * Math.sin(this.beamPulseTime * 5);
        this.beamMesh.material.color.setHSL(hueShift, 0.7, 0.6);
    }

    applyDamage(enemy, delta, context) {
        if (!enemy || enemy.isDestroyed) {
            return;
        }

        const damage = this.damagePerSecond * delta;
        const destroyed = enemy.takeDamage(damage);
        if (destroyed) {
            this.target = null;
            this.clearBeam();
            const manager = this.game?.enemyManager;
            if (manager && typeof manager.handleEnemyDestruction === 'function') {
                manager.handleEnemyDestruction(enemy);
            } else if (typeof context.onEnemyDestroyed === 'function') {
                context.onEnemyDestroyed(enemy);
            }
        }
    }

    clearBeam() {
        if (this.beamMesh) {
            this.beamMesh.visible = false;
        }
    }

    createBeamMesh() {
        const geometry = LaserTurret.getSharedBeamGeometry();
        const material = new THREE.MeshBasicMaterial({
            color: 0x6ffbff,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.visible = false;
        mesh.frustumCulled = false;
        return mesh;
    }

    acquireFromPool() {
        if (this.isDisposed || this.poolIndex !== null || !LaserTurret.turretPool) {
            return;
        }
        this.poolIndex = LaserTurret.turretPool.acquireSlot(this.position, this);
    }

    dispose() {
        this.isDisposed = true;
        this.clearBeam();
        if (this.game.scene && this.beamMesh) {
            this.game.scene.remove(this.beamMesh);
            this.beamMesh.geometry = null;
        }
        if (this.beamMesh && this.beamMesh.material) {
            this.beamMesh.material.dispose();
        }
        this.beamMesh = null;

        if (this.poolIndex !== null && LaserTurret.turretPool) {
            LaserTurret.turretPool.releaseSlot(this.poolIndex);
            this.poolIndex = null;
        }
    }
}




import * as THREE from 'three';
import { BulletPoolManager } from './BulletPoolManager.js';

export class WorldRenderer {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;

        // Maps to store visual representations of logical entities
        this.itemMeshes = new Map();   // Map<Item, THREE.Mesh>

        // Reusable geometries/materials to save memory
        this.enemyGeometry = new THREE.BoxGeometry(2, 2, 2);
        this.enemyVisuals = new EnemyVisualManager({
            scene: this.scene,
            geometry: this.enemyGeometry,
            flashBlendColor: new THREE.Color(0xffffff),
            flashBlendFactor: 0.4
        });

        this.bulletPool = new BulletPoolManager(this.scene);

        // Apply 2D horizontal culling to bullets
        this.apply2DCulling(this.bulletPool.mesh, 2000);

        // Note: Enemy meshes are created dynamically, so we'll apply culling
        // after the first frame when enemies exist
        this.enemyCullingApplied = false;
    }

    /**
     * Apply 2D horizontal distance-based culling to a mesh.
     * Objects are only hidden if far away horizontally, regardless of altitude.
     * @param {THREE.Mesh|THREE.InstancedMesh} mesh - The mesh to apply culling to
     * @param {number} maxDistance - Maximum horizontal distance before culling (default: 2000)
     */
    apply2DCulling(mesh, maxDistance = 2000) {
        if (!mesh) return;

        mesh.frustumCulled = false;
        mesh.onBeforeRender = (renderer, scene, camera) => {
            const dx = camera.position.x - (mesh.position?.x || 0);
            const dz = camera.position.z - (mesh.position?.z || 0);
            const distance2D = Math.sqrt(dx * dx + dz * dz);
            mesh.visible = distance2D < maxDistance;
        };
    }

    getBulletPool() {
        return this.bulletPool;
    }

    render(gameState) {
        const { plane, enemies, items } = gameState;

        // 1. Sync Player/Camera
        if (plane) {
            this.syncCamera(plane);
        }

        // 2. Sync Enemies
        this.syncEnemies(Array.isArray(enemies) ? enemies : []);

        // 3. Sync Bullets - Handled by BulletPoolManager and individual Bullet instances
        // No explicit sync needed here as bullets update their own pool slots

        // 4. Sync Items (deployed items)
        if (items) {
            this.syncItems(items);
        }
    }

    syncCamera(plane) {
        // Smoothly interpolate camera to plane's position/rotation
        // For now, direct copy as per original logic
        this.camera.position.copy(plane.position);
        this.camera.quaternion.copy(plane.quaternion);
    }

    syncEnemies(enemies = []) {
        this.enemyVisuals.beginFrame();
        for (const enemy of enemies) {
            this.enemyVisuals.updateEnemy(enemy);
        }
        this.enemyVisuals.endFrame();

        // Apply 2D culling to enemy meshes (only need to do this once per mesh)
        if (!this.enemyCullingApplied && enemies.length > 0) {
            const enemyMeshes = this.enemyVisuals.getMeshes();
            enemyMeshes.forEach(mesh => this.apply2DCulling(mesh, 2000));
            this.enemyCullingApplied = true;
        }
    }

    // syncBullets removed - handled by pool


    syncItems(items) {
        // Similar logic for items (Campfire, Turret, etc.)
        // This requires Items to have a 'type' or similar to know what mesh to build
        // For now, placeholder
    }

    getEnemyMeshes() {
        return this.enemyVisuals.getMeshes();
    }

    getEnemyFromMesh(mesh, instanceId) {
        return this.enemyVisuals.getEnemyFromInstance(mesh, instanceId);
    }
}

class EnemyVisualManager {
    constructor({ scene, geometry, flashBlendColor, flashBlendFactor }) {
        this.scene = scene;
        this.geometry = geometry;
        this.flashLightenFactor = 0.5; // How much lighter the flash is

        this.pools = new Map();
        this.poolByMesh = new Map();
        this.enemyInstances = new Map();
        this.updatedThisFrame = new Set();

        this.typeColors = {
            red: 0xff0000,
            orange: 0xffa500,
            black: 0x333333,
            default: 0xff0000
        };

        this.identityQuaternion = new THREE.Quaternion();
        this.tempMatrix = new THREE.Matrix4();
        this.tempScale = new THREE.Vector3(1, 1, 1);
        this.tempColor = new THREE.Color();
    }

    beginFrame() {
        this.updatedThisFrame.clear();
    }

    updateEnemy(enemy) {
        if (!enemy || enemy.isDestroyed) {
            return;
        }

        let instance = this.enemyInstances.get(enemy);
        if (!instance) {
            instance = this.allocateInstance(enemy);
        }

        this.writeTransform(instance, enemy);

        // Handle flash state
        if (enemy.isFlashing && !instance.wasFlashing) {
            this.startFlash(instance);
        } else if (!enemy.isFlashing && instance.wasFlashing) {
            this.endFlash(instance);
        }

        this.updatedThisFrame.add(enemy);
    }

    endFrame() {
        const staleEnemies = [];
        for (const enemy of this.enemyInstances.keys()) {
            if (!this.updatedThisFrame.has(enemy)) {
                staleEnemies.push(enemy);
            }
        }

        for (const enemy of staleEnemies) {
            this.releaseInstance(enemy);
        }

        for (const pool of this.pools.values()) {
            if (pool.mesh) {
                pool.mesh.count = pool.activeCount;
            }
        }
    }

    getMeshes() {
        const meshes = [];
        for (const pool of this.pools.values()) {
            if (pool.mesh && pool.activeCount > 0) {
                meshes.push(pool.mesh);
            }
        }
        return meshes;
    }

    getEnemyFromInstance(mesh, instanceId) {
        if (!mesh || typeof instanceId !== 'number' || instanceId < 0) {
            return null;
        }
        const pool = this.poolByMesh.get(mesh);
        if (!pool) {
            return null;
        }
        return pool.slotToEnemy[instanceId] || null;
    }

    allocateInstance(enemy) {
        const pool = this.getOrCreatePool(enemy?.type);
        if (pool.activeCount >= pool.capacity) {
            this.expandPool(pool);
        }

        const slot = pool.activeCount;
        pool.activeCount += 1;
        pool.slotToEnemy[slot] = enemy;

        const instance = {
            pool,
            slot,
            wasFlashing: false,
        };

        // Set initial color (like buildings do)
        pool.mesh.setColorAt(slot, new THREE.Color(pool.baseColor));
        if (pool.mesh.instanceColor) {
            pool.mesh.instanceColor.needsUpdate = true;
        }

        this.enemyInstances.set(enemy, instance);
        return instance;
    }

    releaseInstance(enemy) {
        const instance = this.enemyInstances.get(enemy);
        if (!instance) {
            return;
        }

        const pool = instance.pool;
        const slot = instance.slot;
        const lastIndex = pool.activeCount - 1;
        if (slot < 0 || lastIndex < 0) {
            this.enemyInstances.delete(enemy);
            return;
        }

        if (slot !== lastIndex) {
            const lastEnemy = pool.slotToEnemy[lastIndex];
            if (lastEnemy) {
                const lastInstance = this.enemyInstances.get(lastEnemy);
                if (lastInstance) {
                    pool.mesh.getMatrixAt(lastIndex, this.tempMatrix);
                    pool.mesh.setMatrixAt(slot, this.tempMatrix);

                    // Fix: Copy color from the moved instance to the new slot
                    pool.mesh.getColorAt(lastIndex, this.tempColor);
                    pool.mesh.setColorAt(slot, this.tempColor);

                    lastInstance.slot = slot;
                }
                pool.slotToEnemy[slot] = lastEnemy;
            }
        }

        pool.slotToEnemy[lastIndex] = null;
        pool.activeCount = Math.max(0, lastIndex);
        pool.mesh.instanceMatrix.needsUpdate = true;
        if (pool.mesh.instanceColor) {
            pool.mesh.instanceColor.needsUpdate = true;
        }
        this.enemyInstances.delete(enemy);
    }

    writeTransform(instance, enemy) {
        const { pool, slot } = instance;
        if (!pool || !pool.mesh) {
            return;
        }

        const scale = Number.isFinite(enemy?.meshScale) ? enemy.meshScale : 1;
        this.tempScale.set(scale, scale, scale);
        this.tempMatrix.compose(
            enemy.position,
            this.identityQuaternion,
            this.tempScale
        );
        pool.mesh.setMatrixAt(slot, this.tempMatrix);
        pool.mesh.instanceMatrix.needsUpdate = true;
    }

    startFlash(instance) {
        instance.wasFlashing = true;
        const pool = instance.pool;
        const flashColor = new THREE.Color(pool.baseColor).lerp(new THREE.Color(0xffffff), this.flashLightenFactor);

        pool.mesh.setColorAt(instance.slot, flashColor);
        if (pool.mesh.instanceColor) {
            pool.mesh.instanceColor.needsUpdate = true;
        }
    }

    endFlash(instance) {
        instance.wasFlashing = false;
        const pool = instance.pool;
        const baseColor = new THREE.Color(pool.baseColor);

        pool.mesh.setColorAt(instance.slot, baseColor);
        if (pool.mesh.instanceColor) {
            pool.mesh.instanceColor.needsUpdate = true;
        }
    }



    getOrCreatePool(type) {
        const key = type || 'default';
        let pool = this.pools.get(key);
        if (!pool) {
            pool = this.createPool(key);
            this.pools.set(key, pool);
        }
        return pool;
    }

    createPool(type) {
        const capacity = 32;
        const baseColor = this.typeColors[type] || this.typeColors.default;
        const material = new THREE.MeshLambertMaterial({ color: 0xffffff }); // White base, will be tinted by instance colors
        const mesh = new THREE.InstancedMesh(this.geometry, material, capacity);
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        mesh.count = 0;
        if (this.scene) {
            this.scene.add(mesh);
        }
        const pool = {
            type,
            mesh,
            material,
            baseColor,
            capacity,
            activeCount: 0,
            slotToEnemy: [],
        };
        this.poolByMesh.set(mesh, pool);
        return pool;
    }

    expandPool(pool) {
        const newCapacity = pool.capacity * 2;
        const material = pool.mesh.material;
        const newMesh = new THREE.InstancedMesh(this.geometry, material, newCapacity);
        newMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

        for (let i = 0; i < pool.activeCount; i++) {
            pool.mesh.getMatrixAt(i, this.tempMatrix);
            newMesh.setMatrixAt(i, this.tempMatrix);
        }

        newMesh.count = pool.activeCount;
        if (this.scene) {
            this.scene.remove(pool.mesh);
            this.scene.add(newMesh);
        }

        this.poolByMesh.delete(pool.mesh);
        pool.mesh = newMesh;
        pool.capacity = newCapacity;
        pool.slotToEnemy.length = newCapacity;
        this.poolByMesh.set(newMesh, pool);
    }

    getMeshes() {
        return Array.from(this.pools.values()).map(pool => pool.mesh);
    }

    getEnemyFromInstance(mesh, instanceId) {
        const pool = this.poolByMesh.get(mesh);
        if (!pool) return null;
        return pool.slotToEnemy[instanceId] || null;
    }
}

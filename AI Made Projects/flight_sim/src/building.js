import * as THREE from 'three';
import { eventBus } from './eventBus.js';

class BuildingVisualController {
    constructor(scheduler) {
        this.baseColor = new THREE.Color(0x808080);
        this.destroyedColor = new THREE.Color(0x000000);
        this.flashColor = new THREE.Color(0xffffff);
        this.pendingTimeouts = new WeakMap();
        this.scheduler = scheduler;
    }

    flashBuilding(collider, healthPercent) {
        if (!collider || !collider.visualParts || !Array.isArray(collider.visualParts)) {
            return;
        }

        const targetColor = this.baseColor.clone().lerp(
            this.destroyedColor,
            1 - THREE.MathUtils.clamp(healthPercent, 0, 1)
        );

        // Flash all block instances
        for (const part of collider.visualParts) {
            part.mesh.setColorAt(part.instanceId, this.flashColor);
            if (part.mesh.instanceColor) {
                part.mesh.instanceColor.needsUpdate = true;
            }
        }

        const pendingTimeout = this.pendingTimeouts.get(collider);
        if (pendingTimeout) {
            if (pendingTimeout.cancel) {
                pendingTimeout.cancel();
            } else {
                clearTimeout(pendingTimeout);
            }
        }

        const onTimeout = () => {
            if (collider.destroyed || !collider.visualParts) {
                this.pendingTimeouts.delete(collider);
                return;
            }

            // Restore color to all block instances
            for (const part of collider.visualParts) {
                part.mesh.setColorAt(part.instanceId, targetColor);
                if (part.mesh.instanceColor) {
                    part.mesh.instanceColor.needsUpdate = true;
                }
            }
            this.pendingTimeouts.delete(collider);
        };

        let timeout;
        if (this.scheduler) {
            timeout = this.scheduler.setTimeout(onTimeout, 0.1);
        } else {
            timeout = setTimeout(onTimeout, 100);
        }

        this.pendingTimeouts.set(collider, timeout);
    }
}

export class BuildingManager {
    constructor(scene, renderer, scheduler) {
        this.scene = scene;
        this.renderer = renderer;
        this.buildingColliders = [];
        this.initialBuildingCount = 0;
        this.buildingInstancedMeshes = [];
        this.instanceDummy = new THREE.Object3D();
        this.buildingVisuals = new BuildingVisualController(scheduler);
    }

    init() {
        const blueprints = this.generateBlueprints();
        const blockCounts = this.countBlocksByTexture(blueprints);
        this.buildBlockMeshes(blockCounts);
        this.populateBlocks(blueprints);
        this.initialBuildingCount = this.buildingColliders.length;
        eventBus.emit('updateBuildingCounter', this.getAliveBuildingsCount(), this.initialBuildingCount);
    }

    generateBlueprints() {
        const spread = 1200;
        const buildingCount = 600;
        const width = 8;
        const depth = 8;
        const heightOptions = [8, 16, 24, 32, 40];
        const blueprints = [];

        for (let i = 0; i < buildingCount; i++) {
            let x, z;
            do {
                x = (Math.random() - 0.5) * spread;
                z = (Math.random() - 0.5) * spread;
            } while (Math.abs(x) < 30 && Math.abs(z) < 30);

            blueprints.push({
                x,
                z,
                width,
                depth,
                height: heightOptions[Math.floor(Math.random() * heightOptions.length)],
                blocks: [], // Will store texture choices for each block
            });
        }

        return blueprints;
    }


    countBlocksByTexture(blueprints) {
        const textures = ['assets/silhouettes.png', 'assets/silhouettes_2.png', 'assets/windows.png', 'assets/windows_2.png'];
        const counts = {};

        // Initialize counts
        textures.forEach(texture => {
            counts[texture] = 0;
        });

        // Count blocks and assign textures
        for (const bp of blueprints) {
            const numBlocks = bp.height / 8;
            bp.blocks = []; // Store texture choices for this building

            for (let i = 0; i < numBlocks; i++) {
                const texture = textures[Math.floor(Math.random() * textures.length)];
                bp.blocks.push(texture);
                counts[texture]++;
            }
        }

        return { textures, counts };
    }


    buildBlockMeshes(blockCounts) {
        const { textures, counts } = blockCounts;
        const geometry = new THREE.BoxGeometry(1, 1, 1);
        const textureLoader = new THREE.TextureLoader();
        const roofMaterial = new THREE.MeshLambertMaterial({ color: 0x808080 });

        this.blockMeshes = {}; // Store meshes by texture path

        for (const texturePath of textures) {
            const count = counts[texturePath];
            if (count === 0) continue;

            // Load wall texture
            const wallTexture = textureLoader.load(texturePath);
            wallTexture.wrapS = THREE.RepeatWrapping;
            wallTexture.wrapT = THREE.RepeatWrapping;
            wallTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy ? this.renderer.capabilities.getMaxAnisotropy() : 1;

            const wallMaterial = new THREE.MeshLambertMaterial({ map: wallTexture });

            // Materials array for BoxGeometry faces
            const materials = [
                wallMaterial,  // +X (right)
                wallMaterial,  // -X (left)
                roofMaterial,  // +Y (top)
                wallMaterial,  // -Y (bottom)
                wallMaterial,  // +Z (front)
                wallMaterial,  // -Z (back)
            ];

            const mesh = new THREE.InstancedMesh(geometry, materials, count);
            mesh.castShadow = false;
            mesh.receiveShadow = false;
            this.scene.add(mesh);

            this.blockMeshes[texturePath] = mesh;
            this.buildingInstancedMeshes.push(mesh);
        }
    }


    populateBlocks(blueprints) {
        const dummy = new THREE.Object3D();
        const BLOCK_SIZE = 8;

        // Instance index counters for each texture
        const instanceIndices = {};
        for (const texturePath in this.blockMeshes) {
            instanceIndices[texturePath] = 0;
        }

        for (const bp of blueprints) {
            const numBlocks = bp.height / BLOCK_SIZE;
            const visualParts = []; // Store all block instances for this building

            // Create each block
            for (let blockIndex = 0; blockIndex < numBlocks; blockIndex++) {
                const texturePath = bp.blocks[blockIndex];
                const mesh = this.blockMeshes[texturePath];
                const instanceId = instanceIndices[texturePath]++;

                // Position block at correct height
                const blockY = blockIndex * BLOCK_SIZE + BLOCK_SIZE / 2;
                dummy.position.set(bp.x, blockY, bp.z);
                dummy.scale.set(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                dummy.updateMatrix();

                mesh.setMatrixAt(instanceId, dummy.matrix);
                mesh.setColorAt(instanceId, new THREE.Color(0x808080));

                visualParts.push({ mesh, instanceId });
            }

            // Update all meshes
            for (const texturePath in this.blockMeshes) {
                const mesh = this.blockMeshes[texturePath];
                mesh.instanceMatrix.needsUpdate = true;
                if (mesh.instanceColor) {
                    mesh.instanceColor.needsUpdate = true;
                }
            }

            // Create building collider
            this.buildingColliders.push({
                cx: bp.x,
                cy: bp.height / 2,
                cz: bp.z,
                hx: bp.width / 2,
                hy: bp.height / 2,
                hz: bp.depth / 2,
                health: 100,
                maxHealth: 100,
                destroyed: false,
                item: null,
                star: null,
                visualParts, // Array of {mesh, instanceId}
                defense: 0,
                onDeath: null,
            });
        }
    }

    // NOTE: Instanced meshes reserve slots up front; any unused slot would otherwise render at (0,0,0).
    getAliveBuildingsCount() {
        return this.buildingColliders.length;
    }

    damageBuilding(collider, amount) {
        if (!collider || collider.destroyed) {
            return;
        }

        const value = Number(amount);
        if (!Number.isFinite(value) || value <= 0) {
            return;
        }

        const defense = collider.defense || 0;
        const effectiveDamage = Math.max(1, value - defense);
        collider.health = Math.max(0, collider.health - effectiveDamage);

        const healthPercent = collider.health / collider.maxHealth;
        this.buildingVisuals.flashBuilding(collider, healthPercent);

        if (collider.health === 0) {
            this.destroyBuilding(collider);
        }
    }

    destroyBuilding(collider) {
        if (!collider || collider.destroyed) {
            return;
        }

        collider.destroyed = true;
        collider.health = 0;

        if (collider.item) {
            this.cleanupAttachedObject(collider.item);
            collider.item = null;
        }

        if (collider.star) {
            this.cleanupAttachedObject(collider.star);
            collider.star = null;
        }

        if (collider.visualParts && Array.isArray(collider.visualParts) && this.instanceDummy) {
            const dummy = this.instanceDummy;
            dummy.position.set(0, -1000, 0);
            dummy.scale.set(0.001, 0.001, 0.001);
            dummy.updateMatrix();

            // Hide all block instances
            for (const part of collider.visualParts) {
                part.mesh.setMatrixAt(part.instanceId, dummy.matrix);
                part.mesh.instanceMatrix.needsUpdate = true;
            }
        }
        const index = this.buildingColliders.indexOf(collider);
        if (index !== -1) {
            this.buildingColliders.splice(index, 1);
        }
        eventBus.emit('updateBuildingCounter', this.getAliveBuildingsCount(), this.initialBuildingCount);
        if (typeof collider.onDeath === 'function') {
            collider.onDeath();
        }
    }

    cleanupAttachedObject(attached) {
        if (!attached) {
            return;
        }

        if (attached.mesh) {
            this.scene.remove(attached.mesh);
        }

        if (typeof attached.dispose === 'function') {
            attached.dispose();
        }

        if (attached.building) {
            attached.building = null;
        }

        eventBus.emit('itemRemovedFromBuilding', attached);
    }

    addItemToBuilding(building, item) {
        if (!building || building.destroyed || building.item) {
            return false;
        }

        building.item = item;
        item.building = building;
        return true;
    }

    addStarToBuilding(building, star) {
        if (!building || building.destroyed || building.star) {
            return false;
        }

        building.star = star;
        star.building = building;
        return true;
    }

    checkEnemyBulletsAgainstBuildings(enemies = []) {
        if (!Array.isArray(enemies) || enemies.length === 0) {
            return;
        }

        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            if (!enemy || enemy.isDestroyed || !Array.isArray(enemy.bullets) || enemy.bullets.length === 0) {
                continue;
            }

            this.handleBulletCollisions(enemy.bullets, {
                getPosition: (bullet) => bullet.position,
                getDamage: (bullet) => bullet.damage,
                onConsumed: (bullet, bulletIndex) => {
                    if (bullet && typeof bullet.destroy === 'function') {
                        bullet.destroy();
                    }
                    enemy.bullets.splice(bulletIndex, 1);
                }
            });
        }
    }

    checkPlayerBulletsAgainstBuildings(bullets, removeBulletCallback) {
        this.handleBulletCollisions(bullets, {
            onConsumed: (bullet) => {
                if (typeof removeBulletCallback === 'function') {
                    removeBulletCallback(bullet);
                }
            }
        });
    }

    handleBulletCollisions(bullets, { getPosition, getDamage, onConsumed } = {}) {
        if (
            this.buildingColliders.length === 0 ||
            !Array.isArray(bullets) ||
            bullets.length === 0
        ) {
            return;
        }

        const resolvePosition = typeof getPosition === 'function'
            ? getPosition
            : (bullet) => bullet?.position ?? bullet?.mesh?.position ?? null;
        const resolveDamage = typeof getDamage === 'function'
            ? getDamage
            : (bullet) => bullet?.damage ?? 10;

        for (let i = bullets.length - 1; i >= 0; i--) {
            const bullet = bullets[i];
            const position = resolvePosition(bullet);
            if (!position) {
                continue;
            }

            const collider = this.findColliderContaining(position);
            if (!collider) {
                continue;
            }

            const damage = resolveDamage(bullet);
            this.damageBuilding(collider, Number.isFinite(damage) ? damage : 10);

            if (typeof onConsumed === 'function') {
                onConsumed(bullet, i);
            }
        }
    }

    findColliderContaining(position) {
        if (!position) {
            return null;
        }

        for (let i = 0; i < this.buildingColliders.length; i++) {
            const collider = this.buildingColliders[i];
            if (!collider || collider.destroyed) {
                continue;
            }

            const dx = Math.abs(position.x - collider.cx) - collider.hx;
            const dy = Math.abs(position.y - collider.cy) - collider.hy;
            const dz = Math.abs(position.z - collider.cz) - collider.hz;

            if (dx <= 0 && dy <= 0 && dz <= 0) {
                return collider;
            }
        }

        return null;
    }
}

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { TurretBullet } from './TurretBullet.js';

/**
 * Manages turret instances and their bullets.
 * Handles turret pooling, bullet spawning, and bullet updates.
 */
export class TurretManager {
    constructor(scene, enemyManager) {
        this.scene = scene;
        this.enemyManager = enemyManager;

        // Turret pool management
        this.capacity = 5;
        this.instances = []; // Array of turret instance groups
        this.freeSlots = []; // Stack of available slots
        this.slotToTurret = [];

        // Model template (loaded once)
        this.modelTemplate = null;
        this.isLoaded = false;
        this.loadCallbacks = [];

        // Turret bullets
        this.bullets = [];

        // Reusable objects
        this.tempPosition = new THREE.Vector3();
        this.tempRotation = new THREE.Euler();

        this.#init();
    }

    update(delta) {
        this.#updateBullets(delta);
    }

    spawnBullet(turret, direction) {
        this.bullets.push(new TurretBullet({
            turret,
            position: (turret.getMuzzlePosition) ? turret.getMuzzlePosition() : turret.mesh.position,
            direction,
            speed: turret.bulletSpeed,
            range: turret.bulletRange,
            damage: turret.bulletDamage,
            maxTicks: turret.bulletMaxTicks,
        }));
    }

    /**
     * Acquire a turret slot and position it
     * @param {THREE.Vector3} position - World position for the turret
     * @returns {number|null} - Slot index or null if pool exhausted
     */
    acquireSlot(position, owner) {
        if (!this.isLoaded) {
            console.warn('Turret pool not ready');
            return null;
        }

        if (this.freeSlots.length === 0) {
            console.log('Turret pool exhausted, expanding...');
            this.#createNewInstance();
        }

        const slot = this.freeSlots.pop();
        const instance = this.instances[slot];

        if (instance) {
            instance.position.copy(position);
            // Ensure it's in the scene (in case it was removed by BuildingManager)
            if (!instance.parent) {
                this.scene.add(instance);
            }
        }

        this.slotToTurret[slot] = owner;
        return slot;
    }

    /**
     * Update a turret's position
     * @param {number} slot - Slot index
     * @param {THREE.Vector3} position - New position
     */
    updateSlot(slot, position) {
        if (slot === null || slot === undefined || !this.instances[slot]) return;

        this.instances[slot].position.copy(position);
    }

    /**
     * Release a turret slot (hide it underground)
     * @param {number} slot - Slot index to release
     */
    releaseSlot(slot) {
        if (slot === null || slot === undefined || !this.instances[slot]) return;

        // Move underground
        this.instances[slot].position.set(0, -1000, 0);

        this.freeSlots.push(slot);
        this.slotToTurret[slot] = null;
    }

    /**
     * Get the mesh instance for a given slot
     * @param {number} slot - Slot index
     * @returns {THREE.Group|null}
     */
    getInstance(slot) {
        if (slot === null || slot === undefined) return null;
        return this.instances[slot] || null;
    }

    /**
     * Get the Turret instance associated with a mesh
     * @param {THREE.Object3D} mesh 
     * @returns {Turret|null}
     */
    getTurretFromMesh(mesh) {
        let current = mesh;
        while (current) {
            const index = this.instances.indexOf(current);
            if (index !== -1) {
                return this.slotToTurret[index];
            }
            current = current.parent;
        }
        return null;
    }

    /**
     * Register callback to execute when model is loaded
     * @param {Function} callback
     */
    onReady(callback) {
        if (this.isLoaded) {
            callback();
        } else {
            this.loadCallbacks.push(callback);
        }
    }

    /**
     * Dispose of all resources
     */
    dispose() {
        // Remove all instances from scene
        this.instances.forEach(instance => {
            if (instance) {
                // Dispose geometries and materials
                instance.traverse((child) => {
                    if (child.geometry) {
                        child.geometry.dispose();
                    }
                    if (child.material) {
                        const materials = Array.isArray(child.material) ? child.material : [child.material];
                        materials.forEach(material => {
                            if (material.map) material.map.dispose();
                            if (material.lightMap) material.lightMap.dispose();
                            if (material.bumpMap) material.bumpMap.dispose();
                            if (material.normalMap) material.normalMap.dispose();
                            if (material.specularMap) material.specularMap.dispose();
                            if (material.envMap) material.envMap.dispose();
                            if (material.aoMap) material.aoMap.dispose();
                            if (material.emissiveMap) material.emissiveMap.dispose();
                            if (material.metalnessMap) material.metalnessMap.dispose();
                            if (material.roughnessMap) material.roughnessMap.dispose();
                            material.dispose();
                        });
                    }
                });

                this.scene.remove(instance);
            }
        });

        this.instances = [];
        this.freeSlots = [];
        this.slotToTurret.fill(null);
        this.modelTemplate = null;
        this.isLoaded = false;
    }

    #init() {
        // Load the GLB model once
        const loader = new GLTFLoader();
        loader.load('assets/3D Models/turret.glb',
            (gltf) => {
                this.modelTemplate = gltf.scene;

                // Apply the scale to template
                this.modelTemplate.scale.set(5, 5, 5);
                // Rotation is now baked into the GLB
                // this.modelTemplate.rotation.set(-0.71, -2.46, -0.42);

                this.isLoaded = true;
                this.#createInstances();

                // Execute any pending callbacks
                this.loadCallbacks.forEach(cb => cb());
                this.loadCallbacks = [];
            },
            (xhr) => {
                console.log(`Turret pool: ${(xhr.loaded / xhr.total * 100).toFixed(0)}% loaded`);
            },
            (error) => {
                console.error('Error loading turret model for pool:', error);
                this.isLoaded = false;
            }
        );
    }

    #createInstances() {
        if (!this.isLoaded || !this.modelTemplate) {
            console.error('Cannot create instances: model not loaded');
            return;
        }

        // Create initial batch of instances
        for (let i = 0; i < this.capacity; i++) {
            this.#createNewInstance();
        }
    }

    #createNewInstance() {
        // Create a wrapper group to handle game-logic rotation (facing enemies)
        const wrapper = new THREE.Group();

        // Clone the model which has the "fix" rotation applied
        const model = this.modelTemplate.clone();
        wrapper.add(model);

        // Hide underground initially
        wrapper.position.set(0, -1000, 0);

        this.scene.add(wrapper);

        // Apply 2D culling so turrets are visible regardless of altitude
        // Note: We attach this to the wrapper
        wrapper.frustumCulled = false;
        wrapper.onBeforeRender = (renderer, scene, camera) => {
            const dx = camera.position.x - wrapper.position.x;
            const dz = camera.position.z - wrapper.position.z;
            const distance2D = Math.sqrt(dx * dx + dz * dz);
            wrapper.visible = distance2D < 2000;
        };

        // Find the head for independent rotation
        const head = wrapper.getObjectByName('head');
        if (head) {
            wrapper.userData.head = head;
        } else {
            console.warn('Turret Head not found in model!');
        }

        const slot = this.instances.length;
        this.instances.push(wrapper);
        this.freeSlots.push(slot);
        this.slotToTurret.push(null);

        return slot;
    }

    #updateBullets(delta) {
        if (this.bullets.length === 0) {
            return;
        }

        const bulletDelta = Math.min(delta, 0.2);

        // Update bullet positions
        for (let i = this.bullets.length - 1; i >= 0; i--) {
            const bullet = this.bullets[i];
            bullet.update(bulletDelta);

            // Check if bullet has expired
            if (bullet.travelled >= bullet.range || bullet.hasExceededLifetime()) {
                bullet.destroy();
                this.bullets.splice(i, 1);
            }
        }

        // Check collisions with enemies (EnemyManager handles removal)
        this.enemyManager.checkTurretBulletCollisions(this.bullets);
    }
}

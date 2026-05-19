import * as THREE from 'three';

export class BulletPoolManager {
    constructor(scene) {
        this.scene = scene;
        this.capacity = 1000;
        this.mesh = null;
        this.activeCount = 0;
        this.freeSlots = []; // Stack of available slots
        this.slotToBullet = new Array(this.capacity).fill(null);

        // Reusable objects to avoid GC
        this.dummy = new THREE.Object3D();
        this.tempColor = new THREE.Color();

        this.init();
    }

    init() {
        const geometry = new THREE.SphereGeometry(0.2, 8, 8);
        const material = new THREE.MeshLambertMaterial({ color: 0xffffff });

        this.mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
        this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.mesh.count = this.capacity; // Always draw all instances

        // Expand bounding sphere to cover large area (fixes high altitude invisibility)
        // Note: frustumCulled and onBeforeRender are now set by WorldRenderer.apply2DCulling()
        this.mesh.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 5000);

        // Initialize free slots and move all instances underground
        for (let i = 0; i < this.capacity; i++) {
            this.freeSlots.push(i);
            this.dummy.position.set(0, -1000, 0);
            this.dummy.updateMatrix();
            this.mesh.setMatrixAt(i, this.dummy.matrix);
        }

        this.mesh.instanceMatrix.needsUpdate = true;
        this.scene.add(this.mesh);
    }

    acquireSlot(position, direction, colorHex) {
        if (this.freeSlots.length === 0) {
            console.warn('Bullet pool exhausted!');
            return null;
        }

        const slot = this.freeSlots.pop();

        // Set initial position
        this.dummy.position.copy(position);
        this.dummy.scale.set(1, 1, 1);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(slot, this.dummy.matrix);

        // Set color
        this.tempColor.setHex(colorHex);
        this.mesh.setColorAt(slot, this.tempColor);

        // Mark as needing update
        this.mesh.instanceMatrix.needsUpdate = true;
        if (this.mesh.instanceColor) {
            this.mesh.instanceColor.needsUpdate = true;
        }

        return slot;
    }

    updateSlot(slot, position) {
        if (slot === null || slot === undefined) return;

        this.dummy.position.copy(position);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(slot, this.dummy.matrix);
        this.mesh.instanceMatrix.needsUpdate = true;
    }

    releaseSlot(slot) {
        if (slot === null || slot === undefined) return;

        // Move underground to center (0, -1000, 0)
        this.dummy.position.set(0, -1000, 0);
        this.dummy.scale.set(1, 1, 1);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(slot, this.dummy.matrix);
        this.mesh.instanceMatrix.needsUpdate = true;

        this.freeSlots.push(slot);
    }

    dispose() {
        if (this.mesh) {
            this.scene.remove(this.mesh);
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.mesh = null;
        }
    }
}

import * as THREE from 'three';

export class AcceleratorRing {
    constructor(game, position) {
        this.game = game;
        this.radius = 15;
        this.boostMultiplier = 3.0;

        // Create a canvas texture for the fading ring effect
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');

        // Radial gradient: Transparent center -> Cyan -> Transparent edge
        const gradient = ctx.createRadialGradient(128, 128, 64, 128, 128, 128);
        gradient.addColorStop(0, 'rgba(0, 255, 255, 0)');   // Inner (transparent)
        gradient.addColorStop(0.8, 'rgba(0, 255, 255, 0.6)'); // Peak opacity
        gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');   // Outer edge (transparent)

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 256, 256);

        const texture = new THREE.CanvasTexture(canvas);

        // Create the mesh
        // We use a PlaneGeometry because the texture handles the ring shape
        this.geometry = new THREE.PlaneGeometry(this.radius * 2, this.radius * 2);
        this.material = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false, // Good for transparent glowing effects
            blending: THREE.AdditiveBlending
        });

        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.mesh.position.copy(position);
        this.mesh.position.y += this.radius; // Lift it up so it sits on the surface

        // PlaneGeometry is XY plane.
        // We want it to be vertical?
        // If we leave it as is, it's a vertical billboard facing Z.
        // If we want it to face the center, we can use lookAt.
        // For now, let's just leave it aligned to world axes, or maybe rotate it to face the center (0,0,0) horizontally.

        this.mesh.lookAt(new THREE.Vector3(0, this.mesh.position.y, 0));

        this.game.scene.add(this.mesh);

        this.boostCooldown = 0;
    }

    use() {
        return this.game.itemDeploymentManager.tryDeployItemToClosestBuilding(this);
    }

    setPosition(pos) {
        this.mesh.position.copy(pos);
        this.mesh.position.y += this.radius;
        this.mesh.lookAt(new THREE.Vector3(0, this.mesh.position.y, 0));
    }

    update(delta, context) {
        // Rotate slowly for visual effect
        this.mesh.rotation.z += delta * 0.5;

        // Check for player collision
        // We treat the ring as a sphere for simple proximity check
        const distanceSq = context.playerPosition.distanceToSquared(this.mesh.position);
        const activationRadius = this.radius * 0.8; // Slightly smaller than visual

        if (distanceSq < activationRadius * activationRadius) {

            if (context.plane) {

                // Apply boost
                // We set the speed directly. MovementSystem1 handles the decay.
                const targetSpeed = context.plane.maxSpeed * this.boostMultiplier;
                if (context.plane.speed < targetSpeed) {
                    context.plane.speed = targetSpeed;
                }
            }
        }
    }

    dispose() {
        if (this.mesh) {
            this.game.scene.remove(this.mesh);
            this.mesh.traverse((child) => {
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
        }
    }
}

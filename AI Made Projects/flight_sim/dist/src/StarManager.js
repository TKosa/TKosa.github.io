import * as THREE from 'three';
import { eventBus } from './eventBus.js';

export class StarManager {
    constructor(game) {
        this.game = game;
        this.stars = [];

        // Star configuration
        this.starChance = 0.2;
        this.starSpinSpeed = 1.5; // radians per second
        this.starRespawnMinDistance = 35;
        this.starRespawnMinDistanceSq = this.starRespawnMinDistance * this.starRespawnMinDistance;
        this.starRespawnDelay = 5;
        this.maxStarRespawnAttempts = 12;

        // Create shared geometry and material
        this.#starGeometry = this.#createStarGeometry();
        this.#starMaterial = new THREE.MeshBasicMaterial({ color: 0xffd700, side: THREE.DoubleSide });
    }

    getStars() {
        return this.stars;
    }

    initializeStars() {
        const buildingColliders = this.game.buildingManager.buildingColliders;

        for (const building of buildingColliders) {
            if (Math.random() < this.starChance) {
                const starMesh = this.#createStarMesh();
                starMesh.position.set(building.cx, building.cy + building.hy + 3, building.cz);
                const star = { mesh: starMesh };
                if (this.game.buildingManager.addStarToBuilding(building, star)) {
                    this.game.scene.add(starMesh);
                    this.stars.push(star);
                }
            }
        }
    }

    update(delta) {
        if (!this.game.plane) {
            return;
        }

        const clampedDelta = Math.min(delta, 0.2);
        const rotationAmount = this.starSpinSpeed * clampedDelta;
        const playerPosition = this.game.camera.position;
        const collectRadiusSq = this.game.plane.starCollectRadiusSq;

        for (let i = this.stars.length - 1; i >= 0; i--) {
            const star = this.stars[i];
            star.mesh.rotation.y += rotationAmount;

            const distanceSq = playerPosition.distanceToSquared(star.mesh.position);
            if (distanceSq <= collectRadiusSq) {
                this.#collectStar(i);
            }
        }
    }

    handleItemRemovedFromBuilding(item) {
        const starIndex = this.stars.findIndex(star => star === item);
        if (starIndex !== -1) {
            this.stars.splice(starIndex, 1);
        }
    }

    spawnNewStar() {
        const buildingColliders = this.game.buildingManager.buildingColliders;
        if (buildingColliders.length === 0) {
            return;
        }

        const playerPosition = this.game.camera.position;

        for (let attempt = 0; attempt < this.maxStarRespawnAttempts; attempt++) {
            const collider = buildingColliders[Math.floor(Math.random() * buildingColliders.length)];
            if (!collider || collider.destroyed || collider.star) {
                continue;
            }

            const dx = collider.cx - playerPosition.x;
            const dz = collider.cz - playerPosition.z;
            const distanceSq = dx * dx + dz * dz;
            if (distanceSq < this.starRespawnMinDistanceSq) {
                continue;
            }

            const starMesh = this.#createStarMesh();
            starMesh.position.set(collider.cx, collider.cy + collider.hy + 3, collider.cz);
            const star = { mesh: starMesh };
            if (this.game.buildingManager.addStarToBuilding(collider, star)) {
                this.game.scene.add(starMesh);
                this.stars.push(star);
                return;
            }
        }
    }

    #collectStar(starIndex) {
        const star = this.stars[starIndex];
        this.game.scene.remove(star.mesh);
        this.stars.splice(starIndex, 1);

        const building = star.building;
        if (building && building.star === star) {
            building.star = null;
        }
        star.building = null;

        this.game.gameState.starCount++;
        eventBus.emit('updateStarDisplay', this.game.gameState.starCount);

        // this.game.enemyManager.spawnEnemyAtEdge();
        this.spawnNewStar();
    }

    #createStarMesh() {
        const mesh = new THREE.Mesh(this.#starGeometry, this.#starMaterial.clone());
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        return mesh;
    }

    #createStarGeometry(points = 5, outerRadius = 1.5, innerRadius = 0.7, depth = 0.6) {
        const shape = new THREE.Shape();
        const angleStep = Math.PI / points;
        shape.moveTo(Math.cos(0) * outerRadius, Math.sin(0) * outerRadius);
        for (let i = 1; i < points * 2; i++) {
            const angle = i * angleStep;
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            shape.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        }
        shape.closePath();

        const extrudeSettings = { depth, bevelEnabled: false };
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geometry.center();
        geometry.rotateX(Math.PI / 2);
        geometry.computeVertexNormals();
        return geometry;
    }

    #starGeometry;
    #starMaterial;
}

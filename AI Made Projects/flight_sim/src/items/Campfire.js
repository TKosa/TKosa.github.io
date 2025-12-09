import * as THREE from 'three';

export class Campfire {
    constructor(game, position) {
        this.game = game;
        this.mesh = new THREE.Mesh(
            new THREE.BoxGeometry(2, 2, 2),
            new THREE.MeshBasicMaterial({ color: 0xffa500, transparent: true, opacity: 0.8 })
        );
        this.mesh.position.copy(position);
        this.game.scene.add(this.mesh);

        this.healRate = 15; // Health per second (tripled)
        this.healRangeSq = 100; // Squared range for healing
    }

    use() {
        return this.game.itemDeploymentManager.tryDeployItemToClosestBuilding(this);
    }

    setPosition(pos) {
        this.mesh.position.copy(pos);
    }

    update(delta, context) {
        const distanceSq = context.playerPosition.distanceToSquared(this.mesh.position);
        if (distanceSq < this.healRangeSq) {
            context.addHealth(this.healRate * delta);
        }
    }

    dispose() {
        this.game.scene.remove(this.mesh);
    }
}

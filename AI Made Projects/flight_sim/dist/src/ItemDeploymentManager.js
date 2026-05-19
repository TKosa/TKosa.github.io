import * as THREE from 'three';

export class ItemDeploymentManager {
    constructor(game) {
        this.game = game;
        this.deployed_items = [];
    }

    handleItemUsed(itemId) {
        const item = this.game.itemFactory.createItem(itemId, this.game.camera.position);
        if (item) {
            // Attempt to use the item. If use() returns false, it means the usage failed
            // (e.g., no valid building target), so we dispose of the item immediately.
            const success = typeof item.use === 'function' ? item.use() : false;
            
            if (!success) {
                if (typeof item.dispose === 'function') {
                    item.dispose();
                }
            }
        }
    }

    tryDeployItemToClosestBuilding(item) {
        if (!item) return false;

        const playerPosition = this.game.camera.position;
        let closestBuilding = null;
        let minDistanceSq = Infinity;

        for (const building of this.game.buildingManager.buildingColliders) {
            if (building.destroyed || building.item) continue;

            const distanceSq = playerPosition.distanceToSquared(new THREE.Vector3(building.cx, building.cy, building.cz));
            if (distanceSq < minDistanceSq) {
                minDistanceSq = distanceSq;
                closestBuilding = building;
            }
        }

        if (!closestBuilding) {
            return false;
        }

        const itemPosition = new THREE.Vector3(closestBuilding.cx, closestBuilding.cy + closestBuilding.hy + 1.5, closestBuilding.cz);
        
        // Update item position to the building
        if (typeof item.setPosition === 'function') {
            item.setPosition(itemPosition);
        } else if (item.position) {
            item.position.copy(itemPosition);
            if (item.mesh) {
                item.mesh.position.copy(itemPosition);
            }
        }

        if (this.game.buildingManager.addItemToBuilding(closestBuilding, item)) {
            this.deployed_items.push(item);
            return true;
        }

        return false;
    }

    handleItemRemovedFromBuilding(item) {
        this.game.starManager.handleItemRemovedFromBuilding(item);
        const deployedItemIndex = this.deployed_items.findIndex(i => i === item);
        if (deployedItemIndex !== -1) {
            this.deployed_items.splice(deployedItemIndex, 1);
        }

        if (item) {
            item.building = null;
        }
    }

    update(delta, context) {
        this.deployed_items.forEach(item => {
            if (item.update) {
                item.update(delta, context);
            }
        });
    }

    getDeployedItems() {
        return this.deployed_items;
    }
}

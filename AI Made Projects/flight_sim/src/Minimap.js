
import { eventBus } from './eventBus.js';

export class Minimap {
    constructor() {
        this.dots = [];
    }

    tick(player, enemies, stars, deployed_items) {
        this.dots = [];

        if (player && player.position) {
            this.addDot(player.position, 'player-dot');
        }

        if (Array.isArray(enemies)) {
            enemies.forEach(enemy => {
                if (!enemy || enemy.isDestroyed) return;

                let className = 'enemy-dot';
                if (enemy.type === 'orange') {
                    className = 'orange-enemy-dot';
                } else if (enemy.type === 'black') {
                    className = 'black-enemy-dot';
                }

                if (enemy.position) {
                    this.addDot(enemy.position, className);
                }
            });
        }

        if (Array.isArray(stars)) {
            stars.forEach(star => {
                if (!star.collected && star.mesh && star.mesh.position) {
                    this.addDot(star.mesh.position, 'star-dot');
                }
            });
        }

        if (Array.isArray(deployed_items)) {
            deployed_items.forEach(item => {
                if (item.mesh && item.mesh.position) {
                    this.addDot(item.mesh.position, 'deployed-item-dot');
                }
            });
        }

        eventBus.emit('renderMinimap', this.dots);
    }

    addDot(position, className) {
        const mapSize = 200;
        const worldSize = 1500;

        // Clamp to world bounds to ensure dots stay within the minimap
        const halfWorld = worldSize / 2;
        const clampedX = Math.max(-halfWorld, Math.min(halfWorld, position.x));
        const clampedZ = Math.max(-halfWorld, Math.min(halfWorld, position.z));

        const x = (clampedX / worldSize) * mapSize + mapSize / 2;
        const z = (clampedZ / worldSize) * mapSize + mapSize / 2;

        this.dots.push({ x, z, className });
    }
}

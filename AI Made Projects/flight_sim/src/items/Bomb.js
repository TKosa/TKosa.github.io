import * as THREE from 'three';

export class Bomb {
    static DEFAULTS = {
        damage: 100,
        radius: 35,
    };

    constructor(game, position) {
        this.game = game;
        this.position = position.clone();
        this.damage = Bomb.DEFAULTS.damage;
        this.radius = Bomb.DEFAULTS.radius;
        this.isDetonated = false;
    }

    use() {
        this.detonate();
        return true;
    }

    /**
     * Detonate the bomb, applying damage to all enemies within radius
     */
    detonate() {
        if (this.isDetonated) {
            return;
        }

        this.isDetonated = true;

        if (!this.game || !this.game.enemyManager) {
            console.warn('Bomb: Cannot detonate without map reference');
            return;
        }

        // Apply damage to enemies
        this.applyDamageToEnemies();

    }

    /**
     * Apply damage to all enemies within the bomb's radius
     */
    applyDamageToEnemies() {
        const enemies = this.game.enemyManager.getEnemies();
        const radiusSq = this.radius * this.radius;

        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (enemy.isDestroyed) {
                continue;
            }

            const distanceSq = this.position.distanceToSquared(enemy.position);
                if (distanceSq <= radiusSq) {
                    const destroyed = enemy.takeDamage(this.damage);
                    if (destroyed) {
                        if (this.game?.enemyManager && typeof this.game.enemyManager.handleEnemyDestruction === 'function') {
                            this.game.enemyManager.handleEnemyDestruction(enemy);
                        } else if (typeof this.game?.onEnemyDestroyed === 'function') {
                            this.game.onEnemyDestroyed(enemy);
                        }
                    }
                }
            }
        }

    update(delta, context) {
        // Bomb-specific logic can go here
        // For now, bombs detonate immediately when used
    }


}

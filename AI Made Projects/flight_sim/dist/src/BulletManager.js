import * as THREE from 'three';
import { Bullet } from './Bullet.js';
import { PlayerBullet } from './playerBullet.js';

export class BulletManager {
    constructor(game) {
        this.game = game;

        // Initialize bullet pool
        const bulletPool = this.game.worldRenderer.getBulletPool();
        Bullet.initialize(bulletPool);
        PlayerBullet.initialize(bulletPool);

        this.playerBulletBaseDamage = 10;
        this.playerBulletMaxDamage = 40;
        this.playerBulletDamage = this.playerBulletBaseDamage;
        this.playerBulletMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    }

    updatePlayerBullets(delta) {
        if (!this.game.plane) {
            return;
        }
        this.game.plane.updateBullets(delta);
    }

    setPlayerBulletDamage(amount) {
        const value = Number(amount);
        if (!Number.isFinite(value) || value <= 0) {
            return false;
        }
        this.playerBulletDamage = Math.min(
            this.playerBulletMaxDamage,
            Math.max(this.playerBulletBaseDamage, value)
        );
        return true;
    }

    checkBulletCollisions() {
        if (this.game.playerHealthManager.getHealth() <= 0 || !this.game.plane) {
            return;
        }

        const planeRadius = this.game.plane.size;
        const enemies = this.game.enemyManager.getEnemies();

        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];
            if (enemy.isDestroyed) {
                enemies.splice(i, 1);
                continue;
            }
            for (let j = enemy.bullets.length - 1; j >= 0; j--) {
                const bullet = enemy.bullets[j];
                const distance = this.game.camera.position.distanceTo(bullet.position);

                if (distance <= planeRadius) {
                    this.game.playerHealthManager.applyDamage(bullet.damage ?? 10);
                    if (bullet && typeof bullet.destroy === 'function') {
                        bullet.destroy();
                    }
                    enemy.bullets.splice(j, 1);
                }
            }
        }
    }

    dispose() {
        if (this.playerBulletMaterial) {
            this.playerBulletMaterial.dispose();
        }
    }
}

import * as THREE from 'three';
import { Enemy } from './Enemy.js';
import { ChasePlayerBehavior } from '../behaviors.js';

export class OrangeEnemy extends Enemy {
    static COLOR = 0xffa500; // Orange

    // Default configuration for orange enemies
    static DEFAULTS = {
        bulletSpeed: 20,
        bulletLifetime: 3.5,
        maxActiveBullets: 7,
        movementSpeedMultiplier: 0.8, // Slower than red enemies
        buildingBulletDamageMultiplier: 1.5, // Higher damage than red enemies
        turnSpeed: 1.5,
    };

    constructor(options = {}) {
        // Apply orange enemy defaults
        const orangeOptions = {
            bulletSpeed: options.bulletSpeed ?? OrangeEnemy.DEFAULTS.bulletSpeed,
            bulletLifetime: options.bulletLifetime ?? OrangeEnemy.DEFAULTS.bulletLifetime,
            maxActiveBullets: options.maxActiveBullets ?? OrangeEnemy.DEFAULTS.maxActiveBullets,
            movementSpeed: options.movementSpeed ?? (options.baseMovementSpeed ?? 12) * OrangeEnemy.DEFAULTS.movementSpeedMultiplier,
            buildingBulletDamage: options.buildingBulletDamage ?? (options.baseBuildingBulletDamage ?? 10) * OrangeEnemy.DEFAULTS.buildingBulletDamageMultiplier,
            ...options,
        };

        // Create behavior if not provided
        if (!orangeOptions.behavior && !orangeOptions.behaviorFactory) {
            orangeOptions.behaviorFactory = (instance) => new ChasePlayerBehavior(instance, {
                speed: orangeOptions.movementSpeed,
                turnSpeed: OrangeEnemy.DEFAULTS.turnSpeed,
                ...orangeOptions.behaviorOptions,
            });
        }

        super(orangeOptions);
        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.hitRadius = 3;
        this.meshScale = 2; // WorldRenderer will use this
        this.type = 'orange';
    }
}


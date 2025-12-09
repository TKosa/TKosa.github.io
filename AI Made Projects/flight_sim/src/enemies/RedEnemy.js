import * as THREE from 'three';
import { Enemy } from './Enemy.js';
import { BasicEnemyBehavior } from '../behaviors.js';

export class RedEnemy extends Enemy {
    static COLOR = 0xff0000; // Red

    // Default configuration for red enemies
    static DEFAULTS = {
        maxHealth: 10,
        bulletSpeed: 24,
        bulletLifetime: 2.8,
        maxActiveBullets: 5,
        movementSpeedMultiplier: 1.0, // Normal speed
        buildingBulletDamageMultiplier: 1.0, // Normal damage
    };

    constructor(options = {}) {
        // Apply red enemy defaults
        const redOptions = {
            maxHealth: options.maxHealth ?? RedEnemy.DEFAULTS.maxHealth,
            bulletSpeed: options.bulletSpeed ?? RedEnemy.DEFAULTS.bulletSpeed,
            bulletLifetime: options.bulletLifetime ?? RedEnemy.DEFAULTS.bulletLifetime,
            maxActiveBullets: options.maxActiveBullets ?? RedEnemy.DEFAULTS.maxActiveBullets,
            movementSpeed: options.movementSpeed ?? (options.baseMovementSpeed ?? 12) * RedEnemy.DEFAULTS.movementSpeedMultiplier,
            buildingBulletDamage: options.buildingBulletDamage ?? (options.baseBuildingBulletDamage ?? 10) * RedEnemy.DEFAULTS.buildingBulletDamageMultiplier,
            ...options,
        };

        // Create behavior if not provided
        if (!redOptions.behavior && !redOptions.behaviorFactory) {
            const initialDirection = RedEnemy.calculateInitialDirection(redOptions.position, redOptions.behaviorOptions);
            redOptions.behaviorFactory = (instance) => new BasicEnemyBehavior(instance, {
                ...redOptions.behaviorOptions,
                initialHeading: initialDirection,
            });
        }

        super(redOptions);
        this.type = 'red';
        this.cityBoundary = options.cityBoundary ?? 600;
    }

    /**
     * Calculate initial direction for red enemy spawning at edge
     * Points toward center with random variation
     */
    static calculateInitialDirection(position, behaviorOptions = {}) {
        if (!position) return null;

        // Point toward center with random variation
        const centerDirection = new THREE.Vector3(-position.x, 0, -position.z).normalize();
        const randomAngle = THREE.MathUtils.degToRad((Math.random() * 150) - 75);
        const rotationAxis = new THREE.Vector3(0, 1, 0);
        return centerDirection.clone().applyAxisAngle(rotationAxis, randomAngle);
    }

    /**
     * Check if red enemy is out of bounds
     * Red enemies should be destroyed when they fly too far from the city
     */
    isOutOfBounds() {
        const position = this.position;
        const boundary = this.cityBoundary + 20;
        return Math.abs(position.x) > boundary || Math.abs(position.z) > boundary;
    }
}

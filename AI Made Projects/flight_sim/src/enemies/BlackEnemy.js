import * as THREE from 'three';
import { Enemy } from './Enemy.js';
import { GoToCenterBehavior } from '../behaviors.js';

export class BlackEnemy extends Enemy {
    static COLOR = 0x333333; // Dark gray (pure black won't be visible)

    constructor(options = {}) {
        super(options);
        this.maxHealth = 500;
        this.health = this.maxHealth;
        this.hitRadius = 5;
        this.meshScale = 4; // WorldRenderer will use this
        this.type = 'black';
        this.behavior = new GoToCenterBehavior(this, options.behaviorOptions);
    }
}

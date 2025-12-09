import { eventBus } from './eventBus.js';

export class PlayerHealthManager {
    constructor(scheduler, initialHealth = 100, onHealthChange = () => { }) {
        this.scheduler = scheduler;
        this.health = initialHealth;
        this.maxHealth = initialHealth;
        this.damageCooldown = 1.5;
        this.lastDamageTime = -Infinity;
        this.isShieldActive = false;
        this.plane = null;
        this.onHealthChange = onHealthChange;
    }

    setPlane(plane) {
        this.plane = plane;
        if (this.plane) {
            this.plane.isShielded = this.isShieldActive;
        }
    }

    applyDamage(amount) {
        const value = Number(amount);

        if (!Number.isFinite(value) || value <= 0 || this.health <= 0) {
            return false;
        }

        const now = this.scheduler.now();

        if (this.isShieldActive) {
            this.consumeShield();
            this.lastDamageTime = now;
            return false;
        }

        if (now - this.lastDamageTime < this.damageCooldown) {
            return false;
        }

        this.health = Math.max(0, this.health - value);
        this.lastDamageTime = now;
        this.emitHealthUpdate();
        return true;
    }

    addHealth(amount) {
        const value = Number(amount);
        if (!Number.isFinite(value) || value <= 0 || this.health <= 0) {
            return;
        }

        const newHealth = Math.min(this.maxHealth, this.health + value);
        if (newHealth === this.health) {
            return;
        }

        this.health = newHealth;
        this.emitHealthUpdate();
    }

    increaseMaxHealth(amount) {
        const value = Number(amount);
        if (!Number.isFinite(value) || value <= 0) {
            return;
        }

        this.maxHealth = Math.max(1, this.maxHealth + value);
        this.health = Math.min(this.maxHealth, this.health + value);

        this.emitHealthUpdate();
    }

    useShield() {
        if (this.isShieldActive || this.health <= 0) {
            return false;
        }

        this.isShieldActive = true;
        if (this.plane) {
            this.plane.isShielded = true;
        }
        this.emitShieldState();
        return true;
    }

    consumeShield() {
        if (!this.isShieldActive) {
            return false;
        }

        this.isShieldActive = false;
        if (this.plane) {
            this.plane.isShielded = false;
        }
        this.emitShieldState();
        return true;
    }

    emitHealthUpdate() {
        eventBus.emit('updateHealthDisplay', this.health, this.maxHealth);
        this.onHealthChange();
    }

    emitShieldState() {
        eventBus.emit('shieldStateChanged', { active: this.isShieldActive });
    }

    getHealth() {
        return this.health;
    }

    getMaxHealth() {
        return this.maxHealth;
    }
}

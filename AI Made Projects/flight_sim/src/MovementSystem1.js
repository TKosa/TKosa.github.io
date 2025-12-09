import * as THREE from 'three';

const TURN_CONSTANTS = {
    INITIAL_TURN_RATE: 0.005,
    TURN_ACCELERATION: 0.00025,
    MAX_TURN_RATE: 0.025
};

/**
 * Original airplane-style movement system.
 * Pitch/yaw/roll controls with forward throttle.
 */
export class MovementSystem1 {
    constructor(plane) {
        this.plane = plane;
        this.currentTurnSpeed = 0;
        this.lastYawInput = 0;
    }

    /**
     * Called by Plane.input() - handles control input
     */
    input(action, isPressed) {
        if (!this.plane.controls) return;
        switch (action) {
            case 'Left':
                this.plane.controls.turnLeft = isPressed;
                break;
            case 'Right':
                this.plane.controls.turnRight = isPressed;
                break;
            case 'Up':
                this.plane.controls.pitchUp = isPressed;
                break;
            case 'Down':
                this.plane.controls.pitchDown = isPressed;
                break;
            case 'Throttle':
                this.plane.controls.throttle = isPressed;
                break;
            default:
                break;
        }
    }

    /**
     * Main update loop - airplane-style movement
     */
    update(deltaMultiplier) {
        if (this.plane.inventory) {
            this.plane.inventory.update();
        }

        // Throttle control
        if (this.plane.controls.throttle && this.plane.speed < this.plane.maxSpeed) {
            this.plane.speed += this.plane.throttleAcceleration * deltaMultiplier;
        } else {
            const decayRate = this.plane.throttleDeceleration * this.plane.rootDecay;
            const limit = this.plane.controls.throttle ? this.plane.maxSpeed : this.plane.minSpeed;
            this.plane.speed = Math.max(limit, this.plane.speed - decayRate * deltaMultiplier);
        }

        // Pitch control
        const pitchInput = (this.plane.controls.pitchUp ? 1 : 0) - (this.plane.controls.pitchDown ? 1 : 0);
        if (pitchInput !== 0) {
            const pitchRate = this.plane.pitchChangeRate * this.plane.globalSensitivity;
            this.plane.pitch += pitchInput * pitchRate * deltaMultiplier;
        }
        this.plane.pitch = THREE.MathUtils.clamp(this.plane.pitch, -this.plane.maxPitch, this.plane.maxPitch);

        // Yaw control
        const yawInput = (this.plane.controls.turnLeft ? 1 : 0) - (this.plane.controls.turnRight ? 1 : 0);
        const horizontalFactor = this.plane.globalSensitivity * this.plane.horizontalSensitivity * this.plane.leftRightRotationBonus;

        if (yawInput !== 0) {
            // Reset to initial rate if direction changed or just started
            if (yawInput !== this.lastYawInput) {
                this.currentTurnSpeed = TURN_CONSTANTS.INITIAL_TURN_RATE;
                this.lastYawInput = yawInput;
            }

            // Accelerate turn
            this.currentTurnSpeed += TURN_CONSTANTS.TURN_ACCELERATION * deltaMultiplier;

            // Cap at max rate
            if (this.currentTurnSpeed > TURN_CONSTANTS.MAX_TURN_RATE) {
                this.currentTurnSpeed = TURN_CONSTANTS.MAX_TURN_RATE;
            }

            const yawRate = this.currentTurnSpeed * horizontalFactor;
            this.plane.yaw += yawInput * yawRate * deltaMultiplier;
        } else {
            this.currentTurnSpeed = 0;
            this.lastYawInput = 0;
        }

        // Roll control (auto-banking)
        const targetRoll = yawInput * horizontalFactor * this.plane.rollTiltFactor;
        const rollSnapBack = this.plane.rollSnapBackRate * this.plane.globalSnapBack * this.plane.leftRightSnapBack;
        this.plane.roll += (targetRoll - this.plane.roll) * rollSnapBack * deltaMultiplier;
        this.plane.roll = THREE.MathUtils.clamp(this.plane.roll, -this.plane.maxRoll, this.plane.maxRoll);

        // Update orientation
        this.plane.updateOrientation();

        // Calculate movement direction
        this.plane.moveDirection
            .copy(this.plane.forwardVector)
            .applyQuaternion(this.plane.quaternion);

        // Apply movement with altitude constraints
        const moveDistance = this.plane.speed * deltaMultiplier;
        const predictedY = this.plane.position.y + this.plane.moveDirection.y * moveDistance;
        if (predictedY < this.plane.minAltitude && this.plane.moveDirection.y < 0) {
            this.plane.horizontalDirection.copy(this.plane.moveDirection);
            this.plane.horizontalDirection.y = 0;
            if (this.plane.horizontalDirection.lengthSq() > 1e-6) {
                this.plane.horizontalDirection.normalize();
                this.plane.position.addScaledVector(this.plane.horizontalDirection, moveDistance);
            } else {
                this.plane.position.addScaledVector(this.plane.moveDirection, moveDistance);
            }
            this.plane.position.y = this.plane.minAltitude;
            this.plane.pitch = Math.max(this.plane.pitch, 0);
        } else {
            this.plane.position.addScaledVector(this.plane.moveDirection, moveDistance);
            if (this.plane.position.y < this.plane.minAltitude) {
                this.plane.position.y = this.plane.minAltitude;
                this.plane.pitch = Math.max(this.plane.pitch, 0);
            }
        }
    }

    /**
     * Reset controls
     */
    resetControls() {
        if (!this.plane.controls) return;
        this.plane.controls.throttle = false;
        this.plane.controls.pitchUp = false;
        this.plane.controls.pitchDown = false;
        this.plane.controls.turnLeft = false;
        this.plane.controls.turnRight = false;
    }
}

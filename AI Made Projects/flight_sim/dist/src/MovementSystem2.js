import * as THREE from 'three';

/**
 * Alternate movement system with 6DOF free-flying controls.
 * WASD moves horizontally, Space/Shift moves up/down.
 * Uses velocity with acceleration/deceleration.
 */
export class MovementSystem2 {
    constructor(plane) {
        this.plane = plane;

        // Velocity for each axis
        this.velocity = new THREE.Vector3(0, 0, 0);

        // Movement parameters
        this.acceleration = 0.015; // How fast we accelerate
        this.maxSpeed = 3.0; // Max horizontal speed
        this.maxVerticalSpeed = 3.0; // Max vertical speed
        this.rotationSpeed = THREE.MathUtils.degToRad(3); // Degrees per frame at 60fps

        // Orientation state
        this.yawAngle = 0;
        this.prevYawAngle = 0;

        // Temporary vectors
        this.tempVec = new THREE.Vector3();
        this.forwardDir = new THREE.Vector3(0, 0, -1);
        this.upDir = new THREE.Vector3(0, 1, 0);
        this.localInput = new THREE.Vector3(); // Reused for horizontal acceleration
    }

    /**
     * Called by Plane.input() - same interface as original
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
            case 'Descend':
                this.plane.controls.descend = isPressed;
                break;
            case 'RotateLeft':
                this.plane.controls.rotateLeft = isPressed;
                break;
            case 'RotateRight':
                this.plane.controls.rotateRight = isPressed;
                break;
        }
    }

    /**
     * Main update loop - replaces Plane.update()
     */
    update(deltaMultiplier) {
        if (this.plane.inventory) {
            this.plane.inventory.update();
        }

        // Handle yaw rotation from Q/E
        const yawInput = (this.plane.controls.rotateLeft ? 1 : 0) - (this.plane.controls.rotateRight ? 1 : 0);
        if (yawInput !== 0) {
            this.yawAngle += yawInput * this.rotationSpeed * deltaMultiplier;
            // Wrap to avoid large numbers
            this.yawAngle = THREE.MathUtils.euclideanModulo(this.yawAngle + Math.PI, Math.PI * 2) - Math.PI;
        }

        const yawDelta = this.yawAngle - this.prevYawAngle;
        if (Math.abs(yawDelta) > 1e-6) {
            const wrappedDelta = THREE.MathUtils.euclideanModulo(yawDelta + Math.PI, Math.PI * 2) - Math.PI;
            if (Math.abs(wrappedDelta) > 1e-6) {
                const cosDelta = Math.cos(wrappedDelta);
                const sinDelta = Math.sin(wrappedDelta);
                const vx = this.velocity.x;
                const vz = this.velocity.z;
                this.velocity.x = vx * cosDelta - vz * sinDelta;
                this.velocity.z = vx * sinDelta + vz * cosDelta;
            }
            this.prevYawAngle = this.yawAngle;
        }

        const accelerationScale = this.acceleration * deltaMultiplier;
        const verticalInput = (this.plane.controls.throttle ? 1 : 0) - (this.plane.controls.descend ? 1 : 0);
        const forwardIntent = (this.plane.controls.pitchUp ? 1 : 0) - (this.plane.controls.pitchDown ? 1 : 0);
        const strafeIntent = (this.plane.controls.turnRight ? 1 : 0) - (this.plane.controls.turnLeft ? 1 : 0);
        const axisAccelerating = { x: false, y: false, z: false };

        // Calculate horizontal acceleration using facing direction (projected onto the ground plane)
        this.localInput.set(0, 0, 0);
        if (forwardIntent !== 0 || strafeIntent !== 0) {
            const sinYaw = Math.sin(this.yawAngle);
            const cosYaw = Math.cos(this.yawAngle);

            if (forwardIntent !== 0) {
                this.localInput.x += sinYaw * forwardIntent;
                this.localInput.z += -cosYaw * forwardIntent;
            }

            if (strafeIntent !== 0) {
                this.localInput.x += cosYaw * strafeIntent;
                this.localInput.z += sinYaw * strafeIntent;
            }

            const horizontalLengthSq = this.localInput.x * this.localInput.x + this.localInput.z * this.localInput.z;
            if (horizontalLengthSq > 0) {
                const invLength = 1 / Math.sqrt(horizontalLengthSq);
                this.localInput.x *= invLength;
                this.localInput.z *= invLength;

                this.velocity.x += this.localInput.x * accelerationScale;
                this.velocity.z += this.localInput.z * accelerationScale;
                axisAccelerating.x = Math.abs(this.localInput.x) > 1e-6;
                axisAccelerating.z = Math.abs(this.localInput.z) > 1e-6;
            }
        }

        if (verticalInput !== 0) {
            const clampedVertical = THREE.MathUtils.clamp(verticalInput, -1, 1);
            this.velocity.y += clampedVertical * accelerationScale;
            axisAccelerating.y = true;
        }

        // Apply axis-specific deceleration when there is no acceleration on that axis
        this.applyAxisDeceleration(axisAccelerating, accelerationScale * 0.5);

        // Clamp horizontal and vertical speeds independently
        const horizontalSpeedSq = this.velocity.x * this.velocity.x + this.velocity.z * this.velocity.z;
        const maxHorizontalSpeedSq = this.maxSpeed * this.maxSpeed;
        if (horizontalSpeedSq > maxHorizontalSpeedSq) {
            const scale = this.maxSpeed / Math.sqrt(horizontalSpeedSq);
            this.velocity.x *= scale;
            this.velocity.z *= scale;
        }
        this.velocity.y = THREE.MathUtils.clamp(this.velocity.y, -this.maxVerticalSpeed, this.maxVerticalSpeed);

        // Apply velocity to position
        this.tempVec.copy(this.velocity).multiplyScalar(deltaMultiplier);
        this.plane.position.add(this.tempVec);

        // Enforce minimum altitude
        if (this.plane.position.y < this.plane.minAltitude) {
            this.plane.position.y = this.plane.minAltitude;
            this.velocity.y = Math.max(0, this.velocity.y); // Stop downward velocity
        }

        // Update plane's speed property for compatibility with existing systems
        this.plane.speed = this.velocity.length();

        // Update orientation (yaw only for now)
        this.plane.yaw = this.yawAngle;
        this.plane.pitch = 0;
        this.plane.roll = 0;
        this.plane.updateOrientation();

        // Update move direction for bullet firing compatibility
        this.forwardDir.set(0, 0, -1).applyAxisAngle(this.upDir, this.yawAngle);
        this.plane.moveDirection.copy(this.forwardDir);
    }

    applyAxisDeceleration(axisAccelerating, decelAmount) {
        if (!axisAccelerating || decelAmount <= 0) {
            return;
        }

        for (const axis of ['x', 'y', 'z']) {
            if (axisAccelerating[axis]) {
                continue;
            }

            const value = this.velocity[axis];
            if (Math.abs(value) < 1e-6) {
                this.velocity[axis] = 0;
                continue;
            }

            const delta = Math.min(Math.abs(value), decelAmount);
            this.velocity[axis] -= Math.sign(value) * delta;
        }
    }

    /**
     * Reset controls - same interface as original
     */
    resetControls() {
        if (!this.plane.controls) return;
        this.plane.controls.throttle = false;
        this.plane.controls.descend = false;
        this.plane.controls.pitchUp = false;
        this.plane.controls.pitchDown = false;
        this.plane.controls.turnLeft = false;
        this.plane.controls.turnRight = false;
        this.plane.controls.rotateLeft = false;
        this.plane.controls.rotateRight = false;
    }
}

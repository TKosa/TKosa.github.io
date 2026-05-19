import * as THREE from 'three';

export class BasicEnemyBehavior {
    constructor(enemy, options = {}) {
        this.enemy = enemy;
        this.speed = options.speed ?? enemy.movementSpeed ?? 12;
        this.patrolRadius = options.patrolRadius ?? 650;
        this.approachRadius = options.approachRadius ?? this.patrolRadius * 0.35;
        this.turnSpeed = options.turnSpeed ?? 1.0;
        this.center = options.center ?? new THREE.Vector3(0, enemy.flightAltitude, 0);
        this.cityBoundary = options.cityBoundary ?? 600;
        this.heading = new THREE.Vector3();
        this.temp = new THREE.Vector3();
        this.state = 'approach';
        if (options.initialHeading) {
            this.heading.copy(options.initialHeading);
        } else {
            this.setHeadingToCenter();
        }
    }

    onAttach() {
        this.setHeadingToCenter();
    }

    setHeadingToCenter() {
        const position = this.enemy.position;
        this.heading.subVectors(this.center, position);
        this.heading.y = 0;
        if (this.heading.lengthSq() === 0) {
            this.heading.set(0, 0, -1);
        }
        this.heading.y = 0;
        this.heading.normalize();
    }

    update(delta) {
        const position = this.enemy.position;

        // Check if outside city boundaries
        if (Math.abs(position.x) > this.cityBoundary || Math.abs(position.z) > this.cityBoundary) {
            this.state = 'turn';
        }

        const horizontal = this.temp.set(
            position.x - this.center.x,
            0,
            position.z - this.center.z
        );
        const distance = horizontal.length();

        if (this.state === 'approach' && distance <= this.approachRadius) {
            this.state = 'outbound';
        } else if (this.state === 'outbound' && distance >= this.patrolRadius) {
            this.state = 'turn';
        }

        const centerDirection = this.temp.set(
            this.center.x - position.x,
            0,
            this.center.z - position.z
        );
        if (centerDirection.lengthSq() > 0) {
            centerDirection.normalize();
        }

        if (this.state === 'approach') {
            this.heading.lerp(centerDirection, Math.min(1, this.turnSpeed * delta));
        } else if (this.state === 'turn') {
            this.heading.lerp(centerDirection, Math.min(1, this.turnSpeed * delta));
            if (this.heading.angleTo(centerDirection) < 0.05) {
                this.state = 'approach';
            }
        }

        this.heading.normalize();
        position.addScaledVector(this.heading, this.speed * delta);
        position.y = this.enemy.flightAltitude;
    }

    dispose() { }
}

export class ChasePlayerBehavior {
    constructor(enemy, options = {}) {
        this.enemy = enemy;
        this.speed = options.speed ?? enemy.movementSpeed ?? 12;
        this.turnSpeed = options.turnSpeed ?? 1.0;
        this.heading = new THREE.Vector3();
        this.temp = new THREE.Vector3();
    }

    onAttach() { }

    update(delta, { playerPosition }) {
        if (!playerPosition) return;

        const position = this.enemy.position;
        const directionToPlayer = this.temp.subVectors(playerPosition, position).normalize();

        this.heading.lerp(directionToPlayer, Math.min(1, this.turnSpeed * delta));
        this.heading.normalize();

        position.addScaledVector(this.heading, this.speed * delta);
        position.y = this.enemy.flightAltitude;
    }

    dispose() { }
}

export class GoToCenterBehavior {
    constructor(enemy, options = {}) {
        this.enemy = enemy;
        this.speed = options.speed ?? enemy.movementSpeed ?? 12;
        this.turnSpeed = options.turnSpeed ?? 1.0;
        this.center = options.center ?? new THREE.Vector3(0, enemy.flightAltitude, 0);
        this.heading = new THREE.Vector3();
        this.temp = new THREE.Vector3();
        this.state = 'approaching';
    }

    onAttach() {
        const position = this.enemy.position;
        this.heading.subVectors(this.center, position);
        if (this.heading.lengthSq() === 0) {
            this.heading.set(0, 0, -1);
        }
        this.heading.normalize();
    }

    update(delta) {
        if (this.state === 'stopped') {
            return;
        }

        const position = this.enemy.position;
        const distanceToCenterSq = position.distanceToSquared(this.center);

        if (distanceToCenterSq <= 1) {
            this.state = 'stopped';
            return;
        }

        const directionToCenter = this.temp.subVectors(this.center, position).normalize();
        this.heading.lerp(directionToCenter, Math.min(1, this.turnSpeed * delta));
        this.heading.normalize();

        position.addScaledVector(this.heading, this.speed * delta);
        position.y = this.enemy.flightAltitude;
    }

    dispose() { }
}
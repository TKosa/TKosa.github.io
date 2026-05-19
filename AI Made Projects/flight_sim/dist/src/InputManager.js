import * as THREE from 'three';
import { eventBus } from './eventBus.js';
import { Turret } from './items/Turret.js';

export class InputManager {
    constructor(game) {
        this.game = game;

        this.keyBindings = {
            ArrowLeft: 'Left',
            ArrowRight: 'Right',
            ArrowUp: 'Up',
            ArrowDown: 'Down',
            KeyA: 'Left',
            KeyD: 'Right',
            KeyW: 'Up',
            KeyS: 'Down',
            Space: 'Throttle',
            ShiftLeft: 'Descend',
            ShiftRight: 'Descend',
            Shift: 'Descend',
            KeyQ: 'RotateLeft',
            KeyE: 'RotateRight'
        };

        this.raycaster = new THREE.Raycaster();
        this.pointerVector = new THREE.Vector2();

        this.isFiring = false;
        this.fireCooldown = 0.2; // 200ms for 5 shots per second (reduced by factor of 4 from 20)
        this.lastFireTime = 0;

        // Bind event handlers
        this.#onKeyDown = (event) => this.#handleKey(event, true);
        this.#onKeyUp = (event) => this.#handleKey(event, false);
        this.#onPointerDown = (event) => this.#handlePointerDown(event);
        this.#onPointerUp = (event) => this.#handlePointerUp(event);
        this.#onPointerMove = (event) => this.#handlePointerMove(event);
        this.#onContextMenu = (event) => {
            event.preventDefault();
            event.stopPropagation();
        };
    }

    attachEventListeners() {
        document.addEventListener('keydown', this.#onKeyDown);
        document.addEventListener('keyup', this.#onKeyUp);
        document.addEventListener('contextmenu', this.#onContextMenu);
        this.game.renderer.domElement.addEventListener('pointerdown', this.#onPointerDown);
        this.game.renderer.domElement.addEventListener('pointerup', this.#onPointerUp);
        this.game.renderer.domElement.addEventListener('pointermove', this.#onPointerMove);
    }

    detachEventListeners() {
        document.removeEventListener('keydown', this.#onKeyDown);
        document.removeEventListener('keyup', this.#onKeyUp);
        document.removeEventListener('contextmenu', this.#onContextMenu);

        if (this.game.renderer && this.game.renderer.domElement) {
            this.game.renderer.domElement.removeEventListener('pointerdown', this.#onPointerDown);
            this.game.renderer.domElement.removeEventListener('pointerup', this.#onPointerUp);
            this.game.renderer.domElement.removeEventListener('pointermove', this.#onPointerMove);
        }
    }

    pickEnemyRaycastTarget() {
        if (!this.game.worldRenderer || typeof this.game.worldRenderer.getEnemyMeshes !== 'function') {
            return null;
        }

        const enemyMeshes = this.game.worldRenderer.getEnemyMeshes();
        if (!Array.isArray(enemyMeshes) || enemyMeshes.length === 0) {
            return null;
        }

        const intersections = this.raycaster.intersectObjects(enemyMeshes);
        if (intersections.length === 0) {
            return null;
        }

        const { object, instanceId } = intersections[0];
        if (typeof instanceId !== 'number' || typeof this.game.worldRenderer.getEnemyFromMesh !== 'function') {
            return null;
        }

        return this.game.worldRenderer.getEnemyFromMesh(object, instanceId) || null;
    }

    pickBuildingRaycastTarget() {
        const meshes = this.game.buildingManager?.buildingInstancedMeshes || [];
        if (!meshes.length) {
            return null;
        }

        const intersections = this.raycaster.intersectObjects(meshes);
        if (intersections.length === 0) {
            return null;
        }

        const { object, instanceId } = intersections[0];
        return this.#resolveBuildingCollider(object, instanceId);
    }

    #handleKey(event, isPressed) {
        const code = event.code;

        if (code === 'Escape' && isPressed) {
            event.preventDefault();
            if (this.game.isPaused) {
                eventBus.emit('resume');
            } else {
                eventBus.emit('pause');
                eventBus.emit('showPauseMenu');
            }
            return;
        }

        const blockInput = this.game.isPaused && isPressed;

        if (code.startsWith('Digit')) {
            if (blockInput) {
                return;
            }
            if (isPressed) {
                const digit = parseInt(code.slice(5), 10);
                const itemIndex = (digit === 0) ? 9 : digit - 1;
                this.game.plane.inventory.useItem(itemIndex);
            }
            return;
        }

        if (code === 'Tab' && isPressed) {
            if (blockInput) {
                return;
            }
            event.preventDefault();
            eventBus.emit('toggleStatsOverlay');
            return;
        }

        let action = this.keyBindings[code];
        if (!action) {
            const fallbackCode = this.#normalizeKeyForBinding(event.key);
            if (fallbackCode) {
                action = this.keyBindings[fallbackCode];
            }
        }

        if (!action) {
            return;
        }

        if (blockInput) {
            return;
        }

        event.preventDefault();

        if (!this.game.plane) {
            return;
        }

        this.game.plane.input(action, isPressed);
    }

    update(delta) {
        this.lastFireTime += delta;

        if (this.isFiring && this.lastFireTime >= this.fireCooldown) {
            this.lastFireTime = 0;

            this.raycaster.setFromCamera(this.pointerVector, this.game.camera);
            const direction = this.raycaster.ray.direction.clone().normalize();
            if (direction.lengthSq() > 0) {
                this.#spawnPlayerBullet(direction);
            }
        }
    }

    #handlePointerMove(event) {
        if (!this.game.renderer) {
            return;
        }
        const rect = this.game.renderer.domElement.getBoundingClientRect();
        const ndcX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        const ndcY = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this.pointerVector.set(ndcX, ndcY);
    }

    #handlePointerUp(event) {
        if (event.button === 0) { // Primary button
            this.isFiring = false;
        }
    }

    #handlePointerDown(event) {
        if (!this.game.renderer || event.target !== this.game.renderer.domElement) {
            return;
        }

        const isPrimary = event.button === 0;
        const isSpecial = event.button === 2;
        if (!isPrimary && !isSpecial) {
            return;
        }

        if (isPrimary) {
            this.isFiring = true;
        }

        if (isSpecial) {
            event.preventDefault();
            this.raycaster.setFromCamera(this.pointerVector, this.game.camera);
            const handledSpecial = this.#inspectSpecialPointerTarget();
            if (handledSpecial) {
                return;
            }

            const direction = this.raycaster.ray.direction.clone().normalize();
            if (direction.lengthSq() > 0 && this.game.plane) {
                this.game.plane.fire(direction, this.game.playerBulletDamage, 2.0);
            }
        }
    }

    #inspectSpecialPointerTarget() {
        const intersects = this.raycaster.intersectObjects(this.game.scene.children, true);
        if (Turret.turretPool) {
            for (const hit of intersects) {
                const turret = Turret.turretPool.getTurretFromMesh(hit.object);
                if (turret) {
                    console.log('Clicked Turret:', turret);
                    return true;
                }
            }
        }

        const enemy = this.pickEnemyRaycastTarget();
        if (enemy) {
            console.log('Right-click Enemy:', enemy);
            return false;
        }

        const building = this.pickBuildingRaycastTarget();
        if (building) {
            console.log('Right-click Building:', building);
            if (this.game.buildingUpgradeMenu) {
                this.game.buildingUpgradeMenu.open(building);
                return true;
            }
        }

        return false;
    }

    #spawnPlayerBullet(direction) {
        if (this.game.plane) {
            this.game.plane.fire(direction, this.game.playerBulletDamage);
        }
    }

    #normalizeKeyForBinding(key) {
        if (typeof key !== 'string' || key.length === 0) {
            return null;
        }

        if (key === ' ') {
            return 'Space';
        }

        if (key === 'Shift') {
            return 'Shift';
        }

        if (key.length === 1) {
            if (/[a-z]/i.test(key)) {
                return `Key${key.toUpperCase()}`;
            }
            if (/[0-9]/.test(key)) {
                return `Digit${key}`;
            }
        }

        return key;
    }

    #resolveBuildingCollider(instancedMesh, instanceId) {
        const colliders = this.game.buildingManager?.buildingColliders || [];
        if (!colliders.length) {
            return null;
        }

        return colliders.find((collider) => collider.instancedMesh === instancedMesh && collider.instanceId === instanceId) || null;
    }

    #onKeyDown;
    #onKeyUp;
    #onPointerDown;
    #onPointerUp;
    #onPointerMove;
    #onContextMenu;
}

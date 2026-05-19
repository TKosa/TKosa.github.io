import * as THREE from 'three';

const STYLE_ID = 'hover-health-style';
const DISPLAY_CLASS = 'hover-health-display';

function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
        return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        .${DISPLAY_CLASS} {
            position: absolute;
            display: none;
            padding: 4px 8px;
            background-color: rgba(0, 0, 0, 0.7);
            color: #fff;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.9em;
            pointer-events: none;
            z-index: 150;
        }
    `;
    document.head.appendChild(style);
}

/**
 * Lightweight HUD helper that raycasts under the mouse to display HP values.
 *
 * External dependencies:
 *  - THREE.Camera: projects rays for cursor picking.
 *  - THREE.WebGLRenderer: provides the canvas and coordinates.
 *  - BuildingManager: supplies instanced meshes/colliders for selection.
 *  - Enemies provider: callback returning an array of objects exposing
 *    { mesh, health, maxHealth, isDestroyed }.
 */
export class HoverHealthDisplay {
    /**
     * @param {Object} options
     * @param {THREE.WebGLRenderer} options.renderer
     * @param {THREE.Camera} options.camera
     * @param {Object} options.buildingManager
     * @param {() => Array} options.enemiesProvider
     * @param {HTMLElement} [options.parent=document.body]
     */
    constructor({ renderer, camera, buildingManager, enemiesProvider, worldRenderer, parent = document.body }) {
        this.renderer = renderer;
        this.camera = camera;
        this.buildingManager = buildingManager;
        this.enemiesProvider = enemiesProvider;
        this.worldRenderer = worldRenderer;
        this.parent = parent;

        this.pointer = new THREE.Vector2();
        this.raycaster = new THREE.Raycaster();
        this.mouseScreenPosition = { x: 0, y: 0 };
        this.hoveredEnemy = null;
        this.hoveredBuilding = null;
        this.element = null;
        this.visible = false;
        this.boundMouseMove = (event) => this.handleMouseMove(event);

        ensureStyles();
        this.createElement();
        this.attach();
    }

    createElement() {
        if (this.element) {
            return;
        }

        this.element = document.createElement('div');
        this.element.className = DISPLAY_CLASS;
        this.element.style.display = 'none';
        this.parent.appendChild(this.element);
    }

    attach() {
        if (!this.renderer || !this.renderer.domElement) {
            return;
        }
        this.renderer.domElement.addEventListener('mousemove', this.boundMouseMove);
    }

    detach() {
        if (!this.renderer || !this.renderer.domElement) {
            return;
        }
        this.renderer.domElement.removeEventListener('mousemove', this.boundMouseMove);
    }

    handleMouseMove(event) {
        if (!this.renderer || event.target !== this.renderer.domElement) {
            return;
        }

        const rect = this.renderer.domElement.getBoundingClientRect();
        this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        this.mouseScreenPosition.x = event.clientX;
        this.mouseScreenPosition.y = event.clientY;

        this.raycaster.setFromCamera(this.pointer, this.camera);
        this.updateHoveredTargets();
    }

    updateHoveredTargets() {
        const enemies = typeof this.enemiesProvider === 'function' ? (this.enemiesProvider() || []) : [];
        const enemyMeshes = this.worldRenderer ? this.worldRenderer.getEnemyMeshes() : [];
        const enemyIntersects = enemyMeshes.length > 0 ? this.raycaster.intersectObjects(enemyMeshes) : [];

        if (enemyIntersects.length > 0) {
            const { object: mesh, instanceId } = enemyIntersects[0];
            this.hoveredEnemy = this.worldRenderer ? this.worldRenderer.getEnemyFromMesh(mesh, instanceId) : null;
            this.hoveredBuilding = null;
            return;
        }

        this.hoveredEnemy = null;
        const buildingMeshes = this.buildingManager?.buildingInstancedMeshes || [];
        if (!buildingMeshes.length) {
            this.hoveredBuilding = null;
            return;
        }

        const buildingIntersects = this.raycaster.intersectObjects(buildingMeshes);
        if (buildingIntersects.length === 0) {
            this.hoveredBuilding = null;
            return;
        }

        const { object: instancedMesh, instanceId } = buildingIntersects[0];
        this.hoveredBuilding = this.findCollider(instancedMesh, instanceId);
    }

    findCollider(instancedMesh, instanceId) {
        const colliders = this.buildingManager?.buildingColliders || [];
        return colliders.find((collider) => collider.instancedMesh === instancedMesh && collider.instanceId === instanceId) || null;
    }

    update() {
        if (!this.element) {
            return;
        }

        let target = null;
        if (this.hoveredEnemy && !this.hoveredEnemy.isDestroyed) {
            target = this.hoveredEnemy;
        } else if (this.hoveredBuilding && !this.hoveredBuilding.destroyed) {
            target = this.hoveredBuilding;
        }

        if (!target) {
            if (this.visible) {
                this.element.style.display = 'none';
                this.visible = false;
            }
            return;
        }

        if (!this.visible) {
            this.element.style.display = 'block';
            this.visible = true;
        }

        const x = this.mouseScreenPosition.x || 0;
        const y = this.mouseScreenPosition.y || 0;
        const maxHealth = Number.isFinite(target.maxHealth) ? target.maxHealth : target.health;
        this.element.style.transform = `translate(${x}px, ${Math.max(0, y - 30)}px)`;
        this.element.textContent = `HP: ${Math.round(target.health)} / ${Math.round(maxHealth)}`;
    }

    destroy() {
        this.detach();
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
        this.hoveredEnemy = null;
        this.hoveredBuilding = null;
    }
}

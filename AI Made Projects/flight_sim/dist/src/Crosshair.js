import * as THREE from 'three';

const STYLE_ID = 'flight-crosshair-style';
const CROSSHAIR_CLASS = 'flight-crosshair';

function ensureStyles() {
    if (document.getElementById(STYLE_ID)) {
        return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
        .${CROSSHAIR_CLASS} {
            position: absolute;
            width: 20px;
            height: 20px;
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 0 5px black;
            pointer-events: none;
            z-index: 150;
            will-change: transform;
        }
    `;
    document.head.appendChild(style);
}

/**
 * @typedef {Object} CrosshairPlane
 * @property {THREE.Vector3} moveDirection  Normalized direction derived from yaw/pitch.
 * @property {number} pitch                 Plane pitch in radians.
 * @property {number} yaw                   Plane yaw in radians.
 */

/**
 * Crosshair overlay that updates itself based on the player's plane orientation.
 *
 * External dependencies:
 *  - THREE.Camera: Used to project the forward vector to screen space.
 *  - THREE.WebGLRenderer: Supplies the viewport dimensions.
 *  - Plane-like object with `moveDirection`, `pitch`, and `yaw` fields exposed.
 */
export class Crosshair {
    /**
     * @param {Object} options
     * @param {THREE.Camera} options.camera
     * @param {THREE.WebGLRenderer} options.renderer
     * @param {HTMLElement} [options.parent=document.body]
     * @param {() => (CrosshairPlane | null)} [options.planeProvider]
     */
    constructor({ camera, renderer, parent = document.body, planeProvider }) {
        this.camera = camera;
        this.renderer = renderer;
        this.parent = parent;
        this.planeProvider = planeProvider;
        this.element = null;
        this.direction = new THREE.Vector3();
        this.targetPosition = new THREE.Vector3();
        this.projectedTarget = new THREE.Vector3();
        this.visible = false;
        this.screenPosition = { x: null, y: null };
        this.lerpFactor = 0.18;

        // Cache dimensions to avoid layout thrashing
        this.cachedWidth = 0;
        this.cachedHeight = 0;

        ensureStyles();
        this.createElement();
        this.updateDimensionCache();

        // Use ResizeObserver to automatically detect when the renderer element changes size
        // This avoids race conditions where window resize fires before renderer resize
        this.resizeObserver = new ResizeObserver(() => this.updateDimensionCache());
        if (this.renderer && this.renderer.domElement) {
            this.resizeObserver.observe(this.renderer.domElement);
        }
    }

    createElement() {
        if (this.element) {
            return;
        }

        this.element = document.createElement('div');
        this.element.className = CROSSHAIR_CLASS;
        this.element.style.display = 'none';
        this.parent.appendChild(this.element);
    }

    updateDimensionCache() {
        if (this.renderer && this.renderer.domElement) {
            this.cachedWidth = this.renderer.domElement.clientWidth;
            this.cachedHeight = this.renderer.domElement.clientHeight;
        }
    }

    setPlaneProvider(provider) {
        this.planeProvider = provider;
    }

    resolvePlane(explicitPlane) {
        if (explicitPlane) {
            return explicitPlane;
        }
        if (typeof this.planeProvider === 'function') {
            return this.planeProvider();
        }
        return null;
    }

    update(planeOverride = null) {
        if (!this.element || !this.camera || !this.renderer) {
            return;
        }

        const plane = this.resolvePlane(planeOverride);
        if (!plane || !plane.moveDirection) {
            if (this.visible) {
                this.element.style.display = 'none';
                this.visible = false;
            }
            this.screenPosition.x = null;
            this.screenPosition.y = null;
            return;
        }

        if (!this.visible) {
            this.element.style.display = 'block';
            this.visible = true;
            this.screenPosition.x = null;
            this.screenPosition.y = null;
        }

        this.direction.copy(plane.moveDirection).normalize();
        this.targetPosition.copy(this.camera.position).add(this.direction.multiplyScalar(100));
        this.projectedTarget.copy(this.targetPosition).project(this.camera);

        // Use cached dimensions, but fallback to reading if cache is empty
        // This can happen if resize event hasn't fired yet
        let width = this.cachedWidth;
        let height = this.cachedHeight;

        if (width === 0 || height === 0) {
            // Cache not populated yet, read once and cache it
            this.updateDimensionCache();
            width = this.cachedWidth;
            height = this.cachedHeight;
        }

        const targetX = (this.projectedTarget.x * 0.5 + 0.5) * width;
        const targetY = (-this.projectedTarget.y * 0.5 + 0.5) * height;

        if (this.screenPosition.x === null || this.screenPosition.y === null) {
            this.screenPosition.x = targetX;
            this.screenPosition.y = targetY;
        } else {
            this.screenPosition.x = this.lerp(this.screenPosition.x, targetX, this.lerpFactor);
            this.screenPosition.y = this.lerp(this.screenPosition.y, targetY, this.lerpFactor);
        }

        // Use transform for positioning, including centering offset
        // (subtract 10px to center the 20px circle)
        const offsetX = this.screenPosition.x - 10;
        const offsetY = this.screenPosition.y - 10;
        this.element.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    }

    lerp(start, end, alpha) {
        return start + (end - start) * Math.min(Math.max(alpha, 0), 1);
    }

    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
    }
}

import * as THREE from 'three';
import { Plane } from './plane.js';

import { eventBus } from './eventBus.js';
import { Minimap } from './Minimap.js';
import { ItemRegistry } from './items/ItemRegistry.js';
import { Turret } from './items/Turret.js';
import { LaserTurret } from './items/LaserTurret.js';
import { BulletManager } from './BulletManager.js';
import { TurretManager } from './TurretManager.js';
import { EnemyManager } from './enemies/EnemyManager.js';
import { StarManager } from './StarManager.js';
import { InputManager } from './InputManager.js';
import { PlayerHealthManager } from './PlayerHealthManager.js';
import { ItemDeploymentManager } from './ItemDeploymentManager.js';


import { BuildingManager } from './building.js';
import { Crosshair } from './Crosshair.js';
import { HoverHealthDisplay } from './HoverHealthDisplay.js';
import { WorldRenderer } from './WorldRenderer.js';
import { GameScheduler } from './GameScheduler.js';
import { buildingGrid } from './SpatialGrid.js';
import { PerformanceMonitor } from './PerformanceMonitor.js';
import { BuildingUpgradeMenu } from './ui/BuildingUpgradeMenu.js';

const DEFAULT_GAME_STATE = {
    health: 100,
};

// const tempConeQuaternion = new THREE.Quaternion();
// const coneBaseDirection = new THREE.Vector3(0, -1, 0);
// const tempSpecialConePosition = new THREE.Vector3();

export class Game {
    constructor(gameContainer, itemFactory) {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1800);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        this.gameContainer = gameContainer;
        this.itemFactory = itemFactory;

        this.worldRenderer = new WorldRenderer(this.scene, this.camera);

        // Initialize game scheduler for tick-based timing
        this.scheduler = new GameScheduler();

        this.playerHealthManager = new PlayerHealthManager(
            this.scheduler,
            DEFAULT_GAME_STATE.health,
            () => this.emitPlayerStats()
        );

        // Initialize performance monitor (set enabled: false to disable)
        this.perfMonitor = new PerformanceMonitor({
            enabled: false,
            logThreshold: 16 // Warn if frame takes > 16ms (60fps threshold)
        });

        this.bulletManager = new BulletManager(this);
        this.buildingManager = new BuildingManager(this.scene, this.renderer, this.scheduler);
        this.enemyManager = new EnemyManager(this);

        // Initialize turret manager (handles both turret instances and bullets)
        this.turretManager = new TurretManager(this.scene, this.enemyManager);
        Turret.initialize(this.turretManager);
        LaserTurret.initialize(this.turretManager);
        this.starManager = new StarManager(this);
        this.plane = null;

        this.gameState = {
            starCount: 0,
        };

        this.statsUpdateInterval = 0.25;
        this.statsUpdateAccumulator = 0;

        this.animationHandle = null;

        this.clock = new THREE.Clock();
        this.clockStarted = false;
        this.minimap = new Minimap();
        this.itemFactory.init(this.scene, this.scheduler, this);



        this.playerVelocity = new THREE.Vector3(0, 0, 0);
        this.previousPlayerPosition = new THREE.Vector3();
        this.hasPreviousPlayerPosition = false;

        this.itemDeploymentManager = new ItemDeploymentManager(this);

        this.isPaused = false;
        this.contextLost = false;

        this.boundEvents = {
            addHealth: (amount) => this.addHealth(amount),
            setPlayerBulletDamage: (amount) => this.setPlayerBulletDamage(amount),
            itemRemovedFromBuilding: (item) => this.itemDeploymentManager.handleItemRemovedFromBuilding(item),
            pause: () => this.pauseGame(),
            resume: () => this.resumeGame(),
        };

        // Initialize input manager
        this.inputManager = new InputManager(this);

        this.onResize = () => this.onWindowResize();
        this.onContextLost = (event) => this.handleContextLost(event);
        this.onContextRestored = () => this.handleContextRestored();

        this.crosshair = new Crosshair({
            camera: this.camera,
            renderer: this.renderer,
            parent: this.gameContainer ?? document.body,
            planeProvider: () => this.plane,
        });
        this.hoverHealthDisplay = new HoverHealthDisplay({
            renderer: this.renderer,
            camera: this.camera,
            buildingManager: this.buildingManager,
            enemiesProvider: () => this.enemyManager.getEnemies(),
            worldRenderer: this.worldRenderer,
            worldRenderer: this.worldRenderer,
            parent: this.gameContainer ?? document.body,
        });

        this.buildingUpgradeMenu = new BuildingUpgradeMenu(this);

        this.inputManager.attachEventListeners();
        window.addEventListener('resize', this.onResize);
        this.renderer.domElement.addEventListener('webglcontextlost', this.onContextLost, false);
        this.renderer.domElement.addEventListener('webglcontextrestored', this.onContextRestored, false);

        eventBus.on('addHealth', this.boundEvents.addHealth);
        eventBus.on('setPlayerBulletDamage', this.boundEvents.setPlayerBulletDamage);
        eventBus.on('itemRemovedFromBuilding', this.boundEvents.itemRemovedFromBuilding);
        eventBus.on('pause', this.boundEvents.pause);
        eventBus.on('resume', this.boundEvents.resume);
        eventBus.on('itemUsed', (itemId) => this.itemDeploymentManager.handleItemUsed(itemId));

        this.init();
        this.syncUI();
        this.startRenderLoop();
    }





    pauseGame() {
        if (this.isPaused) {
            return;
        }
        this.isPaused = true;
        this.clock.getDelta();
        this.stopRenderLoop();
        this.renderer.render(this.scene, this.camera);
    }

    resumeGame() {
        if (!this.isPaused) {
            return;
        }
        this.isPaused = false;
        this.clock.getDelta();
        this.startRenderLoop();
    }

    handleContextLost(event) {
        if (event && typeof event.preventDefault === 'function') {
            event.preventDefault();
        }

        if (this.contextLost) {
            return;
        }
        this.contextLost = true;
        this.stopRenderLoop();
    }

    handleContextRestored() {
        if (!this.contextLost) {
            return;
        }
        this.contextLost = false;
        this.clock.getDelta();
        if (!this.isPaused) {
            this.startRenderLoop();
        } else if (this.renderer) {
            this.renderer.render(this.scene, this.camera);
        }
    }

    init() {
        this.scene.fog = new THREE.Fog(0x87CEEB, 100, 1800); // Add fog for depth perception

        this.camera.position.set(0, 10, 20); // Start slightly elevated and back

        const inventoryItemPool = Object.values(ItemRegistry);

        this.plane = new Plane(this, inventoryItemPool, this.itemFactory, this.scheduler);
        this.playerHealthManager.setPlane(this.plane);
        // this.plane.updateOrientation(); // Handled by renderer

        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x87CEEB); // Sky blue background
        this.renderer.shadowMap.enabled = false; // Disable expensive shadow map calculations
        this.gameContainer.appendChild(this.renderer.domElement);

        // --- Lighting ---
        const ambientLight = new THREE.AmbientLight(0xaaaaaa); // Soft ambient light
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
        directionalLight.position.set(50, 100, 75);
        directionalLight.castShadow = false; // Skip shadow calculations for performance
        this.scene.add(directionalLight);

        // --- Ground ---
        const groundSize = 3000;
        const groundGeometry = new THREE.PlaneGeometry(groundSize, groundSize);
        const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x55aa55 }); // Greenish ground
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2; // Rotate to be horizontal
        ground.receiveShadow = false;
        this.scene.add(ground);

        // --- City Boundaries ---
        const spread = 1200; // How far buildings spread out
        this.cityBoundary = spread / 2;
        const boundaryGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-this.cityBoundary, 0, -this.cityBoundary),
            new THREE.Vector3(this.cityBoundary, 0, -this.cityBoundary),
            new THREE.Vector3(this.cityBoundary, 0, this.cityBoundary),
            new THREE.Vector3(-this.cityBoundary, 0, this.cityBoundary),
            new THREE.Vector3(-this.cityBoundary, 0, -this.cityBoundary),
        ]);
        const boundaryMaterial = new THREE.LineBasicMaterial({ color: 0xffffff });
        const boundary = new THREE.Line(boundaryGeometry, boundaryMaterial);
        boundary.position.y = 0.1; // Slightly above the ground
        this.scene.add(boundary);

        // --- Buildings ---
        this.buildingManager.init();

        // Populate static building grid
        this.buildingGrid = buildingGrid;

        for (const building of this.buildingManager.buildingColliders) {
            // Create a wrapper object with a .position property for the grid
            const wrapper = {
                position: new THREE.Vector3(building.cx, building.cy, building.cz),
                collider: building
            };
            this.buildingGrid.add(wrapper);
            building._gridWrapper = wrapper;
        }

        this.starManager.initializeStars();
        this.enemyManager.init();
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    tick(delta) {
        this.perfMonitor.startTiming('Total Frame');

        // Update game scheduler (tick-based timing)
        this.perfMonitor.startTiming('Scheduler');
        this.scheduler.tick(delta);
        this.perfMonitor.endTiming('Scheduler');

        this.perfMonitor.startTiming('Input Manager');
        this.inputManager.update(delta);
        this.perfMonitor.endTiming('Input Manager');

        this.perfMonitor.startTiming('Movement');
        this.updateMovement(delta);
        this.perfMonitor.endTiming('Movement');

        this.perfMonitor.startTiming('Stars');
        this.starManager.update(delta);
        this.perfMonitor.endTiming('Stars');

        this.perfMonitor.startTiming('Enemies Update');
        this.enemyManager.update(delta, this.camera.position, this.playerVelocity);
        this.perfMonitor.endTiming('Enemies Update');

        this.perfMonitor.startTiming('Player Bullets');
        this.bulletManager.updatePlayerBullets(delta);
        this.perfMonitor.endTiming('Player Bullets');

        this.perfMonitor.startTiming('Turret Bullets');
        this.turretManager.update(delta);
        this.perfMonitor.endTiming('Turret Bullets');

        this.perfMonitor.startTiming('Building Collision (Enemy)');
        this.buildingManager.checkEnemyBulletsAgainstBuildings(this.enemyManager.getEnemies());
        this.perfMonitor.endTiming('Building Collision (Enemy)');

        if (this.plane) {
            this.perfMonitor.startTiming('Building Collision (Player)');
            this.buildingManager.checkPlayerBulletsAgainstBuildings(
                this.plane.bullets,
                (bullet) => this.plane.removeBullet(bullet)
            );
            this.perfMonitor.endTiming('Building Collision (Player)');
        }

        this.perfMonitor.startTiming('Item Updates');
        const itemContext = {
            playerPosition: this.camera.position,
            enemies: this.enemyManager.getEnemies(),
            addHealth: (amount) => this.addHealth(amount),
            spawnTurretBullet: (turret, direction) => this.turretManager.spawnBullet(turret, direction),
            plane: this.plane,
            onEnemyDestroyed: (enemy) => this.enemyManager.handleEnemyDestruction(enemy),
        };

        this.itemDeploymentManager.update(delta, itemContext);
        this.perfMonitor.endTiming('Item Updates');

        this.perfMonitor.startTiming('Bullet Collisions');
        this.bulletManager.checkBulletCollisions();
        this.perfMonitor.endTiming('Bullet Collisions');

        this.perfMonitor.startTiming('Collisions');
        this.checkCollisions();
        this.checkRammingCollisions();
        this.perfMonitor.endTiming('Collisions');

        this.perfMonitor.startTiming('Minimap');
        this.minimap.tick(this.plane, this.enemyManager.getEnemies(), this.starManager.getStars(), this.itemDeploymentManager.getDeployedItems());
        this.perfMonitor.endTiming('Minimap');

        if (this.hoverHealthDisplay) {
            this.perfMonitor.startTiming('Hover Health Display');
            this.hoverHealthDisplay.update();
            this.perfMonitor.endTiming('Hover Health Display');
        }

        if (this.crosshair) {
            this.perfMonitor.startTiming('Crosshair');
            this.crosshair.update();
            this.perfMonitor.endTiming('Crosshair');
        }

        // Render the world state
        this.perfMonitor.startTiming('World Renderer');
        const enemies = this.enemyManager.getEnemies();
        this.worldRenderer.render({
            plane: this.plane,
            enemies: enemies,
            bullets: [
                ...this.plane.bullets,
                ...enemies.flatMap(e => e.bullets)
            ],
            items: this.itemDeploymentManager.getDeployedItems()
        });
        this.perfMonitor.endTiming('World Renderer');

        this.perfMonitor.endTiming('Total Frame');
        this.perfMonitor.logStats();
    }

    updateMovement(delta) {
        if (!this.plane) {
            return;
        }

        const clampedDelta = Math.min(delta, 0.2);
        const deltaMultiplier = clampedDelta * 60;
        this.plane.update(deltaMultiplier);

        if (this.plane) {
            if (this.hasPreviousPlayerPosition) {
                if (clampedDelta > 0) {
                    this.playerVelocity.copy(this.camera.position).sub(this.previousPlayerPosition).divideScalar(clampedDelta);
                } else {
                    this.playerVelocity.set(0, 0, 0);
                }
            } else {
                this.playerVelocity.set(0, 0, 0);
                this.hasPreviousPlayerPosition = true;
            }
            this.previousPlayerPosition.copy(this.camera.position);
        } else {
            this.playerVelocity.set(0, 0, 0);
            this.hasPreviousPlayerPosition = false;
        }

        this.statsUpdateAccumulator += clampedDelta;
        if (this.statsUpdateAccumulator >= this.statsUpdateInterval) {
            this.statsUpdateAccumulator = 0;
            this.emitPlayerStats();
        }
    }

    syncUI() {
        eventBus.emit('updateStarDisplay', this.gameState.starCount);
        eventBus.emit('updateHealthDisplay', this.playerHealthManager.getHealth(), this.playerHealthManager.getMaxHealth());
        eventBus.emit('updateBuildingCounter', this.buildingManager.getAliveBuildingsCount(), this.buildingManager.initialBuildingCount);
        this.emitPlayerStats();
        this.emitShieldState();
    }

    applyDamage(amount) {
        return this.playerHealthManager.applyDamage(amount);
    }

    addHealth(amount) {
        this.playerHealthManager.addHealth(amount);
    }

    increaseMaxHealth(amount) {
        this.playerHealthManager.increaseMaxHealth(amount);
    }

    checkCollisions() {
        if (!this.plane) {
            return;
        }

        const planeRadius = this.plane.size;
        const planeRadiusSq = planeRadius * planeRadius;
        const planePosition = this.plane.position;

        // Use spatial grid to check for nearby buildings
        const checkRadius = planeRadius + 100; // Check radius includes max building size
        const nearbyBuildings = this.buildingGrid.checkArea(planePosition, checkRadius);

        for (const wrapper of nearbyBuildings) {
            const collider = wrapper.collider;
            if (collider.destroyed) {
                continue;
            }

            const dx = Math.max(Math.abs(planePosition.x - collider.cx) - collider.hx, 0);
            const dy = Math.max(Math.abs(planePosition.y - collider.cy) - collider.hy, 0);
            const dz = Math.max(Math.abs(planePosition.z - collider.cz) - collider.hz, 0);
            const distanceSq = dx * dx + dy * dy + dz * dz;

            if (distanceSq <= planeRadiusSq) {
                const damaged = this.playerHealthManager.applyDamage(15);
                if (damaged) {
                    this.plane.speed = Math.max(this.plane.minSpeed, this.plane.speed * 0.4);
                }

                planePosition.y = collider.cy + collider.hy + planeRadius;
                this.camera.position.copy(planePosition);
                return;
            }
        }
    }

    checkRammingCollisions() {
        if (!this.plane) return;

        // Check if traveling at > 1.1x max speed
        if (this.plane.speed <= this.plane.maxSpeed * 1.1) {
            return;
        }

        const enemies = this.enemyManager.getEnemies();
        const planePos = this.plane.position;
        // Use a slightly larger radius for ramming to make it feel good
        const ramRadius = this.plane.size + 2;

        for (const enemy of enemies) {
            if (enemy.isDestroyed) continue;

            // Check cooldown
            if (enemy.ramHitCooldown) continue;

            const distSq = planePos.distanceToSquared(enemy.position);
            const combinedRadius = ramRadius + (enemy.hitRadius || 2);

            if (distSq < combinedRadius * combinedRadius) {
                // RAMMING SPEED!
                const damage = 50;
                const destroyed = enemy.takeDamage(damage);

                if (destroyed) {
                    this.enemyManager.handleEnemyDestruction(enemy);
                } else {
                    // Set cooldown flag
                    enemy.ramHitCooldown = true;
                    // Clear it after 1 second
                    this.scheduler.setTimeout(() => {
                        enemy.ramHitCooldown = false;
                    }, 1.0);
                }
            }
        }
    }






    onEnemyDestroyed(enemy) {
        // Placeholder for future hooks (e.g., score tracking). Stars now drop exclusively from pickups.
        eventBus.emit('enemyDestroyed', { enemy });
    }


    setPlayerBulletDamage(amount) {
        if (this.bulletManager.setPlayerBulletDamage(amount)) {
            this.emitPlayerStats();
        }
    }



    emitPlayerStats() {
        const stats = this.getCombinedStats();
        eventBus.emit('playerStats', stats);
        eventBus.emit('updateStatsPanel', stats);
    }

    emitShieldState() {
        this.playerHealthManager.emitShieldState();
    }

    scheduleStatsRefresh() {
        const callback = () => this.emitPlayerStats();
        if (typeof queueMicrotask === 'function') {
            queueMicrotask(callback);
        } else {
            Promise.resolve().then(callback);
        }
    }

    getCombinedStats() {
        if (!this.plane) {
            return {
                // speed: 0,
                // size: 0,
                // rotationSpeed: 0,
                // maxSpeed: 0,
                // acceleration: 0,
                // yawChangeRate: 0,
                // yawChangeRateBase: 0,
                // yawChangeRateMax: 0,
                // maxSpeedFrame: 0,
                // maxSpeedBase: 0,
                // maxSpeedCap: 0,
                // accelerationFrame: 0,
                // accelerationBase: 0,
                // accelerationMax: 0,
                // sizeBase: 0,
                // minSize: 0,
                // starRadius: 0,
                // starRadiusBase: 0,
                // starRadiusMax: 0,
                // health: this.playerHealthManager.getHealth(),
                // maxHealth: this.playerHealthManager.getMaxHealth(),
                // bulletDamage: this.playerBulletDamage,
                // bulletDamageBase: this.playerBulletBaseDamage,
                // bulletDamageMax: this.playerBulletMaxDamage,
                // bulletLifetimeTicks: 0,
                // bulletLifetimeBase: 0,
                // bulletLifetimeMax: 0,
            };
        }

        const planeStats = this.plane.toStats();
        return {
            ...planeStats,
            health: this.playerHealthManager.getHealth(),
            maxHealth: this.playerHealthManager.getMaxHealth(),
            bulletDamage: this.bulletManager.playerBulletDamage,
            bulletDamageBase: this.bulletManager.playerBulletBaseDamage,
            bulletDamageMax: this.bulletManager.playerBulletMaxDamage,
        };
    }






    startRenderLoop() {

        if (this.animationHandle !== null || this.contextLost) return;
        if (!this.clockStarted) {
            this.clock.start();
            this.clockStarted = true;
        }
        this.clock.getDelta();
        this.animationHandle = requestAnimationFrame(() => this.renderLoop());
    }

    stopRenderLoop() {
        if (this.animationHandle === null) return;
        cancelAnimationFrame(this.animationHandle);
        this.animationHandle = null;
    }

    renderLoop() {
        this.perfMonitor.startTiming('=== Full RAF Frame ===');

        this.animationHandle = requestAnimationFrame(() => this.renderLoop());

        const delta = this.clock.getDelta();
        if (!this.isPaused) {
            this.tick(delta);
        }

        this.perfMonitor.startTiming('Three.js Renderer');
        this.renderer.render(this.scene, this.camera);
        this.perfMonitor.endTiming('Three.js Renderer');

        this.perfMonitor.endTiming('=== Full RAF Frame ===');
    }

    dispose() {
        this.inputManager.detachEventListeners();
        window.removeEventListener('resize', this.onResize);

        if (this.renderer && this.renderer.domElement) {
            this.renderer.domElement.removeEventListener('webglcontextlost', this.onContextLost);
            this.renderer.domElement.removeEventListener('webglcontextrestored', this.onContextRestored);
        }

        eventBus.off('addHealth', this.boundEvents.addHealth);
        eventBus.off('setPlayerBulletDamage', this.boundEvents.setPlayerBulletDamage);
        eventBus.off('requestInventoryItem', this.boundEvents.requestInventoryItem);
        eventBus.off('pause', this.boundEvents.pause);
        eventBus.off('resume', this.boundEvents.resume);

        if (this.plane) {
            this.plane.dispose();
        }

        this.stopRenderLoop();

        if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
            this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }

        if (this.hoverHealthDisplay) {
            this.hoverHealthDisplay.destroy();
            this.hoverHealthDisplay = null;
        }

        if (this.buildingUpgradeMenu) {
            this.buildingUpgradeMenu.dispose();
            this.buildingUpgradeMenu = null;
        }

        if (this.crosshair) {
            this.crosshair.destroy();
            this.crosshair = null;
        }

        if (this.bulletManager) {
            this.bulletManager.dispose();
        }
    }

    getItemFactory() {
        return this.itemFactory;
    }
}














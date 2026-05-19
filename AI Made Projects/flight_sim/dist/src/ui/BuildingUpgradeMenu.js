import { eventBus } from '../eventBus.js';

const STYLE_ID = 'building-upgrade-menu-style';
const MENU_CLASS = 'building-upgrade-menu';

export class BuildingUpgradeMenu {
    constructor(game) {
        this.game = game;
        this.element = null;
        this.activeBuilding = null;
        this.isVisible = false;

        this.costs = {
            health: 5,
            defense: 5,
            turretDamage: 10
        };

        this.createStyles();
        this.createElement();

        // Close on Escape key
        this.onKeyDown = (e) => {
            if (e.code === 'Escape' && this.isVisible) {
                this.close();
            }
        };
        document.addEventListener('keydown', this.onKeyDown);
    }

    createStyles() {
        if (document.getElementById(STYLE_ID)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            .${MENU_CLASS} {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background-color: rgba(20, 20, 30, 0.95);
                color: #fff;
                padding: 20px;
                border-radius: 8px;
                border: 1px solid #444;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                min-width: 300px;
                z-index: 1000;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                display: none;
            }
            .${MENU_CLASS} h2 {
                margin: 0 0 15px 0;
                font-size: 1.2em;
                color: #87CEEB;
                text-align: center;
                border-bottom: 1px solid #444;
                padding-bottom: 10px;
            }
            .${MENU_CLASS} .stat-row {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
                padding: 5px 0;
            }
            .${MENU_CLASS} .stat-label {
                color: #aaa;
            }
            .${MENU_CLASS} .stat-value {
                font-weight: bold;
                color: #fff;
            }
            .${MENU_CLASS} .upgrade-btn {
                background: #2c3e50;
                border: 1px solid #34495e;
                color: #fff;
                padding: 5px 10px;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s;
                font-size: 0.9em;
                margin-left: 10px;
            }
            .${MENU_CLASS} .upgrade-btn:hover:not(:disabled) {
                background: #34495e;
                border-color: #87CEEB;
            }
            .${MENU_CLASS} .upgrade-btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                background: #1a1a1a;
            }
            .${MENU_CLASS} .close-btn {
                position: absolute;
                top: 10px;
                right: 10px;
                background: none;
                border: none;
                color: #aaa;
                font-size: 1.2em;
                cursor: pointer;
            }
            .${MENU_CLASS} .close-btn:hover {
                color: #fff;
            }
            .${MENU_CLASS} .stars-display {
                text-align: center;
                margin-bottom: 15px;
                color: #ffd700;
                font-weight: bold;
            }
        `;
        document.head.appendChild(style);
    }

    createElement() {
        this.element = document.createElement('div');
        this.element.className = MENU_CLASS;
        this.element.innerHTML = `
            <button class="close-btn">&times;</button>
            <h2>Building Upgrade</h2>
            <div class="stars-display">Stars: 0</div>
            <div class="content"></div>
        `;

        this.element.querySelector('.close-btn').addEventListener('click', () => this.close());
        this.element.addEventListener('contextmenu', (e) => e.preventDefault());
        document.body.appendChild(this.element);
    }

    open(building) {
        if (!building || building.destroyed) return;

        this.activeBuilding = building;
        this.isVisible = true;
        this.element.style.display = 'block';
        this.render();

        // Pause game input if needed, or just handle it via isPaused check in InputManager
        // For now, we rely on the menu being modal-like visually
    }

    close() {
        this.isVisible = false;
        this.element.style.display = 'none';
        this.activeBuilding = null;
    }

    render() {
        if (!this.activeBuilding || !this.isVisible) return;

        const building = this.activeBuilding;
        const stars = this.game.gameState.starCount;
        const content = this.element.querySelector('.content');
        const starsDisplay = this.element.querySelector('.stars-display');

        starsDisplay.textContent = `Stars: ${stars}`;

        // Ensure defense property exists
        if (typeof building.defense === 'undefined') {
            building.defense = 0;
        }

        const hasTurret = building.item && (building.item.constructor.name.includes('Turret') || building.item.constructor.name.includes('Laser'));
        let turretDamage = 0;
        if (hasTurret) {
            turretDamage = building.item.bulletDamage || building.item.damagePerSecond || 0;
            // Format to 1 decimal if it's a float (like damagePerSecond might be)
            if (!Number.isInteger(turretDamage)) {
                turretDamage = turretDamage.toFixed(1);
            }
        }

        content.innerHTML = `
            <div class="stat-row">
                <span class="stat-label">Health</span>
                <div>
                    <span class="stat-value">${Math.round(building.health)}/${Math.round(building.maxHealth)}</span>
                    <button class="upgrade-btn" id="btn-upgrade-health" 
                        ${stars < this.costs.health ? 'disabled' : ''}>
                        +50 HP (${this.costs.health}★)
                    </button>
                </div>
            </div>
            <div class="stat-row">
                <span class="stat-label">Defense</span>
                <div>
                    <span class="stat-value">${building.defense}</span>
                    <button class="upgrade-btn" id="btn-upgrade-defense"
                        ${stars < this.costs.defense ? 'disabled' : ''}>
                        +1 Def (${this.costs.defense}★)
                    </button>
                </div>
            </div>
            <div class="stat-row">
                <span class="stat-label">Turret Dmg</span>
                <div>
                    <span class="stat-value">${hasTurret ? turretDamage : '-'}</span>
                    <button class="upgrade-btn" id="btn-upgrade-turret"
                        ${!hasTurret || stars < this.costs.turretDamage ? 'disabled' : ''}>
                        +1 Dmg (${this.costs.turretDamage}★)
                    </button>
                </div>
            </div>
        `;

        // Bind events
        content.querySelector('#btn-upgrade-health').onclick = () => this.upgradeHealth();
        content.querySelector('#btn-upgrade-defense').onclick = () => this.upgradeDefense();
        content.querySelector('#btn-upgrade-turret').onclick = () => this.upgradeTurret();
    }

    upgradeHealth() {
        if (this.game.gameState.starCount >= this.costs.health) {
            this.game.gameState.starCount -= this.costs.health;
            this.activeBuilding.maxHealth += 50;
            this.activeBuilding.health += 50;
            eventBus.emit('updateStarDisplay', this.game.gameState.starCount);
            this.render();
        }
    }

    upgradeDefense() {
        if (this.game.gameState.starCount >= this.costs.defense) {
            this.game.gameState.starCount -= this.costs.defense;
            this.activeBuilding.defense += 1;
            eventBus.emit('updateStarDisplay', this.game.gameState.starCount);
            this.render();
        }
    }

    upgradeTurret() {
        if (this.game.gameState.starCount >= this.costs.turretDamage) {
            const turret = this.activeBuilding.item;
            if (turret) {
                let upgraded = false;
                if (typeof turret.bulletDamage === 'number') {
                    turret.bulletDamage += 1;
                    upgraded = true;
                } else if (typeof turret.damagePerSecond === 'number') {
                    turret.damagePerSecond += 1;
                    upgraded = true;
                }

                if (upgraded) {
                    this.game.gameState.starCount -= this.costs.turretDamage;
                    eventBus.emit('updateStarDisplay', this.game.gameState.starCount);
                    this.render();
                }
            }
        }
    }

    dispose() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        if (this.onKeyDown) {
            document.removeEventListener('keydown', this.onKeyDown);
        }
    }
}

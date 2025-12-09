import { eventBus } from './eventBus.js';
import { RECIPES } from './crafting.js';
import { OverlayHost } from './ui/OverlayHost.js';
import { RecipeListView } from './ui/RecipeListView.js';
import { CraftingMenuView } from './ui/CraftingMenuView.js';

export class PauseMenu {
    constructor() {
        this.host = new OverlayHost('pause-menu-root', import.meta.url, {
            stylesheets: ['../css/item-slots.css', '../css/pause-menu.css']
        });
        this.overlay = null;
        this.resumeBtn = null;
        this.craftingBtn = null;
        this.recipesBtn = null;

        this.recipesOverlay = null;
        this.recipesList = null;
        this.recipesBackBtn = null;

        this.craftingOverlay = null;
        this.craftingViewRoot = null;
        this.craftingBackBtn = null;

        this.recipeListView = null;
        this.craftingMenuView = null;

        this.loadingPromise = this.initialize();

        this.boundEvents = {
            showPauseMenu: () => this.handleShowRequest(),
            resumeGame: () => this.hide(),
        };

        eventBus.on('showPauseMenu', this.boundEvents.showPauseMenu);
        eventBus.on('resume', this.boundEvents.resumeGame);
        eventBus.on('inventoryUpdated', (items) => {
            this.latestInventory = items;
        });
    }

    async initialize() {
        this.host.ensureStylesheets();
        await this.host.injectTemplate('../pause-menu.html', this.getFallbackMarkup());
        this.cacheElements();

        this.recipeListView = new RecipeListView(this.recipesList, RECIPES);
        this.recipeListView.render();

        this.craftingMenuView = new CraftingMenuView(this.craftingViewRoot);

        this.bindUiActions();
        this.hide();
    }

    // ... (existing code) ...

    showCrafting() {
        if (this.craftingMenuView) {
            this.craftingMenuView.render(this.latestInventory);
        }
        this.showOverlay(this.craftingOverlay);
    }

    cacheElements() {
        this.overlay = document.getElementById('pause-overlay');
        this.resumeBtn = document.getElementById('resume-btn');
        this.craftingBtn = document.getElementById('crafting-btn');
        this.recipesBtn = document.getElementById('recipes-btn');

        this.recipesOverlay = document.getElementById('recipes-overlay');
        this.recipesList = document.getElementById('recipes-list');
        this.recipesBackBtn = document.getElementById('recipes-back-btn');

        this.craftingOverlay = document.getElementById('crafting-overlay');
        this.craftingViewRoot = document.getElementById('crafting-view');
        this.craftingBackBtn = document.getElementById('crafting-back-btn');
    }

    bindUiActions() {
        if (this.resumeBtn) {
            this.resumeBtn.addEventListener('click', () => {
                eventBus.emit('resume');
            });
        }

        if (this.recipesBtn) {
            this.recipesBtn.addEventListener('click', () => {
                this.showRecipes();
            });
        }

        if (this.craftingBtn) {
            this.craftingBtn.addEventListener('click', () => {
                this.showCrafting();
            });
        }

        const backToPauseMenu = () => this.showPauseMenu();
        if (this.recipesBackBtn) {
            this.recipesBackBtn.addEventListener('click', backToPauseMenu);
        }
        if (this.craftingBackBtn) {
            this.craftingBackBtn.addEventListener('click', backToPauseMenu);
        }
    }

    async handleShowRequest() {
        await this.loadingPromise;
        this.show();
    }

    show() {
        this.showPauseMenu();
    }

    hide() {
        this.hideAllSections();
        this.host.hideHost();
    }

    showPauseMenu() {
        this.showOverlay(this.overlay);
    }

    showRecipes() {
        if (this.recipeListView && !this.recipeListView.rendered) {
            this.recipeListView.render();
        }
        this.showOverlay(this.recipesOverlay);
    }



    hideAllSections() {
        [this.overlay, this.recipesOverlay, this.craftingOverlay].forEach(section => {
            if (section) {
                section.hidden = true;
            }
        });
    }

    showOverlay(section) {
        if (!section) {
            return;
        }
        this.hideAllSections();
        this.host.showHost();
        section.hidden = false;
    }

    getFallbackMarkup() {
        return `
<div id="pause-overlay" class="pause-overlay" hidden>
    <div class="pause-menu">
        <header class="pause-menu-header">
            <h2>Paused</h2>
            <p>Take a breather before jumping back into the city.</p>
        </header>
        <div class="pause-menu-buttons">
            <button id="resume-btn" class="pause-btn primary" type="button">Resume</button>
            <button id="crafting-btn" class="pause-btn" type="button">Crafting</button>
            <button id="recipes-btn" class="pause-btn" type="button">Recipes</button>
        </div>
    </div>
</div>
<div id="recipes-overlay" class="pause-overlay" hidden>
    <div class="pause-menu">
        <header class="pause-menu-header">
            <h2>Recipes</h2>
        </header>
        <div id="recipes-list" class="recipes-list"></div>
        <div class="pause-menu-buttons">
            <button id="recipes-back-btn" class="pause-btn" type="button">Back</button>
        </div>
    </div>
</div>
<div id="crafting-overlay" class="pause-overlay" hidden>
    <div class="pause-menu">
        <header class="pause-menu-header">
            <h2>Crafting</h2>
        </header>
        <div id="crafting-view" class="crafting-view">
            <div class="crafting-row top">
                <div id="crafting-inputs" class="crafting-inputs"></div>
                <div class="crafting-arrow">→</div>
                <div id="crafting-output" class="crafting-output"></div>
            </div>
            <div id="crafting-inventory" class="crafting-row inventory"></div>
        </div>
        <div class="pause-menu-buttons">
            <button id="crafting-back-btn" class="pause-btn" type="button">Back</button>
        </div>
    </div>
</div>`;
    }
}

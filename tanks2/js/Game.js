import { NetworkingScreen } from './networking/NetworkingScreen.js';
import { Maze } from './maze/Maze.js';
import { Pregame } from './pregame/Pregame.js';
import { peerManager } from './networking/peer_manager.js';
import { ClientInputRelay } from './input/ClientInputRelay.js';
import { canvas, ctx, setHudScoreboardVisible, layoutHudOverCanvas, ensureHudScoreboardHandlers } from './render/context.js';
import { setPregameOverlayVisible } from './render/pregame_dom.js';

export class Game{
    constructor() {
        // Initialize Maze; it carries its own default settings
        this.maze = new Maze(this);
        try { window.__mazeRef = this.maze; } catch (_) {}
        this.pregame = new Pregame(this, canvas.height * 3 / 4);
        this.networking = new NetworkingScreen(this);
        this.main_object = this.pregame;
        this.clientInputRelay = new ClientInputRelay(peerManager);
        // Ensure scoreboard hidden until gameplay starts
        try { setHudScoreboardVisible(false); } catch (_) {}
        try { ensureHudScoreboardHandlers(); } catch (_) {}
    }

    main(){ this.main_object.main(); }

    onclick(x,y){ this.main_object.onclick(x,y); }

    keyDownHandler(key){ this.main_object.keyDownHandler(key); }

    keyUpHandler(key){
        if (this.main_object && typeof this.main_object.keyUpHandler === 'function') {
            this.main_object.keyUpHandler(key);
        }
    }


    // Compact protocol: init string from host
    startFromHostCompact(str){
        this.pregame.focus = null;
        if (this.networking) { this.networking.hideOverlay(); }
        if (this.maze && typeof this.maze.applyInitString === 'function') {
            this.maze.applyInitString(str);
        }
        // Ensure previous pregame frame is cleared fully
        try { ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height); } catch (e) {}
        this.maze.spectator = true;
        this.main_object = this.maze;
        this.maze.beginGameplay && this.maze.beginGameplay();
        // Show and align HTML scoreboard during gameplay
        try { setHudScoreboardVisible(true); layoutHudOverCanvas(); setPregameOverlayVisible(false); } catch (_) {}

        this.setupClientControllers({ tanks: this.maze.remoteTankMeta });
    }


    // Compact protocol: delta string from host
    updateStateFromHostCompact(str){
        if (!str || !this.maze || typeof this.maze.applyDeltaString !== 'function') { return; }
        this.maze.applyDeltaString(str);
    }

    setupClientControllers(payload){
        if (!this.clientInputRelay) { return; }
        this.clientInputRelay.configure(payload || {});
    }

};

export default Game;

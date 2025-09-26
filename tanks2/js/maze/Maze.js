import { eventHub } from '../event_hub.js';
import { peerManager } from '../networking/peer_manager.js';
import { Wall, Intersection } from './Wall.js';
import { Square } from './Square.js';
import { createPowerupByType, generatePowerup } from './Powerup.js';
import { doRectsOverlap, shuffle } from '../helper_fns.js';
import { canvas, ctx, layoutHudOverCanvas, setHudScoreboardVisible } from '../render/context.js';
import { renderHudScoreboard } from '../render/scoreboard_dom.js';

//ctx must be defined 


export class Maze {
    constructor(game, settings){
        this.game=game;
        // Default settings live in Maze (single source of truth)
        const defaultSettings = {
            num_of_rows: 6,
            num_of_columns: 9,
            wall_thiccness: 4,
            speed: 1,
            move_speed: 3,
            rotation_speed: 9/100,
            bullet_speed: 3,
            seconds_between_rounds: 3,
            friendly_fire: false,
            bullet_limit: 7,
            bounce_limit: 7,
            powerup_interval: 8,
            powerup_limit: 8,
            powerup_duration: 10,
        };
        this.settings = Object.assign({}, defaultSettings, settings || {});
        this.num_of_rows=this.settings.num_of_rows;
        this.num_of_columns=this.settings.num_of_columns;
        this.wall_thiccness=this.settings.wall_thiccness;
        // Reserve a top scoreboard panel (20% height)
        this.scoreboardHeight = Math.floor(canvas.height * 1/5);
        this.width=canvas.width-this.wall_thiccness;
        this.height=(canvas.height - this.scoreboardHeight) - this.wall_thiccness;

        // Precompute integer-aligned cell edges to avoid subpixel artifacts
        this._buildGridEdges();
        
        this.tanks=[];
        this.powerups=[];
        // Unified serializable state (authoritative on host; mirrored on guests)
        this.state = {
            tanks: {},      // id -> { id, x, y, rotation, colour, width, height, score, is_dead, powerups: [{type,spriteId?}] }
            powerups: {},   // id -> { id, type, x, y, width, height }
            meta: { nextPowerupId: 1, nextTankId: 1 }
        };
        this.pendingPowerupEvents = [];
        this.teleportMirrors = {};
        this.lastSnapshot = null;
        this.message = "Shoot the opposing tanks!"
        this.num_of_destroyed_tanks=0;
        this.spectator = false;
        this.remoteState = null;
        this.remoteTankMeta = [];
        this.remoteTankMap = {};
        this.remotePowerups = [];
        this.remoteBulletCache = {};
        this.remoteBulletLerpDuration = 60;
        this.remoteBulletPredictionWindow = 120;
        this.remoteGlobalBullets = [];
        this.nextPowerupId = 1;
        this.nextTankId = 1;
        this.tankById = {};
        this.lastStateBroadcast = 0;
        this.lastRemoteStateTime = 0;
        this.hostOwned = false;
        this.tick = 0;

        //2d array
        this.squares=[];
        for(var r=0;r<this.num_of_rows;r++){
            var row=[];
            for (var c=0;c<this.num_of_columns;c++){
                row.push(new Square(this,r,c));
            }
            this.squares.push(row);
        }

        // Build shared walls and intersections now that squares exist
        this._initWalls();

        // Defer randomization, prerender, and powerups until game start

        //Functions that are called every tick
        this.extraFunctionsPerCycle = [];
        // Global visual state flags
        this.trippyCount = 0;
    }

    // Build integer-aligned edges for rows and columns
    _buildGridEdges(){
        var rows = this.num_of_rows;
        var cols = this.num_of_columns;
        // Columns
        var baseW = Math.floor(this.width / cols);
        var remW = this.width - baseW * cols;
        this._colX = [0];
        for (var c = 0; c < cols; c++){
            var add = baseW + (c < remW ? 1 : 0);
            this._colX.push(this._colX[c] + add);
        }
        // Rows
        var baseH = Math.floor(this.height / rows);
        var remH = this.height - baseH * rows;
        this._rowY = [0];
        for (var r = 0; r < rows; r++){
            var addH = baseH + (r < remH ? 1 : 0);
            this._rowY.push(this._rowY[r] + addH);
        }
    }

    getCellRect(row, col){
        var x0 = this._colX[col];
        var x1 = this._colX[col+1];
        var y0 = this._rowY[row];
        var y1 = this._rowY[row+1];
        return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    }

    main() {
        this.tick += 1;
        if(this.spectator){
            this.drawSpectator();
            return;
        }
    this.tanks.forEach(function(tank){tank.main();});
    this.draw();
        this.broadcastState();
    }

         draw(){
        if ((this.trippyCount || 0) > 0) {
            // Trippy mode: only scoreboard + dynamic objects
            this.drawScoreboardTop();
            this.drawDynamicObjects();
            return;
        }
        this.drawScoreboardTop();
        this.drawBackground();
        this.drawDynamicObjects();
    }

        drawBackground() {
            // Draw tiles and walls directly on main canvas (single-canvas mode)
            ctx.save();
            if (typeof ctx.setTransform === 'function') { ctx.setTransform(1,0,0,1,0,0); }
            // Clear gameplay area (not scoreboard) before drawing background
            var gy = this.scoreboardHeight;
            var gh = canvas.height - gy;
            ctx.clearRect(0, gy, canvas.width, gh);
            ctx.translate(0, this.scoreboardHeight);
            ctx.translate(this.wall_thiccness/2, this.wall_thiccness/2);
            // Tiles
            for (var ri = 0; ri < this.squares.length; ri++){
                var row = this.squares[ri];
                for (var ci = 0; ci < row.length; ci++){
                    var square = row[ci];
                    var fill = ((square.row + square.col) % 2 == 0) ? "#C0C0C0" : "#E0E0E0";
                    ctx.fillStyle = fill;
                    ctx.fillRect(square.x, square.y, square.width, square.height);
                }
            }
            // Walls
            ctx.fillStyle = 'black';
            for (var wi = 0; wi < this.walls.length; wi++){
                var w = this.walls[wi];
                if (!w.isActive) continue;
                ctx.fillRect(w.x, w.y, w.width, w.height);
            }
            ctx.restore();
        }

    // Build the static background on the background canvas
    prerenderBackground(){
        // No-op in single-canvas mode; background is drawn in drawBackground
    }

    // Host local start: generate maze + prerender + start powerups
    beginGameplay(){
        if (!this._generated) {
            this.randomize();
            this.prerenderBackground();
            this._generated = true;
        }
        // Host assigns sequential tank ids and broadcasts full roster
        if (peerManager && peerManager.isHost) {
            this.assignSequentialTankIds();
            this.broadcastStartState();
        }
        if (!this._powerupsLoopStarted) {
            this._powerupsLoopStarted = true;
            setTimeout(this.tryAddPowerupAndRepeat.bind(this), this.settings.powerup_interval*1000, this);
        }
    }

    assignSequentialTankIds(){
        this.tankById = {};
        var nextId = 1;
        for (var i=0;i<this.tanks.length;i++){
            var t = this.tanks[i];
            t.id = nextId;
            this.tankById[t.id] = t;
            nextId++;
        }
        this.nextTankId = nextId;
    }

    serializeTankRoster(){
        var arr = [];
        for (var i=0;i<this.tanks.length;i++){
            var t = this.tanks[i];
            arr.push({ id: t.id, x: Math.round(t.x)||0, y: Math.round(t.y)||0, rotation: t.rotation||0, colour: t.colour||t.color||'#000', width: t.width||20, height: t.height||20, ownerPeerId: t.ownerPeerId||null, controls: t.controls||[] });
        }
        return arr;
    }

    broadcastStartState(){
        if (!peerManager || !peerManager.isHost) { return; }
        try {
            var payload = { role: 'host', type: 'init', tanks: this.serializeTankRoster(), maze: this.serializeLayout ? this.serializeLayout() : null, gameConfig: this.settings };
            // Compact init string path already exists; keep JSON path for clarity
            if (typeof this.serializeUnifiedSnapshot === 'function') {
                var jsnap = this.serializeUnifiedSnapshot();
                peerManager.broadcast('U,' + jsnap);
            }
            // Also notify via legacy event for UI readiness
            eventHub.emit('network-ready', { role: 'host', roomId: peerManager.id });
        } catch (_) {}
    }

    drawDynamicObjects() {
        // Prune any stale per-cycle functions (e.g., old teleport mirrors)
        try { this._pruneStaleExtraFunctions(); } catch(_){}
        ctx.save();
        ctx.translate(0, this.scoreboardHeight);
        ctx.translate(this.wall_thiccness/2, this.wall_thiccness/2);
        this.tanks.forEach(function (tank) {
      tank.draw();
    });
    this.powerups.forEach(function (powerup) {
      powerup.draw();
    });
        // Extra per-cycle visuals (e.g., teleport mirror drawn here when desired)
        this.extraFunctionsPerCycle.forEach(function (f) { try { f(); } catch (e) {} });
        ctx.restore();
    }

    _pruneStaleExtraFunctions(){
        if (!Array.isArray(this.extraFunctionsPerCycle) || this.extraFunctionsPerCycle.length === 0) { return; }
        var mirrors = this.teleportMirrors || {};
        var next = [];
        for (var i = 0; i < this.extraFunctionsPerCycle.length; i++){
            var f = this.extraFunctionsPerCycle[i];
            if (f && f.__tp_tankId != null) {
                if (mirrors && mirrors[f.__tp_tankId]) { next.push(f); }
                // else drop it
            } else {
                next.push(f);
            }
        }
        this.extraFunctionsPerCycle = next;
    }

    _initWalls(){
        var wt = this.wall_thiccness;
        var half = wt/2;
        this.walls = [];
        this.intersections = [];
        // Build intersections grid (nodes)
        for (var r=0; r<=this.num_of_rows; r++){
            var rowNodes = [];
            for (var c=0; c<=this.num_of_columns; c++){
                rowNodes.push(new Intersection(this._colX[c], this._rowY[r]));
            }
            this.intersections.push(rowNodes);
        }
        // Vertical seams c = 0..cols
        for (var c=0; c<=this.num_of_columns; c++){
            for (var r=0; r<this.num_of_rows; r++){
                var x = this._colX[c] - half;
                var y = this._rowY[r] - half;
                var h = (this._rowY[r+1] - this._rowY[r]) + wt;
                var wall = new Wall(x, y, wt, h, 'vertical');
                wall.N = this.intersections[r][c];
                wall.S = this.intersections[r+1][c];
                // Assign to adjacent squares
                if (c > 0) { this.squares[r][c-1].east = wall; }
                if (c < this.num_of_columns) { this.squares[r][c] && (this.squares[r][c].west = wall); }
                // Register on intersections
                if (!this.intersections[r][c].east) this.intersections[r][c].east = wall;
                if (!this.intersections[r+1][c].west) this.intersections[r+1][c].west = wall;
                this.walls.push(wall);
            }
        }
        // Horizontal seams r = 0..rows
        for (var r=0; r<=this.num_of_rows; r++){
            for (var c=0; c<this.num_of_columns; c++){
                var xh = this._colX[c] - half;
                var yh = this._rowY[r] - half;
                var w = (this._colX[c+1] - this._colX[c]) + wt;
                var wallh = new Wall(xh, yh, w, wt, 'horizontal');
                wallh.W = this.intersections[r][c];
                wallh.E = this.intersections[r][c+1];
                // Assign to adjacent squares
                if (r > 0) { this.squares[r-1][c].south = wallh; }
                if (r < this.num_of_rows) { this.squares[r] && this.squares[r][c] && (this.squares[r][c].north = wallh); }
                // Register on intersections
                if (!this.intersections[r][c].south) this.intersections[r][c].south = wallh;
                if (!this.intersections[r][c+1].north) this.intersections[r][c+1].north = wallh;
                this.walls.push(wallh);
            }
        }
    }
    
    // New top scoreboard panel (HTML-based). Keep canvas area clear.
    drawScoreboardTop() {
        // Ensure the canvas scoreboard region is blank
        if (typeof ctx.setTransform === 'function') {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
        var panelH = this.scoreboardHeight;
        ctx.clearRect(0, 0, canvas.width, panelH);
        // Disable canvas gear click area since HTML replaces it
        this._gearBtnRect = null;

        // Update HTML scoreboard contents
        try { layoutHudOverCanvas(); setHudScoreboardVisible(true); } catch(_){}
        var tanksSrc = this.spectator ? (this.remoteTankMeta || []) : (this.tanks || []);
        var players = [];
        for (var i = 0; i < tanksSrc.length; i++) {
            var t = tanksSrc[i];
            if (!t) { continue; }
            var scoreVal = (typeof t.score === 'number') ? t.score : parseInt(t.score || '0', 10) || 0;
            var iconId = null;
            var powerupsList = t && Array.isArray(t.powerups) ? t.powerups : [];
            for (var pi = 0; pi < powerupsList.length; pi++) {
                var power = powerupsList[pi];
                if (!power) { continue; }
                if (!this.spectator && power.img && power.img.id) {
                    iconId = power.img.id;
                    break;
                }
                if (power.spriteId) {
                    iconId = power.spriteId;
                    break;
                }
            }
            players.push({
                id: t.id || ('tank-' + (i + 1)),
                score: scoreVal,
                powerupIconId: iconId || null,
            });
        }
        renderHudScoreboard({
            players: players,
        });
    }

    // Testing helper: remove interior walls and regenerate powerups
    testFlattenAndRegen(){
        try {
            // Deactivate interior walls (keep outer borders)
            for (var r = 0; r < this.num_of_rows; r++){
                for (var c = 0; c < this.num_of_columns; c++){
                    var sq = this.squares[r][c];
                    if (sq && sq.east) { sq.east.isActive = false; }
                    if (sq && sq.south) { sq.south.isActive = false; }
                }
            }
            // Clear existing powerups immediately
            var list = (this.powerups || []).slice();
            for (var i = 0; i < list.length; i++){
                var p = list[i];
                try { if (p && p.timeout) { clearTimeout(p.timeout); p.timeout = null; } } catch(_){}
                try { this.removePowerup(p); } catch(_){}
            }
            // Regenerate a full batch up to limit
            var limit = Math.max(0, this.settings && this.settings.powerup_limit ? this.settings.powerup_limit : 0);
            for (var k = 0; k < limit; k++){
                var pu = generatePowerup(this);
                this.placeObject(pu);
                this.addPowerup(pu);
            }
            // Redraw background to reflect wall changes
            this.drawBackground();
            this.drawScoreboardTop();
        } catch (e) {}
    }

    keyDownHandler(event) {
        if (document.activeElement.tagName == "INPUT" ) { return; } //Don't pass into Maze if typing in input box
        this.tanks.forEach(function(tank){
            tank.keyDownHandler(event);
        });
    }

    keyUpHandler(event) {
        this.tanks.forEach(function(tank){
            if (typeof tank.keyUpHandler === 'function') {
                tank.keyUpHandler(event);
            }
        });
    }

    randomize(){
        // Reset visit flags and reactivate all walls
        this.squares.forEach(function(row){
            row.forEach(function(square){ square.visited=false; });
        });
        (this.walls||[]).forEach(function(w){ w.isActive = true; });

        var entry_square=this.squares[0][0];
        this.visit(this.getRandomSquare(),this.getRandomSquare());
    }

    //Used in randomize. Visiting square b from a means removing the border between a-b and visiting all unvisited neighbours (in a random order). 
    visit(old_square,new_square){
        old_square.removeBorder(new_square);
        new_square.visited=true;

        var neighbours=new_square.getNeighbours();
        neighbours=shuffle(neighbours);

        for(var i=0;i<neighbours.length;i++){
            if (neighbours[i].visited==false){
                this.visit(new_square,neighbours[i]);
            }
        }
    }

    
    getSquareAtXY(pos){
        var x=pos[0];
        var y=pos[1];
        //Check if position is in the maze
        if(this.isOutOfBounds(pos)){return false;}
        return this.squares[Math.floor(y/this.height * this.num_of_rows)][Math.floor(x/this.width * this.num_of_columns)]
    }


    getRandomSquare(){
        var rnd_row_num = Math.floor(Math.random()*this.squares.length);
        var row = this.squares[rnd_row_num];
        var rnd_square = row[Math.floor(Math.random()*row.length)];
        return rnd_square;
    }

    
    //Check if a rectangle collides with (a wall in) the maze
    doesRectCollide(rect){
        // rect = [x,y,w,h]
        if(this.isOutOfBounds([rect[0],rect[1]])){return true;}
        var square = this.getSquareAtXY([rect[0],rect[1]]);
        if(!square){return true;}
        var nearby_squares = square.getNeighbours().concat([square]);
        //We need to check walls of nearby squares because of the case where you're driving into top wall horizontally
        var nearby_walls = [];
        nearby_squares.forEach(function(e){
            e.getWalls().forEach(function(el){
                nearby_walls.push(el);
            });
        });
        var collides=false;
        nearby_walls.forEach(function(e){
            if(doRectsOverlap(rect,e)){collides=true;}
        });
        return collides;

    }
    

    isOutOfBounds(pos){
        if(pos[0]<=0 || pos[0]>=this.width || pos[1]<=0 || pos[1]>=this.height){return true;}
        return false;
    }

    
    tankDestroyed(){
        this.num_of_destroyed_tanks+=1;

        if (this.num_of_destroyed_tanks==this.tanks.length-1){
            for(var i=0;i<this.tanks.length;i++){
                var tank = this.tanks[i];
                if(tank.is_dead==false){
                    tank.score+=1;
                    this.restart_helper(this.settings.seconds_between_rounds);
                    return;
                }            
            }        
        }
    }

    restart_helper(sec){
        if(sec==0){this.restart();return;}
        this.message="Next round starting in time seconds".replace('time',sec);
        setTimeout(this.restart_helper.bind(this),1000,sec-1);    
    }

    restart(){
        this.randomize();
        this.message="restart";
        this.num_of_destroyed_tanks=0;
        for(var i=0;i<this.tanks.length;i++){
            this.tanks[i].restart();
        }
        this.powerups=[];
        this.pendingPowerupEvents = [];
        this.teleportMirrors = {};
        this.lastSnapshot = null;
    }

    //Takes obj with x, y, width and height properties and sets x,y to place it in a random valid position
    placeObject(object){
        var square = this.getRandomSquare();
        var wt = this.wall_thiccness;
        var westActive = square.west && square.west.isActive ? 1 : 0;
        var eastActive = square.east && square.east.isActive ? 1 : 0;
        var northActive = square.north && square.north.isActive ? 1 : 0;
        var southActive = square.south && square.south.isActive ? 1 : 0;
        var min_x = square.x + wt * westActive ; 
        var max_x = square.x + square.width - wt * eastActive - object.width ;
        var min_y = square.y + wt * northActive ;
        var max_y = square.y + square.height - wt * southActive - object.height;

        object.x = min_x + Math.random()*(max_x-min_x);
        object.y = min_y + Math.random()*(max_y-min_y);

    }

    registerTank(tank){
        this.tankById[tank.id || ('tank-' + this.tanks.length)] = tank;
    }

    serializeLayout(){
        var layout = [];
        for (var r = 0; r < this.squares.length; r++){
            var row = [];
            for (var c = 0; c < this.squares[r].length; c++){
                var sq = this.squares[r][c];
                row.push({
                    north: !!(sq.north && sq.north.isActive),
                    south: !!(sq.south && sq.south.isActive),
                    east:  !!(sq.east  && sq.east.isActive),
                    west:  !!(sq.west  && sq.west.isActive)
                });
            }
            layout.push(row);
        }
        return {
            num_of_rows: this.num_of_rows,
            num_of_columns: this.num_of_columns,
            wall_thiccness: this.wall_thiccness,
            squares: layout
        };
    }

    loadLayout(data){
        if (!data || !data.squares) { return; }
        this.num_of_rows = data.num_of_rows || this.num_of_rows;
        this.num_of_columns = data.num_of_columns || this.num_of_columns;
        this.wall_thiccness = data.wall_thiccness || this.wall_thiccness;
        for (var r = 0; r < this.squares.length && r < data.squares.length; r++){
            for (var c = 0; c < this.squares[r].length && c < data.squares[r].length; c++){
                var square = this.squares[r][c];
                var src = data.squares[r][c] || {};
                if (square.north) square.north.isActive = !!src.north;
                if (square.south) square.south.isActive = !!src.south;
                if (square.east)  square.east.isActive  = !!src.east;
                if (square.west)  square.west.isActive  = !!src.west;
            }
        }
    }

    serializeState(){
        return this.captureState();
    }

    captureState(){
        var self = this;
        var tanksState = this.tanks.map(function(tank, index){
            return self.cloneTankState({
                id: tank.id || ('tank-' + index),
                colour: tank.colour,
                ownerPeerId: tank.ownerPeerId,
                x: tank.x,
                y: tank.y,
                rotation: tank.rotation,
                score: tank.score,
                is_dead: tank.is_dead,
                width: tank.width,
                height: tank.height,
                bullets: tank.bullets.map(function(bullet){
                    return { x: bullet.x, y: bullet.y, radius: bullet.radius, colour: tank.colour };
                }),
                powerups: tank.powerups.map(function(powerup){
                    return powerup.serialize ? powerup.serialize() : { name: powerup.name, type: powerup.constructor && powerup.constructor.name ? powerup.constructor.name : powerup.name, spriteId: powerup.img && powerup.img.id ? powerup.img.id : null };
                })
            });
        });
    var boardPowerups = this.serializeBoardPowerups();
    var snapshot = {
        message: this.message,
        tanks: tanksState,
        powerups: boardPowerups,
        events: this.consumePendingEvents ? this.consumePendingEvents() : []
    };
    // Keep unified state.tanks synced with snapshot (ids -> simple entries)
    try {
        this.state.tanks = {};
        for (var i=0;i<tanksState.length;i++){
            var ts = tanksState[i];
            this.state.tanks[ts.id] = { id: ts.id, x: ts.x, y: ts.y, rotation: ts.rotation, width: ts.width, height: ts.height, colour: ts.colour, score: ts.score, is_dead: ts.is_dead, powerups: (ts.powerups||[]).map(function(p){ return { type: p.type || p.name, spriteId: p.spriteId||null }; }) };
        }
    } catch(_){}
    return snapshot;
    }

    serializeBoardPowerups(){
        var list = [];
        for (var i = 0; i < this.powerups.length; i++) {
            var powerup = this.powerups[i];
            if (!powerup) { continue; }
            if (!powerup.id) {
                powerup.id = 'powerup-' + (this.nextPowerupId++);
            }
            list.push({
                id: powerup.id,
                type: powerup.constructor && powerup.constructor.name ? powerup.constructor.name : powerup.name,
                name: powerup.name,
                x: powerup.x,
                y: powerup.y,
                width: powerup.width,
                height: powerup.height,
                spriteId: powerup.img && powerup.img.id ? powerup.img.id : null,
                color: powerup.color || '#ffffff'
            });
            // Keep unified state.powerups in sync (host-preferred)
            try { this.state && (this.state.powerups[powerup.id] = { id: powerup.id, type: list[list.length-1].type, x: powerup.x, y: powerup.y, width: powerup.width, height: powerup.height }); } catch(_){}
        }
        return list;
    }

    cloneTankState(tankState){
        return JSON.parse(JSON.stringify(tankState));
    }

    clonePowerupState(powerupState){
        return JSON.parse(JSON.stringify(powerupState));
    }

    clonePowerupList(list){
        var self = this;
        var source = Array.isArray(list) ? list : [];
        return source.map(function(powerup){
            return self.clonePowerupState(powerup);
        });
    }

    cloneSnapshot(snapshot){
        if (!snapshot) {
            return { message: '', tanks: [], powerups: [], events: [] };
        }
        var tanks = Array.isArray(snapshot.tanks) ? snapshot.tanks : [];
        var self = this;
        return {
            message: snapshot.message,
            tanks: tanks.map(function(tank){ return self.cloneTankState(tank); }),
            powerups: self.clonePowerupList(snapshot.powerups),
            events: []
        };
    }

    collectRemoteTankMeta(){
        var list = [];
        if (!this.remoteTankMap) { return list; }
        for (var id in this.remoteTankMap) {
            if (Object.prototype.hasOwnProperty.call(this.remoteTankMap, id)) {
                list.push(this.remoteTankMap[id]);
            }
        }
        return list;
    }

    buildStatePacket(){
        var current = this.captureState();
        var packet = null;
        if (!this.lastSnapshot) {
            packet = { type: 'state-init', state: current };
        } else {
            var delta = this.diffSnapshots(this.lastSnapshot, current);
            if (delta) {
                packet = { type: 'state-delta', delta: delta };
            }
        }
        this.lastSnapshot = this.cloneSnapshot(current);
        return packet;
    }

    // Build unified delta JSON comparing previous unified state
    buildUnifiedDeltaPacket(){
        try {
            var prev = this._lastUnifiedState || { tanks: {}, powerups: {} };
            var json = this.serializeUnifiedDelta(prev);
            this._lastUnifiedState = JSON.parse(this.serializeUnifiedSnapshot());
            return 'V,' + json; // V for unified delta
        } catch(_) { return null; }
    }

    // New unified-state serializers/apply methods (guests consume)
    serializeUnifiedSnapshot(){
        try { return JSON.stringify({ tanks: this.state.tanks || {}, powerups: this.state.powerups || {} }); } catch(_) { return '{}'; }
    }
    applyUnifiedSnapshot(json){
        try {
            var obj = typeof json === 'string' ? JSON.parse(json) : (json || {});
            this.state.tanks = obj.tanks || {};
            this.state.powerups = obj.powerups || {};
            // Rebuild remoteTankMap for compatibility
            this.remoteTankMap = {};
            for (var id in this.state.tanks){ if (!Object.prototype.hasOwnProperty.call(this.state.tanks, id)) continue; this.remoteTankMap[id] = this.state.tanks[id]; }
            this.remoteTankMeta = this.collectRemoteTankMeta();
            if (typeof this.recomputeGlobalPowerups === 'function') { this.recomputeGlobalPowerups(); }
        } catch(_){}
    }
    // Delta format: { tanks: { set: {id->state}, del: [ids] }, powerups: { set: {id->entry}, del: [ids] } }
    serializeUnifiedDelta(prev){
        var delta = { tanks: { set: {}, del: [] }, powerups: { set: {}, del: [] } };
        try {
            var pt = (prev && prev.tanks) || {};
            var ct = this.state.tanks || {};
            // sets/updates
            for (var id in ct){ if (!Object.prototype.hasOwnProperty.call(ct, id)) continue; var a = JSON.stringify(pt[id]||null), b = JSON.stringify(ct[id]); if (a !== b) { delta.tanks.set[id] = ct[id]; } }
            // deletions
            for (var id2 in pt){ if (!Object.prototype.hasOwnProperty.call(pt, id2)) continue; if (!Object.prototype.hasOwnProperty.call(ct, id2)) { delta.tanks.del.push(id2); } }
            var pp = (prev && prev.powerups) || {};
            var cp = this.state.powerups || {};
            for (var pid in cp){ if (!Object.prototype.hasOwnProperty.call(cp, pid)) continue; var pa = JSON.stringify(pp[pid]||null), pb = JSON.stringify(cp[pid]); if (pa !== pb) { delta.powerups.set[pid] = cp[pid]; } }
            for (var pid2 in pp){ if (!Object.prototype.hasOwnProperty.call(pp, pid2)) continue; if (!Object.prototype.hasOwnProperty.call(cp, pid2)) { delta.powerups.del.push(pid2); } }
        } catch(_){}
        return JSON.stringify(delta);
    }
    applyUnifiedDelta(json){
        try {
            var d = typeof json === 'string' ? JSON.parse(json) : (json || {});
            var ts = (d.tanks || {}); var ps = (d.powerups || {});
            // tanks
            this.state.tanks = this.state.tanks || {};
            (ts.del||[]).forEach((id)=>{ delete this.state.tanks[id]; delete this.remoteTankMap[id]; });
            var setT = ts.set || {};
            for (var id in setT){ if (!Object.prototype.hasOwnProperty.call(setT, id)) continue; this.state.tanks[id] = setT[id]; this.remoteTankMap[id] = setT[id]; }
            // powerups
            this.state.powerups = this.state.powerups || {};
            (ps.del||[]).forEach((pid)=>{ delete this.state.powerups[pid]; });
            var setP = ps.set || {};
            for (var pid in setP){ if (!Object.prototype.hasOwnProperty.call(setP, pid)) continue; this.state.powerups[pid] = setP[pid]; }
            this.remoteTankMeta = this.collectRemoteTankMeta();
            if (typeof this.recomputeGlobalPowerups === 'function') { this.recomputeGlobalPowerups(); }
        } catch(_){}
    }

    // Compact string serializers (Phase 1)
    serializeInitString(){
        // I,rows,cols,wall,mv,rv,bv,bl,bo,pi,pl,pd,ff,layout,powerups,tanks
        var s = this.settings || {};
        var rows = this.num_of_rows || s.num_of_rows || 0;
        var cols = this.num_of_columns || s.num_of_columns || 0;
        var wall = this.wall_thiccness || s.wall_thiccness || 0;
        var mv = +((s.move_speed != null ? s.move_speed : 0));
        var rv = +((s.rotation_speed != null ? s.rotation_speed : 0));
        var bv = +((s.bullet_speed != null ? s.bullet_speed : 0));
        var bl = +((s.bullet_limit != null ? s.bullet_limit : 0));
        var bo = +((s.bounce_limit != null ? s.bounce_limit : 0));
        var pi = +((s.powerup_interval != null ? s.powerup_interval : 0));
        var pl = +((s.powerup_limit != null ? s.powerup_limit : 0));
        var pd = +((s.powerup_duration != null ? s.powerup_duration : 0));
        var ff = (s.friendly_fire ? 1 : 0);
        var layoutObj = this.serializeLayout ? this.serializeLayout() : null;
        var layoutStr = layoutObj ? btoa(unescape(encodeURIComponent(JSON.stringify(layoutObj)))) : '';
        var powerupBlocks = (this.powerups || []).map(function(p){
            if (!p) { return ''; }
            var x = Math.round(p.x) || 0;
            var y = Math.round(p.y) || 0;
            var w = Math.round(p.width) || 0;
            var h = Math.round(p.height) || 0;
            var sid = (p.img && p.img.id) ? p.img.id : '';
            var c = (p.color || '').replace(/[,|;]/g,'');
            return [x,y,w,h,sid,c].join('|');
        }).filter(Boolean).join(';');
        var tankBlocks = (this.tanks || []).map(function(t, index){
            if (!t) { return ''; }
            var id = t.id || ('tank-' + index);
            var x = Math.round(t.x) || 0;
            var y = Math.round(t.y) || 0;
            var r = +(t.rotation || 0).toFixed(4);
            var w = Math.round(t.width) || 0;
            var h = Math.round(t.height) || 0;
            var c = (t.colour || '').replace(/[,|;]/g,'');
            var s = +(t.score || 0);
            return [id,x,y,r,w,h,c,s].join('|');
        }).filter(Boolean).join(';');
        return ['I', rows, cols, wall, mv, rv, bv, bl, bo, pi, pl, pd, ff, layoutStr, powerupBlocks, tankBlocks].join(',');
    }

    serializeDeltaString(){
        // D,tanks,bullets,powerups,events (timestamp removed)
        var tanks = (this.tanks || []).map(function(t, index){
            if (!t) { return ''; }
        var id = t.id || ('tank-' + index);
        var x = Math.round(t.x) || 0;
        var y = Math.round(t.y) || 0;
        var r = +(t.rotation || 0).toFixed(4);
        var s = +(t.score || 0);
        var alive = t.is_dead ? 0 : 1;
        return [id,x,y,r,s,alive].join('|');
        }).filter(Boolean).join(';');
        var bullets = [];
        (this.tanks || []).forEach(function(t){
            (t.bullets || []).forEach(function(b){
                var vx = +(b.direction && b.direction[0] || 0).toFixed(3);
                var vy = +(b.direction && b.direction[1] || 0).toFixed(3);
                var col = (t.colour || '').replace(/[,|;]/g,'');
                var rad = Math.round(b.radius || 1);
                bullets.push([Math.round(b.x)||0, Math.round(b.y)||0, vx, vy, col, rad].join('|'));
            });
        });
        var powerups = (this.powerups || []).map(function(p){
            if (!p) { return ''; }
            var x = Math.round(p.x) || 0;
            var y = Math.round(p.y) || 0;
            var w = Math.round(p.width) || 0;
            var h = Math.round(p.height) || 0;
            var sid = (p.img && p.img.id) ? p.img.id : '';
            var c = (p.color || '').replace(/[,|;]/g,'');
            return [x,y,w,h,sid,c].join('|');
        }).filter(Boolean).join(';');
        // Consume and serialize pending powerup events (generic)
        var evts = this.consumePendingEvents();
        var events = '';
        if (evts && evts.length) {
            var partsE = [];
            for (var ei = 0; ei < evts.length; ei++){
                var e = evts[ei];
                if (!e) continue;
                var p = (e.powerup||'').replace(/[,|;]/g,'');
                var s = (e.status||'').replace(/[,|;]/g,'');
                var t = (e.target||'').replace(/[,|;]/g,'');
                var id = (e.tankId||'').replace(/[,|;]/g,'');
                partsE.push([p,s,t,id].join('|'));
            }
            events = partsE.join(';');
        }
        return ['D', tanks, bullets.join(';'), powerups, events].join(',');
    }

    applyInitString(str){
        if (typeof str !== 'string' || !str || str[0] !== 'I') { return; }
        var parts = str.split(',');
        // indexes: 1..13 settings, 14 layout, 15 powerups, 16 tanks
        var toInt = function(v){ var n = parseInt(v,10); return isNaN(n)?0:n; };
        var toNum = function(v){ var n = parseFloat(v); return isNaN(n)?0:n; };
        this.num_of_rows = toInt(parts[1]);
        this.num_of_columns = toInt(parts[2]);
        this.wall_thiccness = toInt(parts[3]);
        this.settings.move_speed = toNum(parts[4]);
        this.settings.rotation_speed = toNum(parts[5]);
        this.settings.bullet_speed = toNum(parts[6]);
        this.settings.bullet_limit = toInt(parts[7]);
        this.settings.bounce_limit = toInt(parts[8]);
        this.settings.powerup_interval = toNum(parts[9]);
        this.settings.powerup_limit = toInt(parts[10]);
        this.settings.powerup_duration = toNum(parts[11]);
        this.settings.friendly_fire = parts[12] === '1';
        // layout (decode but apply after rebuilding grid/walls)
        var layoutObj = null;
        try {
            var layoutToken = parts[13] || '';
            if (layoutToken) {
                var json = decodeURIComponent(escape(atob(layoutToken)));
                layoutObj = JSON.parse(json);
            }
        } catch (e) { layoutObj = null; }
        // Rebuild grid based on updated settings so guest has proper walls
        this._buildGridEdges();
        // Recreate squares
        this.squares = [];
        for (var r = 0; r < this.num_of_rows; r++){
            var row = [];
            for (var c = 0; c < this.num_of_columns; c++){
                row.push(new Square(this, r, c));
            }
            this.squares.push(row);
        }
        // Rebuild walls/intersections
        this._initWalls();
        // Apply layout activation flags
        if (layoutObj && layoutObj.squares && this.loadLayout) {
            this.loadLayout(layoutObj);
        }
        // powerups
        this.remotePowerups = [];
        var pBlock = parts[14] || '';
        if (pBlock) {
            var pEntries = pBlock.split(';');
            for (var pi = 0; pi < pEntries.length; pi++){
                var tok = pEntries[pi];
                if (!tok) { continue; }
                var f = tok.split('|');
                this.remotePowerups.push({
                    x: parseInt(f[0],10)||0,
                    y: parseInt(f[1],10)||0,
                    width: parseInt(f[2],10)||0,
                    height: parseInt(f[3],10)||0,
                    spriteId: f[4]||'',
                    color: f[5]||'#ffffff'
                });
            }
        }
        // tanks
        this.remoteTankMap = {};
        var tankBlock = parts[15] || '';
        if (tankBlock) {
            var entries = tankBlock.split(';');
            for (var i = 0; i < entries.length; i++){
                var tok = entries[i];
                if (!tok) { continue; }
                var f = tok.split('|');
                var id = f[0];
                this.remoteTankMap[id] = {
                    id: id,
                    x: toInt(f[1]), y: toInt(f[2]), rotation: toNum(f[3]),
                    width: toInt(f[4]), height: toInt(f[5]), colour: f[6] || '#ffffff', score: toInt(f[7])
                };
            }
        }
        this.remoteTankMeta = this.collectRemoteTankMeta();
        this.remoteState = { tanks: this.remoteTankMeta, powerups: this.remotePowerups };
        this.recomputeGlobalPowerups && this.recomputeGlobalPowerups();
        // Refresh prerendered background for guests
        this.prerenderBackground();
        this.message = 'Awaiting host updates...';
    }

    applyDeltaString(str){
        if (typeof str !== 'string' || !str || str[0] !== 'D') { return; }
        var parts = str.split(',');
        var toInt = function(v){ var n = parseInt(v,10); return isNaN(n)?0:n; };
        var toNum = function(v){ var n = parseFloat(v); return isNaN(n)?0:n; };
        // Support legacy format D,ts,tanks,... and new format D,tanks,...
        var base = 1;
        if (parts.length >= 6) { // likely legacy with ts
            base = 2;
        }
        // tanks
        var tankBlock = parts[base] || '';
        if (tankBlock) {
            var entries = tankBlock.split(';');
            for (var i = 0; i < entries.length; i++){
                var tok = entries[i];
                if (!tok) { continue; }
                var f = tok.split('|');
        var id = f[0];
        var existing = this.remoteTankMap && this.remoteTankMap[id] ? this.remoteTankMap[id] : { id: id };
        existing.x = toInt(f[1]); existing.y = toInt(f[2]); existing.rotation = toNum(f[3]); existing.score = toInt(f[4]);
        // Host-provided alive flag (binary). Only apply if present; default to alive.
        if (f.length > 5 && f[5] !== '') {
          var aliveFlag = toInt(f[5]);
          existing.is_dead = (aliveFlag === 0);
        } else if (typeof existing.is_dead !== 'boolean') {
          existing.is_dead = false;
        }
        this.remoteTankMap[id] = existing;
            }
        }
        this.remoteTankMeta = this.collectRemoteTankMeta();
        // Local prediction: conservatively mark as dead only when friendly fire is enabled
        // and the overlapping bullet is clearly not from the same tank (colour mismatch).
        // This avoids self-hit flicker on guests when firing.
        try {
          if (this.settings && this.settings.friendly_fire) {
            var tanksArr = this.remoteTankMeta || [];
            var bulletsArr = this.remoteGlobalBullets || [];
            for (var ti = 0; ti < tanksArr.length; ti++){
              var rt = tanksArr[ti];
              if (!rt || rt.is_dead) continue;
              var tx = rt.x, ty = rt.y;
              var tw = rt.width || (this.width/this.num_of_columns/3);
              var th = rt.height || (this.height/this.num_of_rows/3);
              for (var bi = 0; bi < bulletsArr.length; bi++){
                var rb = bulletsArr[bi];
                if (!rb) continue;
                // Skip own bullets by colour match
                if (rb.colour && rt.colour && rb.colour === rt.colour) { continue; }
                var br = (rb.radius || 1);
                var bx0 = rb.x - br, by0 = rb.y - br, bw = br*2, bh = br*2;
                if (doRectsOverlap([tx,ty,tw,th], [bx0,by0,bw,bh])){
                  // Mark predicted dead
                  rt.is_dead = true;
                  // Also update map entry if present
                  var mt = this.remoteTankMap && this.remoteTankMap[rt.id];
                  if (mt) { mt.is_dead = true; }
                  break;
                }
              }
            }
          }
        } catch (e) { /* no-op */ }
        // bullets
        var bullets = [];
        var bulletBlock = parts[base + 1] || '';
        if (bulletBlock) {
            var bEntries = bulletBlock.split(';');
            for (var j = 0; j < bEntries.length; j++){
                var b = bEntries[j];
                if (!b) { continue; }
                var bf = b.split('|');
                bullets.push({ x: toInt(bf[0]), y: toInt(bf[1]), vx: toNum(bf[2]), vy: toNum(bf[3]), colour: bf[4]||'#000000', radius: toInt(bf[5])||1 });
            }
        }
        this.remoteGlobalBullets = bullets;
        // powerups
        var newPowerups = [];
        var pBlockDelta = parts[base + 2] || '';
        if (pBlockDelta) {
            var entriesP = pBlockDelta.split(';');
            for (var k = 0; k < entriesP.length; k++){
                var tk = entriesP[k];
                if (!tk) { continue; }
                var pf = tk.split('|');
                newPowerups.push({
                    x: toInt(pf[0]), y: toInt(pf[1]), width: toInt(pf[2]), height: toInt(pf[3]), spriteId: pf[4]||'', color: pf[5]||'#ffffff'
                });
            }
        }
        this.remotePowerups = newPowerups;
        this.remoteState = { tanks: this.remoteTankMeta, powerups: this.remotePowerups };
        // events
        var eventsBlock = parts[base + 3] || '';
        if (eventsBlock) {
            var entriesE = eventsBlock.split(';');
            for (var eIdx = 0; eIdx < entriesE.length; eIdx++){
                var ek = entriesE[eIdx];
                if (!ek) { continue; }
                var ef = ek.split('|');
                var evt = { type: 'powerup', powerup: ef[0]||'', status: ef[1]||'', target: ef[2]||'', tankId: ef[3]||'' };
                this.applyPowerupEvent(evt);
            }
        }
    }

    diffSnapshots(prev, curr){
        prev = prev || {};
        curr = curr || {};
        var delta = {};
        var prevTanks = Array.isArray(prev.tanks) ? prev.tanks : [];
        var currTanks = Array.isArray(curr.tanks) ? curr.tanks : [];
        var prevPowerups = Array.isArray(prev.powerups) ? prev.powerups : [];
        var currPowerups = Array.isArray(curr.powerups) ? curr.powerups : [];
        if (curr.message !== prev.message) {
            delta.message = curr.message;
        }

        var changedTanks = [];
        var prevMap = {};
        var currMap = {};
        prevTanks.forEach(function(tank, index){
            if (!tank) { return; }
            var prevId = (tank.id) ? tank.id : ('tank-' + index);
            prevMap[prevId] = tank;
        });
        currTanks.forEach(function(tank, index){
            if (!tank) { return; }
            var currId = (tank.id) ? tank.id : ('tank-' + index);
            currMap[currId] = tank;
        });

        var self = this;
        for (var id in currMap) {
            var newTank = currMap[id];
            var oldTank = prevMap[id];
            if (!oldTank || self.hasTankChanged(oldTank, newTank)) {
                changedTanks.push(newTank);
            }
        }

        if (changedTanks.length) {
            delta.tanks = changedTanks;
        }

        var removed = [];
        for (var prevId in prevMap) {
            if (!currMap[prevId]) {
                removed.push(prevId);
            }
        }
        if (removed.length) {
            delta.removedTanks = removed;
        }

        if (this.haveBoardPowerupsChanged(prevPowerups, currPowerups)) {
            delta.powerups = this.clonePowerupList(currPowerups);
        }

        var currEvents = Array.isArray(curr.events) ? curr.events : [];
        if (currEvents.length) {
            delta.events = currEvents;
        }

        return Object.keys(delta).length ? delta : null;
    }

    hasTankChanged(prevTank, newTank){
        if (!prevTank || !newTank) { return prevTank !== newTank; }
        if (prevTank.x !== newTank.x || prevTank.y !== newTank.y) { return true; }
        if (prevTank.rotation !== newTank.rotation) { return true; }
        if (prevTank.colour !== newTank.colour) { return true; }
        if (prevTank.ownerPeerId !== newTank.ownerPeerId) { return true; }
        if (prevTank.width !== newTank.width || prevTank.height !== newTank.height) { return true; }
        if (prevTank.score !== newTank.score) { return true; }
        if (!!prevTank.is_dead !== !!newTank.is_dead) { return true; }
        if (this.haveBulletsChanged(prevTank.bullets, newTank.bullets)) { return true; }
        if (this.havePowerupsChanged(prevTank.powerups, newTank.powerups)) { return true; }
        return false;
    }

    haveBulletsChanged(prevBullets, newBullets){
        prevBullets = prevBullets || [];
        newBullets = newBullets || [];
        if (prevBullets.length !== newBullets.length) { return true; }
        for (var i = 0; i < prevBullets.length; i++) {
            var a = prevBullets[i];
            var b = newBullets[i];
            if (a.x !== b.x || a.y !== b.y || a.radius !== b.radius) {
                return true;
            }
        }
        return false;
    }


        // Backwards-compat alias; recompute current global visual flags from meta
        syncGlobalPowerups(){ this.recomputeGlobalPowerups(); }
    // Recompute visual global flags (e.g., Trippy) from remote tank metadata
    recomputeGlobalPowerups(){
        try {
            var meta = this.remoteTankMeta || [];
            var hasTrippy = 0;
            for (var i = 0; i < meta.length; i++){
                var t = meta[i];
                if (!t || !t.powerups) continue;
                for (var j = 0; j < t.powerups.length; j++){
                    var pu = t.powerups[j];
                    var nm = (pu && (pu.type || pu.name || '')) + '';
                    if (/Trippy/i.test(nm)) { hasTrippy++; break; }
                }
            }
            this.trippyCount = hasTrippy;
        } catch (_) {}
    }
    havePowerupsChanged(prevPowerups, newPowerups){
        prevPowerups = prevPowerups || [];
        newPowerups = newPowerups || [];
        if (prevPowerups.length !== newPowerups.length) { return true; }
        for (var i = 0; i < prevPowerups.length; i++) {
            var a = prevPowerups[i];
            var b = newPowerups[i];
            if ((a && a.type) !== (b && b.type)) { return true; }
        }
        return false;
    }

    haveBoardPowerupsChanged(prevPowerups, newPowerups){
        prevPowerups = Array.isArray(prevPowerups) ? prevPowerups : [];
        newPowerups = Array.isArray(newPowerups) ? newPowerups : [];
        if (prevPowerups.length !== newPowerups.length) { return true; }
        var prevMap = {};
        prevPowerups.forEach(function(powerup, index){
            if (!powerup) { return; }
            var id = powerup.id || ('powerup-' + index);
            prevMap[id] = powerup;
        });
        for (var i = 0; i < newPowerups.length; i++) {
            var powerup = newPowerups[i];
            if (!powerup) { return true; }
            var id = powerup.id || ('powerup-' + i);
            var prevEntry = prevMap[id];
            if (!prevEntry) { return true; }
            if (prevEntry.x !== powerup.x || prevEntry.y !== powerup.y) { return true; }
            if (prevEntry.width !== powerup.width || prevEntry.height !== powerup.height) { return true; }
            if ((prevEntry.spriteId || null) !== (powerup.spriteId || null)) { return true; }
            if ((prevEntry.type || null) !== (powerup.type || null)) { return true; }
            if ((prevEntry.color || null) !== (powerup.color || null)) { return true; }
        }
        return false;
    }

    getCachedSnapshot(){
        if (this.lastSnapshot) {
            return this.cloneSnapshot(this.lastSnapshot);
        }
        var snapshot = this.captureState();
        this.lastSnapshot = this.cloneSnapshot(snapshot);
        return snapshot;
    }

    // Legacy JSON state/delta paths were removed

    applyInputState(state){
        if (!state || !state.tankId) { return; }
        var tank = this.tankById ? this.tankById[state.tankId] : null;
        if (!tank) { return; }
        tank.applyNetworkInput({
            upPressed: !!state.upPressed,
            downPressed: !!state.downPressed,
            leftPressed: !!state.leftPressed,
            rightPressed: !!state.rightPressed,
            shooting: !!state.shooting,
            specialKeyPressed: !!state.specialKeyPressed
        });
    }

    broadcastState(){
        if (!peerManager || !peerManager.isHost || !peerManager.connections || peerManager.connections.length === 0) { return; }
        var now = performance.now();
        if (this.lastSnapshot && now - this.lastStateBroadcast < 30) { return; }
        var packet = this.buildStatePacket();
        if (!packet) { return; }
        this.lastStateBroadcast = now;
        // Send compact string only
        try {
            if (packet.type === 'state-init') {
                peerManager.broadcast(this.serializeInitString());
            } else if (packet.type === 'state-delta') {
                peerManager.broadcast(this.serializeDeltaString());
            }
        } catch (e) {}
    }

    drawSpectator(){
        // Draw scoreboard first
        this.drawScoreboardTop();
        // Respect trippy mode: skip background clear/tiles/walls to create trail effect
        if (!((this.trippyCount || 0) > 0)) {
            try {
                if (typeof ctx.setTransform === 'function') { ctx.setTransform(1,0,0,1,0,0); }
                // Draw background directly (single-canvas mode)
                this.drawBackground();
            } catch (e) {}
        }
        ctx.save();
        ctx.translate(0, this.scoreboardHeight);
        ctx.translate(this.wall_thiccness/2, this.wall_thiccness/2);
        // Draw walls only when not in trippy mode (walls are part of background in host path)
        if (!((this.trippyCount || 0) > 0)) {
            ctx.fillStyle = 'black';
            for (var i = 0; i < this.walls.length; i++) {
                var w = this.walls[i];
                if (!w.isActive) continue;
                ctx.fillRect(w.x, w.y, w.width, w.height);
            }
        }
        // Prefer unified state for board powerups if present, fallback to legacy remote list
        var boardPowerups = null;
        if (this.state && this.state.powerups && Object.keys(this.state.powerups).length) {
            boardPowerups = Object.values(this.state.powerups);
        } else {
            boardPowerups = (this.remoteState && this.remoteState.powerups) ? this.remoteState.powerups : this.remotePowerups;
        }
        if (boardPowerups && boardPowerups.length) {
            for (var p = 0; p < boardPowerups.length; p++) {
                this.drawRemotePowerup(boardPowerups[p]);
            }
        }
        // Draw compact bullets first so tanks render on top
        if (this.remoteGlobalBullets && this.remoteGlobalBullets.length) {
            for (var gb = 0; gb < this.remoteGlobalBullets.length; gb++){
                var pb = this.remoteGlobalBullets[gb];
                this.drawRemoteBullet({ x: pb.x, y: pb.y, radius: pb.radius || 1, colour: pb.colour || '#000000' });
            }
        }
        // Then draw tanks (no per-tank bullets in guest mode)
        var tanks = (this.remoteState && this.remoteState.tanks) ? this.remoteState.tanks : this.remoteTankMeta;
        if (tanks) {
            for (var i = 0; i < tanks.length; i++){
                var t = tanks[i];
                this.drawRemoteTank(t);
                var tankId = t && t.id;
                var hasTeleport = (tankId && this.teleportMirrors && this.teleportMirrors[tankId]) || (t && t.powerups && t.powerups.some(function(p){ return p && p.type === 'TeleportPowerup'; }));
                if (hasTeleport) { this.drawTeleportMirrorState(t); }
            }
        }
        ctx.restore();
        // Optional spectator message under game area
        ctx.font = "15px Verdana";
        ctx.fillStyle = "black";
        ctx.fillText(this.message || '', canvas.width/2, this.scoreboardHeight + this.height + 20);
    }


    drawRemotePowerup(powerupState){
        if (!powerupState) { return; }
        var width = powerupState.width || 20;
        var height = powerupState.height || 20;
        var x = powerupState.x || 0;
        var y = powerupState.y || 0;
        var sprite = powerupState.spriteId ? document.getElementById(powerupState.spriteId) : null;
        if (sprite) {
            var prev = ctx.imageSmoothingEnabled;
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(sprite, x, y, width, height);
            ctx.imageSmoothingEnabled = prev;
            return;
        }
        ctx.lineWidth = 1;
        ctx.strokeStyle = powerupState.color || '#ffffff';
        ctx.strokeRect(x, y, width, height);
    }

    drawRemoteTank(tankState){
        if (!tankState) { return; }
        if (tankState.is_dead) { return; }
        var width = tankState.width || (this.width/this.num_of_columns/3);
        var height = tankState.height || (this.height/this.num_of_rows/3);
        ctx.save();
        ctx.translate( tankState.x + width/2, tankState.y + height/2 );
        ctx.rotate(tankState.rotation || 0);
        var sprite = document.getElementById('tank');
        if (sprite) {
            var prev = ctx.imageSmoothingEnabled;
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(sprite, -width/2, -height/2, width, height);
            ctx.imageSmoothingEnabled = prev;
        } else {
            ctx.fillStyle=tankState.colour || '#ffffff';
            ctx.fillRect(-width/2,-height/2,width,height);
        }
        ctx.restore();
    }

    drawRemoteBullet(bulletState){
        if (!bulletState) { return; }
    ctx.beginPath();
    // Use transmitted colour and radius for visual parity with host
    var radius = (typeof bulletState.radius === 'number' && bulletState.radius > 0) ? bulletState.radius : 1;
    var color = bulletState.colour || '#000000';
    ctx.fillStyle = '#000000';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.arc(bulletState.x, bulletState.y, radius, 0, 2*Math.PI);
    ctx.fill();
    ctx.stroke();
    }

    drawTeleportMirrorState(tankState){
        var width = tankState.width || (this.width/this.num_of_columns/3);
        var height = tankState.height || (this.height/this.num_of_rows/3);
        ctx.save();
        ctx.translate(
            canvas.width - (tankState.x + width / 2),
            this.height - (tankState.y + height / 2)
        );
        ctx.rotate(tankState.rotation || 0);
        // Render the clone at 30% opacity for parity with host
        var oldAlpha = ctx.globalAlpha;
        ctx.globalAlpha = 0.3;
        var sprite = document.getElementById('tank');
        if (sprite) {
            var prev = ctx.imageSmoothingEnabled;
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(sprite, -width / 2, -height / 2, width, height);
            ctx.imageSmoothingEnabled = prev;
        } else {
            ctx.fillStyle = tankState.colour || '#ffffff';
            ctx.fillRect(-width / 2, -height / 2, width, height);
        }
        ctx.globalAlpha = oldAlpha;
        ctx.restore();
    }

    //Will fail if length if full. Will not eject oldest powerup.
    tryAddPowerupAndRepeat(){
        if (this.spectator) { return; }
            if(this.powerups.length != this.settings.powerup_limit){
                if(this.powerups.length >= this.settings.powerup_limit){
                this.powerups.shift();
            }    
            
            var powerup = generatePowerup(this);
            this.placeObject(powerup);
            this.addPowerup(powerup);
            this.message = powerup.getMessage();
        }    

            setTimeout(this.tryAddPowerupAndRepeat.bind(this), this.settings.powerup_interval*1000, this);
    }

    addPowerup(powerup){
        if (!powerup) { return; }
        if (!powerup.id) {
            powerup.id = 'powerup-' + (this.nextPowerupId++);
        }
        this.powerups.push(powerup);
        if (powerup.registerDelegate) {
            powerup.registerDelegate(this.broadcastPowerupEvent.bind(this));
        }
        // Host announces spawns so guests add matching powerup locally
        try {
            if (peerManager && peerManager.isHost) {
                var typeName = (powerup.constructor && powerup.constructor.name) ? powerup.constructor.name : (powerup.name || '');
                var sid = (powerup.img && powerup.img.id) ? powerup.img.id : '';
                var color = (powerup.color || '').replace(/[|]/g,'');
                // S,type|id|x|y|w|h|spriteId|color
                var block = [typeName, powerup.id, Math.round(powerup.x)||0, Math.round(powerup.y)||0, Math.round(powerup.width)||0, Math.round(powerup.height)||0, sid, color].join('|');
                peerManager.broadcast(['S', block].join(','));
            }
        } catch (_) {}
    }
    
    removePowerup(powerup){
        this.powerups.splice(this.powerups.indexOf(powerup),1);
    }

    broadcastPowerupEvent(event){
        if (!event) { return; }
        if (!this.pendingPowerupEvents) {
            this.pendingPowerupEvents = [];
        }
        this.pendingPowerupEvents.push(event);
        // Host: also broadcast unified delta reflecting icon change immediately if available
        try {
            if (this.game && this.game.peer_manager && this.game.peer_manager.isHost && typeof this.buildUnifiedDeltaPacket === 'function') {
                var pkt = this.buildUnifiedDeltaPacket();
                if (pkt && typeof this.game.peer_manager.broadcast === 'function') { this.game.peer_manager.broadcast(pkt); }
            }
        } catch(_){}
    }

    consumePendingEvents(){
        var events = this.pendingPowerupEvents || [];
        this.pendingPowerupEvents = [];
        return events;
    }

    applyPowerupEvent(event){
        if (!event) { return; }
        // No special-casing for global powerups; guests synthesize effects via peer manager.

        // Resolve triggering tank if available
        var tankRef = null;
        if (event.tankId && this.tankById) { tankRef = this.tankById[event.tankId] || null; }

        // Teleport mirror visibility toggling for guests/spectators
        if (event.powerup === 'TeleportPowerup' && event.tankId) {
            if (!this.teleportMirrors) { this.teleportMirrors = {}; }
            if (event.status === 'activate') {
                this.teleportMirrors[event.tankId] = true;
            } else if (event.status === 'deactivate') {
                delete this.teleportMirrors[event.tankId];
            }
            // fall through to allow any effect/undo calls as well
        }

        // Reflect active powerup icon into unified state for scoreboard icons (single source of truth)
        if (event.tankId) {
            this.state = this.state || { tanks: {}, powerups: {}, meta: { nextPowerupId: 0 } };
            var st = this.state.tanks[event.tankId] || (this.state.tanks[event.tankId] = { id: event.tankId, powerups: [] });
            if (event.status === 'activate') {
                var iconId = this.resolvePowerupSpriteId(event.powerup);
                st.powerups = iconId ? [{ type: event.powerup, spriteId: iconId }] : [{ type: event.powerup }];
            } else if (event.status === 'deactivate') {
                st.powerups = [];
            }
            // Maintain legacy remote meta for render paths that still read it
            if (this.remoteTankMap) {
                var rt = this.remoteTankMap[event.tankId] || (this.remoteTankMap[event.tankId] = { id: event.tankId });
                rt.powerups = (st.powerups || []).slice();
                this.remoteTankMeta = this.collectRemoteTankMeta();
                this.remoteState = { tanks: this.remoteTankMeta, powerups: this.remotePowerups };
            }
            if (typeof this.recomputeGlobalPowerups === 'function') { this.recomputeGlobalPowerups(); }
        }

        // Find a matching live powerup object in the maze, prefer exact id
        var matched = null;
        if (event.powerupId && this.powerups) {
            for (var ix = 0; ix < this.powerups.length; ix++){
                var pp = this.powerups[ix];
                if (pp && pp.id === event.powerupId) { matched = pp; break; }
            }
        }
        if (!matched && this.powerups) {
            for (var i = 0; i < this.powerups.length; i++){
                var p = this.powerups[i];
                if (p && (String(p.id) === String(event.powerupId))) { matched = p; break; }
            }
        }

        if (event.status === 'activate'){
            if (matched) {
                // Prefer unified pickup flow to ensure consistent handling
                if (typeof matched.pickup === 'function') { matched.pickup(tankRef || (event.tankId || '')); return; }
                if (typeof matched.onBulletHit === 'function' && tankRef) { matched.onBulletHit(tankRef); return; }
                if (typeof matched.effect === 'function') { matched.effect(tankRef); return; }
            }
            return;
        }

        if (event.status === 'deactivate'){
            // Prefer undo on the tank's active powerups
            if (tankRef && Array.isArray(tankRef.powerups)){
                for (var j=0; j<tankRef.powerups.length; j++){
                    var ap = tankRef.powerups[j];
                    var an = (ap && ap.constructor && ap.constructor.name) ? ap.constructor.name : (ap && ap.name);
                    if (an === event.powerup) {
                        // Use teardown if available to ensure scoreboard repaint
                        if (typeof ap.teardown === 'function') { ap.teardown(); }
                        else if (typeof ap.undo === 'function') { ap.undo(tankRef); }
                    }
                }
            }
            if (matched) {
                if (typeof matched.teardown === 'function') { matched.teardown(); }
                else if (typeof matched.undo === 'function') { matched.undo(tankRef); }
            }
            return;
        }
    }

    // Map powerup constructor/name to a known sprite element id for guests
    resolvePowerupSpriteId(name){
        var n = String(name || '');
        // Normalize common variants
        if (/Trippy/i.test(n)) return 'pills';
        if (/Remove\s*Bullet\s*Limit|RemoveBulletLimit/i.test(n)) return 'unlimited';
        if (/Triple\s*-?Shot|TripleShot/i.test(n)) return 'tripleshot';
        if (/MoveThroughWalls|ghost/i.test(n)) return 'ghost';
        if (/Teleport/i.test(n)) return 'teleport';
        if (/Cannon(ball)?/i.test(n)) return 'cannonball';
        if (/Invis/i.test(n)) return 'invisible';
        if (/Shinra/i.test(n)) return 'repel';
        if (/Hex/i.test(n)) return 'hex';
        return null;
    }

    addTank(tank){
        this.tanks.push(tank)
    }

    onclick(x,y){
        // No scoreboard-gear click targets; reserved for future use
    }


}

export default Maze;
    

    

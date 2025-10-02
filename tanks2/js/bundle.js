(() => {
  // js/event_hub.js
  var EventHub = class {
    constructor() {
      this.eventHandlers = {};
    }
    on(event, handler) {
      if (!this.eventHandlers[event]) {
        this.eventHandlers[event] = [];
      }
      this.eventHandlers[event].push(handler);
    }
    emit(event, ...rest) {
      const handlers = this.eventHandlers[event];
      if (!handlers || handlers.length === 0) {
        return;
      }
      handlers.forEach((handler) => {
        try {
          handler.apply(null, rest);
        } catch (_) {
        }
      });
    }
  };
  var eventHub = new EventHub();

  // js/render/context.js
  var canvas = document.getElementById("myCanvas");
  var ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.mozImageSmoothingEnabled = false;
  ctx.webkitImageSmoothingEnabled = false;
  ctx.msImageSmoothingEnabled = false;
  var GAME_WIDTH = 1280;
  var GAME_HEIGHT = 720;
  canvas.width = GAME_WIDTH;
  canvas.height = GAME_HEIGHT;
  function setHudScoreboardVisible(visible) {
    const hudScoreboard = document.getElementById("hud-scoreboard");
    if (!hudScoreboard) return;
    hudScoreboard.classList.toggle("hidden", !visible);
  }
  function layoutHudOverCanvas() {
    const hudScoreboard = document.getElementById("hud-scoreboard");
    if (!hudScoreboard) return;
    const rect = canvas.getBoundingClientRect();
    const panelHeight = Math.round(rect.height * 0.2);
    hudScoreboard.style.left = Math.round(rect.left) + "px";
    hudScoreboard.style.top = Math.round(rect.top) + "px";
    hudScoreboard.style.width = Math.round(rect.width) + "px";
    hudScoreboard.style.height = panelHeight + "px";
  }
  window.addEventListener("resize", () => {
    try {
      layoutHudOverCanvas();
    } catch (_) {
    }
  });
  var _hudHandlersBound = false;
  function ensureHudScoreboardHandlers() {
    if (_hudHandlersBound) return;
    document.addEventListener("click", function(ev) {
      const net = ev.target && ev.target.closest ? ev.target.closest(".sb-network") : null;
      if (!net) return;
      ev.stopPropagation();
      ev.preventDefault();
      const overlay = document.getElementById("net-stats-overlay");
      if (overlay) {
        overlay.classList.toggle("hidden");
      }
    }, true);
    document.addEventListener("click", function(ev) {
      const btn = ev.target && ev.target.closest ? ev.target.closest(".sb-test") : null;
      if (!btn) return;
      ev.stopPropagation();
      ev.preventDefault();
      try {
        if (window.__mazeRef && typeof window.__mazeRef.testFlattenAndRegen === "function") {
          window.__mazeRef.testFlattenAndRegen();
        }
      } catch (_) {
      }
    }, true);
    _hudHandlersBound = true;
  }

  // js/maze/Powerup.js
  function isValidImage(el) {
    return !!(el && el.tagName === "IMG" && el.complete && el.naturalWidth > 0);
  }
  var Powerup = class {
    constructor(maze, x = 0, y = 0) {
      this.x = x;
      this.y = y;
      this.width = 20;
      this.height = 20;
      this.maze = maze;
      this.delegate = null;
      this._handled = false;
      if (maze && typeof maze.nextPowerupId === "number") {
        this.id = maze.nextPowerupId++;
      } else {
        this.id = this.id || 0;
      }
    }
    getMessage() {
      return this.name;
    }
    draw() {
      if (isValidImage(this.img)) {
        var prev = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(this.img, this.x, this.y, this.width, this.height);
        ctx.imageSmoothingEnabled = prev;
        return;
      }
      ctx.lineWidth = 1;
      ctx.strokeStyle = this.color;
      ctx.strokeRect(this.x, this.y, this.width, this.width);
    }
    onBulletHit(tank) {
      this.pickup(tank);
    }
    // Unified pickup entrypoint used both by local game loop and networking
    // Accepts a Tank instance or a tankId string; resolves via maze.tanks when needed
    pickup(target) {
      if (!this.maze) {
        return false;
      }
      var tank = null;
      if (typeof target === "string") {
        var id = target;
        if (Array.isArray(this.maze.tanks)) {
          for (var i = 0; i < this.maze.tanks.length; i++) {
            if (this.maze.tanks[i] && this.maze.tanks[i].id === id) {
              tank = this.maze.tanks[i];
              break;
            }
          }
        }
      } else {
        tank = target;
      }
      if (!tank) {
        return false;
      }
      if (this._handled) {
        return false;
      }
      this._handled = true;
      try {
        this.maze.removePowerup(this);
      } catch (_) {
      }
      this.tank = tank;
      try {
        tank.removeAllPowerups();
      } catch (_) {
      }
      try {
        tank.addPowerup(this);
      } catch (_) {
      }
      try {
        this.timeout = setTimeout(this.teardown.bind(this), this.maze.settings.powerup_duration * 1e3);
      } catch (_) {
      }
      try {
        this.notifyActivate(tank);
      } catch (_) {
      }
      try {
        if (this.maze.drawScoreboardTop) {
          this.maze.drawScoreboardTop();
        }
      } catch (_) {
      }
      return true;
    }
    // Teardown: undo effect via tank.removePowerup (which calls undo), notify, and repaint scoreboard
    teardown() {
      try {
        if (this.timeout) {
          clearTimeout(this.timeout);
          this.timeout = null;
        }
        if (this.tank) {
          this.tank.removePowerup(this);
        }
        if (this.maze && this.maze.drawScoreboardTop) {
          this.maze.drawScoreboardTop();
        }
      } catch (_) {
      }
    }
    registerDelegate(fn) {
      this.delegate = fn;
    }
    broadcast(event) {
      if (typeof this.delegate === "function") {
        this.delegate(event);
      }
    }
    getTargetType() {
      return "tank";
    }
    serialize() {
      return {
        name: this.name,
        type: this.constructor && this.constructor.name ? this.constructor.name : this.name,
        spriteId: this.img && this.img.id ? this.img.id : null
      };
    }
    notifyActivate(tank) {
      this.emitEvent("activate", tank);
    }
    notifyDeactivate(tank) {
      this.emitEvent("deactivate", tank);
    }
    emitEvent(status, tank) {
      const event = {
        type: "powerup",
        status,
        powerup: this.constructor && this.constructor.name ? this.constructor.name : this.name,
        target: this.getTargetType()
      };
      if (tank) {
        event.tankId = tank.id;
        event.peerId = tank.ownerPeerId;
      }
      if (this.id) {
        event.powerupId = this.id;
      }
      this.broadcast(event);
      try {
        var parts = ["X", event.powerup, status, event.target || "", event.tankId || "", this.id || ""];
        peerManager.broadcast(parts.join(","));
      } catch (_) {
      }
    }
  };
  var TrippyPowerup = class extends Powerup {
    constructor(maze, x, y) {
      super(maze, x, y);
      this.name = "Trippy";
      this.color = "green";
      this.img = document.getElementById("illusion");
    }
    effect(tank) {
      if (typeof this.maze.trippyCount !== "number") {
        this.maze.trippyCount = 0;
      }
      this.maze.trippyCount += 1;
    }
    undo(tank) {
      if (typeof this.maze.trippyCount !== "number") {
        this.maze.trippyCount = 0;
      }
      this.maze.trippyCount = Math.max(0, (this.maze.trippyCount || 0) - 1);
    }
    getTargetType() {
      return "global";
    }
  };
  function createPowerupByType(name, maze) {
    var n = String(name || "");
    try {
      if (/Trippy/i.test(n)) return new TrippyPowerup(maze);
      if (/Remove\s*Bullet\s*Limit|RemoveBulletLimit/i.test(n)) return new RemoveBulletLimitPowerup(maze);
      if (/Triple\s*-?Shot|TripleShot/i.test(n)) return new TripleShotPowerup(maze);
      if (/MoveThroughWalls|ghost/i.test(n)) return new MoveThroughWallsPowerup(maze);
      if (/Teleport/i.test(n)) return new TeleportPowerup(maze);
      if (/Cannon(ball)?/i.test(n)) return new CannonballPowerup(maze);
      if (/Invis/i.test(n)) return new InvisibilityPowerup(maze);
      if (/Shinra/i.test(n)) return new ShinraTenseiPowerup(maze);
      if (/Hex/i.test(n)) return new HexPowerup(maze);
    } catch (e) {
    }
    return null;
  }
  var RemoveBulletLimitPowerup = class extends Powerup {
    constructor(maze, x, y) {
      super(maze, x, y);
      this.name = "Remove Bullet Limit";
      this.color = "orange";
      this.img = document.getElementById("unlimited");
    }
    // Effect and undo methods remain unchanged.
    effect(tank) {
      tank.shouldFire = function() {
        if (this.shooting) {
          return true;
        } else {
          return false;
        }
      };
    }
    undo(tank) {
      tank.shouldFire = function() {
        if (this.shooting && this.bullets.length < this.bullet_limit) {
          return true;
        } else {
          return false;
        }
      };
    }
  };
  var TripleShotPowerup = class extends Powerup {
    constructor(maze, x, y) {
      super(maze, x, y);
      this.name = "Triple-Shot";
      this.color = "red";
      this.img = document.getElementById("tripleshot");
    }
    // Effect and undo methods remain unchanged.
    effect(tank) {
      tank.fire = function() {
        this.fire_helper(this.rotation, this.maze.settings.bullet_speed);
        this.fire_helper(this.rotation - Math.PI / 12, this.maze.settings.bullet_speed);
        this.fire_helper(this.rotation + Math.PI / 12, this.maze.settings.bullet_speed);
      };
      tank.bullet_limit = 3 * this.maze.settings.bullet_limit;
    }
    undo(tank) {
      {
        tank.fire = function() {
          this.fire_helper(this.rotation, this.maze.settings.bullet_speed);
        };
        tank.bullet_limit = this.maze.settings.bullet_limit;
      }
    }
  };
  var MoveThroughWallsPowerup = class extends Powerup {
    constructor(maze, x, y) {
      super(maze, x, y);
      this.name = "ghost";
      this.color = "blue";
      this.img = document.getElementById("ghost");
    }
    // Effect and undo methods remain unchanged.
    effect(tank) {
      tank.tryMovingTo = function(pos) {
        var x = pos[0];
        var y = pos[1];
        if (!this.maze.isOutOfBounds([x, y])) {
          this.x = x;
          this.y = y;
        }
      };
    }
    undo(tank) {
      tank.tryMovingTo = function(pos) {
        var x = pos[0];
        var y = pos[1];
        if (!this.maze.doesRectCollide([x, y, this.width, this.height])) {
          this.x = x;
          this.y = y;
        }
      };
      if (tank.maze.doesRectCollide([tank.x, tank.y, tank.width, tank.height])) {
        var square = tank.maze.getSquareAtXY([tank.x, tank.y]);
        if (square) {
          var center = square.getCenter();
          tank.x = center[0];
          tank.y = center[1];
        }
      }
    }
  };
  var TeleportPowerup = class extends Powerup {
    constructor(maze, x, y) {
      super(maze, x, y);
      this.name = "Teleport";
      this.color = "cyan";
      this.img = document.getElementById("teleport");
    }
    // Effect and undo methods remain unchanged.
    effect(tank) {
      this.draw_mirror = function() {
        ctx.save();
        ctx.translate(
          canvas.width - (this.x + this.width / 2),
          this.maze.height - (this.y + this.height / 2)
        );
        ctx.rotate(this.rotation || 0);
        var oldAlpha = ctx.globalAlpha;
        ctx.globalAlpha = 0.3;
        var sprite = document.getElementById("tank");
        if (isValidImage(sprite)) {
          var prev = ctx.imageSmoothingEnabled;
          ctx.imageSmoothingEnabled = true;
          ctx.drawImage(sprite, -this.width / 2, -this.height / 2, this.width, this.height);
          ctx.imageSmoothingEnabled = prev;
        } else {
          ctx.fillStyle = this.colour;
          ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        }
        ctx.globalAlpha = oldAlpha;
        ctx.restore();
      }.bind(tank);
      try {
        this.draw_mirror.__tp_tankId = tank.id;
      } catch (_) {
      }
      tank.maze.extraFunctionsPerCycle.push(this.draw_mirror);
      tank.maze.teleportMirrors[tank.id] = true;
      tank.special = function() {
        if (this.poweruplock == true) {
          return;
        }
        this.x = canvas.width - this.x - this.width;
        this.y = this.maze.height - this.y - this.height;
        this.tryMovingTo([this.x, this.y]);
        try {
          if (peerManager && peerManager.isHost) {
            if (this.maze.doesRectCollide([this.x, this.y, this.width, this.height])) {
              var sq = this.maze.getSquareAtXY([this.x, this.y]);
              if (sq) {
                var ctr = sq.getCenter();
                this.x = ctr[0];
                this.y = ctr[1];
              }
            }
          }
        } catch (_) {
        }
        this.poweruplock = true;
      };
    }
    undo(tank) {
      try {
        removeElementFromArray(this.draw_mirror, tank.maze.extraFunctionsPerCycle);
        var arr = tank.maze.extraFunctionsPerCycle;
        if (Array.isArray(arr)) {
          for (var i = arr.length - 1; i >= 0; i--) {
            var f = arr[i];
            if (f && f.__tp_tankId && f.__tp_tankId === tank.id) {
              arr.splice(i, 1);
            }
          }
        }
      } catch (_) {
      }
      try {
        delete tank.maze.teleportMirrors[tank.id];
      } catch (_) {
      }
      tank.special = function() {
      };
      tank.poweruplock = false;
      if (tank.maze.doesRectCollide([tank.x, tank.y, tank.width, tank.height])) {
        var sq = tank.maze.getSquareAtXY([tank.x, tank.y]);
        if (sq) {
          var c = sq.getCenter();
          tank.x = c[0];
          tank.y = c[1];
        }
      }
    }
  };
  var CannonballPowerup = class extends Powerup {
    constructor(maze, x, y) {
      super(maze, x, y);
      this.name = "CannonBall";
      this.color = "grey";
      this.img = document.getElementById("cannonball");
    }
    // Override of Bullethit. Removed timer. Cannonball lasts until you use it or replace it.
    onBulletHit(tank) {
      super.onBulletHit(tank);
      if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
      }
    }
    effect(tank) {
      tank.special = function() {
        this.fire();
        var cannonball = this.bullets[this.bullets.length - 1];
        cannonball.radius = 50;
        var speedMultipler = 2;
        cannonball.direction[0] *= speedMultipler;
        cannonball.direction[1] *= speedMultipler;
        cannonball.handleMovement = function() {
          this.x += this.direction[0];
          this.y += this.direction[1];
          if (this.x > canvas.width + this.radius || this.x < 0 - this.radius || this.y > this.tank.maze.height + this.radius || this.y < 0 - this.radius)
            this.tank.removeBullet(this);
        };
        this.special = function() {
        };
        this.removeAllPowerups();
      };
    }
    undo(tank) {
      tank.special = function() {
      };
    }
  };
  var InvisibilityPowerup = class extends Powerup {
    constructor(maze, x, y) {
      super(maze, x, y);
      this.name = "Invisibility";
      this.color = "grey";
      this.img = document.getElementById("invisible");
    }
    // Effect and undo methods remain unchanged.
    effect(tank) {
      tank.old_draw = tank.draw;
      tank.draw = function() {
        this.bullets.forEach(function(e) {
          e.draw();
        });
      };
      tank.special = tank.old_draw;
    }
    undo(tank) {
      tank.draw = tank.old_draw;
    }
  };
  var ShinraTenseiPowerup = class _ShinraTenseiPowerup extends Powerup {
    constructor(maze, x, y) {
      super(maze, x, y);
      this.name = "Shinra Tensei";
      this.color = "purple";
      this.img = document.getElementById("repel");
    }
    // Effect and undo methods remain unchanged.
    effect(tank) {
      tank.special = function() {
        this.maze.tanks.forEach(
          function(tank2) {
            _ShinraTenseiPowerup.repelTank(this, tank2);
            tank2.bullets.forEach(
              function(bullet) {
                _ShinraTenseiPowerup.repelBullet(this, bullet);
              }.bind(this)
            );
          }.bind(this)
        );
      };
    }
    undo(tank) {
      tank.special = function() {
      };
    }
    static repelTank(repeler, repelee) {
      if (repeler == repelee) {
        return;
      }
      var dx = repelee.x - repeler.x;
      var dy = repelee.y - repeler.y;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      var strength = 2;
      var nx = dx / dist;
      var ny = dy / dist;
      repelee.tryMovingTo([
        repelee.x + nx * strength,
        repelee.y + ny * strength
      ]);
    }
    static repelBullet(tank, bullet) {
      var dx = bullet.x - tank.x;
      var dy = bullet.y - tank.y;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = dx / dist;
      var ny = dy / dist;
      var push = 0.5;
      var vx = bullet.direction[0] + nx * push;
      var vy = bullet.direction[1] + ny * push;
      var maxSpeed = tank && tank.maze && tank.maze.settings && tank.maze.settings.bullet_speed ? tank.maze.settings.bullet_speed : 3;
      var speed = Math.sqrt(vx * vx + vy * vy);
      if (speed > maxSpeed) {
        var scale = maxSpeed / speed;
        vx *= scale;
        vy *= scale;
      }
      bullet.direction[0] = vx;
      bullet.direction[1] = vy;
    }
  };
  var HexPowerup = class extends Powerup {
    constructor(maze, x, y) {
      super(maze, x, y);
      this.name = "Hex";
      this.color = "purple";
      this.img = document.getElementById("hex");
    }
    // Effect and undo methods remain unchanged.
    effect(tank) {
      tank.maze.tanks.forEach(function(tank2) {
        [tank2.onLeftPress, tank2.onRightPress] = [
          tank2.onRightPress,
          tank2.onLeftPress
        ];
        [tank2.onUpPress, tank2.onDownPress] = [tank2.onDownPress, tank2.onUpPress];
      });
    }
    undo(tank) {
      this.effect(tank);
    }
  };
  function generatePowerup(maze) {
    const powerupNo = Math.floor(8 * Math.random());
    switch (powerupNo) {
      case 0:
        return new TrippyPowerup(maze);
      case 1:
        return new RemoveBulletLimitPowerup(maze);
      case 2:
        return new TripleShotPowerup(maze);
      case 3:
        return new MoveThroughWallsPowerup(maze);
      case 4:
        return new TeleportPowerup(maze);
      case 5:
        return new CannonballPowerup(maze);
      case 6:
        return new ShinraTenseiPowerup(maze);
      case 7:
        return new MoveThroughWallsPowerup(maze);
    }
  }

  // js/networking/protocol_router.js
  var P = {};
  var netProtocol = P;
  P.encodeFreeText = function(value) {
    return ("" + (value == null ? "" : value)).replace(/,/g, "\xB7").replace(/[|;]/g, "/");
  };
  P.decodeFreeText = function(value) {
    return ("" + (value == null ? "" : value)).replace(/·/g, ",");
  };
  P.buildCompactPlayerList = function(players) {
    var blocks = (players || []).map(function(p) {
      var id = p && p.id ? p.id : "";
      var name = p && p.nickname ? P.encodeFreeText(p.nickname) : "Player";
      return id + "|" + name;
    }).join(";");
    return "P," + blocks;
  };
  P.handlePeerMessage = function(manager, data, conn) {
    data = netBinary && netBinary.hydrate ? netBinary.hydrate(data, manager, conn) : data;
    if (data == null) {
      return;
    }
    if (typeof data !== "string" || !data.length) {
      return;
    }
    var kind = data[0];
    switch (kind) {
      case "U": {
        if (!manager.isHost && manager.game && manager.game.maze && typeof manager.game.maze.applyUnifiedSnapshot === "function") {
          try {
            manager.game.maze.applyUnifiedSnapshot(data.substring(2));
          } catch (e) {
          }
        }
        return;
      }
      case "S": {
        if (manager.isHost) {
          return;
        }
        try {
          if (!manager.game || !manager.game.maze) {
            return;
          }
          var mz = manager.game.maze;
          var block = data.substring(2) || "";
          if (!block) {
            return;
          }
          var f = block.split("|");
          var type = f[0] || "";
          var id = parseInt(f[1] || "0", 10) || 0;
          var x = parseInt(f[2] || "0", 10) || 0;
          var y = parseInt(f[3] || "0", 10) || 0;
          var w = parseInt(f[4] || "20", 10) || 20;
          var h = parseInt(f[5] || "20", 10) || 20;
          var spriteId = f[6] || "";
          var color = f[7] || "";
          if (!mz.remotePowerups) {
            mz.remotePowerups = [];
          }
          mz.remotePowerups.push({ id, type, name: type, x, y, width: w, height: h, spriteId, color });
          mz.remoteState = { tanks: mz.remoteTankMeta, powerups: mz.remotePowerups };
        } catch (e) {
        }
        return;
      }
      case "Q": {
        if (manager.isHost) {
          try {
            var tsNum = parseInt(data.substring(2), 10) || 0;
            if (conn && conn.send) {
              conn.send(netBinary.buildPong(tsNum));
            }
          } catch (e) {
          }
        }
        return;
      }
      case "q": {
        if (!manager.isHost) {
          try {
            var ts = parseInt(data.substring(2), 10) >>> 0;
            var now = Math.floor(performance.now());
            var now32 = now >>> 0;
            var diff = now32 - ts >>> 0;
            if (diff <= 3e4) {
              manager._stats.rttMs = diff;
            }
          } catch (e) {
          }
        }
        return;
      }
      case "I": {
        if (!manager.isHost && manager.game && typeof manager.game.startFromHostCompact === "function") {
          manager.game.startFromHostCompact(data);
        }
        return;
      }
      case "D": {
        if (!manager.isHost && manager.game && typeof manager.game.updateStateFromHostCompact === "function") {
          manager.game.updateStateFromHostCompact(data);
        }
        return;
      }
      case "C": {
        if (manager.isHost) {
          try {
            var parts = data.split(",");
            var payload = {
              tankId: parts[1],
              upPressed: parts[2] === "1",
              rightPressed: parts[3] === "1",
              downPressed: parts[4] === "1",
              leftPressed: parts[5] === "1",
              shooting: parts[6] === "1",
              specialKeyPressed: parts[7] === "1",
              peerId: conn && conn.peer
            };
            manager.applyInputState(payload);
          } catch (e) {
          }
        }
        return;
      }
      case "P": {
        try {
          var block = data.substring(2) || "";
          var players = [];
          if (block) {
            block.split(";").forEach(function(tok) {
              if (!tok) {
                return;
              }
              var f2 = tok.split("|");
              var id2 = f2[0];
              var nn = P.decodeFreeText(f2[1] || "Player");
              if (id2) {
                players.push({ id: id2, nickname: nn });
              }
            });
          }
          manager.updatePlayersFromPayload(players);
          manager.maybeEmitReady("player-list-compact");
        } catch (e) {
        }
        return;
      }
      case "N": {
        try {
          var partsN = data.split(",");
          var pid = partsN[1] || conn && conn.peer;
          var nick = P.decodeFreeText(partsN[2] || "Player");
          if (pid) {
            manager.players.set(pid, nick);
            manager.emitPlayerList();
            if (manager.isHost) {
              manager.broadcast(data, conn);
              manager.broadcastPlayerList();
            }
          }
          if (!manager.isHost) {
            manager.maybeEmitReady("nickname-compact");
          }
        } catch (e) {
        }
        return;
      }
      case "M": {
        try {
          var partsM = data.split(",");
          var nickM = P.decodeFreeText(partsM[1] || "Player");
          var textM = P.decodeFreeText(partsM.slice(2).join(","));
          addChatMessage(nickM + ": " + textM, "other-message");
          if (manager.isHost) {
            manager.broadcast(data, conn);
          }
        } catch (e) {
        }
        return;
      }
      case "E": {
        try {
          var textE = P.decodeFreeText(data.substring(2));
          addChatMessage("* " + textE, "notification-message");
          if (manager.isHost) {
            manager.broadcast(data, conn);
          }
        } catch (e) {
        }
        return;
      }
      case "V": {
        if (!manager.isHost && manager.game && manager.game.maze && typeof manager.game.maze.applyUnifiedDelta === "function") {
          try {
            manager.game.maze.applyUnifiedDelta(data.substring(2));
          } catch (e) {
          }
        }
        return;
      }
      case "X": {
        try {
          var partsX = data.split(",");
          var pType = partsX[1] || "";
          var pStatus = partsX[2] || "";
          var pTarget = partsX[3] || "";
          var pTankId = partsX[4] || "";
          var pId = parseInt(partsX[5] || "0", 10) || 0;
          var payload = { type: "powerup", powerup: pType, status: pStatus, target: pTarget, tankId: pTankId, powerupId: pId };
          if (manager.isHost && manager.game && manager.game.maze) {
            var mzHost = manager.game.maze;
            var hostHandled = false;
            if (pId && Array.isArray(mzHost.powerups)) {
              for (var hi = 0; hi < mzHost.powerups.length; hi++) {
                var hp = mzHost.powerups[hi];
                if (hp && hp.id === pId && typeof hp.pickup === "function") {
                  hostHandled = hp.pickup(pTankId) || hostHandled;
                  break;
                }
              }
            }
            if (!hostHandled) {
              try {
                var hinst = createPowerupByType(pType, mzHost);
                if (hinst && typeof hinst.pickup === "function") {
                  try {
                    hinst.pickup(pTankId);
                  } catch (_) {
                  }
                }
              } catch (_) {
              }
            }
            manager.broadcast(data, conn);
            return;
          }
          if (!manager.isHost && manager.game && manager.game.maze) {
            var mz = manager.game.maze;
            if (typeof mz.applyPowerupEvent === "function") {
              mz.applyPowerupEvent(payload);
            }
            try {
              if (payload && payload.status === "activate" && payload.powerupId && Array.isArray(mz.powerups)) {
                for (var gi = 0; gi < mz.powerups.length; gi++) {
                  var gp = mz.powerups[gi];
                  if (gp && gp.id === payload.powerupId && typeof gp.pickup === "function") {
                    gp.pickup(payload.tankId || "");
                    break;
                  }
                }
              }
            } catch (_) {
            }
            if (payload && payload.tankId && payload.status === "activate" && typeof mz.resolvePowerupSpriteId === "function") {
              mz.state = mz.state || { tanks: {}, powerups: {}, meta: { nextPowerupId: 0 } };
              var st = mz.state.tanks[payload.tankId] || (mz.state.tanks[payload.tankId] = { id: payload.tankId, powerups: [] });
              var iconId = mz.resolvePowerupSpriteId(payload.powerup);
              st.powerups = iconId ? [{ type: payload.powerup, spriteId: iconId }] : [{ type: payload.powerup }];
              if (mz.remoteTankMap) {
                var rt = mz.remoteTankMap[payload.tankId] || (mz.remoteTankMap[payload.tankId] = { id: payload.tankId });
                rt.powerups = (st.powerups || []).slice();
                mz.remoteTankMeta = mz.collectRemoteTankMeta();
                mz.remoteState = { tanks: mz.remoteTankMeta, powerups: mz.remotePowerups };
              }
              if (typeof mz.recomputeGlobalPowerups === "function") {
                mz.recomputeGlobalPowerups();
              }
            }
          }
        } catch (e) {
        }
        return;
      }
      case "T": {
        try {
          var partsT = data.split(",");
          var fromId = partsT[1] || conn && conn.peer;
          var blockT = partsT[2] || "";
          var list = [];
          if (blockT) {
            blockT.split(";").forEach(function(tok) {
              if (!tok) {
                return;
              }
              var f2 = tok.split("|");
              var cfg = { panelId: P.decodeFreeText(f2[0] || ""), colour: P.decodeFreeText(f2[1] || ""), controls: [] };
              for (var i = 2; i < 8; i++) {
                cfg.controls.push(P.decodeFreeText(f2[i] || ""));
              }
              list.push(cfg);
            });
          }
          if (fromId) {
            manager.remoteTankConfigs[fromId] = list;
            if (fromId === manager.id) {
              manager.localTankConfigs = list;
            }
          }
          if (manager.isHost) {
            manager.broadcast(data, conn);
          }
        } catch (e) {
        }
        return;
      }
    }
  };

  // js/networking/binary_protocol.js
  var api = {};
  api.BIN_TYPE = {
    INPUT: 1,
    PING: 2,
    PONG: 3,
    PLAYERS: 16,
    NICK: 17,
    CHAT: 18,
    NOTIFY: 19,
    PWR: 20,
    SPAWN: 21,
    INIT: 32,
    DELTA: 33
  };
  api.utf8Encode = function(str) {
    str = "" + (str == null ? "" : str);
    var out = new Uint8Array(str.length * 4);
    var o = 0;
    for (var i = 0; i < str.length; i++) {
      var code = str.charCodeAt(i);
      if (code < 128) {
        out[o++] = code;
      } else if (code < 2048) {
        out[o++] = 192 | code >> 6;
        out[o++] = 128 | code & 63;
      } else if (code < 65536) {
        out[o++] = 224 | code >> 12;
        out[o++] = 128 | code >> 6 & 63;
        out[o++] = 128 | code & 63;
      } else {
        out[o++] = 240 | code >> 18;
        out[o++] = 128 | code >> 12 & 63;
        out[o++] = 128 | code >> 6 & 63;
        out[o++] = 128 | code & 63;
      }
    }
    return out.slice(0, o);
  };
  api.utf8Decode = function(bytes) {
    var b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
    var out = "";
    for (var i = 0; i < b.length; i++) {
      var c = b[i];
      if (c < 128) {
        out += String.fromCharCode(c);
      } else if ((c & 224) === 192) {
        var c2 = b[++i];
        out += String.fromCharCode((c & 31) << 6 | c2 & 63);
      } else if ((c & 240) === 224) {
        var c2a = b[++i], c3 = b[++i];
        out += String.fromCharCode((c & 15) << 12 | (c2a & 63) << 6 | c3 & 63);
      } else {
        var c2b = b[++i], c3b = b[++i], c4 = b[++i];
        var cp = (c & 7) << 18 | (c2b & 63) << 12 | (c3b & 63) << 6 | c4 & 63;
        cp -= 65536;
        out += String.fromCharCode(55296 + (cp >> 10), 56320 + (cp & 1023));
      }
    }
    return out;
  };
  function W() {
    this._a = [];
  }
  W.prototype.writeU8 = function(v) {
    this._a.push((v & 255) >>> 0);
  };
  W.prototype.writeU16 = function(v) {
    v >>>= 0;
    this._a.push(v & 255, v >>> 8 & 255);
  };
  W.prototype.writeU32 = function(v) {
    v >>>= 0;
    this._a.push(v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24 & 255);
  };
  W.prototype.writeF32 = function(f) {
    var buf = new ArrayBuffer(4);
    new DataView(buf).setFloat32(0, +f || 0, true);
    var b = new Uint8Array(buf);
    for (var i = 0; i < 4; i++) {
      this._a.push(b[i]);
    }
  };
  W.prototype.writeBytes = function(bytes) {
    var b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
    for (var i = 0; i < b.length; i++) {
      this._a.push(b[i]);
    }
  };
  W.prototype.writeStr8 = function(str) {
    var b = api.utf8Encode(str || "");
    var len = Math.min(255, b.length);
    this.writeU8(len);
    for (var i = 0; i < len; i++) {
      this._a.push(b[i]);
    }
  };
  W.prototype.writeStr16 = function(str) {
    var b = api.utf8Encode(str || "");
    var len = Math.min(65535, b.length);
    this.writeU16(len);
    for (var i = 0; i < len; i++) {
      this._a.push(b[i]);
    }
  };
  W.prototype.toBuffer = function() {
    var u = new Uint8Array(this._a.length);
    for (var i = 0; i < u.length; i++) {
      u[i] = this._a[i];
    }
    return u.buffer;
  };
  api.ByteWriter = W;
  api.buildInput = function(state) {
    var idBytes = api.utf8Encode(state.tankId || "");
    var flags = (state.upPressed ? 1 : 0) | (state.rightPressed ? 1 : 0) << 1 | (state.downPressed ? 1 : 0) << 2 | (state.leftPressed ? 1 : 0) << 3 | (state.shooting ? 1 : 0) << 4 | (state.specialKeyPressed ? 1 : 0) << 5;
    var len = Math.min(255, idBytes.length);
    var buf = new Uint8Array(3 + len);
    buf[0] = api.BIN_TYPE.INPUT;
    buf[1] = len;
    for (var i = 0; i < len; i++) {
      buf[2 + i] = idBytes[i];
    }
    buf[2 + len] = flags & 63;
    return buf.buffer;
  };
  api.buildPing = function(ts) {
    var buf = new ArrayBuffer(5);
    var dv = new DataView(buf);
    dv.setUint8(0, api.BIN_TYPE.PING);
    dv.setUint32(1, ts >>> 0);
    return buf;
  };
  api.buildPong = function(ts) {
    var buf = new ArrayBuffer(5);
    var dv = new DataView(buf);
    dv.setUint8(0, api.BIN_TYPE.PONG);
    dv.setUint32(1, ts >>> 0);
    return buf;
  };
  api.buildPlayerList = function(players) {
    var w = new W();
    w.writeU8(api.BIN_TYPE.PLAYERS);
    var list = Array.isArray(players) ? players : [];
    var n = Math.min(255, list.length);
    w.writeU8(n);
    for (var i = 0; i < n; i++) {
      var p = list[i] || {};
      w.writeStr8(p.id || "");
      w.writeStr8(p.nickname || "Player");
    }
    return w.toBuffer();
  };
  api.buildNickname = function(peerId, nickname) {
    var w = new W();
    w.writeU8(api.BIN_TYPE.NICK);
    w.writeStr8(peerId || "");
    w.writeStr8(nickname || "");
    return w.toBuffer();
  };
  api.buildChat = function(nickname, text) {
    var w = new W();
    w.writeU8(api.BIN_TYPE.CHAT);
    w.writeStr8(nickname || "");
    w.writeStr16(text || "");
    return w.toBuffer();
  };
  api.buildNotify = function(text) {
    var w = new W();
    w.writeU8(api.BIN_TYPE.NOTIFY);
    w.writeStr16(text || "");
    return w.toBuffer();
  };
  api.buildPowerupEventFromString = function(str) {
    var parts = (str || "").split(",");
    if (parts[0] !== "X") return null;
    var w = new W();
    w.writeU8(api.BIN_TYPE.PWR);
    w.writeStr8(parts[1] || "");
    w.writeStr8(parts[2] || "");
    w.writeStr8(parts[3] || "");
    w.writeStr8(parts[4] || "");
    var id = parseInt(parts[5] || "0", 10) || 0;
    w.writeU16(id);
    return w.toBuffer();
  };
  api.buildSpawnFromString = function(str) {
    if (typeof str !== "string" || str[0] !== "S") return null;
    var block = str.substring(2) || "";
    var f = block.split("|");
    var toInt = function(v) {
      var n = parseInt(v, 10);
      return isNaN(n) ? 0 : n;
    };
    var w = new W();
    w.writeU8(api.BIN_TYPE.SPAWN);
    w.writeStr8(f[0] || "");
    w.writeU16(toInt(f[1] || 0));
    w.writeU16(toInt(f[2] || 0));
    w.writeU16(toInt(f[3] || 0));
    w.writeU16(toInt(f[4] || 0));
    w.writeU16(toInt(f[5] || 0));
    w.writeStr8(f[6] || "");
    w.writeStr8(f[7] || "");
    return w.toBuffer();
  };
  api.buildInitFromString = function(str) {
    var parts = (str || "").split(",");
    if (parts[0] !== "I") return null;
    var toInt = function(v) {
      var n = parseInt(v, 10);
      return isNaN(n) ? 0 : n;
    };
    var toNum = function(v) {
      var n = parseFloat(v);
      return isNaN(n) ? 0 : n;
    };
    var w = new W();
    w.writeU8(api.BIN_TYPE.INIT);
    var rows = toInt(parts[1]), cols = toInt(parts[2]), wall = toInt(parts[3]);
    var mv = toNum(parts[4]), rv = toNum(parts[5]), bv = toNum(parts[6]);
    var bl = toInt(parts[7]), bo = toInt(parts[8]);
    var pi = toNum(parts[9]), pl = toInt(parts[10]), pd = toNum(parts[11]);
    var ff = parts[12] === "1" ? 1 : 0;
    w.writeU16(rows);
    w.writeU16(cols);
    w.writeU16(wall);
    w.writeF32(mv);
    w.writeF32(rv);
    w.writeF32(bv);
    w.writeU16(bl);
    w.writeU16(bo);
    w.writeF32(pi);
    w.writeU16(pl);
    w.writeF32(pd);
    w.writeU8(ff);
    w.writeStr16(parts[13] || "");
    var pBlock = parts[14] || "";
    var pList = pBlock ? pBlock.split(";").filter(Boolean) : [];
    var pc = Math.min(65535, pList.length);
    w.writeU16(pc);
    for (var i = 0; i < pc; i++) {
      var f = pList[i].split("|");
      w.writeU16(toInt(f[0] || 0));
      w.writeU16(toInt(f[1] || 0));
      w.writeU16(toInt(f[2] || 0));
      w.writeU16(toInt(f[3] || 0));
      w.writeStr8(f[4] || "");
      w.writeStr8(f[5] || "");
    }
    var tBlock = parts[15] || "";
    var tList = tBlock ? tBlock.split(";").filter(Boolean) : [];
    var tc = Math.min(65535, tList.length);
    w.writeU16(tc);
    for (var j = 0; j < tc; j++) {
      var tf = tList[j].split("|");
      w.writeStr8(tf[0] || "");
      w.writeU16(toInt(tf[1] || 0));
      w.writeU16(toInt(tf[2] || 0));
      w.writeF32(toNum(tf[3] || 0));
      w.writeU16(toInt(tf[4] || 0));
      w.writeU16(toInt(tf[5] || 0));
      w.writeStr8(tf[6] || "");
      w.writeU16(toInt(tf[7] || 0));
    }
    return w.toBuffer();
  };
  api.buildDeltaFromString = function(str) {
    var parts = (str || "").split(",");
    if (parts[0] !== "D") return null;
    var toInt = function(v) {
      var n = parseInt(v, 10);
      return isNaN(n) ? 0 : n;
    };
    var toNum = function(v) {
      var n = parseFloat(v);
      return isNaN(n) ? 0 : n;
    };
    var w = new W();
    w.writeU8(api.BIN_TYPE.DELTA);
    var idx = parts.length >= 6 ? 2 : 1;
    w.writeU32(0);
    var tBlock = parts[idx] || "";
    var tList = tBlock ? tBlock.split(";").filter(Boolean) : [];
    var tc = Math.min(65535, tList.length);
    w.writeU16(tc);
    for (var i = 0; i < tc; i++) {
      var f = tList[i].split("|");
      w.writeStr8(f[0] || "");
      w.writeU16(toInt(f[1] || 0));
      w.writeU16(toInt(f[2] || 0));
      w.writeF32(toNum(f[3] || 0));
      w.writeU16(toInt(f[4] || 0));
      w.writeU8(toInt(f[5] || 1));
    }
    var bBlock = parts[idx + 1] || "";
    var bList = bBlock ? bBlock.split(";").filter(Boolean) : [];
    var bc = Math.min(65535, bList.length);
    w.writeU16(bc);
    for (var j = 0; j < bc; j++) {
      var bf = bList[j].split("|");
      w.writeU16(toInt(bf[0] || 0));
      w.writeU16(toInt(bf[1] || 0));
      w.writeF32(toNum(bf[2] || 0));
      w.writeF32(toNum(bf[3] || 0));
      w.writeStr8(bf[4] || "");
      w.writeU8(toInt(bf[5] || 1));
    }
    var pBlock = parts[idx + 2] || "";
    var pList = pBlock ? pBlock.split(";").filter(Boolean) : [];
    var pc = Math.min(65535, pList.length);
    w.writeU16(pc);
    for (var k = 0; k < pc; k++) {
      var pf = pList[k].split("|");
      w.writeU16(toInt(pf[0] || 0));
      w.writeU16(toInt(pf[1] || 0));
      w.writeU16(toInt(pf[2] || 0));
      w.writeU16(toInt(pf[3] || 0));
      w.writeStr8(pf[4] || "");
      w.writeStr8(pf[5] || "");
    }
    var eBlock = parts[idx + 3] || "";
    var eList = eBlock ? eBlock.split(";").filter(Boolean) : [];
    var ec = Math.min(65535, eList.length);
    w.writeU16(ec);
    for (var m = 0; m < ec; m++) {
      var ef = eList[m].split("|");
      w.writeStr8(ef[0] || "");
      w.writeStr8(ef[1] || "");
      w.writeStr8(ef[2] || "");
      w.writeStr8(ef[3] || "");
    }
    return w.toBuffer();
  };
  api.hydrate = function(data, manager, conn) {
    try {
      if (typeof data === "string") {
        return data;
      }
      if (typeof Blob !== "undefined" && data instanceof Blob && data.arrayBuffer) {
        data.arrayBuffer().then(function(buf) {
          try {
            netProtocol && netProtocol.handlePeerMessage && netProtocol.handlePeerMessage(manager, buf, conn);
          } catch (_) {
          }
        });
        return null;
      }
      var bytes = null;
      if (data && data.byteLength != null && !(data instanceof ArrayBuffer)) {
        bytes = new Uint8Array(data);
      } else if (data instanceof ArrayBuffer) {
        bytes = new Uint8Array(data);
      }
      if (!bytes || bytes.length === 0) {
        return data;
      }
      var type = bytes[0];
      var bt = api.BIN_TYPE;
      switch (type) {
        case bt.INPUT: {
          var len = bytes[1] || 0;
          var idBytes = bytes.slice(2, 2 + len);
          var tankId = api.utf8Decode(idBytes);
          var flags = bytes[2 + len] || 0;
          var f = function(bit) {
            return flags >> bit & 1 ? "1" : "0";
          };
          return ["C", tankId, f(0), f(1), f(2), f(3), f(4), f(5)].join(",");
        }
        case bt.PING: {
          var dv1 = new DataView(bytes.buffer, bytes.byteOffset || 0, bytes.byteLength);
          var ts1 = dv1.getUint32(1);
          return "Q," + ts1;
        }
        case bt.PONG: {
          var dv2 = new DataView(bytes.buffer, bytes.byteOffset || 0, bytes.byteLength);
          var ts2 = dv2.getUint32(1);
          return "q," + ts2;
        }
        case bt.PLAYERS: {
          var o = 1, n = bytes[o++] || 0, parts = [];
          for (var i = 0; i < n; i++) {
            var lid = bytes[o++] || 0;
            var id = api.utf8Decode(bytes.slice(o, o + lid));
            o += lid;
            var lnn = bytes[o++] || 0;
            var nn = api.utf8Decode(bytes.slice(o, o + lnn));
            o += lnn;
            parts.push(id + "|" + (netProtocol && netProtocol.encodeFreeText ? netProtocol.encodeFreeText(nn) : nn));
          }
          return "P," + parts.join(";");
        }
        case bt.NICK: {
          var o1 = 1;
          var rl8 = function() {
            return bytes[o1++];
          };
          var rStr8 = function() {
            var l = rl8();
            var s2 = api.utf8Decode(bytes.slice(o1, o1 + l));
            o1 += l;
            return s2;
          };
          var id1 = rStr8();
          var nn1 = rStr8();
          var e = netProtocol && netProtocol.encodeFreeText ? netProtocol.encodeFreeText : function(x7) {
            return x7;
          };
          return "N," + id1 + "," + e(nn1);
        }
        case bt.CHAT: {
          var o2 = 1;
          var rU8 = function() {
            return bytes[o2++];
          };
          var rU16 = function() {
            var v = bytes[o2] | bytes[o2 + 1] << 8;
            o2 += 2;
            return v >>> 0;
          };
          var rStr8 = function() {
            var l = rU8();
            var s2 = api.utf8Decode(bytes.slice(o2, o2 + l));
            o2 += l;
            return s2;
          };
          var rStr16 = function() {
            var l = rU16();
            var s2 = api.utf8Decode(bytes.slice(o2, o2 + l));
            o2 += l;
            return s2;
          };
          var nick = rStr8();
          var text = rStr16();
          var eF = netProtocol && netProtocol.encodeFreeText ? netProtocol.encodeFreeText : function(x7) {
            return x7;
          };
          return "M," + eF(nick) + "," + eF(text);
        }
        case bt.NOTIFY: {
          var o3 = 1;
          var rU16b = function() {
            var v = bytes[o3] | bytes[o3 + 1] << 8;
            o3 += 2;
            return v >>> 0;
          };
          var rStr16b = function() {
            var l = rU16b();
            var s2 = api.utf8Decode(bytes.slice(o3, o3 + l));
            o3 += l;
            return s2;
          };
          var text2 = rStr16b();
          var eF2 = netProtocol && netProtocol.encodeFreeText ? netProtocol.encodeFreeText : function(x7) {
            return x7;
          };
          return "E," + eF2(text2);
        }
        case bt.PWR: {
          var o4 = 1;
          var rU8b = function() {
            return bytes[o4++];
          };
          var rU16c = function() {
            var v = bytes[o4] | bytes[o4 + 1] << 8;
            o4 += 2;
            return v >>> 0;
          };
          var rStr8b = function() {
            var l = rU8b();
            var s2 = api.utf8Decode(bytes.slice(o4, o4 + l));
            o4 += l;
            return s2;
          };
          var p = rStr8b(), s1 = rStr8b(), t = rStr8b(), id2 = rStr8b();
          var pid = rU16c();
          return ["X", p, s1, t, id2, pid].join(",");
        }
        case bt.SPAWN: {
          var o5 = 1;
          var rU8c = function() {
            return bytes[o5++];
          };
          var rU16d = function() {
            var v = bytes[o5] | bytes[o5 + 1] << 8;
            o5 += 2;
            return v >>> 0;
          };
          var rStr8c = function() {
            var l = rU8c();
            var s2 = api.utf8Decode(bytes.slice(o5, o5 + l));
            o5 += l;
            return s2;
          };
          var type = rStr8c();
          var id3 = rU16d();
          var x = rU16d(), y = rU16d(), w = rU16d(), h = rU16d();
          var sid = rStr8c(), col = rStr8c();
          return "S," + [type, id3, x, y, w, h, sid, col].join("|");
        }
        case bt.INIT: {
          var o6 = 1;
          var rU16e = function() {
            var v = bytes[o6] | bytes[o6 + 1] << 8;
            o6 += 2;
            return v >>> 0;
          };
          var rU8d = function() {
            return bytes[o6++];
          };
          var rF32 = function() {
            var dv3 = new DataView(bytes.buffer, (bytes.byteOffset || 0) + o6, 4);
            var f2 = dv3.getFloat32(0, true);
            o6 += 4;
            return f2;
          };
          var rStr8d = function() {
            var l = rU8d();
            var s2 = api.utf8Decode(bytes.slice(o6, o6 + l));
            o6 += l;
            return s2;
          };
          var rStr16d = function() {
            var l = rU16e();
            var s2 = api.utf8Decode(bytes.slice(o6, o6 + l));
            o6 += l;
            return s2;
          };
          var rows = rU16e(), cols = rU16e(), wall = rU16e();
          var mv = rF32(), rv = rF32(), bv = rF32();
          var bl = rU16e(), bo = rU16e();
          var pi = rF32(), pl = rU16e(), pd = rF32();
          var ff = rU8d();
          var layout = rStr16d();
          var pc = rU16e();
          var pParts = [];
          for (var pi2 = 0; pi2 < pc; pi2++) {
            var x2 = rU16e(), y2 = rU16e(), w2 = rU16e(), h2 = rU16e();
            var sid2 = rStr8d(), col2 = rStr8d();
            pParts.push([x2, y2, w2, h2, sid2, col2].join("|"));
          }
          var tc = rU16e();
          var tParts = [];
          for (var ti = 0; ti < tc; ti++) {
            var idt = rStr8d();
            var x3 = rU16e(), y3 = rU16e();
            var rot = rF32();
            var w3 = rU16e(), h3 = rU16e();
            var col3 = rStr8d();
            var score = rU16e();
            tParts.push([idt, x3, y3, rot, w3, h3, col3, score].join("|"));
          }
          return ["I", rows, cols, wall, mv, rv, bv, bl, bo, pi, pl, pd, ff ? 1 : 0, layout, pParts.join(";"), tParts.join(";")].join(",");
        }
        case bt.DELTA: {
          var o7 = 1;
          var rU16f = function() {
            var v = bytes[o7] | bytes[o7 + 1] << 8;
            o7 += 2;
            return v >>> 0;
          };
          var rU8e = function() {
            return bytes[o7++];
          };
          var rU32 = function() {
            var dv4 = new DataView(bytes.buffer, (bytes.byteOffset || 0) + o7, 4);
            var v = dv4.getUint32(0, true);
            o7 += 4;
            return v >>> 0;
          };
          var rF32b = function() {
            var dv5 = new DataView(bytes.buffer, (bytes.byteOffset || 0) + o7, 4);
            var f2 = dv5.getFloat32(0, true);
            o7 += 4;
            return f2;
          };
          var rStr8e = function() {
            var l = rU8e();
            var s2 = api.utf8Decode(bytes.slice(o7, o7 + l));
            o7 += l;
            return s2;
          };
          rU32();
          var tc2 = rU16f();
          var tParts2 = [];
          for (var ti2 = 0; ti2 < tc2; ti2++) {
            var id4 = rStr8e();
            var x4 = rU16f(), y4 = rU16f();
            var rot2 = rF32b();
            var score2 = rU16f();
            var alive = rU8e();
            tParts2.push([id4, x4, y4, rot2, score2, alive].join("|"));
          }
          var bc = rU16f();
          var bParts = [];
          for (var bi = 0; bi < bc; bi++) {
            var x5 = rU16f(), y5 = rU16f();
            var vx = rF32b(), vy = rF32b();
            var col4 = rStr8e();
            var rad = rU8e();
            bParts.push([x5, y5, vx, vy, col4, rad].join("|"));
          }
          var pc2 = rU16f();
          var pParts2 = [];
          for (var pj = 0; pj < pc2; pj++) {
            var x6 = rU16f(), y6 = rU16f(), w4 = rU16f(), h4 = rU16f();
            var sid3 = rStr8e(), col5 = rStr8e();
            pParts2.push([x6, y6, w4, h4, sid3, col5].join("|"));
          }
          var ec = rU16f();
          var eParts = [];
          for (var ei = 0; ei < ec; ei++) {
            var p = rStr8e(), s = rStr8e(), t = rStr8e(), id5 = rStr8e();
            eParts.push([p, s, t, id5].join("|"));
          }
          return ["D", tParts2.join(";"), bParts.join(";"), pParts2.join(";"), eParts.join(";")].join(",");
        }
      }
    } catch (_) {
    }
    return data;
  };
  var netBinary = api;

  // js/networking/peer_manager.js
  var PeerManager = class {
    constructor() {
      this.remoteTankConfigs = {};
      this.localTankConfigs = [];
      this.game = null;
      this.reset();
      this._stats = {
        sentBytes: 0,
        sentMessages: 0,
        recvBytes: 0,
        recvMessages: 0,
        sentPerSec: 0,
        recvPerSec: 0,
        bytesSentPerSec: 0,
        bytesRecvPerSec: 0,
        rttMs: null
      };
      this._lastStatsSnapshot = { sentBytes: 0, recvBytes: 0, sentMessages: 0, recvMessages: 0 };
      this._statsTimer = null;
      this._pingTimer = null;
    }
    reset() {
      if (this.peer) {
        try {
          this.peer.destroy();
        } catch (err) {
        }
      }
      this.peer = null;
      this.connections = [];
      this.nickname = "";
      this.players = /* @__PURE__ */ new Map();
      this.isHost = false;
      this.id = null;
      this.roomName = "";
      this.readyNotified = false;
      this.lastStartPayload = null;
      this.remoteTankConfigs = {};
      if (this.isHost) {
        this.remoteTankConfigs[this.id || "host"] = this.localTankConfigs || [];
      }
      this.stopInstrumentation();
    }
    hostRoom(roomName, nickname) {
      if (!window.Peer) {
        eventHub.emit("network-status", "PeerJS library not available.");
        return;
      }
      roomName = sanitize(roomName);
      nickname = sanitize(nickname) || "Commander";
      if (!roomName) {
        eventHub.emit("network-status", "Please provide a room name to host.");
        return;
      }
      this.reset();
      this.isHost = true;
      this.roomName = roomName;
      this.nickname = nickname;
      this.peer = new Peer(roomName);
      this.peer.on("connection", (conn) => {
        this.setupConnection(conn);
      });
      this.peer.on("open", (id) => {
        this.id = id;
        this.players.set(id, this.nickname);
        eventHub.emit("network-status", 'Hosting room "' + roomName + '". ');
        eventHub.emit("network-ready", { role: "host", roomId: id });
        this.readyNotified = true;
        this.emitPlayerList();
        addChatMessage('You are hosting the room as "' + this.nickname + '".', "notification-message");
        this.startInstrumentation();
      });
      this.peer.on("error", (err) => {
        eventHub.emit("network-status", "Error hosting room: " + (err && err.type ? err.type : "unknown"));
        if (err && (err.type === "unavailable-id" || /taken/i.test(err.message || ""))) {
          eventHub.emit("network-status", "Room name already taken. Ask friends for the room code to join.");
        } else {
          addChatMessage("* Host error: " + (err && err.type ? err.type : "unknown"), "notification-message");
        }
      });
    }
    joinRoom(roomName, nickname) {
      if (!window.Peer) {
        eventHub.emit("network-status", "PeerJS library not available.");
        return;
      }
      roomName = sanitize(roomName);
      nickname = sanitize(nickname) || randomCallsign();
      if (!roomName) {
        eventHub.emit("network-status", "Please enter a room name or ID to join.");
        return;
      }
      this.reset();
      this.isHost = false;
      this.roomName = roomName;
      this.nickname = nickname;
      this.peer = new Peer();
      this.peer.on("open", (id) => {
        this.id = id;
        this.players.set(id, this.nickname);
        eventHub.emit("network-status", 'Attempting to join room "' + roomName + '"...');
        this.emitPlayerList();
        const conn = this.peer.connect(roomName);
        conn.on("error", (err) => {
          eventHub.emit("network-status", "Connection error: " + (err && err.type ? err.type : "unknown"));
        });
        this.setupConnection(conn);
      });
      this.peer.on("error", (err) => {
        eventHub.emit("network-status", "Error joining room: " + (err && err.type ? err.type : "unknown"));
      });
    }
    setupConnection(conn) {
      if (!conn || conn._handled) {
        return;
      }
      conn._handled = true;
      this.connections.push(conn);
      conn.on("data", (data) => {
        try {
          var size = 0;
          if (typeof data === "string") {
            size = data.length;
          } else if (data && data.byteLength) {
            size = data.byteLength;
          }
          this._stats.recvBytes += size;
          this._stats.recvMessages += 1;
        } catch (_) {
        }
        if (netProtocol && typeof netProtocol.handlePeerMessage === "function") {
          netProtocol.handlePeerMessage(this, data, conn);
        }
      });
      conn.on("close", () => {
        this.connections = this.connections.filter((c) => c !== conn);
        const removedName = this.players.get(conn.peer);
        this.players.delete(conn.peer);
        if (this.remoteTankConfigs) {
          delete this.remoteTankConfigs[conn.peer];
        }
        this.broadcastPlayerList();
        if (removedName) {
          addChatMessage("* " + removedName + " disconnected.", "notification-message");
          if (this.isHost) {
            this.sendNotification(removedName + " left the room.");
          }
        }
      });
      conn.on("error", (err) => {
        eventHub.emit("network-status", "Connection error with " + conn.peer);
      });
      conn.on("open", () => {
        if (!this.isHost) {
          eventHub.emit("network-status", 'Connected to host "' + conn.peer + '".');
          eventHub.emit("network-ready", { role: "guest", roomId: this.roomName });
          addChatMessage('You joined room "' + this.roomName + '" as "' + this.nickname + '".', "notification-message");
          this.startInstrumentation();
        }
        try {
          conn.send(netBinary.buildNickname(this.id, this.nickname));
        } catch (e) {
          try {
            conn.send(["N", this.id, netProtocol.encodeFreeText(this.nickname)].join(","));
          } catch (_) {
          }
        }
        if (this.isHost) {
          this.sendPlayerListTo(conn);
          this.broadcastPlayerList();
          if (this.game && this.game.main_object && typeof this.game.main_object.getCachedSnapshot === "function") {
            if (this.game && this.game.maze && typeof this.game.maze.serializeInitString === "function") {
              try {
                var istr = this.game.maze.serializeInitString();
                var ib = null;
                try {
                  ib = netBinary.buildInitFromString(istr);
                } catch (_) {
                  ib = null;
                }
                if (ib) {
                  conn.send(ib);
                } else {
                  conn.send(istr);
                }
              } catch (e) {
              }
            }
            try {
              if (this.game && this.game.maze && typeof this.game.maze.serializeUnifiedSnapshot === "function") {
                var jsnap = this.game.maze.serializeUnifiedSnapshot();
                conn.send("U," + jsnap);
              }
            } catch (_) {
            }
          }
        }
      });
    }
    broadcast(message, excludeConn) {
      let outMsg = message;
      try {
        if (typeof message === "string" && message.length) {
          const k = message[0];
          if (k === "I") {
            const binI = netBinary.buildInitFromString(message);
            if (binI) {
              outMsg = binI;
            }
          } else if (k === "D") {
            const binD = netBinary.buildDeltaFromString(message);
            if (binD) {
              outMsg = binD;
            }
          } else if (k === "P") {
            outMsg = netBinary.buildPlayerList(this.getPlayerListPayload());
          } else if (k === "M") {
            const parts = message.split(",");
            const nick = netProtocol.decodeFreeText(parts[1] || "");
            const text = netProtocol.decodeFreeText(parts.slice(2).join(","));
            outMsg = netBinary.buildChat(nick, text);
          } else if (k === "E") {
            const text = netProtocol.decodeFreeText(message.substring(2));
            outMsg = netBinary.buildNotify(text);
          } else if (k === "X") {
            const binX = netBinary.buildPowerupEventFromString(message);
            if (binX) {
              outMsg = binX;
            }
          } else if (k === "S") {
            const binS = netBinary.buildSpawnFromString(message);
            if (binS) {
              outMsg = binS;
            }
          } else if (k === "N") {
            const parts = message.split(",");
            const pid = parts[1] || "";
            const nick = netProtocol.decodeFreeText(parts[2] || "");
            outMsg = netBinary.buildNickname(pid, nick);
          }
        }
      } catch (_) {
      }
      this.connections.forEach((conn) => {
        if (conn.open && conn !== excludeConn) {
          try {
            conn.send(outMsg);
            try {
              var size = 0;
              if (typeof outMsg === "string") {
                size = outMsg.length;
              } else if (outMsg && outMsg.byteLength) {
                size = outMsg.byteLength;
              }
              this._stats.sentBytes += size;
              this._stats.sentMessages += 1;
            } catch (_) {
            }
          } catch (err) {
          }
        }
      });
    }
    broadcastPlayerList() {
      try {
        this.broadcast(netBinary.buildPlayerList(this.getPlayerListPayload()));
      } catch (e) {
        try {
          this.broadcast(netProtocol.buildCompactPlayerList(this.getPlayerListPayload()));
        } catch (_) {
        }
      }
      this.emitPlayerList();
    }
    sendPlayerListTo(conn) {
      if (!conn || !conn.open) {
        return;
      }
      try {
        conn.send(netBinary.buildPlayerList(this.getPlayerListPayload()));
      } catch (e) {
        try {
          conn.send(netProtocol.buildCompactPlayerList(this.getPlayerListPayload()));
        } catch (_) {
        }
      }
    }
    emitPlayerList() {
      eventHub.emit("network-player-list", this.getPlayerListPayload());
      if (!this.isHost) {
        this.maybeEmitReady("player-list");
      }
    }
    getPlayerListPayload() {
      const list = [];
      this.players.forEach((name, id) => {
        list.push({ id, nickname: name });
      });
      return list;
    }
    sendTankConfig(configs) {
      this.localTankConfigs = configs || [];
      if (!this.peer) {
        return;
      }
      const peerId = this.id || "pending";
      if (this.isHost) {
        this.remoteTankConfigs[peerId] = this.localTankConfigs;
      }
      try {
        const blocks = (this.localTankConfigs || []).map((cfg) => {
          const pid = netProtocol.encodeFreeText(cfg.panelId || "");
          const col = netProtocol.encodeFreeText(cfg.colour || "");
          const cs = (cfg.controls || []).slice(0, 6).map(netProtocol.encodeFreeText);
          while (cs.length < 6) {
            cs.push("");
          }
          return [pid, col].concat(cs).join("|");
        }).join(";");
        const msg = ["T", peerId, blocks].join(",");
        this.broadcast(msg);
      } catch (e) {
      }
    }
    sendInputState(state) {
      if (!state || !state.tankId) {
        return;
      }
      state.peerId = this.id;
      if (this.isHost) {
        this.applyInputState(state);
        return;
      }
      try {
        this.broadcast(netBinary.buildInput(state));
      } catch (e) {
        var flags = function(v) {
          return v ? 1 : 0;
        };
        var compact = ["C", state.tankId, flags(state.upPressed), flags(state.rightPressed), flags(state.downPressed), flags(state.leftPressed), flags(state.shooting), flags(state.specialKeyPressed)].join(",");
        this.broadcast(compact);
      }
    }
    updatePlayersFromPayload(players) {
      this.players = /* @__PURE__ */ new Map();
      if (Array.isArray(players)) {
        for (let i = 0; i < players.length; i++) {
          const entry = players[i];
          if (entry && entry.id) {
            this.players.set(entry.id, entry.nickname || "Player");
          }
        }
      }
      if (this.id && !this.players.has(this.id)) {
        this.players.set(this.id, this.nickname);
      }
      this.emitPlayerList();
    }
    applyInputState(state) {
      if (!state) {
        return;
      }
      if (this.isHost) {
        this.remoteTankConfigs = this.remoteTankConfigs || {};
        if (state.peerId && !this.remoteTankConfigs[state.peerId]) {
          this.remoteTankConfigs[state.peerId] = [];
        }
      }
      if (this.game && this.game.main_object && typeof this.game.main_object.applyInputState === "function") {
        this.game.main_object.applyInputState(state);
      }
    }
    addPlayer(id, nickname) {
      if (!id) {
        return;
      }
      this.players.set(id, nickname || "Player");
      this.broadcastPlayerList();
    }
    sendChatMessage(message) {
      const nickSafe = netProtocol.encodeFreeText(this.nickname);
      const textSafe = netProtocol.encodeFreeText(message);
      this.broadcast(["M", nickSafe, textSafe].join(","));
    }
    sendNotification(text) {
      addChatMessage("* " + text, "notification-message");
      const textSafe = netProtocol.encodeFreeText(text);
      this.broadcast(["E", textSafe].join(","));
    }
    getNickname() {
      return this.nickname;
    }
    maybeEmitReady(reason) {
      if (this.readyNotified) {
        return;
      }
      this.readyNotified = true;
      eventHub.emit("network-ready", { role: this.isHost ? "host" : "guest", roomId: this.isHost ? this.id : this.roomName });
    }
    // --- instrumentation ---
    startInstrumentation() {
      this.stopInstrumentation();
      this._statsTimer = setInterval(() => {
        const sb = this._stats.sentBytes - this._lastStatsSnapshot.sentBytes;
        const rb = this._stats.recvBytes - this._lastStatsSnapshot.recvBytes;
        const sm = this._stats.sentMessages - this._lastStatsSnapshot.sentMessages;
        const rm = this._stats.recvMessages - this._lastStatsSnapshot.recvMessages;
        this._lastStatsSnapshot = {
          sentBytes: this._stats.sentBytes,
          recvBytes: this._stats.recvBytes,
          sentMessages: this._stats.sentMessages,
          recvMessages: this._stats.recvMessages
        };
        this._stats.bytesSentPerSec = sb;
        this._stats.bytesRecvPerSec = rb;
        this._stats.sentPerSec = sm;
        this._stats.recvPerSec = rm;
        eventHub.emit("network-stats", Object.assign({}, this._stats));
      }, 1e3);
      if (!this.isHost) {
        this._pingTimer = setInterval(() => {
          const ts = Math.floor(performance.now());
          try {
            this.broadcast(netBinary.buildPing(ts));
          } catch (_) {
          }
        }, 2e3);
      }
    }
    stopInstrumentation() {
      if (this._statsTimer) {
        clearInterval(this._statsTimer);
        this._statsTimer = null;
      }
      if (this._pingTimer) {
        clearInterval(this._pingTimer);
        this._pingTimer = null;
      }
      if (this._stats) {
        this._stats.rttMs = null;
        this._stats.sentBytes = 0;
        this._stats.recvBytes = 0;
        this._stats.sentMessages = 0;
        this._stats.recvMessages = 0;
        this._stats.bytesSentPerSec = 0;
        this._stats.bytesRecvPerSec = 0;
        this._stats.sentPerSec = 0;
        this._stats.recvPerSec = 0;
      }
      this._lastStatsSnapshot = { sentBytes: 0, recvBytes: 0, sentMessages: 0, recvMessages: 0 };
    }
  };
  function sanitize(value) {
    return (value || "").replace(/[^a-zA-Z0-9 _-]/g, "").trim();
  }
  function utf8Encode(str) {
    str = "" + (str == null ? "" : str);
    const out = new Uint8Array(str.length * 4);
    let o = 0;
    for (let i = 0; i < str.length; i++) {
      let code = str.charCodeAt(i);
      if (code < 128) {
        out[o++] = code;
      } else if (code < 2048) {
        out[o++] = 192 | code >> 6;
        out[o++] = 128 | code & 63;
      } else if (code < 65536) {
        out[o++] = 224 | code >> 12;
        out[o++] = 128 | code >> 6 & 63;
        out[o++] = 128 | code & 63;
      } else {
        out[o++] = 240 | code >> 18;
        out[o++] = 128 | code >> 12 & 63;
        out[o++] = 128 | code >> 6 & 63;
        out[o++] = 128 | code & 63;
      }
    }
    return out.slice(0, o);
  }
  function ByteWriter() {
    this._a = [];
  }
  ByteWriter.prototype.writeU8 = function(v) {
    this._a.push((v & 255) >>> 0);
  };
  ByteWriter.prototype.writeU16 = function(v) {
    v >>>= 0;
    this._a.push(v & 255, v >>> 8 & 255);
  };
  ByteWriter.prototype.writeU32 = function(v) {
    v >>>= 0;
    this._a.push(v & 255, v >>> 8 & 255, v >>> 16 & 255, v >>> 24 & 255);
  };
  ByteWriter.prototype.writeF32 = function(f) {
    const buf = new ArrayBuffer(4);
    new DataView(buf).setFloat32(0, +f || 0, true);
    const b = new Uint8Array(buf);
    for (let i = 0; i < 4; i++) {
      this._a.push(b[i]);
    }
  };
  ByteWriter.prototype.writeBytes = function(bytes) {
    const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
    for (let i = 0; i < b.length; i++) {
      this._a.push(b[i]);
    }
  };
  ByteWriter.prototype.writeStr8 = function(str) {
    const b = utf8Encode(str || "");
    const len = Math.min(255, b.length);
    this.writeU8(len);
    for (let i = 0; i < len; i++) {
      this._a.push(b[i]);
    }
  };
  ByteWriter.prototype.writeStr16 = function(str) {
    const b = utf8Encode(str || "");
    const len = Math.min(65535, b.length);
    this.writeU16(len);
    for (let i = 0; i < len; i++) {
      this._a.push(b[i]);
    }
  };
  ByteWriter.prototype.toBuffer = function() {
    const u = new Uint8Array(this._a.length);
    for (let i = 0; i < u.length; i++) {
      u[i] = this._a[i];
    }
    return u.buffer;
  };
  function addChatMessage(message, messageType) {
    var chatMessages = document.getElementById("chat-messages");
    if (!chatMessages) {
      return;
    }
    var messageElement = document.createElement("div");
    messageElement.textContent = message;
    messageElement.className = "chat-message " + (messageType || "notification-message");
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }
  var peerManager = new PeerManager();
  function randomCallsign() {
    const CALLSIGNS = [
      "Scout",
      "Ranger",
      "Vanguard",
      "Maverick",
      "Falcon",
      "Viper",
      "Nomad",
      "Ghost",
      "Reaper",
      "Sentinel",
      "Hunter",
      "Bravo",
      "Delta",
      "Echo",
      "Foxtrot",
      "Saber",
      "Specter",
      "Havoc",
      "Phoenix",
      "Spartan",
      "Titan",
      "Bulldog",
      "Badger",
      "Wolverine",
      "Gunner",
      "Hammer",
      "Raptor",
      "Hawk",
      "Comet",
      "Meteor",
      "Blaze",
      "Gladius",
      "Aegis",
      "Paladin",
      "Corsair",
      "Dragoon",
      "Lancer",
      "Outrider",
      "Pathfinder",
      "Overwatch",
      "Warhorse",
      "Longbow",
      "Blackjack",
      "Wildcat",
      "Cougar",
      "Kodiak",
      "Patriot",
      "Valkyrie",
      "Legion",
      "Arcadian",
      "Buckeye",
      "Guardian",
      "Centurion",
      "Warlock",
      "Sentury",
      "Bastion",
      "Onyx",
      "Cinder",
      "Inferno",
      "Grizzly",
      "Ajax",
      "Atlas",
      "Bishop",
      "Crosshair",
      "Diesel",
      "Fury",
      "Goliath",
      "Hurricane",
      "Iceman",
      "Jaguar",
      "Knight",
      "Lynx",
      "Maelstrom",
      "Nomad-2",
      "Oracle",
      "Phantom",
      "Quake",
      "Ravager",
      "Saber-2",
      "Talon",
      "Umbra",
      "Vector",
      "Warden",
      "Xiphos",
      "Yankee",
      "Zephyr",
      "Ironclad",
      "Foxhound",
      "Thunder",
      "Lightning"
    ];
    const i = Math.floor(Math.random() * CALLSIGNS.length);
    return CALLSIGNS[i];
  }

  // js/networking/NetworkingScreen.js
  function NetworkingScreen(game2) {
    this.game = game2;
    this.connectOverlay = null;
    this.chatOverlay = null;
    this.chatPanel = null;
    this.statusEls = [];
    this.roomInput = null;
    this.nicknameInput = null;
    this.hostButton = null;
    this.joinButton = null;
    this.enterLobbyButton = null;
    this.playerListEl = null;
    this.roomCodeEl = null;
    this.chatInput = null;
    this.sendButton = null;
    this.closeConnectButton = null;
    this.closeChatButton = null;
    this._boundResize = null;
    this._chatDrag = { active: false, startX: 0, startWidth: 0 };
    this.overlayEnabled = true;
    this.overlayRequested = false;
    this.ensureDom();
    if (this.sendButton) {
      this.sendButton.disabled = false;
    }
    if (this.chatInput) {
      this.chatInput.disabled = false;
    }
    this.registerListeners();
  }
  NetworkingScreen.prototype.ensureDom = function() {
    this.connectOverlay = document.getElementById("networking-connect-overlay");
    this.chatOverlay = null;
    this.statusEls = Array.from(document.querySelectorAll("#network-status, #network-status-connect, #network-status-chat"));
    this.roomInput = document.getElementById("room-name");
    this.nicknameInput = document.getElementById("nickname");
    this.hostButton = document.getElementById("host-room-btn");
    this.joinButton = document.getElementById("join-room-btn");
    this.enterLobbyButton = document.getElementById("enter-lobby-btn");
    this.playerListEl = document.getElementById("player-list");
    this.roomCodeEl = document.getElementById("room-code");
    this.chatInput = document.getElementById("chat-message-input");
    this.sendButton = document.getElementById("chat-send-btn");
    this.chatPanel = document.getElementById("networking-chat-panel");
    this.closeConnectButton = document.getElementById("networking-close-connect-btn");
    this.closeChatButton = document.getElementById("networking-close-chat-btn");
  };
  NetworkingScreen.prototype.registerListeners = function() {
    var self = this;
    if (this.hostButton) {
      this.hostButton.addEventListener("click", function() {
        peerManager.hostRoom(self.roomInput.value, self.nicknameInput.value);
        self.showChatOverlay();
      });
    }
    if (this.joinButton) {
      this.joinButton.addEventListener("click", function() {
        peerManager.joinRoom(self.roomInput.value, self.nicknameInput.value);
        self.showChatOverlay();
      });
    }
    if (this.closeConnectButton) {
      this.closeConnectButton.addEventListener("click", function() {
        self.hideOverlay();
      });
    }
    if (this.sendButton) {
      this.sendButton.addEventListener("click", function() {
        self.handleSendMessage();
      });
    }
    if (this.chatInput) {
      this.chatInput.addEventListener("keydown", function(event) {
        if (event.key === "Enter") {
          event.preventDefault();
          self.handleSendMessage();
        }
      });
    }
    eventHub.on("network-status", function(message) {
      for (var i = 0; i < self.statusEls.length; i++) {
        self.statusEls[i].textContent = message;
      }
    });
    eventHub.on("network-ready", function(info) {
      if (!info) {
        return;
      }
      if (self.sendButton) {
        self.sendButton.disabled = false;
      }
      if (self.chatInput) {
        self.chatInput.disabled = false;
      }
      if (self.overlayEnabled) {
        self.showChatOverlay();
      }
      try {
        var saved = localStorage.getItem("chatPanelWidthPx");
        if (saved && self.chatPanel) {
          var px = Math.max(0, Math.min(window.innerWidth * 0.9, parseInt(saved, 10) || 0));
          if (px > 0) {
            self.chatPanel.style.width = px + "px";
            self.chatPanel.classList.add("chat-open");
          }
        }
      } catch (_) {
      }
      if (self.game && self.game.pregame && typeof self.game.pregame.emitTankConfig === "function") {
        self.game.pregame.emitTankConfig();
      }
    });
    eventHub.on("network-player-list", function(players) {
      self.renderPlayerList(players || []);
    });
    eventHub.on("network-stats", function(stats) {
      if (!stats || !self.statusEls || self.statusEls.length === 0) {
        return;
      }
      var connectEl = document.getElementById("network-status-connect");
      var chatEl = null;
      var statsEl = document.getElementById("network-status");
      var connectLines = [];
      var chatLines = [];
      if (typeof stats.rttMs === "number") {
        connectLines.push("Ping: " + stats.rttMs + " ms");
        chatLines.push("Ping: " + stats.rttMs + " ms");
      }
      chatLines.push("Tx: " + stats.sentPerSec + " msg/s");
      chatLines.push("Rx: " + stats.recvPerSec + " msg/s");
      chatLines.push("Up: " + stats.bytesSentPerSec + " B/s");
      chatLines.push("Down: " + stats.bytesRecvPerSec + " B/s");
      if (connectEl) {
        var baseC = (connectEl.textContent || "").split("\n")[0] || connectEl.textContent;
        connectEl.textContent = baseC + "\n" + connectLines.join("\n");
      }
      if (statsEl) {
        var baseS = (statsEl.textContent || "").split("\n")[0] || statsEl.textContent;
        statsEl.textContent = baseS + "\n" + chatLines.join("\n");
      }
      if (!connectEl && !chatEl && !statsEl) {
        var lines = chatLines;
        for (var i = 0; i < self.statusEls.length; i++) {
          var el = self.statusEls[i];
          var base = (el.textContent || "").split("\n")[0] || el.textContent;
          el.textContent = base + "\n" + lines.join("\n");
        }
      }
    });
    var handle = document.getElementById("chat-resize-handle");
    if (handle && this.chatPanel) {
      handle.addEventListener("mousedown", function(e) {
        e.preventDefault();
        self._chatDrag.active = true;
        self._chatDrag.startX = e.clientX;
        self._chatDrag.startWidth = self.chatPanel.getBoundingClientRect().width;
        document.body.classList.add("resizing-chat");
      });
      window.addEventListener("mousemove", function(e) {
        if (!self._chatDrag.active) {
          return;
        }
        var dx = self._chatDrag.startX - e.clientX;
        var newWidth = Math.max(0, Math.min(window.innerWidth * 0.9, self._chatDrag.startWidth + dx));
        self.chatPanel.style.width = newWidth + "px";
        self.chatPanel.classList.add("chat-open");
      });
      window.addEventListener("mouseup", function() {
        if (!self._chatDrag.active) {
          return;
        }
        self._chatDrag.active = false;
        document.body.classList.remove("resizing-chat");
        try {
          var w = self.chatPanel.getBoundingClientRect().width;
          localStorage.setItem("chatPanelWidthPx", Math.round(w));
        } catch (_) {
        }
      });
    }
  };
  NetworkingScreen.prototype.layoutChatRight = function() {
  };
  NetworkingScreen.prototype.handleSendMessage = function() {
    if (this.chatInput.disabled) {
      return;
    }
    var message = (this.chatInput.value || "").trim();
    if (!message) {
      return;
    }
    var nickname = peerManager.getNickname ? peerManager.getNickname() : "Me";
    addChatMessage("You: " + message, "self-message");
    peerManager.sendChatMessage(message);
    this.chatInput.value = "";
  };
  NetworkingScreen.prototype.renderPlayerList = function(players) {
    if (!this.playerListEl) {
      return;
    }
    while (this.playerListEl.firstChild) {
      this.playerListEl.removeChild(this.playerListEl.firstChild);
    }
    if (!players || players.length === 0) {
      var emptyItem = document.createElement("li");
      emptyItem.textContent = "Waiting for players...";
      emptyItem.className = "player-list-empty";
      this.playerListEl.appendChild(emptyItem);
      return;
    }
    var localTankCount = this.game && this.game.pregame ? this.game.pregame.tank_panels.length : 0;
    for (var i = 0; i < players.length; i++) {
      var item = document.createElement("li");
      var entry = players[i];
      var label = entry.nickname || "Player";
      if (entry.id && peerManager.id === entry.id) {
        label += " (This device";
        if (localTankCount) {
          label += ", Tanks: " + localTankCount;
        }
        label += ")";
      } else {
        label += " (ID " + (entry.id ? entry.id.substring(0, 6) : "????") + ")";
      }
      item.textContent = label;
      this.playerListEl.appendChild(item);
    }
  };
  NetworkingScreen.prototype.showOverlay = function() {
    if (!this.overlayEnabled) {
      return;
    }
    if (peerManager && (peerManager.connections || []).length > 0 || peerManager && peerManager.readyNotified) {
      this.showChatOverlay();
    } else {
      this.showConnectOverlay();
    }
  };
  NetworkingScreen.prototype.showConnectOverlay = function() {
    if (!this.overlayEnabled) {
      return;
    }
    this.overlayRequested = true;
    if (!this.connectOverlay) {
      this.ensureDom();
    }
    if (this.chatOverlay) {
      this.chatOverlay.classList.add("hidden");
      this.chatOverlay.style.display = "";
    }
    if (this.connectOverlay) {
      this.connectOverlay.classList.remove("hidden");
      this.connectOverlay.style.display = "flex";
      if (this.roomInput) {
        try {
          this.roomInput.focus();
        } catch (_) {
        }
      }
    }
  };
  NetworkingScreen.prototype.showChatOverlay = function() {
    if (!this.overlayEnabled) {
      return;
    }
    this.ensureDom();
    if (this.connectOverlay) {
      this.connectOverlay.classList.add("hidden");
      this.connectOverlay.style.display = "";
    }
    if (this.chatPanel) {
      this.chatPanel.classList.remove("hidden");
      this.chatPanel.classList.add("chat-open");
      if (this.chatInput) {
        try {
          this.chatInput.disabled = false;
          this.chatInput.removeAttribute("disabled");
        } catch (_) {
        }
      }
      if (this.sendButton) {
        try {
          this.sendButton.disabled = false;
          this.sendButton.removeAttribute("disabled");
        } catch (_) {
        }
      }
      if (this.chatInput) {
        try {
          this.chatInput.focus();
        } catch (_) {
        }
      }
    }
  };
  NetworkingScreen.prototype.hideOverlay = function() {
    this.ensureDom();
    this.overlayRequested = false;
    if (this.connectOverlay) {
      this.connectOverlay.classList.add("hidden");
      this.connectOverlay.style.display = "";
    }
    if (this.chatPanel) {
      this.chatPanel.classList.add("chat-open");
      this.chatPanel.classList.remove("hidden");
    }
  };
  NetworkingScreen.prototype.enableOverlay = function() {
    this.overlayEnabled = true;
  };
  NetworkingScreen.prototype.disableOverlay = function() {
    this.overlayEnabled = false;
    this.hideOverlay();
  };

  // js/maze/Wall.js
  var Wall = class {
    constructor(x, y, width, height, orientation) {
      this.x = x | 0;
      this.y = y | 0;
      this.width = width | 0;
      this.height = height | 0;
      this.orientation = orientation;
      this.isActive = true;
      this.N = null;
      this.S = null;
      this.W = null;
      this.E = null;
    }
    getRect() {
      return [this.x, this.y, this.width, this.height];
    }
  };
  var Intersection = class {
    constructor(x, y) {
      this.x = x | 0;
      this.y = y | 0;
      this.north = null;
      this.south = null;
      this.west = null;
      this.east = null;
    }
  };

  // js/helper_fns.js
  function doRectsOverlap(rect1, rect2) {
    if (rect1[0] + rect1[2] < rect2[0]) {
      return false;
    }
    if (rect1[0] > rect2[0] + rect2[2]) {
      return false;
    }
    if (rect1[1] + rect1[3] < rect2[1]) {
      return false;
    }
    if (rect1[1] > rect2[1] + rect2[3]) {
      return false;
    }
    return true;
  }
  function removeElementFromArray2(element, array) {
    if (!array || !Array.isArray(array)) {
      return;
    }
    const idx = array.indexOf(element);
    if (idx >= 0) {
      array.splice(idx, 1);
    }
  }
  function shuffle(array) {
    var tmp = [];
    var src = array.slice();
    while (src.length > 0) {
      var rnd = Math.floor(Math.random() * src.length);
      tmp.push(src[rnd]);
      src.splice(rnd, 1);
    }
    return tmp;
  }

  // js/maze/Square.js
  var Square = class {
    constructor(maze, row, col) {
      this.maze = maze;
      this.row = row;
      this.col = col;
      this.north = null;
      this.east = null;
      this.south = null;
      this.west = null;
      var rect = this.maze.getCellRect(row, col);
      this.width = rect.width;
      this.height = rect.height;
      this.wall_thiccness = maze.wall_thiccness;
      this.x = rect.x;
      this.y = rect.y;
      this.visited = false;
    }
    draw() {
    }
    // drawBackground removed; handled during Maze.prerenderBackground()
    removeBorder(square) {
      if (this.row == square.row) {
        if (this.col == square.col - 1) {
          if (this.east) this.east.isActive = false;
          if (square.west) square.west.isActive = false;
        }
        if (this.col == square.col + 1) {
          if (this.west) this.west.isActive = false;
          if (square.east) square.east.isActive = false;
        }
      }
      if (this.col == square.col) {
        if (this.row == square.row - 1) {
          if (this.south) this.south.isActive = false;
          if (square.north) square.north.isActive = false;
        }
        if (this.row == square.row + 1) {
          if (this.north) this.north.isActive = false;
          if (square.south) square.south.isActive = false;
        }
      }
    }
    //Returns neighbouring squares
    getNeighbours() {
      var neighbours = [];
      if (this.col > 0) {
        neighbours.push(this.maze.squares[this.row][this.col - 1]);
      }
      if (this.col < this.maze.num_of_columns - 1) {
        neighbours.push(this.maze.squares[this.row][this.col + 1]);
      }
      if (this.row > 0) {
        neighbours.push(this.maze.squares[this.row - 1][this.col]);
      }
      if (this.row < this.maze.num_of_rows - 1) {
        neighbours.push(this.maze.squares[this.row + 1][this.col]);
      }
      return neighbours;
    }
    //returns [x,y]
    getCenter() {
      return [this.x + this.width / 2, this.y + this.height / 2];
    }
    // Return active wall rects for collision (canonical: east/south and borders)
    getWalls() {
      var rects = [];
      if (this.row === 0 && this.north && this.north.isActive) rects.push(this.north.getRect());
      if (this.col === 0 && this.west && this.west.isActive) rects.push(this.west.getRect());
      if (this.east && this.east.isActive) rects.push(this.east.getRect());
      if (this.south && this.south.isActive) rects.push(this.south.getRect());
      return rects;
    }
    hasActiveBorderWith(square) {
      if (this.row == square.row) {
        if (this.col == square.col + 1) {
          return this.west;
        }
        if (this.col == square.col - 1) {
          return this.east;
        }
      }
      if (this.col == square.col) {
        if (this.row == square.row + 1) {
          return this.north;
        }
        if (this.row == square.row - 1) {
          return this.south;
        }
      }
      return false;
    }
  };

  // js/render/scoreboard_dom.js
  var rootEl = null;
  var innerEl = null;
  var playersEl = null;
  var networkImg = null;
  var testBtn = null;
  var lastSignature = "";
  var lastTankSpriteSrc = "";
  var lastNetworkIconSrc = "";
  function ensureStructure() {
    if (!rootEl) {
      rootEl = document.getElementById("hud-scoreboard");
    }
    if (!rootEl) {
      return null;
    }
    if (!innerEl) {
      innerEl = rootEl.querySelector(".sb-inner");
      if (!innerEl) {
        innerEl = document.createElement("div");
        innerEl.className = "sb-inner";
        rootEl.appendChild(innerEl);
      }
    }
    if (!playersEl) {
      playersEl = innerEl.querySelector(".sb-players");
      if (!playersEl) {
        playersEl = document.createElement("div");
        playersEl.className = "sb-players";
        innerEl.insertBefore(playersEl, innerEl.firstChild || null);
      }
    }
    if (!testBtn) {
      testBtn = innerEl.querySelector(".sb-test");
    }
    if (!networkImg) {
      const networkBtn = innerEl.querySelector(".sb-network");
      networkImg = networkBtn ? networkBtn.querySelector("img") : null;
    }
    return {
      root: rootEl,
      inner: innerEl,
      players: playersEl,
      testBtn,
      networkImg
    };
  }
  function resolveImageSrc(idOrSelector) {
    if (!idOrSelector) return "";
    const el = document.getElementById(idOrSelector);
    if (!el || !("src" in el)) {
      return "";
    }
    return el.src || "";
  }
  function createPlayerNode(tankId) {
    const wrapper = document.createElement("div");
    wrapper.className = "sb-player";
    if (tankId) {
      wrapper.dataset.tankId = tankId;
    }
    const icon = document.createElement("img");
    icon.className = "sb-icon";
    icon.alt = "";
    icon.hidden = true;
    wrapper.appendChild(icon);
    const row = document.createElement("div");
    row.className = "sb-row";
    const tankImg = document.createElement("img");
    tankImg.className = "sb-tank";
    tankImg.alt = "";
    row.appendChild(tankImg);
    const scoreSpan = document.createElement("span");
    scoreSpan.className = "sb-score";
    scoreSpan.textContent = "0";
    row.appendChild(scoreSpan);
    wrapper.appendChild(row);
    wrapper._iconEl = icon;
    wrapper._tankEl = tankImg;
    wrapper._scoreEl = scoreSpan;
    return wrapper;
  }
  function renderHudScoreboard({
    players = [],
    tankSpriteId = "tank",
    networkIconId = "network-icon"
  } = {}) {
    const nodes = ensureStructure();
    if (!nodes) {
      return;
    }
    const tankSpriteSrc = resolveImageSrc(tankSpriteId);
    const networkIconSrc = resolveImageSrc(networkIconId) || "res/ui/network.png";
    const signature = JSON.stringify({
      players: players.map((p) => ({
        id: p && p.id ? p.id : null,
        score: p && typeof p.score !== "undefined" ? p.score : 0,
        powerup: p && p.powerupIconId ? p.powerupIconId : null
      })),
      tankSpriteSrc,
      networkIconSrc
    });
    if (signature === lastSignature && tankSpriteSrc === lastTankSpriteSrc && networkIconSrc === lastNetworkIconSrc) {
      return;
    }
    lastSignature = signature;
    lastTankSpriteSrc = tankSpriteSrc;
    lastNetworkIconSrc = networkIconSrc;
    const container = nodes.players;
    const existing = /* @__PURE__ */ new Map();
    Array.from(container.children).forEach((child) => {
      if (child.dataset && child.dataset.tankId) {
        existing.set(child.dataset.tankId, child);
      }
    });
    const fragment = document.createDocumentFragment();
    for (let i = 0; i < players.length; i += 1) {
      const player = players[i] || {};
      const tankId = player.id || `tank-${i + 1}`;
      let node = existing.get(tankId);
      if (node) {
        existing.delete(tankId);
      } else {
        node = createPlayerNode(tankId);
      }
      if (!node._iconEl) {
        node._iconEl = node.querySelector(".sb-icon");
      }
      if (!node._tankEl) {
        node._tankEl = node.querySelector(".sb-tank");
      }
      if (!node._scoreEl) {
        node._scoreEl = node.querySelector(".sb-score");
      }
      node.dataset.tankId = tankId;
      const iconId = player.powerupIconId || null;
      if (iconId) {
        const iconSrc = resolveImageSrc(iconId);
        if (iconSrc) {
          node._iconEl.src = iconSrc;
          node._iconEl.hidden = false;
        } else {
          node._iconEl.hidden = true;
        }
      } else {
        node._iconEl.hidden = true;
      }
      if (tankSpriteSrc) {
        node._tankEl.src = tankSpriteSrc;
      }
      const scoreVal = typeof player.score === "number" ? player.score : parseInt(player.score, 10) || 0;
      const scoreText = String(scoreVal);
      if (node._scoreEl.textContent !== scoreText) {
        node._scoreEl.textContent = scoreText;
      }
      fragment.appendChild(node);
    }
    if (existing.size > 0) {
      existing.forEach((node) => {
        if (node && node.parentNode === container) {
          node.parentNode.removeChild(node);
        }
      });
    }
    container.replaceChildren(fragment);
    if (nodes.networkImg) {
      nodes.networkImg.src = networkIconSrc;
    }
  }

  // js/maze/Maze.js
  var Maze = class {
    constructor(game2, settings) {
      this.game = game2;
      const defaultSettings = {
        num_of_rows: 6,
        num_of_columns: 9,
        wall_thiccness: 4,
        speed: 1,
        move_speed: 3,
        rotation_speed: 9 / 100,
        bullet_speed: 3,
        seconds_between_rounds: 3,
        friendly_fire: false,
        bullet_limit: 7,
        bounce_limit: 7,
        powerup_interval: 8,
        powerup_limit: 8,
        powerup_duration: 10
      };
      this.settings = Object.assign({}, defaultSettings, settings || {});
      this.num_of_rows = this.settings.num_of_rows;
      this.num_of_columns = this.settings.num_of_columns;
      this.wall_thiccness = this.settings.wall_thiccness;
      this.scoreboardHeight = Math.floor(canvas.height * 1 / 5);
      this.width = canvas.width - this.wall_thiccness;
      this.height = canvas.height - this.scoreboardHeight - this.wall_thiccness;
      this._buildGridEdges();
      this.tanks = [];
      this.powerups = [];
      this.state = {
        tanks: {},
        // id -> { id, x, y, rotation, colour, width, height, score, is_dead, powerups: [{type,spriteId?}] }
        powerups: {},
        // id -> { id, type, x, y, width, height }
        meta: { nextPowerupId: 1, nextTankId: 1 }
      };
      this.pendingPowerupEvents = [];
      this.teleportMirrors = {};
      this.lastSnapshot = null;
      this.message = "Shoot the opposing tanks!";
      this.num_of_destroyed_tanks = 0;
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
      this.squares = [];
      for (var r = 0; r < this.num_of_rows; r++) {
        var row = [];
        for (var c = 0; c < this.num_of_columns; c++) {
          row.push(new Square(this, r, c));
        }
        this.squares.push(row);
      }
      this._initWalls();
      this.extraFunctionsPerCycle = [];
      this.trippyCount = 0;
    }
    // Build integer-aligned edges for rows and columns
    _buildGridEdges() {
      var rows = this.num_of_rows;
      var cols = this.num_of_columns;
      var baseW = Math.floor(this.width / cols);
      var remW = this.width - baseW * cols;
      this._colX = [0];
      for (var c = 0; c < cols; c++) {
        var add = baseW + (c < remW ? 1 : 0);
        this._colX.push(this._colX[c] + add);
      }
      var baseH = Math.floor(this.height / rows);
      var remH = this.height - baseH * rows;
      this._rowY = [0];
      for (var r = 0; r < rows; r++) {
        var addH = baseH + (r < remH ? 1 : 0);
        this._rowY.push(this._rowY[r] + addH);
      }
    }
    getCellRect(row, col) {
      var x0 = this._colX[col];
      var x1 = this._colX[col + 1];
      var y0 = this._rowY[row];
      var y1 = this._rowY[row + 1];
      return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
    }
    main() {
      this.tick += 1;
      if (this.spectator) {
        this.drawSpectator();
        return;
      }
      this.tanks.forEach(function(tank) {
        tank.main();
      });
      this.draw();
      this.broadcastState();
    }
    draw() {
      if ((this.trippyCount || 0) > 0) {
        this.drawScoreboardTop();
        this.drawDynamicObjects();
        return;
      }
      this.drawScoreboardTop();
      this.drawBackground();
      this.drawDynamicObjects();
    }
    drawBackground() {
      ctx.save();
      if (typeof ctx.setTransform === "function") {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      var gy = this.scoreboardHeight;
      var gh = canvas.height - gy;
      ctx.clearRect(0, gy, canvas.width, gh);
      ctx.translate(0, this.scoreboardHeight);
      ctx.translate(this.wall_thiccness / 2, this.wall_thiccness / 2);
      for (var ri = 0; ri < this.squares.length; ri++) {
        var row = this.squares[ri];
        for (var ci = 0; ci < row.length; ci++) {
          var square = row[ci];
          var fill = (square.row + square.col) % 2 == 0 ? "#C0C0C0" : "#E0E0E0";
          ctx.fillStyle = fill;
          ctx.fillRect(square.x, square.y, square.width, square.height);
        }
      }
      ctx.fillStyle = "black";
      for (var wi = 0; wi < this.walls.length; wi++) {
        var w = this.walls[wi];
        if (!w.isActive) continue;
        ctx.fillRect(w.x, w.y, w.width, w.height);
      }
      ctx.restore();
    }
    // Build the static background on the background canvas
    prerenderBackground() {
    }
    // Host local start: generate maze + prerender + start powerups
    beginGameplay() {
      if (!this._generated) {
        this.randomize();
        this.prerenderBackground();
        this._generated = true;
      }
      if (peerManager && peerManager.isHost) {
        this.assignSequentialTankIds();
        this.broadcastStartState();
      }
      if (!this._powerupsLoopStarted) {
        this._powerupsLoopStarted = true;
        setTimeout(this.tryAddPowerupAndRepeat.bind(this), this.settings.powerup_interval * 1e3, this);
      }
    }
    assignSequentialTankIds() {
      this.tankById = {};
      var nextId = 1;
      for (var i = 0; i < this.tanks.length; i++) {
        var t = this.tanks[i];
        t.id = nextId;
        this.tankById[t.id] = t;
        nextId++;
      }
      this.nextTankId = nextId;
    }
    serializeTankRoster() {
      var arr = [];
      for (var i = 0; i < this.tanks.length; i++) {
        var t = this.tanks[i];
        arr.push({ id: t.id, x: Math.round(t.x) || 0, y: Math.round(t.y) || 0, rotation: t.rotation || 0, colour: t.colour || t.color || "#000", width: t.width || 20, height: t.height || 20, ownerPeerId: t.ownerPeerId || null, controls: t.controls || [] });
      }
      return arr;
    }
    broadcastStartState() {
      if (!peerManager || !peerManager.isHost) {
        return;
      }
      try {
        var payload = { role: "host", type: "init", tanks: this.serializeTankRoster(), maze: this.serializeLayout ? this.serializeLayout() : null, gameConfig: this.settings };
        if (typeof this.serializeUnifiedSnapshot === "function") {
          var jsnap = this.serializeUnifiedSnapshot();
          peerManager.broadcast("U," + jsnap);
        }
        eventHub.emit("network-ready", { role: "host", roomId: peerManager.id });
      } catch (_) {
      }
    }
    drawDynamicObjects() {
      try {
        this._pruneStaleExtraFunctions();
      } catch (_) {
      }
      ctx.save();
      ctx.translate(0, this.scoreboardHeight);
      ctx.translate(this.wall_thiccness / 2, this.wall_thiccness / 2);
      this.tanks.forEach(function(tank) {
        tank.draw();
      });
      this.powerups.forEach(function(powerup) {
        powerup.draw();
      });
      this.extraFunctionsPerCycle.forEach(function(f) {
        try {
          f();
        } catch (e) {
        }
      });
      ctx.restore();
    }
    _pruneStaleExtraFunctions() {
      if (!Array.isArray(this.extraFunctionsPerCycle) || this.extraFunctionsPerCycle.length === 0) {
        return;
      }
      var mirrors = this.teleportMirrors || {};
      var next = [];
      for (var i = 0; i < this.extraFunctionsPerCycle.length; i++) {
        var f = this.extraFunctionsPerCycle[i];
        if (f && f.__tp_tankId != null) {
          if (mirrors && mirrors[f.__tp_tankId]) {
            next.push(f);
          }
        } else {
          next.push(f);
        }
      }
      this.extraFunctionsPerCycle = next;
    }
    _initWalls() {
      var wt = this.wall_thiccness;
      var half = wt / 2;
      this.walls = [];
      this.intersections = [];
      for (var r = 0; r <= this.num_of_rows; r++) {
        var rowNodes = [];
        for (var c = 0; c <= this.num_of_columns; c++) {
          rowNodes.push(new Intersection(this._colX[c], this._rowY[r]));
        }
        this.intersections.push(rowNodes);
      }
      for (var c = 0; c <= this.num_of_columns; c++) {
        for (var r = 0; r < this.num_of_rows; r++) {
          var x = this._colX[c] - half;
          var y = this._rowY[r] - half;
          var h = this._rowY[r + 1] - this._rowY[r] + wt;
          var wall = new Wall(x, y, wt, h, "vertical");
          wall.N = this.intersections[r][c];
          wall.S = this.intersections[r + 1][c];
          if (c > 0) {
            this.squares[r][c - 1].east = wall;
          }
          if (c < this.num_of_columns) {
            this.squares[r][c] && (this.squares[r][c].west = wall);
          }
          if (!this.intersections[r][c].east) this.intersections[r][c].east = wall;
          if (!this.intersections[r + 1][c].west) this.intersections[r + 1][c].west = wall;
          this.walls.push(wall);
        }
      }
      for (var r = 0; r <= this.num_of_rows; r++) {
        for (var c = 0; c < this.num_of_columns; c++) {
          var xh = this._colX[c] - half;
          var yh = this._rowY[r] - half;
          var w = this._colX[c + 1] - this._colX[c] + wt;
          var wallh = new Wall(xh, yh, w, wt, "horizontal");
          wallh.W = this.intersections[r][c];
          wallh.E = this.intersections[r][c + 1];
          if (r > 0) {
            this.squares[r - 1][c].south = wallh;
          }
          if (r < this.num_of_rows) {
            this.squares[r] && this.squares[r][c] && (this.squares[r][c].north = wallh);
          }
          if (!this.intersections[r][c].south) this.intersections[r][c].south = wallh;
          if (!this.intersections[r][c + 1].north) this.intersections[r][c + 1].north = wallh;
          this.walls.push(wallh);
        }
      }
    }
    // New top scoreboard panel (HTML-based). Keep canvas area clear.
    drawScoreboardTop() {
      if (typeof ctx.setTransform === "function") {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      var panelH = this.scoreboardHeight;
      ctx.clearRect(0, 0, canvas.width, panelH);
      this._gearBtnRect = null;
      try {
        layoutHudOverCanvas();
        setHudScoreboardVisible(true);
      } catch (_) {
      }
      var tanksSrc = this.spectator ? this.remoteTankMeta || [] : this.tanks || [];
      var players = [];
      for (var i = 0; i < tanksSrc.length; i++) {
        var t = tanksSrc[i];
        if (!t) {
          continue;
        }
        var scoreVal = typeof t.score === "number" ? t.score : parseInt(t.score || "0", 10) || 0;
        var iconId = null;
        var powerupsList = t && Array.isArray(t.powerups) ? t.powerups : [];
        for (var pi = 0; pi < powerupsList.length; pi++) {
          var power = powerupsList[pi];
          if (!power) {
            continue;
          }
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
          id: t.id || "tank-" + (i + 1),
          score: scoreVal,
          powerupIconId: iconId || null
        });
      }
      renderHudScoreboard({
        players
      });
    }
    // Testing helper: remove interior walls and regenerate powerups
    testFlattenAndRegen() {
      try {
        for (var r = 0; r < this.num_of_rows; r++) {
          for (var c = 0; c < this.num_of_columns; c++) {
            var sq = this.squares[r][c];
            if (sq && sq.east) {
              sq.east.isActive = false;
            }
            if (sq && sq.south) {
              sq.south.isActive = false;
            }
          }
        }
        var list = (this.powerups || []).slice();
        for (var i = 0; i < list.length; i++) {
          var p = list[i];
          try {
            if (p && p.timeout) {
              clearTimeout(p.timeout);
              p.timeout = null;
            }
          } catch (_) {
          }
          try {
            this.removePowerup(p);
          } catch (_) {
          }
        }
        var limit = Math.max(0, this.settings && this.settings.powerup_limit ? this.settings.powerup_limit : 0);
        for (var k = 0; k < limit; k++) {
          var pu = generatePowerup(this);
          this.placeObject(pu);
          this.addPowerup(pu);
        }
        this.drawBackground();
        this.drawScoreboardTop();
      } catch (e) {
      }
    }
    keyDownHandler(event) {
      if (document.activeElement.tagName == "INPUT") {
        return;
      }
      this.tanks.forEach(function(tank) {
        tank.keyDownHandler(event);
      });
    }
    keyUpHandler(event) {
      this.tanks.forEach(function(tank) {
        if (typeof tank.keyUpHandler === "function") {
          tank.keyUpHandler(event);
        }
      });
    }
    randomize() {
      this.squares.forEach(function(row) {
        row.forEach(function(square) {
          square.visited = false;
        });
      });
      (this.walls || []).forEach(function(w) {
        w.isActive = true;
      });
      var entry_square = this.squares[0][0];
      this.visit(this.getRandomSquare(), this.getRandomSquare());
    }
    //Used in randomize. Visiting square b from a means removing the border between a-b and visiting all unvisited neighbours (in a random order). 
    visit(old_square, new_square) {
      old_square.removeBorder(new_square);
      new_square.visited = true;
      var neighbours = new_square.getNeighbours();
      neighbours = shuffle(neighbours);
      for (var i = 0; i < neighbours.length; i++) {
        if (neighbours[i].visited == false) {
          this.visit(new_square, neighbours[i]);
        }
      }
    }
    getSquareAtXY(pos) {
      var x = pos[0];
      var y = pos[1];
      if (this.isOutOfBounds(pos)) {
        return false;
      }
      return this.squares[Math.floor(y / this.height * this.num_of_rows)][Math.floor(x / this.width * this.num_of_columns)];
    }
    getRandomSquare() {
      var rnd_row_num = Math.floor(Math.random() * this.squares.length);
      var row = this.squares[rnd_row_num];
      var rnd_square = row[Math.floor(Math.random() * row.length)];
      return rnd_square;
    }
    //Check if a rectangle collides with (a wall in) the maze
    doesRectCollide(rect) {
      if (this.isOutOfBounds([rect[0], rect[1]])) {
        return true;
      }
      var square = this.getSquareAtXY([rect[0], rect[1]]);
      if (!square) {
        return true;
      }
      var nearby_squares = square.getNeighbours().concat([square]);
      var nearby_walls = [];
      nearby_squares.forEach(function(e) {
        e.getWalls().forEach(function(el) {
          nearby_walls.push(el);
        });
      });
      var collides = false;
      nearby_walls.forEach(function(e) {
        if (doRectsOverlap(rect, e)) {
          collides = true;
        }
      });
      return collides;
    }
    isOutOfBounds(pos) {
      if (pos[0] <= 0 || pos[0] >= this.width || pos[1] <= 0 || pos[1] >= this.height) {
        return true;
      }
      return false;
    }
    tankDestroyed() {
      this.num_of_destroyed_tanks += 1;
      if (this.num_of_destroyed_tanks == this.tanks.length - 1) {
        for (var i = 0; i < this.tanks.length; i++) {
          var tank = this.tanks[i];
          if (tank.is_dead == false) {
            tank.score += 1;
            this.restart_helper(this.settings.seconds_between_rounds);
            return;
          }
        }
      }
    }
    restart_helper(sec) {
      if (sec == 0) {
        this.restart();
        return;
      }
      this.message = "Next round starting in time seconds".replace("time", sec);
      setTimeout(this.restart_helper.bind(this), 1e3, sec - 1);
    }
    restart() {
      this.randomize();
      this.message = "restart";
      this.num_of_destroyed_tanks = 0;
      for (var i = 0; i < this.tanks.length; i++) {
        this.tanks[i].restart();
      }
      this.powerups = [];
      this.pendingPowerupEvents = [];
      this.teleportMirrors = {};
      this.lastSnapshot = null;
    }
    //Takes obj with x, y, width and height properties and sets x,y to place it in a random valid position
    placeObject(object) {
      var square = this.getRandomSquare();
      var wt = this.wall_thiccness;
      var westActive = square.west && square.west.isActive ? 1 : 0;
      var eastActive = square.east && square.east.isActive ? 1 : 0;
      var northActive = square.north && square.north.isActive ? 1 : 0;
      var southActive = square.south && square.south.isActive ? 1 : 0;
      var min_x = square.x + wt * westActive;
      var max_x = square.x + square.width - wt * eastActive - object.width;
      var min_y = square.y + wt * northActive;
      var max_y = square.y + square.height - wt * southActive - object.height;
      object.x = min_x + Math.random() * (max_x - min_x);
      object.y = min_y + Math.random() * (max_y - min_y);
    }
    registerTank(tank) {
      this.tankById[tank.id || "tank-" + this.tanks.length] = tank;
    }
    serializeLayout() {
      var layout = [];
      for (var r = 0; r < this.squares.length; r++) {
        var row = [];
        for (var c = 0; c < this.squares[r].length; c++) {
          var sq = this.squares[r][c];
          row.push({
            north: !!(sq.north && sq.north.isActive),
            south: !!(sq.south && sq.south.isActive),
            east: !!(sq.east && sq.east.isActive),
            west: !!(sq.west && sq.west.isActive)
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
    loadLayout(data) {
      if (!data || !data.squares) {
        return;
      }
      this.num_of_rows = data.num_of_rows || this.num_of_rows;
      this.num_of_columns = data.num_of_columns || this.num_of_columns;
      this.wall_thiccness = data.wall_thiccness || this.wall_thiccness;
      for (var r = 0; r < this.squares.length && r < data.squares.length; r++) {
        for (var c = 0; c < this.squares[r].length && c < data.squares[r].length; c++) {
          var square = this.squares[r][c];
          var src = data.squares[r][c] || {};
          if (square.north) square.north.isActive = !!src.north;
          if (square.south) square.south.isActive = !!src.south;
          if (square.east) square.east.isActive = !!src.east;
          if (square.west) square.west.isActive = !!src.west;
        }
      }
    }
    serializeState() {
      return this.captureState();
    }
    captureState() {
      var self = this;
      var tanksState = this.tanks.map(function(tank, index) {
        return self.cloneTankState({
          id: tank.id || "tank-" + index,
          colour: tank.colour,
          ownerPeerId: tank.ownerPeerId,
          x: tank.x,
          y: tank.y,
          rotation: tank.rotation,
          score: tank.score,
          is_dead: tank.is_dead,
          width: tank.width,
          height: tank.height,
          bullets: tank.bullets.map(function(bullet) {
            return { x: bullet.x, y: bullet.y, radius: bullet.radius, colour: tank.colour };
          }),
          powerups: tank.powerups.map(function(powerup) {
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
      try {
        this.state.tanks = {};
        for (var i = 0; i < tanksState.length; i++) {
          var ts = tanksState[i];
          this.state.tanks[ts.id] = { id: ts.id, x: ts.x, y: ts.y, rotation: ts.rotation, width: ts.width, height: ts.height, colour: ts.colour, score: ts.score, is_dead: ts.is_dead, powerups: (ts.powerups || []).map(function(p) {
            return { type: p.type || p.name, spriteId: p.spriteId || null };
          }) };
        }
      } catch (_) {
      }
      return snapshot;
    }
    serializeBoardPowerups() {
      var list = [];
      for (var i = 0; i < this.powerups.length; i++) {
        var powerup = this.powerups[i];
        if (!powerup) {
          continue;
        }
        if (!powerup.id) {
          powerup.id = "powerup-" + this.nextPowerupId++;
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
          color: powerup.color || "#ffffff"
        });
        try {
          this.state && (this.state.powerups[powerup.id] = { id: powerup.id, type: list[list.length - 1].type, x: powerup.x, y: powerup.y, width: powerup.width, height: powerup.height });
        } catch (_) {
        }
      }
      return list;
    }
    cloneTankState(tankState) {
      return JSON.parse(JSON.stringify(tankState));
    }
    clonePowerupState(powerupState) {
      return JSON.parse(JSON.stringify(powerupState));
    }
    clonePowerupList(list) {
      var self = this;
      var source = Array.isArray(list) ? list : [];
      return source.map(function(powerup) {
        return self.clonePowerupState(powerup);
      });
    }
    cloneSnapshot(snapshot) {
      if (!snapshot) {
        return { message: "", tanks: [], powerups: [], events: [] };
      }
      var tanks = Array.isArray(snapshot.tanks) ? snapshot.tanks : [];
      var self = this;
      return {
        message: snapshot.message,
        tanks: tanks.map(function(tank) {
          return self.cloneTankState(tank);
        }),
        powerups: self.clonePowerupList(snapshot.powerups),
        events: []
      };
    }
    collectRemoteTankMeta() {
      var list = [];
      if (!this.remoteTankMap) {
        return list;
      }
      for (var id in this.remoteTankMap) {
        if (Object.prototype.hasOwnProperty.call(this.remoteTankMap, id)) {
          list.push(this.remoteTankMap[id]);
        }
      }
      return list;
    }
    buildStatePacket() {
      var current = this.captureState();
      var packet = null;
      if (!this.lastSnapshot) {
        packet = { type: "state-init", state: current };
      } else {
        var delta = this.diffSnapshots(this.lastSnapshot, current);
        if (delta) {
          packet = { type: "state-delta", delta };
        }
      }
      this.lastSnapshot = this.cloneSnapshot(current);
      return packet;
    }
    // Build unified delta JSON comparing previous unified state
    buildUnifiedDeltaPacket() {
      try {
        var prev = this._lastUnifiedState || { tanks: {}, powerups: {} };
        var json = this.serializeUnifiedDelta(prev);
        this._lastUnifiedState = JSON.parse(this.serializeUnifiedSnapshot());
        return "V," + json;
      } catch (_) {
        return null;
      }
    }
    // New unified-state serializers/apply methods (guests consume)
    serializeUnifiedSnapshot() {
      try {
        return JSON.stringify({ tanks: this.state.tanks || {}, powerups: this.state.powerups || {} });
      } catch (_) {
        return "{}";
      }
    }
    applyUnifiedSnapshot(json) {
      try {
        var obj = typeof json === "string" ? JSON.parse(json) : json || {};
        this.state.tanks = obj.tanks || {};
        this.state.powerups = obj.powerups || {};
        this.remoteTankMap = {};
        for (var id in this.state.tanks) {
          if (!Object.prototype.hasOwnProperty.call(this.state.tanks, id)) continue;
          this.remoteTankMap[id] = this.state.tanks[id];
        }
        this.remoteTankMeta = this.collectRemoteTankMeta();
        if (typeof this.recomputeGlobalPowerups === "function") {
          this.recomputeGlobalPowerups();
        }
      } catch (_) {
      }
    }
    // Delta format: { tanks: { set: {id->state}, del: [ids] }, powerups: { set: {id->entry}, del: [ids] } }
    serializeUnifiedDelta(prev) {
      var delta = { tanks: { set: {}, del: [] }, powerups: { set: {}, del: [] } };
      try {
        var pt = prev && prev.tanks || {};
        var ct = this.state.tanks || {};
        for (var id in ct) {
          if (!Object.prototype.hasOwnProperty.call(ct, id)) continue;
          var a = JSON.stringify(pt[id] || null), b = JSON.stringify(ct[id]);
          if (a !== b) {
            delta.tanks.set[id] = ct[id];
          }
        }
        for (var id2 in pt) {
          if (!Object.prototype.hasOwnProperty.call(pt, id2)) continue;
          if (!Object.prototype.hasOwnProperty.call(ct, id2)) {
            delta.tanks.del.push(id2);
          }
        }
        var pp = prev && prev.powerups || {};
        var cp = this.state.powerups || {};
        for (var pid in cp) {
          if (!Object.prototype.hasOwnProperty.call(cp, pid)) continue;
          var pa = JSON.stringify(pp[pid] || null), pb = JSON.stringify(cp[pid]);
          if (pa !== pb) {
            delta.powerups.set[pid] = cp[pid];
          }
        }
        for (var pid2 in pp) {
          if (!Object.prototype.hasOwnProperty.call(pp, pid2)) continue;
          if (!Object.prototype.hasOwnProperty.call(cp, pid2)) {
            delta.powerups.del.push(pid2);
          }
        }
      } catch (_) {
      }
      return JSON.stringify(delta);
    }
    applyUnifiedDelta(json) {
      try {
        var d = typeof json === "string" ? JSON.parse(json) : json || {};
        var ts = d.tanks || {};
        var ps = d.powerups || {};
        this.state.tanks = this.state.tanks || {};
        (ts.del || []).forEach((id2) => {
          delete this.state.tanks[id2];
          delete this.remoteTankMap[id2];
        });
        var setT = ts.set || {};
        for (var id in setT) {
          if (!Object.prototype.hasOwnProperty.call(setT, id)) continue;
          this.state.tanks[id] = setT[id];
          this.remoteTankMap[id] = setT[id];
        }
        this.state.powerups = this.state.powerups || {};
        (ps.del || []).forEach((pid2) => {
          delete this.state.powerups[pid2];
        });
        var setP = ps.set || {};
        for (var pid in setP) {
          if (!Object.prototype.hasOwnProperty.call(setP, pid)) continue;
          this.state.powerups[pid] = setP[pid];
        }
        this.remoteTankMeta = this.collectRemoteTankMeta();
        if (typeof this.recomputeGlobalPowerups === "function") {
          this.recomputeGlobalPowerups();
        }
      } catch (_) {
      }
    }
    // Compact string serializers (Phase 1)
    serializeInitString() {
      var s = this.settings || {};
      var rows = this.num_of_rows || s.num_of_rows || 0;
      var cols = this.num_of_columns || s.num_of_columns || 0;
      var wall = this.wall_thiccness || s.wall_thiccness || 0;
      var mv = +(s.move_speed != null ? s.move_speed : 0);
      var rv = +(s.rotation_speed != null ? s.rotation_speed : 0);
      var bv = +(s.bullet_speed != null ? s.bullet_speed : 0);
      var bl = +(s.bullet_limit != null ? s.bullet_limit : 0);
      var bo = +(s.bounce_limit != null ? s.bounce_limit : 0);
      var pi = +(s.powerup_interval != null ? s.powerup_interval : 0);
      var pl = +(s.powerup_limit != null ? s.powerup_limit : 0);
      var pd = +(s.powerup_duration != null ? s.powerup_duration : 0);
      var ff = s.friendly_fire ? 1 : 0;
      var layoutObj = this.serializeLayout ? this.serializeLayout() : null;
      var layoutStr = layoutObj ? btoa(unescape(encodeURIComponent(JSON.stringify(layoutObj)))) : "";
      var powerupBlocks = (this.powerups || []).map(function(p) {
        if (!p) {
          return "";
        }
        var x = Math.round(p.x) || 0;
        var y = Math.round(p.y) || 0;
        var w = Math.round(p.width) || 0;
        var h = Math.round(p.height) || 0;
        var sid = p.img && p.img.id ? p.img.id : "";
        var c = (p.color || "").replace(/[,|;]/g, "");
        return [x, y, w, h, sid, c].join("|");
      }).filter(Boolean).join(";");
      var tankBlocks = (this.tanks || []).map(function(t, index) {
        if (!t) {
          return "";
        }
        var id = t.id || "tank-" + index;
        var x = Math.round(t.x) || 0;
        var y = Math.round(t.y) || 0;
        var r = +(t.rotation || 0).toFixed(4);
        var w = Math.round(t.width) || 0;
        var h = Math.round(t.height) || 0;
        var c = (t.colour || "").replace(/[,|;]/g, "");
        var s2 = +(t.score || 0);
        return [id, x, y, r, w, h, c, s2].join("|");
      }).filter(Boolean).join(";");
      return ["I", rows, cols, wall, mv, rv, bv, bl, bo, pi, pl, pd, ff, layoutStr, powerupBlocks, tankBlocks].join(",");
    }
    serializeDeltaString() {
      var tanks = (this.tanks || []).map(function(t2, index) {
        if (!t2) {
          return "";
        }
        var id2 = t2.id || "tank-" + index;
        var x = Math.round(t2.x) || 0;
        var y = Math.round(t2.y) || 0;
        var r = +(t2.rotation || 0).toFixed(4);
        var s2 = +(t2.score || 0);
        var alive = t2.is_dead ? 0 : 1;
        return [id2, x, y, r, s2, alive].join("|");
      }).filter(Boolean).join(";");
      var bullets = [];
      (this.tanks || []).forEach(function(t2) {
        (t2.bullets || []).forEach(function(b) {
          var vx = +(b.direction && b.direction[0] || 0).toFixed(3);
          var vy = +(b.direction && b.direction[1] || 0).toFixed(3);
          var col = (t2.colour || "").replace(/[,|;]/g, "");
          var rad = Math.round(b.radius || 1);
          bullets.push([Math.round(b.x) || 0, Math.round(b.y) || 0, vx, vy, col, rad].join("|"));
        });
      });
      var powerups = (this.powerups || []).map(function(p2) {
        if (!p2) {
          return "";
        }
        var x = Math.round(p2.x) || 0;
        var y = Math.round(p2.y) || 0;
        var w = Math.round(p2.width) || 0;
        var h = Math.round(p2.height) || 0;
        var sid = p2.img && p2.img.id ? p2.img.id : "";
        var c = (p2.color || "").replace(/[,|;]/g, "");
        return [x, y, w, h, sid, c].join("|");
      }).filter(Boolean).join(";");
      var evts = this.consumePendingEvents();
      var events = "";
      if (evts && evts.length) {
        var partsE = [];
        for (var ei = 0; ei < evts.length; ei++) {
          var e = evts[ei];
          if (!e) continue;
          var p = (e.powerup || "").replace(/[,|;]/g, "");
          var s = (e.status || "").replace(/[,|;]/g, "");
          var t = (e.target || "").replace(/[,|;]/g, "");
          var id = (e.tankId || "").replace(/[,|;]/g, "");
          partsE.push([p, s, t, id].join("|"));
        }
        events = partsE.join(";");
      }
      return ["D", tanks, bullets.join(";"), powerups, events].join(",");
    }
    applyInitString(str) {
      if (typeof str !== "string" || !str || str[0] !== "I") {
        return;
      }
      var parts = str.split(",");
      var toInt = function(v) {
        var n = parseInt(v, 10);
        return isNaN(n) ? 0 : n;
      };
      var toNum = function(v) {
        var n = parseFloat(v);
        return isNaN(n) ? 0 : n;
      };
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
      this.settings.friendly_fire = parts[12] === "1";
      var layoutObj = null;
      try {
        var layoutToken = parts[13] || "";
        if (layoutToken) {
          var json = decodeURIComponent(escape(atob(layoutToken)));
          layoutObj = JSON.parse(json);
        }
      } catch (e) {
        layoutObj = null;
      }
      this._buildGridEdges();
      this.squares = [];
      for (var r = 0; r < this.num_of_rows; r++) {
        var row = [];
        for (var c = 0; c < this.num_of_columns; c++) {
          row.push(new Square(this, r, c));
        }
        this.squares.push(row);
      }
      this._initWalls();
      if (layoutObj && layoutObj.squares && this.loadLayout) {
        this.loadLayout(layoutObj);
      }
      this.remotePowerups = [];
      var pBlock = parts[14] || "";
      if (pBlock) {
        var pEntries = pBlock.split(";");
        for (var pi = 0; pi < pEntries.length; pi++) {
          var tok = pEntries[pi];
          if (!tok) {
            continue;
          }
          var f = tok.split("|");
          this.remotePowerups.push({
            x: parseInt(f[0], 10) || 0,
            y: parseInt(f[1], 10) || 0,
            width: parseInt(f[2], 10) || 0,
            height: parseInt(f[3], 10) || 0,
            spriteId: f[4] || "",
            color: f[5] || "#ffffff"
          });
        }
      }
      this.remoteTankMap = {};
      var tankBlock = parts[15] || "";
      if (tankBlock) {
        var entries = tankBlock.split(";");
        for (var i = 0; i < entries.length; i++) {
          var tok = entries[i];
          if (!tok) {
            continue;
          }
          var f = tok.split("|");
          var id = f[0];
          this.remoteTankMap[id] = {
            id,
            x: toInt(f[1]),
            y: toInt(f[2]),
            rotation: toNum(f[3]),
            width: toInt(f[4]),
            height: toInt(f[5]),
            colour: f[6] || "#ffffff",
            score: toInt(f[7])
          };
        }
      }
      this.remoteTankMeta = this.collectRemoteTankMeta();
      this.remoteState = { tanks: this.remoteTankMeta, powerups: this.remotePowerups };
      this.recomputeGlobalPowerups && this.recomputeGlobalPowerups();
      this.prerenderBackground();
      this.message = "Awaiting host updates...";
    }
    applyDeltaString(str) {
      if (typeof str !== "string" || !str || str[0] !== "D") {
        return;
      }
      var parts = str.split(",");
      var toInt = function(v) {
        var n = parseInt(v, 10);
        return isNaN(n) ? 0 : n;
      };
      var toNum = function(v) {
        var n = parseFloat(v);
        return isNaN(n) ? 0 : n;
      };
      var base = 1;
      if (parts.length >= 6) {
        base = 2;
      }
      var tankBlock = parts[base] || "";
      if (tankBlock) {
        var entries = tankBlock.split(";");
        for (var i = 0; i < entries.length; i++) {
          var tok = entries[i];
          if (!tok) {
            continue;
          }
          var f = tok.split("|");
          var id = f[0];
          var existing = this.remoteTankMap && this.remoteTankMap[id] ? this.remoteTankMap[id] : { id };
          existing.x = toInt(f[1]);
          existing.y = toInt(f[2]);
          existing.rotation = toNum(f[3]);
          existing.score = toInt(f[4]);
          if (f.length > 5 && f[5] !== "") {
            var aliveFlag = toInt(f[5]);
            existing.is_dead = aliveFlag === 0;
          } else if (typeof existing.is_dead !== "boolean") {
            existing.is_dead = false;
          }
          this.remoteTankMap[id] = existing;
        }
      }
      this.remoteTankMeta = this.collectRemoteTankMeta();
      try {
        if (this.settings && this.settings.friendly_fire) {
          var tanksArr = this.remoteTankMeta || [];
          var bulletsArr = this.remoteGlobalBullets || [];
          for (var ti = 0; ti < tanksArr.length; ti++) {
            var rt = tanksArr[ti];
            if (!rt || rt.is_dead) continue;
            var tx = rt.x, ty = rt.y;
            var tw = rt.width || this.width / this.num_of_columns / 3;
            var th = rt.height || this.height / this.num_of_rows / 3;
            for (var bi = 0; bi < bulletsArr.length; bi++) {
              var rb = bulletsArr[bi];
              if (!rb) continue;
              if (rb.colour && rt.colour && rb.colour === rt.colour) {
                continue;
              }
              var br = rb.radius || 1;
              var bx0 = rb.x - br, by0 = rb.y - br, bw = br * 2, bh = br * 2;
              if (doRectsOverlap([tx, ty, tw, th], [bx0, by0, bw, bh])) {
                rt.is_dead = true;
                var mt = this.remoteTankMap && this.remoteTankMap[rt.id];
                if (mt) {
                  mt.is_dead = true;
                }
                break;
              }
            }
          }
        }
      } catch (e) {
      }
      var bullets = [];
      var bulletBlock = parts[base + 1] || "";
      if (bulletBlock) {
        var bEntries = bulletBlock.split(";");
        for (var j = 0; j < bEntries.length; j++) {
          var b = bEntries[j];
          if (!b) {
            continue;
          }
          var bf = b.split("|");
          bullets.push({ x: toInt(bf[0]), y: toInt(bf[1]), vx: toNum(bf[2]), vy: toNum(bf[3]), colour: bf[4] || "#000000", radius: toInt(bf[5]) || 1 });
        }
      }
      this.remoteGlobalBullets = bullets;
      var newPowerups = [];
      var pBlockDelta = parts[base + 2] || "";
      if (pBlockDelta) {
        var entriesP = pBlockDelta.split(";");
        for (var k = 0; k < entriesP.length; k++) {
          var tk = entriesP[k];
          if (!tk) {
            continue;
          }
          var pf = tk.split("|");
          newPowerups.push({
            x: toInt(pf[0]),
            y: toInt(pf[1]),
            width: toInt(pf[2]),
            height: toInt(pf[3]),
            spriteId: pf[4] || "",
            color: pf[5] || "#ffffff"
          });
        }
      }
      this.remotePowerups = newPowerups;
      this.remoteState = { tanks: this.remoteTankMeta, powerups: this.remotePowerups };
      var eventsBlock = parts[base + 3] || "";
      if (eventsBlock) {
        var entriesE = eventsBlock.split(";");
        for (var eIdx = 0; eIdx < entriesE.length; eIdx++) {
          var ek = entriesE[eIdx];
          if (!ek) {
            continue;
          }
          var ef = ek.split("|");
          var evt = { type: "powerup", powerup: ef[0] || "", status: ef[1] || "", target: ef[2] || "", tankId: ef[3] || "" };
          this.applyPowerupEvent(evt);
        }
      }
    }
    diffSnapshots(prev, curr) {
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
      prevTanks.forEach(function(tank, index) {
        if (!tank) {
          return;
        }
        var prevId2 = tank.id ? tank.id : "tank-" + index;
        prevMap[prevId2] = tank;
      });
      currTanks.forEach(function(tank, index) {
        if (!tank) {
          return;
        }
        var currId = tank.id ? tank.id : "tank-" + index;
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
    hasTankChanged(prevTank, newTank) {
      if (!prevTank || !newTank) {
        return prevTank !== newTank;
      }
      if (prevTank.x !== newTank.x || prevTank.y !== newTank.y) {
        return true;
      }
      if (prevTank.rotation !== newTank.rotation) {
        return true;
      }
      if (prevTank.colour !== newTank.colour) {
        return true;
      }
      if (prevTank.ownerPeerId !== newTank.ownerPeerId) {
        return true;
      }
      if (prevTank.width !== newTank.width || prevTank.height !== newTank.height) {
        return true;
      }
      if (prevTank.score !== newTank.score) {
        return true;
      }
      if (!!prevTank.is_dead !== !!newTank.is_dead) {
        return true;
      }
      if (this.haveBulletsChanged(prevTank.bullets, newTank.bullets)) {
        return true;
      }
      if (this.havePowerupsChanged(prevTank.powerups, newTank.powerups)) {
        return true;
      }
      return false;
    }
    haveBulletsChanged(prevBullets, newBullets) {
      prevBullets = prevBullets || [];
      newBullets = newBullets || [];
      if (prevBullets.length !== newBullets.length) {
        return true;
      }
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
    syncGlobalPowerups() {
      this.recomputeGlobalPowerups();
    }
    // Recompute visual global flags (e.g., Trippy) from remote tank metadata
    recomputeGlobalPowerups() {
      try {
        var meta = this.remoteTankMeta || [];
        var hasTrippy = 0;
        for (var i = 0; i < meta.length; i++) {
          var t = meta[i];
          if (!t || !t.powerups) continue;
          for (var j = 0; j < t.powerups.length; j++) {
            var pu = t.powerups[j];
            var nm = (pu && (pu.type || pu.name || "")) + "";
            if (/Trippy/i.test(nm)) {
              hasTrippy++;
              break;
            }
          }
        }
        this.trippyCount = hasTrippy;
      } catch (_) {
      }
    }
    havePowerupsChanged(prevPowerups, newPowerups) {
      prevPowerups = prevPowerups || [];
      newPowerups = newPowerups || [];
      if (prevPowerups.length !== newPowerups.length) {
        return true;
      }
      for (var i = 0; i < prevPowerups.length; i++) {
        var a = prevPowerups[i];
        var b = newPowerups[i];
        if ((a && a.type) !== (b && b.type)) {
          return true;
        }
      }
      return false;
    }
    haveBoardPowerupsChanged(prevPowerups, newPowerups) {
      prevPowerups = Array.isArray(prevPowerups) ? prevPowerups : [];
      newPowerups = Array.isArray(newPowerups) ? newPowerups : [];
      if (prevPowerups.length !== newPowerups.length) {
        return true;
      }
      var prevMap = {};
      prevPowerups.forEach(function(powerup2, index) {
        if (!powerup2) {
          return;
        }
        var id2 = powerup2.id || "powerup-" + index;
        prevMap[id2] = powerup2;
      });
      for (var i = 0; i < newPowerups.length; i++) {
        var powerup = newPowerups[i];
        if (!powerup) {
          return true;
        }
        var id = powerup.id || "powerup-" + i;
        var prevEntry = prevMap[id];
        if (!prevEntry) {
          return true;
        }
        if (prevEntry.x !== powerup.x || prevEntry.y !== powerup.y) {
          return true;
        }
        if (prevEntry.width !== powerup.width || prevEntry.height !== powerup.height) {
          return true;
        }
        if ((prevEntry.spriteId || null) !== (powerup.spriteId || null)) {
          return true;
        }
        if ((prevEntry.type || null) !== (powerup.type || null)) {
          return true;
        }
        if ((prevEntry.color || null) !== (powerup.color || null)) {
          return true;
        }
      }
      return false;
    }
    getCachedSnapshot() {
      if (this.lastSnapshot) {
        return this.cloneSnapshot(this.lastSnapshot);
      }
      var snapshot = this.captureState();
      this.lastSnapshot = this.cloneSnapshot(snapshot);
      return snapshot;
    }
    // Legacy JSON state/delta paths were removed
    applyInputState(state) {
      if (!state || !state.tankId) {
        return;
      }
      var tank = this.tankById ? this.tankById[state.tankId] : null;
      if (!tank) {
        return;
      }
      tank.applyNetworkInput({
        upPressed: !!state.upPressed,
        downPressed: !!state.downPressed,
        leftPressed: !!state.leftPressed,
        rightPressed: !!state.rightPressed,
        shooting: !!state.shooting,
        specialKeyPressed: !!state.specialKeyPressed
      });
    }
    broadcastState() {
      if (!peerManager || !peerManager.isHost || !peerManager.connections || peerManager.connections.length === 0) {
        return;
      }
      var now = performance.now();
      if (this.lastSnapshot && now - this.lastStateBroadcast < 30) {
        return;
      }
      var packet = this.buildStatePacket();
      if (!packet) {
        return;
      }
      this.lastStateBroadcast = now;
      try {
        if (packet.type === "state-init") {
          peerManager.broadcast(this.serializeInitString());
        } else if (packet.type === "state-delta") {
          peerManager.broadcast(this.serializeDeltaString());
        }
      } catch (e) {
      }
    }
    drawSpectator() {
      this.drawScoreboardTop();
      if (!((this.trippyCount || 0) > 0)) {
        try {
          if (typeof ctx.setTransform === "function") {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
          }
          this.drawBackground();
        } catch (e) {
        }
      }
      ctx.save();
      ctx.translate(0, this.scoreboardHeight);
      ctx.translate(this.wall_thiccness / 2, this.wall_thiccness / 2);
      if (!((this.trippyCount || 0) > 0)) {
        ctx.fillStyle = "black";
        for (var i = 0; i < this.walls.length; i++) {
          var w = this.walls[i];
          if (!w.isActive) continue;
          ctx.fillRect(w.x, w.y, w.width, w.height);
        }
      }
      var boardPowerups = null;
      if (this.state && this.state.powerups && Object.keys(this.state.powerups).length) {
        boardPowerups = Object.values(this.state.powerups);
      } else {
        boardPowerups = this.remoteState && this.remoteState.powerups ? this.remoteState.powerups : this.remotePowerups;
      }
      if (boardPowerups && boardPowerups.length) {
        for (var p = 0; p < boardPowerups.length; p++) {
          this.drawRemotePowerup(boardPowerups[p]);
        }
      }
      if (this.remoteGlobalBullets && this.remoteGlobalBullets.length) {
        for (var gb = 0; gb < this.remoteGlobalBullets.length; gb++) {
          var pb = this.remoteGlobalBullets[gb];
          this.drawRemoteBullet({ x: pb.x, y: pb.y, radius: pb.radius || 1, colour: pb.colour || "#000000" });
        }
      }
      var tanks = this.remoteState && this.remoteState.tanks ? this.remoteState.tanks : this.remoteTankMeta;
      if (tanks) {
        for (var i = 0; i < tanks.length; i++) {
          var t = tanks[i];
          this.drawRemoteTank(t);
          var tankId = t && t.id;
          var hasTeleport = tankId && this.teleportMirrors && this.teleportMirrors[tankId] || t && t.powerups && t.powerups.some(function(p2) {
            return p2 && p2.type === "TeleportPowerup";
          });
          if (hasTeleport) {
            this.drawTeleportMirrorState(t);
          }
        }
      }
      ctx.restore();
      ctx.font = "15px Verdana";
      ctx.fillStyle = "black";
      ctx.fillText(this.message || "", canvas.width / 2, this.scoreboardHeight + this.height + 20);
    }
    drawRemotePowerup(powerupState) {
      if (!powerupState) {
        return;
      }
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
      ctx.strokeStyle = powerupState.color || "#ffffff";
      ctx.strokeRect(x, y, width, height);
    }
    drawRemoteTank(tankState) {
      if (!tankState) {
        return;
      }
      if (tankState.is_dead) {
        return;
      }
      var width = tankState.width || this.width / this.num_of_columns / 3;
      var height = tankState.height || this.height / this.num_of_rows / 3;
      ctx.save();
      ctx.translate(tankState.x + width / 2, tankState.y + height / 2);
      ctx.rotate(tankState.rotation || 0);
      var sprite = document.getElementById("tank");
      if (sprite) {
        var prev = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(sprite, -width / 2, -height / 2, width, height);
        ctx.imageSmoothingEnabled = prev;
      } else {
        ctx.fillStyle = tankState.colour || "#ffffff";
        ctx.fillRect(-width / 2, -height / 2, width, height);
      }
      ctx.restore();
    }
    drawRemoteBullet(bulletState) {
      if (!bulletState) {
        return;
      }
      ctx.beginPath();
      var radius = typeof bulletState.radius === "number" && bulletState.radius > 0 ? bulletState.radius : 1;
      var color = bulletState.colour || "#000000";
      ctx.fillStyle = "#000000";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.arc(bulletState.x, bulletState.y, radius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }
    drawTeleportMirrorState(tankState) {
      var width = tankState.width || this.width / this.num_of_columns / 3;
      var height = tankState.height || this.height / this.num_of_rows / 3;
      ctx.save();
      ctx.translate(
        canvas.width - (tankState.x + width / 2),
        this.height - (tankState.y + height / 2)
      );
      ctx.rotate(tankState.rotation || 0);
      var oldAlpha = ctx.globalAlpha;
      ctx.globalAlpha = 0.3;
      var sprite = document.getElementById("tank");
      if (sprite) {
        var prev = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(sprite, -width / 2, -height / 2, width, height);
        ctx.imageSmoothingEnabled = prev;
      } else {
        ctx.fillStyle = tankState.colour || "#ffffff";
        ctx.fillRect(-width / 2, -height / 2, width, height);
      }
      ctx.globalAlpha = oldAlpha;
      ctx.restore();
    }
    //Will fail if length if full. Will not eject oldest powerup.
    tryAddPowerupAndRepeat() {
      if (this.spectator) {
        return;
      }
      if (this.powerups.length != this.settings.powerup_limit) {
        if (this.powerups.length >= this.settings.powerup_limit) {
          this.powerups.shift();
        }
        var powerup = generatePowerup(this);
        this.placeObject(powerup);
        this.addPowerup(powerup);
        this.message = powerup.getMessage();
      }
      setTimeout(this.tryAddPowerupAndRepeat.bind(this), this.settings.powerup_interval * 1e3, this);
    }
    addPowerup(powerup) {
      if (!powerup) {
        return;
      }
      if (!powerup.id) {
        powerup.id = "powerup-" + this.nextPowerupId++;
      }
      this.powerups.push(powerup);
      if (powerup.registerDelegate) {
        powerup.registerDelegate(this.broadcastPowerupEvent.bind(this));
      }
      try {
        if (peerManager && peerManager.isHost) {
          var typeName = powerup.constructor && powerup.constructor.name ? powerup.constructor.name : powerup.name || "";
          var sid = powerup.img && powerup.img.id ? powerup.img.id : "";
          var color = (powerup.color || "").replace(/[|]/g, "");
          var block = [typeName, powerup.id, Math.round(powerup.x) || 0, Math.round(powerup.y) || 0, Math.round(powerup.width) || 0, Math.round(powerup.height) || 0, sid, color].join("|");
          peerManager.broadcast(["S", block].join(","));
        }
      } catch (_) {
      }
    }
    removePowerup(powerup) {
      this.powerups.splice(this.powerups.indexOf(powerup), 1);
    }
    broadcastPowerupEvent(event) {
      if (!event) {
        return;
      }
      if (!this.pendingPowerupEvents) {
        this.pendingPowerupEvents = [];
      }
      this.pendingPowerupEvents.push(event);
      try {
        if (this.game && this.game.peer_manager && this.game.peer_manager.isHost && typeof this.buildUnifiedDeltaPacket === "function") {
          var pkt = this.buildUnifiedDeltaPacket();
          if (pkt && typeof this.game.peer_manager.broadcast === "function") {
            this.game.peer_manager.broadcast(pkt);
          }
        }
      } catch (_) {
      }
    }
    consumePendingEvents() {
      var events = this.pendingPowerupEvents || [];
      this.pendingPowerupEvents = [];
      return events;
    }
    applyPowerupEvent(event) {
      if (!event) {
        return;
      }
      var tankRef = null;
      if (event.tankId && this.tankById) {
        tankRef = this.tankById[event.tankId] || null;
      }
      if (event.powerup === "TeleportPowerup" && event.tankId) {
        if (!this.teleportMirrors) {
          this.teleportMirrors = {};
        }
        if (event.status === "activate") {
          this.teleportMirrors[event.tankId] = true;
        } else if (event.status === "deactivate") {
          delete this.teleportMirrors[event.tankId];
        }
      }
      if (event.tankId) {
        this.state = this.state || { tanks: {}, powerups: {}, meta: { nextPowerupId: 0 } };
        var st = this.state.tanks[event.tankId] || (this.state.tanks[event.tankId] = { id: event.tankId, powerups: [] });
        if (event.status === "activate") {
          var iconId = this.resolvePowerupSpriteId(event.powerup);
          st.powerups = iconId ? [{ type: event.powerup, spriteId: iconId }] : [{ type: event.powerup }];
        } else if (event.status === "deactivate") {
          st.powerups = [];
        }
        if (this.remoteTankMap) {
          var rt = this.remoteTankMap[event.tankId] || (this.remoteTankMap[event.tankId] = { id: event.tankId });
          rt.powerups = (st.powerups || []).slice();
          this.remoteTankMeta = this.collectRemoteTankMeta();
          this.remoteState = { tanks: this.remoteTankMeta, powerups: this.remotePowerups };
        }
        if (typeof this.recomputeGlobalPowerups === "function") {
          this.recomputeGlobalPowerups();
        }
      }
      var matched = null;
      if (event.powerupId && this.powerups) {
        for (var ix = 0; ix < this.powerups.length; ix++) {
          var pp = this.powerups[ix];
          if (pp && pp.id === event.powerupId) {
            matched = pp;
            break;
          }
        }
      }
      if (!matched && this.powerups) {
        for (var i = 0; i < this.powerups.length; i++) {
          var p = this.powerups[i];
          if (p && String(p.id) === String(event.powerupId)) {
            matched = p;
            break;
          }
        }
      }
      if (event.status === "activate") {
        if (matched) {
          if (typeof matched.pickup === "function") {
            matched.pickup(tankRef || (event.tankId || ""));
            return;
          }
          if (typeof matched.onBulletHit === "function" && tankRef) {
            matched.onBulletHit(tankRef);
            return;
          }
          if (typeof matched.effect === "function") {
            matched.effect(tankRef);
            return;
          }
        }
        return;
      }
      if (event.status === "deactivate") {
        if (tankRef && Array.isArray(tankRef.powerups)) {
          for (var j = 0; j < tankRef.powerups.length; j++) {
            var ap = tankRef.powerups[j];
            var an = ap && ap.constructor && ap.constructor.name ? ap.constructor.name : ap && ap.name;
            if (an === event.powerup) {
              if (typeof ap.teardown === "function") {
                ap.teardown();
              } else if (typeof ap.undo === "function") {
                ap.undo(tankRef);
              }
            }
          }
        }
        if (matched) {
          if (typeof matched.teardown === "function") {
            matched.teardown();
          } else if (typeof matched.undo === "function") {
            matched.undo(tankRef);
          }
        }
        return;
      }
    }
    // Map powerup constructor/name to a known sprite element id for guests
    resolvePowerupSpriteId(name) {
      var n = String(name || "");
      if (/Trippy/i.test(n)) return "illusion";
      if (/Remove\s*Bullet\s*Limit|RemoveBulletLimit/i.test(n)) return "unlimited";
      if (/Triple\s*-?Shot|TripleShot/i.test(n)) return "tripleshot";
      if (/MoveThroughWalls|ghost/i.test(n)) return "ghost";
      if (/Teleport/i.test(n)) return "teleport";
      if (/Cannon(ball)?/i.test(n)) return "cannonball";
      if (/Invis/i.test(n)) return "invisible";
      if (/Shinra/i.test(n)) return "repel";
      if (/Hex/i.test(n)) return "hex";
      return null;
    }
    addTank(tank) {
      this.tanks.push(tank);
    }
    onclick(x, y) {
    }
  };

  // js/pregame/constants.js
  var PREGAME_BORDER_WIDTH = 5;

  // js/pregame/UiNode.js
  var UiNode = class {
    constructor({ x = 0, y = 0, width = 0, height = 0, visible = true } = {}) {
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.visible = visible;
      this.children = [];
      this.parent = null;
    }
    addChild(node) {
      if (!node) {
        return null;
      }
      if (node.parent) {
        node.parent.removeChild(node);
      }
      node.parent = this;
      this.children.push(node);
      return node;
    }
    removeChild(node) {
      const index = this.children.indexOf(node);
      if (index === -1) {
        return;
      }
      node.parent = null;
      this.children.splice(index, 1);
    }
    setChildren(children) {
      this.children.slice().forEach((child) => this.removeChild(child));
      (children || []).forEach((child) => this.addChild(child));
    }
    containsPoint(x, y) {
      return this.visible && x >= this.x && y >= this.y && x <= this.x + this.width && y <= this.y + this.height;
    }
    draw(ctx2) {
      if (!this.visible) {
        return;
      }
      this.drawSelf(ctx2);
      this.children.forEach((child) => child.draw(ctx2));
    }
    drawSelf(ctx2) {
    }
    dispatchClick(x, y) {
      if (!this.containsPoint(x, y)) {
        return false;
      }
      for (let i = this.children.length - 1; i >= 0; i--) {
        if (this.children[i].dispatchClick(x, y)) {
          return true;
        }
      }
      return this.handleClick(x, y);
    }
    handleClick() {
      return false;
    }
  };
  var UiNode_default = UiNode;

  // js/pregame/Panel.js
  var Panel = class extends UiNode_default {
    constructor(colour) {
      super({ x: 0, y: 0, width: canvas.width / 5, height: canvas.height });
      this.colour = colour;
      this.buttons = [];
      this.north_border = PREGAME_BORDER_WIDTH;
      this.east_border = PREGAME_BORDER_WIDTH / 2;
      this.south_border = PREGAME_BORDER_WIDTH;
      this.west_border = PREGAME_BORDER_WIDTH / 2;
    }
    addButton(button) {
      this.buttons.push(button);
      this.addChild(button);
    }
  };
  var Panel_default = Panel;

  // js/pregame/Button.js
  var Button = class extends UiNode_default {
    constructor(panel, x = 0, y = 0, text = "") {
      super({ x: 0, y, width: panel && panel.width ? panel.width / 1.5 : 0, height: 28 });
      this.text = text;
      this.panel = panel;
    }
    get_as_Rect() {
      return [this.x, this.y, this.width, this.height];
    }
    update() {
    }
    resize_horiontals() {
    }
    center_horizontally() {
    }
    center_vertically() {
    }
    handleClick() {
      if (this.onclick) {
        this.onclick();
        return true;
      }
      return false;
    }
  };
  var Button_default = Button;

  // js/pregame/SetControlsButton.js
  var SetControlsButton = class extends Button_default {
    constructor(panel, x, y, text, default_value = "") {
      super(panel, x, y, text + ": ");
      this.control = text + ": ";
      this.value = default_value;
      this.panel.addButton(this);
    }
    keyDownHandler(key) {
      this.value = key;
      if (this.panel && this.panel.pregame && typeof this.panel.pregame.emitTankConfig === "function") {
        this.panel.pregame.emitTankConfig();
      }
    }
    onclick() {
      this.panel.pregame.focus = this;
    }
  };
  var SetControlsButton_default = SetControlsButton;

  // js/pregame/TankPanel.js
  var TankPanel = class extends Panel_default {
    constructor(pregame, colour = "green", assignment = void 0) {
      super(colour);
      this.panelId = "panel-" + Math.random().toString(36).slice(2, 8);
      this.pregame = pregame;
      var delete_button = new Button_default(this, 0, this.height * 10 / 12, "delete");
      delete_button.onclick = function() {
        this.pregame.removeTankPanel(this);
      }.bind(this);
      this.addButton(delete_button);
      delete_button.center_horizontally();
      var controls = ["up", "right", "down", "left", "attack", "special"];
      for (var i = 0; i < controls.length; i++) {
        var button = new SetControlsButton_default(this, 0, this.height * (3 + i) / 12, controls[i], assignment ? assignment[i] : void 0);
        button.center_horizontally();
      }
      if (this.pregame && typeof this.pregame.emitTankConfig === "function") {
        this.pregame.emitTankConfig();
      }
    }
  };
  var TankPanel_default = TankPanel;

  // js/maze/Bullet.js
  var Bullet = class {
    constructor(tank, direction, x, y, radius = 1) {
      this.tank = tank;
      this.direction = direction;
      this.x = x;
      this.y = y;
      this.radius = radius;
      this.bounces = 0;
      this.time_created = tank.maze.tick;
    }
    main() {
      this.handleMovement();
      this.handleTankCollisions();
      this.handlePowerupCollisions();
    }
    draw() {
      ctx.beginPath();
      ctx.fillStyle = "black";
      ctx.strokeStyle = this.tank.colour;
      ctx.lineWidth = 1;
      ctx.arc(this.x, this.y, this.radius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();
    }
    handleMovement() {
      if (!this.tank.maze.doesRectCollide([this.x - this.radius + this.direction[0], this.y - this.radius, this.radius, this.radius])) {
        this.x += this.direction[0];
      } else {
        this.direction[0] *= -1;
        this.bounces += 1;
      }
      if (!this.tank.maze.doesRectCollide([this.x - this.radius, this.y - this.radius + this.direction[1], this.radius, this.radius])) {
        this.y += this.direction[1];
      } else {
        this.direction[1] *= -1;
        this.bounces += 1;
      }
      if (this.bounces >= this.tank.bounce_limit) {
        this.tank.removeBullet(this);
      }
    }
    handleTankCollisions() {
      this.tank.maze.tanks.forEach(function(tank) {
        if (tank == this.tank && this.tank.maze.settings.friendly_fire == false) {
          return;
        }
        if (tank.is_dead == false) {
          var bullet_rect = [this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2];
          var tank_rect = [tank.x, tank.y, tank.width, tank.height];
          if (doRectsOverlap(tank_rect, bullet_rect)) {
            if (tank == this.tank && this.tank.maze.tick - this.time_created < 10) {
              return;
            }
            debugger;
            tank.onBulletHit();
          }
        }
      }.bind(this));
    }
    handlePowerupCollisions() {
      this.tank.maze.powerups.forEach(
        function(powerup) {
          var bullet_rect = [this.x - this.radius, this.y - this.radius, this.radius * 2, this.radius * 2];
          var powerup_rect = [powerup.x, powerup.y, powerup.width, powerup.height];
          if (doRectsOverlap(powerup_rect, bullet_rect)) {
            powerup.onBulletHit(this.tank);
          }
        }.bind(this)
      );
    }
  };
  var Bullet_default = Bullet;

  // js/maze/Tank.js
  var DEFAULT_RECHARGE_DURATION = 20;
  var TANK_ACTIONS = ["up", "right", "down", "left", "fire", "special"];
  function createInputState() {
    return { up: false, right: false, down: false, left: false, fire: false, special: false };
  }
  function forwardVector(angle, magnitude) {
    return {
      x: Math.sin(angle) * magnitude,
      y: -Math.cos(angle) * magnitude
    };
  }
  var Tank = class {
    /**
     * @param {number} x
     * @param {number} y
     * @param {Maze} maze
     * @param {string[]} controls - ordered as [up, right, down, left, fire, special]
     * @param {string} colour
     * @param {{ disableInput?: boolean }} options
     */
    constructor(x, y, maze, controls, colour = "black", options) {
      this.x = x;
      this.y = y;
      this.maze = maze;
      this.colour = colour;
      this.powerups = [];
      this.maze.tanks.push(this);
      const opts = options || {};
      this.disableInput = !!opts.disableInput;
      const sampleSquare = this.maze.squares[0][0];
      this.width = this.maze.width / this.maze.num_of_columns / 3;
      this.height = this.maze.height / this.maze.num_of_rows / 3;
      this.rotation = 0;
      this.bullets = [];
      this.bullet_limit = this.maze.settings.bullet_limit;
      this.bounce_limit = this.maze.settings.bounce_limit;
      this.score = 0;
      this.is_dead = false;
      this.poweruplock = false;
      this.move_speed = this.maze.settings.move_speed * Math.min(sampleSquare.width, sampleSquare.height) / 60 * 0.8;
      this.rotation_speed = this.maze.settings.rotation_speed * 1.2;
      this.localInput = createInputState();
      this.networkInput = createInputState();
      this.activePowerups = [];
      this.pendingPowerupUpdates = false;
      this.fireWasActive = false;
      this.upPressed = false;
      this.rightPressed = false;
      this.downPressed = false;
      this.leftPressed = false;
      this.shooting = false;
      this.specialKeyPressed = false;
      this.hasFiredThisPress = false;
      this.special = function() {
      };
      this.rechargeDuration = this.maze && this.maze.settings && typeof this.maze.settings.recharge_duration === "number" ? this.maze.settings.recharge_duration : DEFAULT_RECHARGE_DURATION;
      this.setControls(controls);
    }
    setControls(controls) {
      this.controls = Array.isArray(controls) ? controls.slice(0, TANK_ACTIONS.length) : [];
    }
    setLocalAction(action, isActive) {
      if (!Object.prototype.hasOwnProperty.call(this.localInput, action)) {
        return;
      }
      if (this.localInput[action] === isActive) {
        return;
      }
      this.localInput[action] = isActive;
      if (action === "special" && !isActive) {
        this.poweruplock = false;
      }
      if (action === "fire") {
        if (!isActive) {
          this.hasFiredThisPress = false;
        }
      }
      this.syncDerivedInput();
    }
    applyNetworkInput(input) {
      if (!input) {
        return;
      }
      TANK_ACTIONS.forEach((action, index) => {
        const key = action === "fire" ? "shooting" : action === "special" ? "specialKeyPressed" : `${action}Pressed`;
        if (action === "fire" && typeof input.shooting === "boolean") {
          this.networkInput.fire = input.shooting;
        } else if (action === "special" && typeof input.specialKeyPressed === "boolean") {
          this.networkInput.special = input.specialKeyPressed;
          if (!input.specialKeyPressed) {
            this.poweruplock = false;
          }
        } else if (typeof input[key] === "boolean") {
          this.networkInput[action] = input[key];
        }
      });
      this.syncDerivedInput();
      this.pendingPowerupUpdates = true;
    }
    syncDerivedInput() {
      this.upPressed = this.isActionActive("up");
      this.rightPressed = this.isActionActive("right");
      this.downPressed = this.isActionActive("down");
      this.leftPressed = this.isActionActive("left");
      this.shooting = this.isActionActive("fire");
      this.specialKeyPressed = this.isActionActive("special");
      if (!this.shooting) {
        this.fireWasActive = false;
        this.hasFiredThisPress = false;
      }
      if (!this.specialKeyPressed) {
        this.poweruplock = false;
      }
    }
    isActionActive(action) {
      return !!(this.localInput[action] || this.networkInput[action]);
    }
    actionForKey(key) {
      const index = this.controls ? this.controls.indexOf(key) : -1;
      return index >= 0 ? TANK_ACTIONS[index] : null;
    }
    setLocalActionForKey(key, isActive) {
      const action = this.actionForKey(key);
      if (!action) {
        return;
      }
      this.setLocalAction(action, isActive);
    }
    main() {
      if (!this.is_dead) {
        if (this.shouldFire()) {
          this.fire();
        }
        if (this.isActionActive("special")) {
          this.special();
        }
      }
      this.bullets.forEach((bullet) => bullet.main());
      if (!this.is_dead) {
        this.handleMovement();
      }
    }
    draw() {
      this.drawBullets();
      if (this.is_dead) {
        return;
      }
      this.drawBody();
    }
    drawBullets() {
      this.bullets.forEach((bullet) => bullet.draw());
    }
    drawBody() {
      if (!this.img) {
        var el = document.getElementById("tank");
        if (el && el.tagName === "IMG" && el.complete && el.naturalWidth > 0) {
          this.img = el;
        }
      }
      ctx.save();
      ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
      ctx.rotate(this.rotation);
      if (this.img && this.img.tagName === "IMG" && this.img.complete && this.img.naturalWidth > 0) {
        var prev = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(this.img, -this.width / 2, -this.height / 2, this.width, this.height);
        ctx.imageSmoothingEnabled = prev;
      } else {
        ctx.fillStyle = this.colour;
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
      }
      ctx.restore();
    }
    getPowerupState() {
      if (!this.pendingPowerupUpdates) {
        return;
      }
      this.pendingPowerupUpdates = false;
      var powerupNames = this.powerups.map(function(powerup) {
        return powerup.name;
      });
      return { tankId: this.id, powerups: powerupNames };
    }
    shouldFire() {
      const active = this.isActionActive("fire");
      if (!active) {
        this.fireWasActive = false;
        return false;
      }
      if (this.hasFiredThisPress) {
        return false;
      }
      if (this.bullets.length >= this.bullet_limit) {
        return false;
      }
      if (this.isWithinRechargeWindow()) {
        return false;
      }
      this.hasFiredThisPress = true;
      this.fireWasActive = true;
      return true;
    }
    isWithinRechargeWindow() {
      var recharge = typeof this.rechargeDuration === "number" ? this.rechargeDuration : DEFAULT_RECHARGE_DURATION;
      if (!recharge || recharge <= 0) {
        return false;
      }
      if (!Array.isArray(this.bullets) || this.bullets.length === 0) {
        return false;
      }
      var tick = this.maze && typeof this.maze.tick === "number" ? this.maze.tick : 0;
      for (var i = 0; i < this.bullets.length; i++) {
        var bullet = this.bullets[i];
        if (!bullet || bullet.time_created == null) {
          continue;
        }
        var age = tick - bullet.time_created;
        if (age > 0 && age < recharge) {
          return true;
        }
      }
      return false;
    }
    fire() {
      this.fireHelper(this.rotation, this.maze.settings.bullet_speed);
    }
    fireHelper(rotation, speed) {
      const velocity = forwardVector(rotation, speed);
      const centerX = this.x + this.width / 2;
      const centerY = this.y + this.height / 2;
      const bulletRadius = 1;
      const originX = centerX + Math.sin(rotation);
      const originY = centerY - Math.cos(rotation);
      const newBullet = new Bullet_default(this, [velocity.x, velocity.y], originX, originY, bulletRadius);
      this.bullets.push(newBullet);
    }
    fire_helper(rotation, speed) {
      this.fireHelper(rotation, speed);
    }
    handleMovement() {
      if (this.isActionActive("right")) {
        this.rotation += this.rotation_speed;
      }
      if (this.isActionActive("left")) {
        this.rotation -= this.rotation_speed;
      }
      if (this.isActionActive("up")) {
        const forward = forwardVector(this.rotation, this.move_speed);
        this.tryMovingTo([this.x + forward.x, this.y]);
        this.tryMovingTo([this.x, this.y + forward.y]);
      }
      if (this.isActionActive("down")) {
        const backward = forwardVector(this.rotation, -this.move_speed);
        this.tryMovingTo([this.x + backward.x, this.y]);
        this.tryMovingTo([this.x, this.y + backward.y]);
      }
    }
    tryMovingTo(pos) {
      if (this.maze.doesRectCollide([this.x, this.y, this.width, this.height])) {
        const centerNow = this.maze.getSquareAtXY([this.x, this.y]).getCenter();
        this.x = centerNow[0];
        this.y = centerNow[1];
      }
      if (!this.maze.doesRectCollide([pos[0], pos[1], this.width, this.height])) {
        this.x = pos[0];
        this.y = pos[1];
        return;
      }
      if (!this.maze.doesRectCollide([pos[0], this.y, this.width, this.height])) {
        this.x = pos[0];
        return;
      }
      if (!this.maze.doesRectCollide([this.x, pos[1], this.width, this.height])) {
        this.y = pos[1];
        return;
      }
      const center = this.maze.getSquareAtXY([this.x, this.y]).getCenter();
      this.x = center[0];
      this.y = center[1];
    }
    keyDownHandler(e) {
      if (this.disableInput) {
        return;
      }
      const key = typeof e === "string" ? e : e && e.key;
      if (!key) {
        return;
      }
      this.setLocalActionForKey(key, true);
    }
    keyUpHandler(e) {
      if (this.disableInput) {
        return;
      }
      const key = typeof e === "string" ? e : e && e.key;
      if (!key) {
        return;
      }
      this.setLocalActionForKey(key, false);
    }
    loadImage(imgElement) {
      this.img = imgElement;
    }
    originalMovement() {
      const ms = this.move_speed;
      if (this.upPressed) {
        this.tryMovingTo([this.x, this.y - ms]);
      }
      if (this.rightPressed) {
        this.tryMovingTo([this.x + ms, this.y]);
      }
      if (this.downPressed) {
        this.tryMovingTo([this.x, this.y + ms]);
      }
      if (this.leftPressed) {
        this.tryMovingTo([this.x - ms, this.y]);
      }
    }
    onBulletHit() {
      this.destroy();
    }
    destroy() {
      this.is_dead = true;
      this.maze.tankDestroyed();
    }
    restart() {
      this.is_dead = false;
      const pos = this.maze.getRandomSquare().getCenter();
      this.x = pos[0];
      this.y = pos[1];
      this.bullets = [];
      this.fireWasActive = false;
      this.localInput = createInputState();
      this.networkInput = createInputState();
      this.syncDerivedInput();
      this.removeAllPowerups();
    }
    addPowerup(powerup) {
      this.removeAllPowerups();
      this.powerups.push(powerup);
      powerup.effect(this);
      this.pendingPowerupUpdates = true;
    }
    removePowerup(powerup) {
      const index = this.powerups.indexOf(powerup);
      if (index === -1) {
        return;
      }
      try {
        if (powerup && powerup.timeout) {
          clearTimeout(powerup.timeout);
          powerup.timeout = null;
        }
      } catch (_) {
      }
      powerup.undo(this);
      if (typeof powerup.notifyDeactivate === "function") {
        powerup.notifyDeactivate(this);
      }
      this.powerups.splice(index, 1);
      this.pendingPowerupUpdates = true;
    }
    removeAllPowerups() {
      this.powerups.slice().forEach((powerup) => {
        powerup.tank.removePowerup(powerup);
      });
    }
    removeBullet(bullet) {
      removeElementFromArray2(bullet, this.bullets);
    }
  };
  var Tank_default = Tank;

  // js/render/pregame_dom.js
  var overlayEl = null;
  var innerEl2 = null;
  var hasBoundKeyListener = false;
  var keyCaptureButton = null;
  var keyCaptureNode = null;
  function ensureEls() {
    if (!overlayEl) overlayEl = document.getElementById("pregame-overlay");
    if (!innerEl2) innerEl2 = document.getElementById("pregame-inner");
  }
  function setPregameOverlayVisible(visible) {
    ensureEls();
    if (!overlayEl) return;
    overlayEl.classList.toggle("hidden", !visible);
  }
  function resetInner() {
    ensureEls();
    if (!innerEl2) return;
    innerEl2.replaceChildren();
  }
  function getControlLabel(button) {
    if (!button) return "";
    return `${button.text || ""}${button.value || ""}`;
  }
  function setActiveControl(button, node) {
    if (keyCaptureNode && keyCaptureNode !== node) {
      keyCaptureNode.classList.remove("pg-control--active");
    }
    keyCaptureButton = button || null;
    keyCaptureNode = node || null;
    if (keyCaptureNode) {
      keyCaptureNode.classList.add("pg-control--active");
    }
  }
  function syncActiveControl(button, node) {
    if (!keyCaptureButton || keyCaptureButton !== button) {
      return;
    }
    if (keyCaptureNode && keyCaptureNode !== node) {
      keyCaptureNode.classList.remove("pg-control--active");
    }
    keyCaptureNode = node;
    keyCaptureNode.classList.add("pg-control--active");
  }
  function clearActiveControl() {
    setActiveControl(null, null);
  }
  function bindKeyCaptureOnce(pregame) {
    if (hasBoundKeyListener) return;
    document.addEventListener(
      "keydown",
      (ev) => {
        if (!keyCaptureButton) return;
        ev.stopPropagation();
        ev.preventDefault();
        const val = ev.key;
        try {
          keyCaptureButton.value = val;
          if (keyCaptureNode) {
            keyCaptureNode.textContent = getControlLabel(keyCaptureButton);
          }
          if (pregame && typeof pregame.emitTankConfig === "function") {
            pregame.emitTankConfig();
          }
        } catch (_) {
        }
        clearActiveControl();
      },
      true
    );
    hasBoundKeyListener = true;
  }
  function resolvePaletteToken(pregame, colour) {
    if (!colour) return "default";
    const templates = pregame && pregame.colour_templates || [];
    const idx = templates.findIndex(
      (value) => typeof value === "string" && value.toLowerCase() === colour.toLowerCase()
    );
    if (idx === -1) {
      return "default";
    }
    return String(idx);
  }
  function renderStartPanel(pregame, root) {
    const card = document.createElement("section");
    card.className = "pg-card pg-card--start";
    const title = document.createElement("h2");
    title.className = "pg-card__title";
    title.textContent = "Pregame";
    card.appendChild(title);
    const description = document.createElement("p");
    description.className = "pg-card__description";
    description.textContent = "Configure tanks, adjust settings, and start the match when you're ready.";
    card.appendChild(description);
    const actions = document.createElement("div");
    actions.className = "pg-action-list";
    card.appendChild(actions);
    const sp = pregame.start_panel;
    function addAction(label, handler, extraClass = "") {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = extraClass ? `pg-btn ${extraClass}` : "pg-btn";
      btn.textContent = label;
      btn.addEventListener("click", handler);
      actions.appendChild(btn);
      return btn;
    }
    addAction("Start", () => {
      if (sp && typeof sp.start === "function") {
        sp.start.call(pregame);
      }
    }, "pg-btn--primary");
    addAction("Add Tank", () => {
      const i = pregame.tank_panels.length;
      const templates = pregame.colour_templates || [];
      const controlsTemplates = pregame.controls_templates || [];
      const colour = templates[i % templates.length] || templates[0] || "#63C132";
      const controls = controlsTemplates[i % controlsTemplates.length] || controlsTemplates[0] || [
        "ArrowUp",
        "ArrowRight",
        "ArrowDown",
        "ArrowLeft",
        "1",
        "2"
      ];
      pregame.addTankPanel(new TankPanel_default(pregame, colour, controls));
    });
    addAction("Settings", () => {
      pregame.showSettingsPanel();
    });
    addAction("Networking", () => {
      const networking = pregame && pregame.game && pregame.game.networking;
      if (networking && typeof networking.showConnectOverlay === "function") {
        networking.showConnectOverlay();
      }
    });
    root.appendChild(card);
  }
  function renderTankPanels(pregame, root) {
    const stack = document.createElement("section");
    stack.className = "pg-tank-stack";
    const header = document.createElement("div");
    header.className = "pg-stack-header";
    header.textContent = "Tanks";
    stack.appendChild(header);
    const tankGrid = document.createElement("div");
    tankGrid.className = "pg-tank-grid";
    stack.appendChild(tankGrid);
    const panels = pregame.tank_panels || [];
    if (!panels.length) {
      const empty = document.createElement("p");
      empty.className = "pg-empty-state";
      empty.textContent = "Click \u201CAdd Tank\u201D to configure local players.";
      tankGrid.appendChild(empty);
      root.appendChild(stack);
      return;
    }
    const controlNames = ["Up", "Right", "Down", "Left", "Attack", "Special"];
    panels.forEach((tp, index) => {
      const tankCard = document.createElement("article");
      tankCard.className = "pg-card pg-tank";
      const paletteToken = resolvePaletteToken(pregame, tp.colour);
      tankCard.dataset.palette = paletteToken;
      const title = document.createElement("header");
      title.className = "pg-tank__title";
      const swatch = document.createElement("span");
      swatch.className = "pg-tank__swatch";
      title.appendChild(swatch);
      const titleText = document.createElement("span");
      titleText.textContent = `Tank ${index + 1}`;
      title.appendChild(titleText);
      tankCard.appendChild(title);
      const controlList = document.createElement("div");
      controlList.className = "pg-control-list";
      tankCard.appendChild(controlList);
      for (let ci = 0; ci < controlNames.length; ci++) {
        const btnObj = tp.buttons[1 + ci];
        const control = document.createElement("button");
        control.type = "button";
        control.className = "pg-control";
        control.dataset.role = controlNames[ci].toLowerCase();
        control.textContent = getControlLabel(btnObj);
        control.title = "Click, then press a key";
        control.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          if (btnObj && typeof btnObj.onclick === "function") {
            btnObj.onclick();
          } else if (pregame) {
            pregame.focus = btnObj;
          }
          setActiveControl(btnObj, control);
        });
        controlList.appendChild(control);
        syncActiveControl(btnObj, control);
      }
      const footer = document.createElement("div");
      footer.className = "pg-tank__footer";
      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "pg-btn pg-btn--danger";
      delBtn.textContent = "Delete Tank";
      delBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        if (keyCaptureButton && keyCaptureButton.panel === tp) {
          clearActiveControl();
        }
        pregame.removeTankPanel(tp);
      });
      footer.appendChild(delBtn);
      tankCard.appendChild(footer);
      tankGrid.appendChild(tankCard);
    });
    root.appendChild(stack);
  }
  function renderPregameMainPanels(pregame) {
    ensureEls();
    if (!overlayEl || !innerEl2) return;
    bindKeyCaptureOnce(pregame);
    resetInner();
    const layout = document.createElement("div");
    layout.className = "pg-main-layout";
    renderStartPanel(pregame, layout);
    renderTankPanels(pregame, layout);
    innerEl2.appendChild(layout);
  }
  function renderPregameSettingsPanel(pregame) {
    ensureEls();
    if (!overlayEl || !innerEl2) return;
    clearActiveControl();
    resetInner();
    const panel = pregame.settings;
    const layout = document.createElement("div");
    layout.className = "pg-settings-layout";
    const card = document.createElement("section");
    card.className = "pg-card pg-card--settings";
    const title = document.createElement("h2");
    title.className = "pg-card__title";
    title.textContent = "Settings";
    card.appendChild(title);
    const list = document.createElement("div");
    list.className = "pg-setting-list";
    card.appendChild(list);
    const buttons = panel.buttons || [];
    buttons.forEach((btn) => {
      if (!btn || btn === panel.back) {
        return;
      }
      const row = document.createElement("label");
      row.className = "pg-setting";
      const span = document.createElement("span");
      span.className = "pg-setting__label";
      span.textContent = btn.text || "";
      row.appendChild(span);
      if ((btn.text || "").toLowerCase().includes("friendly fire")) {
        row.classList.add("pg-setting--toggle");
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = (btn.value || "").toString().toLowerCase() === "true";
        input.addEventListener("change", () => {
          btn.value = input.checked ? "true" : "false";
        });
        row.appendChild(input);
      } else {
        const input = document.createElement("input");
        input.type = "text";
        input.value = (btn.value || "").toString();
        input.addEventListener("input", () => {
          btn.value = input.value;
        });
        row.appendChild(input);
      }
      list.appendChild(row);
    });
    const footer = document.createElement("div");
    footer.className = "pg-settings__footer";
    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "pg-btn pg-btn--primary";
    backBtn.textContent = panel.back && panel.back.text ? panel.back.text : "Back";
    backBtn.addEventListener("click", () => {
      const ok = panel.save();
      if (ok === false) {
        backBtn.textContent = panel.back && panel.back.text ? panel.back.text : "Back";
        return;
      }
      pregame.showMainPanels();
    });
    footer.appendChild(backBtn);
    card.appendChild(footer);
    layout.appendChild(card);
    innerEl2.appendChild(layout);
  }

  // js/pregame/StartPanel.js
  var StartPanel = class extends Panel_default {
    constructor(colour, pregame) {
      super(colour);
      this.pregame = pregame;
      this.west_border = PREGAME_BORDER_WIDTH;
      this.east_border = PREGAME_BORDER_WIDTH;
      var start_button = new Button_default(this, 0, 0, "Start");
      start_button.onclick = this.start.bind(this.pregame);
      start_button.center_horizontally();
      start_button.y = canvas.height * 9 / 20;
      this.addButton(start_button);
      var add_button = new Button_default(this, 0, 0, "Add Tank");
      add_button.onclick = function() {
        var pregame2 = this.panel.pregame;
        var current_template = pregame2.tank_panels.length;
        pregame2.addTankPanel(new TankPanel_default(pregame2, pregame2.colour_templates[current_template], pregame2.controls_templates[current_template]));
      };
      add_button.y = canvas.height * 11 / 20;
      add_button.center_horizontally();
      this.addButton(add_button);
      var settings_button = new Button_default(this, 0, 0, "Settings");
      settings_button.onclick = function() {
        this.pregame.showSettingsPanel();
      }.bind(this);
      settings_button.y = canvas.height * 13 / 20;
      settings_button.center_horizontally();
      this.addButton(settings_button);
      var networking_button = new Button_default(this, 0, 0, "Networking");
      networking_button.onclick = function() {
        if (this.pregame.game && this.pregame.game.networking) {
          this.pregame.game.networking.showConnectOverlay();
          if (peerManager && typeof peerManager.emitPlayerList === "function") {
            peerManager.emitPlayerList();
          }
        }
      }.bind(this);
      networking_button.y = canvas.height * 15 / 20;
      networking_button.center_horizontally();
      this.addButton(networking_button);
    }
    start() {
      if (this.pregame && this.pregame.game && this.pregame.game.networking) {
        try {
          this.pregame.game.networking.disableOverlay();
        } catch (_) {
        }
      }
      if (peerManager && peerManager.connections && peerManager.connections.length > 0 && !peerManager.isHost) {
        addChatMessage("* Only the host can start the match.", "notification-message");
        return;
      }
      var maze = this.game.maze;
      this.game.main_object = maze;
      if (typeof maze.beginGameplay === "function") {
        maze.beginGameplay();
      }
      try {
        setHudScoreboardVisible(true);
        layoutHudOverCanvas();
      } catch (_) {
      }
      try {
        setPregameOverlayVisible(false);
      } catch (_) {
      }
      maze.hostOwned = true;
      var tankPayloads = [];
      var ownerId = peerManager && peerManager.id ? peerManager.id : "local";
      for (var i = 0; i < this.tank_panels.length; i++) {
        var panel = this.tank_panels[i];
        var cb = panel.buttons;
        var controls = [cb[1].value, cb[2].value, cb[3].value, cb[4].value, cb[5].value, cb[6].value];
        var rnd_pos = maze.getRandomSquare().getCenter();
        var tank = new Tank_default(0, 0, maze, controls, panel.colour);
        tank.id = ownerId + "-" + (panel.panelId || "tank-" + i);
        tank.ownerPeerId = ownerId;
        var tankSprite = document.getElementById("tank");
        if (tankSprite && tankSprite.tagName === "IMG" && tankSprite.complete && tankSprite.naturalWidth > 0) {
          tank.loadImage(tankSprite);
        }
        maze.registerTank && maze.registerTank(tank);
        maze.placeObject(tank);
        tankPayloads.push({
          id: tank.id,
          colour: tank.colour,
          controls,
          ownerPeerId: ownerId,
          score: tank.score,
          x: tank.x,
          y: tank.y,
          rotation: tank.rotation,
          width: tank.width,
          height: tank.height
        });
      }
      if (peerManager && peerManager.isHost) {
        var remoteConfigs = peerManager.remoteTankConfigs || {};
        Object.keys(remoteConfigs).forEach(function(peerId) {
          if (!remoteConfigs[peerId] || remoteConfigs[peerId].length === 0) {
            return;
          }
          if (peerId === ownerId) {
            return;
          }
          remoteConfigs[peerId].forEach(function(cfg, idx) {
            var controls2 = cfg.controls && cfg.controls.length ? cfg.controls : ["w", "d", "s", "a", "f", "g"];
            var tank2 = new Tank_default(0, 0, maze, controls2, cfg.colour || "#cccccc", { disableInput: true });
            tank2.id = peerId + "-" + (cfg.panelId || "tank-" + idx);
            tank2.ownerPeerId = peerId;
            tank2.score = cfg.score || 0;
            var remoteSprite = document.getElementById("tank");
            if (remoteSprite) {
              tank2.loadImage(remoteSprite);
            }
            maze.registerTank && maze.registerTank(tank2);
            maze.placeObject(tank2);
            tankPayloads.push({
              id: tank2.id,
              colour: tank2.colour,
              controls: controls2,
              ownerPeerId: peerId,
              score: tank2.score,
              x: tank2.x,
              y: tank2.y,
              rotation: tank2.rotation,
              width: tank2.width,
              height: tank2.height
            });
          });
        });
      }
      if (peerManager && peerManager.isHost && peerManager.connections && peerManager.connections.length > 0) {
        if (typeof maze.serializeInitString === "function") {
          try {
            peerManager.broadcast(maze.serializeInitString());
          } catch (e) {
          }
        }
        peerManager.maybeEmitReady && peerManager.maybeEmitReady("host-start");
      }
    }
  };
  var StartPanel_default = StartPanel;

  // js/pregame/SetSettingsButton.js
  var SetSettingsButton = class extends SetControlsButton_default {
    constructor(panel, x, y, text, default_value = "", attribute_name) {
      super(panel, x, y, text, default_value);
      this.attribute_name = attribute_name;
      var g = this.panel.pregame.game;
      var s = g.maze && g.maze.settings ? g.maze.settings : {};
      this.value = (attribute_name in s ? s[attribute_name] : "").toString();
    }
    keyDownHandler(key) {
      if (key == "Backspace") {
        this.value = this.value.slice(0, -1);
        return;
      }
      if (key == "Enter") {
        this.panel.pregame.focus = this.panel.back;
        return;
      }
      this.value += key;
    }
    onclick() {
      this.panel.pregame.focus = this;
      this.value = "";
    }
  };
  var SetSettingsButton_default = SetSettingsButton;

  // js/pregame/SettingsPanel.js
  var SettingsPanel = class extends Panel_default {
    constructor(pregame) {
      super("Green");
      this.width = canvas.width;
      this.pregame = pregame;
      this.settings = [
        ["Number of Rows", "num_of_rows"],
        ["Number of Columns", "num_of_columns"],
        ["Movement Speed", "move_speed"],
        ["Friendly Fire", "friendly_fire"],
        ["Number of Bullets", "bullet_limit"],
        ["Time Between Powerups (s)", "powerup_interval"],
        ["Max powerups on screen", "powerup_limit"],
        ["Duration of powerups (s)", "powerup_duration"]
      ];
      this.settings.forEach(function(ar) {
        this.make_button(ar);
      }.bind(this));
      this.addBackButton();
      var blen = this.buttons.length;
      for (var i = 0; i < blen; i++) {
        var button = this.buttons[i];
        button.y = canvas.height * 4 / 5 / (blen - 1) * i + button.height;
        button.resize_horiontals();
      }
    }
    addBackButton() {
      var back = new Button_default(this, 0, 0, "Back");
      this.back = back;
      back.y = canvas.height * 5 / 6;
      back.update();
      back.onclick = function() {
        var save_successful = this.save();
        if (!save_successful) {
          return;
        }
        this.pregame.showMainPanels();
      }.bind(this);
      back.keyDownHandler = function(key) {
        if (key == "Enter" && this.panel.pregame.focus == this) {
          this.onclick();
        }
      };
      this.addButton(back);
    }
    save() {
      var back_button = this.back;
      var buttons_that_must_be_posints = [0, 1, 4, 6];
      var buttons_that_must_be_posnumbers = [2, 5, 7];
      for (var i = 0; i < buttons_that_must_be_posints.length; i++) {
        var button = this.buttons[buttons_that_must_be_posints[i]];
        if (!this.isPosInt(button.value)) {
          back_button.text = "x must be positive Integer".replace("x", button.text).replace(":", "");
          return false;
        }
        var game2 = button.panel.pregame.game;
        var name = button.attribute_name;
        var raw = button.value;
        var intNames = ["num_of_rows", "num_of_columns", "bullet_limit", "powerup_limit", "seconds_between_rounds"];
        var numNames = ["move_speed", "rotation_speed", "bullet_speed", "powerup_interval", "powerup_duration"];
        var val = raw;
        if (intNames.indexOf(name) !== -1) {
          val = parseInt(raw, 10);
        }
        if (numNames.indexOf(name) !== -1) {
          val = parseFloat(raw);
        }
        game2.maze.settings[name] = val;
      }
      for (var i = 0; i < buttons_that_must_be_posnumbers.length; i++) {
        var button = this.buttons[buttons_that_must_be_posnumbers[i]];
        if (!this.isPosNumber(button.value)) {
          back_button.text = "x must be positive Integer".replace("x", button.text).replace(":", "");
          return false;
        }
        var numericGame = button.panel.pregame.game;
        var numericName = button.attribute_name;
        numericGame.maze.settings[numericName] = parseFloat(button.value);
      }
      var friendly_fire_button = this.buttons[3];
      this.pregame.game.maze.settings.friendly_fire = friendly_fire_button.value == "true" ? true : false;
      back_button.text = "Back";
      return true;
    }
    isPosInt(str) {
      if (isNaN(str)) {
        return false;
      }
      var number = parseFloat(str);
      if (!Number.isInteger(number) || number < 0) {
        return false;
      }
      return true;
    }
    isPosNumber(str) {
      if (isNaN(str)) {
        return false;
      }
      var number = parseFloat(str);
      if (number <= 0) {
        return false;
      }
      return true;
    }
    make_button(ar) {
      var text = ar[0];
      var attribute_name = ar[1];
      this[attribute_name] = new SetSettingsButton_default(this, 0, 0, text, "", attribute_name);
      if (ar[0] == "Friendly Fire") {
        this[attribute_name].onclick = function() {
          this.panel.pregame.focus = this;
          this.value == "true" ? this.value = "false" : this.value = "true";
        };
      }
    }
  };
  var SettingsPanel_default = SettingsPanel;

  // js/pregame/Pregame.js
  var Pregame = class {
    constructor(game2, height) {
      this.game = game2;
      this.height = canvas.height;
      this.width = canvas.width;
      this.root = new UiNode_default({
        x: 0,
        y: 0,
        width: this.width,
        height: this.height
      });
      this.focus = null;
      this.start_panel = new StartPanel_default("red", this);
      this.tank_panels = [];
      this.settings = new SettingsPanel_default(this);
      this.current_panels = [];
      this.colour_templates = [
        "#63C132",
        "#FFAD69",
        "#54F2F2",
        "#D90429",
        "#04A777",
        "#042A2B",
        "#6D98BA",
        "#D3B99F",
        "#1E3888",
        "#1282A2",
        "#D90368"
      ];
      this.controls_templates = [
        ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", "1", "2"],
        ["w", "d", "s", "a", "f", "g"],
        ["y", "j", "h", "g", "k", "l"]
      ];
      this.showMainPanels();
      this.updatePanelHorizontals();
      this.ensureDefaultTank();
      try {
        setPregameOverlayVisible(true);
        renderPregameMainPanels(this);
      } catch (_) {
      }
    }
    main() {
    }
    draw() {
    }
    syncRootWithPanels(panels) {
      this.current_panels = panels;
      this.root.setChildren(panels);
    }
    showMainPanels() {
      this.focus = null;
      this.syncRootWithPanels([this.start_panel].concat(this.tank_panels));
      try {
        setPregameOverlayVisible(true);
        renderPregameMainPanels(this);
      } catch (_) {
      }
    }
    showSettingsPanel() {
      this.focus = null;
      this.syncRootWithPanels([this.settings]);
      try {
        setPregameOverlayVisible(true);
        renderPregameSettingsPanel(this);
      } catch (_) {
      }
    }
    addTankPanel(tank_panel) {
      this.tank_panels.push(tank_panel);
      this.showMainPanels();
      this.updatePanelHorizontals();
      this.emitTankConfig();
      try {
        renderPregameMainPanels(this);
      } catch (_) {
      }
    }
    removeTankPanel(tank_panel) {
      this.tank_panels.splice(this.tank_panels.indexOf(tank_panel), 1);
      this.showMainPanels();
      this.updatePanelHorizontals();
      this.emitTankConfig();
      try {
        renderPregameMainPanels(this);
      } catch (_) {
      }
    }
    updatePanelHorizontals() {
      (this.tank_panels || []).forEach(function(tank_panel) {
        if (!tank_panel || !Array.isArray(tank_panel.buttons)) {
          return;
        }
        tank_panel.buttons.forEach(function(b) {
          if (b && typeof b.update === "function") {
            b.update();
          }
        });
        tank_panel.east_border = PREGAME_BORDER_WIDTH / 2;
      });
      if (this.tank_panels.length > 0) {
        this.tank_panels[this.tank_panels.length - 1].east_border = PREGAME_BORDER_WIDTH;
      }
    }
    // Match old implementation: iterate panels/buttons and fire onclick on hit
    onclick(x, y) {
      this.button_has_been_found = false;
      var panels = this.current_panels || [];
      for (var p = 0; p < panels.length && !this.button_has_been_found; p++) {
        var panel = panels[p];
        var btns = panel.buttons || [];
        for (var b = 0; b < btns.length && !this.button_has_been_found; b++) {
          var button = btns[b];
          var rect = [x, y, 1, 1];
          var brect = button.get_as_Rect ? button.get_as_Rect() : [button.x, button.y, button.width, button.height];
          var hit = typeof doRectsOverlap === "function" ? doRectsOverlap(rect, brect) : x >= button.x && y >= button.y && x <= button.x + button.width && y <= button.y + button.height;
          if (hit) {
            this.button_has_been_found = true;
            if (typeof button.onclick === "function") {
              button.onclick();
            }
          }
        }
      }
    }
    keyDownHandler(e) {
      if (this.focus == null) {
        return;
      }
      this.focus.keyDownHandler(e);
    }
    emitTankConfig() {
      if (typeof peerManager.sendTankConfig !== "function") {
        return;
      }
      var configs = this.getTankPanelConfigs();
      peerManager.sendTankConfig(configs);
    }
    getTankPanelConfigs() {
      return this.tank_panels.map(function(panel, index) {
        var controls = panel.buttons.filter(function(btn) {
          return btn instanceof SetControlsButton_default;
        }).map(function(btn) {
          return btn.value || "";
        });
        return {
          panelId: panel.panelId || "panel-" + index,
          colour: panel.colour,
          controls
        };
      });
    }
    ensureDefaultTank() {
      if (this.tank_panels.length === 0) {
        var colour = this.colour_templates[0] || "#63C132";
        var controls = this.controls_templates[0] || [
          "ArrowUp",
          "ArrowRight",
          "ArrowDown",
          "ArrowLeft",
          "1",
          "2"
        ];
        this.addTankPanel(new TankPanel_default(this, colour, controls));
      }
    }
  };

  // js/Game.js
  var Game = class {
    constructor() {
      this.maze = new Maze(this);
      try {
        window.__mazeRef = this.maze;
      } catch (_) {
      }
      this.pregame = new Pregame(this, canvas.height * 3 / 4);
      this.networking = new NetworkingScreen(this);
      this.main_object = this.pregame;
      this.clientControlMap = {};
      this.clientInputState = {};
      this.clientInputHandlers = null;
      this.clientInputBound = false;
      try {
        setHudScoreboardVisible(false);
      } catch (_) {
      }
      try {
        ensureHudScoreboardHandlers();
      } catch (_) {
      }
    }
    main() {
      this.main_object.main();
    }
    onclick(x, y) {
      this.main_object.onclick(x, y);
    }
    keyDownHandler(key) {
      this.main_object.keyDownHandler(key);
    }
    keyUpHandler(key) {
      if (this.main_object && typeof this.main_object.keyUpHandler === "function") {
        this.main_object.keyUpHandler(key);
      }
    }
    // Compact protocol: init string from host
    startFromHostCompact(str) {
      this.pregame.focus = null;
      if (this.networking) {
        this.networking.hideOverlay();
      }
      if (this.maze && typeof this.maze.applyInitString === "function") {
        this.maze.applyInitString(str);
      }
      try {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      } catch (e) {
      }
      this.maze.spectator = true;
      this.main_object = this.maze;
      this.maze.beginGameplay && this.maze.beginGameplay();
      try {
        setHudScoreboardVisible(true);
        layoutHudOverCanvas();
        setPregameOverlayVisible(false);
      } catch (_) {
      }
      this.setupClientControllers({ tanks: this.maze.remoteTankMeta });
    }
    // Compact protocol: delta string from host
    updateStateFromHostCompact(str) {
      if (!str || !this.maze || typeof this.maze.applyDeltaString !== "function") {
        return;
      }
      this.maze.applyDeltaString(str);
    }
    setupClientControllers(payload) {
      this.unregisterClientInputRelay();
      this.clientControlMap = {};
      this.clientInputState = {};
      var peer = peerManager;
      if (!peer || peer.isHost || !peer.id) {
        this.clientInputBound = false;
        return;
      }
      var myId = peer.id;
      var tanks = payload && payload.tanks ? payload.tanks : [];
      var actionBindings = [
        { action: "up", payloadKey: "upPressed" },
        { action: "right", payloadKey: "rightPressed" },
        { action: "down", payloadKey: "downPressed" },
        { action: "left", payloadKey: "leftPressed" },
        { action: "fire", payloadKey: "shooting" },
        { action: "special", payloadKey: "specialKeyPressed" }
      ];
      var hasControlledTank = false;
      var localCfgs = peer && peer.localTankConfigs ? peer.localTankConfigs.slice() : [];
      var usedCfgIndexes = /* @__PURE__ */ new Set();
      for (var i = 0; i < tanks.length; i++) {
        var tank = tanks[i];
        var tankOwner = tank && tank.ownerPeerId ? tank.ownerPeerId : null;
        if (!tankOwner && tank && tank.id && myId && tank.id.indexOf(myId + "-") === 0) {
          tankOwner = myId;
        }
        if (tankOwner !== myId) {
          continue;
        }
        hasControlledTank = true;
        this.clientInputState[tank.id] = {
          upPressed: false,
          rightPressed: false,
          downPressed: false,
          leftPressed: false,
          shooting: false,
          specialKeyPressed: false
        };
        var controls = Array.isArray(tank.controls) ? tank.controls.slice() : null;
        if (!controls || controls.length === 0) {
          var suffix = tank && tank.id ? tank.id.substring((myId + "-").length) : "";
          var matchIndex = -1;
          for (var ci = 0; ci < localCfgs.length; ci++) {
            var cfg = localCfgs[ci];
            if (usedCfgIndexes.has(ci)) {
              continue;
            }
            if (cfg && cfg.panelId && suffix && cfg.panelId === suffix) {
              matchIndex = ci;
              break;
            }
          }
          if (matchIndex === -1) {
            for (var cj = 0; cj < localCfgs.length; cj++) {
              if (!usedCfgIndexes.has(cj)) {
                matchIndex = cj;
                break;
              }
            }
          }
          if (matchIndex >= 0 && localCfgs[matchIndex] && Array.isArray(localCfgs[matchIndex].controls)) {
            controls = localCfgs[matchIndex].controls.slice();
            usedCfgIndexes.add(matchIndex);
          }
        }
        controls = Array.isArray(controls) ? controls : [];
        for (var j = 0; j < controls.length && j < actionBindings.length; j++) {
          var key = controls[j];
          if (!key) {
            continue;
          }
          this.clientControlMap[key] = {
            tankId: tank.id,
            action: actionBindings[j].action,
            payloadKey: actionBindings[j].payloadKey
          };
        }
      }
      if (hasControlledTank) {
        this.registerClientInputRelay();
      } else {
        this.clientInputBound = false;
      }
    }
    registerClientInputRelay() {
      if (this.clientInputBound) {
        return;
      }
      this.clientInputHandlers = {
        keydown: this.handleClientKeyDown.bind(this),
        keyup: this.handleClientKeyUp.bind(this)
      };
      document.addEventListener("keydown", this.clientInputHandlers.keydown, true);
      document.addEventListener("keyup", this.clientInputHandlers.keyup, true);
      this.clientInputBound = true;
    }
    unregisterClientInputRelay() {
      if (!this.clientInputBound || !this.clientInputHandlers) {
        return;
      }
      document.removeEventListener("keydown", this.clientInputHandlers.keydown, true);
      document.removeEventListener("keyup", this.clientInputHandlers.keyup, true);
      this.clientInputHandlers = null;
      this.clientInputBound = false;
    }
    handleClientKeyDown(event) {
      var peer = peerManager;
      if (!peer || peer.isHost) {
        return;
      }
      if (isTypingInEditable()) {
        return;
      }
      var mapping = this.clientControlMap[event.key];
      if (!mapping) {
        return;
      }
      var state = this.clientInputState[mapping.tankId];
      if (!state) {
        return;
      }
      var changed = this.setInputStateFlag(state, mapping.payloadKey, true);
      if (changed) {
        this.queueInputSend(mapping.tankId);
      }
      if (event.key.indexOf("Arrow") === 0) {
        event.preventDefault();
      }
    }
    handleClientKeyUp(event) {
      var peer = peerManager;
      if (!peer || peer.isHost) {
        return;
      }
      if (isTypingInEditable()) {
        return;
      }
      var mapping = this.clientControlMap[event.key];
      if (!mapping) {
        return;
      }
      var state = this.clientInputState[mapping.tankId];
      if (!state) {
        return;
      }
      var changed = this.setInputStateFlag(state, mapping.payloadKey, false);
      if (changed) {
        this.queueInputSend(mapping.tankId);
      }
    }
    setInputStateFlag(state, key, value) {
      if (state[key] === value) {
        return false;
      }
      state[key] = value;
      return true;
    }
    queueInputSend(tankId) {
      var peer = peerManager;
      if (!peer || !peer.sendInputState) {
        return;
      }
      var state = this.clientInputState[tankId];
      if (!state) {
        return;
      }
      peer.sendInputState({
        tankId,
        upPressed: !!state.upPressed,
        downPressed: !!state.downPressed,
        leftPressed: !!state.leftPressed,
        rightPressed: !!state.rightPressed,
        shooting: !!state.shooting,
        specialKeyPressed: !!state.specialKeyPressed
      });
    }
  };
  function isTypingInEditable() {
    try {
      var el = document && document.activeElement ? document.activeElement : null;
      if (!el) {
        return false;
      }
      var tag = (el.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") {
        return true;
      }
      if (el.isContentEditable) {
        return true;
      }
    } catch (_) {
    }
    return false;
  }

  // js/main.js
  var game = new Game();
  peerManager.game = game;
  function draw() {
    if (game.main_object !== game.maze) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
    game.main();
    requestAnimationFrame(draw);
  }
  function setup() {
    canvas.addEventListener("click", function(event) {
      const rect = canvas.getBoundingClientRect();
      const sx = GAME_WIDTH / rect.width;
      const sy = GAME_HEIGHT / rect.height;
      const x = (event.clientX - rect.left) * sx;
      const y = (event.clientY - rect.top) * sy;
      game.onclick(x, y);
    }, false);
    addEventListener("keydown", function(event) {
      game.keyDownHandler(event.key);
    }, false);
    addEventListener("keyup", function(event) {
      if (typeof game.keyUpHandler === "function") {
        game.keyUpHandler(event.key);
      }
    }, false);
    draw();
  }
  setup();
})();

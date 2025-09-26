import { peerManager } from '../networking/peer_manager.js';
import { canvas, ctx } from '../render/context.js';

function isValidImage(el){ return !!(el && el.tagName === 'IMG' && el.complete && el.naturalWidth > 0); }

export class Powerup {
  constructor(maze, x = 0, y = 0) {
    this.x = x;
    this.y = y;
    this.width = 20;
    this.height = 20;
    this.maze = maze;
    this.delegate = null;
    this._handled = false;
    // Use host-assigned sequential integer ids from Maze
    if (maze && typeof maze.nextPowerupId === 'number') {
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
    // Delegate to unified pickup flow
    this.pickup(tank);
  }

  // Unified pickup entrypoint used both by local game loop and networking
  // Accepts a Tank instance or a tankId string; resolves via maze.tanks when needed
  pickup(target) {
    if (!this.maze) { return false; }
    var tank = null;
    if (typeof target === 'string') {
      var id = target;
      if (Array.isArray(this.maze.tanks)) {
        for (var i = 0; i < this.maze.tanks.length; i++) {
          if (this.maze.tanks[i] && this.maze.tanks[i].id === id) { tank = this.maze.tanks[i]; break; }
        }
      }
    } else {
      tank = target;
    }
    if (!tank) { return false; }
    if (this._handled) { return false; }
    this._handled = true;

    // Remove from board
    try { this.maze.removePowerup(this); } catch (_) {}
    // Apply to tank
    this.tank = tank;
    try { tank.removeAllPowerups(); } catch (_) {}
    try { tank.addPowerup(this); } catch (_) {}

    // Set timer for teardown
    try {
      this.timeout = setTimeout(this.teardown.bind(this), this.maze.settings.powerup_duration * 1000);
    } catch (_) {}

    // Notify guests if host
    try { this.notifyActivate(tank); } catch (_) {}

    // Force scoreboard refresh to show icon immediately
    try { if (this.maze.drawScoreboardTop) { this.maze.drawScoreboardTop(); } } catch (_) {}
    return true;
  }

  // Teardown: undo effect via tank.removePowerup (which calls undo), notify, and repaint scoreboard
  teardown() {
    try {
      if (this.timeout) { clearTimeout(this.timeout); this.timeout = null; }
      if (this.tank) { this.tank.removePowerup(this); }
      // Repaint scoreboard area to clear icon promptly
      if (this.maze && this.maze.drawScoreboardTop) { this.maze.drawScoreboardTop(); }
    } catch (_) {}
  }

  registerDelegate(fn) {
    this.delegate = fn;
  }

  broadcast(event) {
    if (typeof this.delegate === 'function') {
      this.delegate(event);
    }
  }

  getTargetType() {
    return 'tank';
  }

  serialize() {
    return {
      name: this.name,
      type: this.constructor && this.constructor.name ? this.constructor.name : this.name,
      spriteId: this.img && this.img.id ? this.img.id : null,
    };
  }

  notifyActivate(tank) {
    this.emitEvent('activate', tank);
  }

  notifyDeactivate(tank) {
    this.emitEvent('deactivate', tank);
  }

  emitEvent(status, tank) {
    const event = {
      type: 'powerup',
      status,
      powerup: this.constructor && this.constructor.name ? this.constructor.name : this.name,
      target: this.getTargetType(),
    };
    if (tank) {
      event.tankId = tank.id;
      event.peerId = tank.ownerPeerId;
    }
    if (this.id) { event.powerupId = this.id; }
    this.broadcast(event);
    // Compact network message (both host and guest send it to their peers/host)
    try {
      var parts = ['X', event.powerup, status, event.target || '', event.tankId || '', this.id || ''];
      peerManager.broadcast(parts.join(','));
    } catch (_) {}
  }
}

export class TrippyPowerup extends Powerup {
  constructor(maze, x, y) {
    super(maze, x, y);
    this.name = "Trippy";
    this.color = "green";
    this.img = document.getElementById("pills");
  }

  effect(tank) {
    // Increment global trippy counter; drawing reads this flag
    if (typeof this.maze.trippyCount !== 'number') { this.maze.trippyCount = 0; }
    this.maze.trippyCount += 1;
  }

  undo(tank) {
    if (typeof this.maze.trippyCount !== 'number') { this.maze.trippyCount = 0; }
    this.maze.trippyCount = Math.max(0, (this.maze.trippyCount || 0) - 1);
  }

  getTargetType() {
    return 'global';
  }
}

// Handle global powerup events on guests/spectators without touching Maze code elsewhere.
// Encapsulated here to respect the constraint: Trippy logic lives in Powerup classes.
// Generic powerup event applier used by networking to mirror host events on guests
export function handleGlobalPowerupEvent(event, maze){
  if (!event || !maze) { return; }
  try {
    if (typeof maze.applyPowerupEvent === 'function') { maze.applyPowerupEvent(event); }
  } catch (e) { /* ignore */ }
}

// Factory: create a powerup instance by constructor/name string
export function createPowerupByType(name, maze){
  var n = String(name || '');
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
  } catch (e) {}
  return null;
}

export class RemoveBulletLimitPowerup extends Powerup {
  constructor(maze, x, y) {
    super(maze, x, y);
    this.name = "Remove Bullet Limit";
    this.color = "orange";
    this.img = document.getElementById("unlimited");
  }
  // Effect and undo methods remain unchanged.
  effect(tank) {
    tank.shouldFire = function () {
      if (this.shooting) {
        return true;
      } else {
        return false;
      }
    };
  }

  undo(tank) {
    tank.shouldFire = function () {
      if (this.shooting && this.bullets.length < this.bullet_limit) {
        return true;
      } else {
        return false;
      }
    };
  }
}

export class TripleShotPowerup extends Powerup {
  constructor(maze, x, y) {
    super(maze, x, y);
    this.name = "Triple-Shot";
    this.color = "red";
    this.img = document.getElementById("tripleshot");
  }
  // Effect and undo methods remain unchanged.
  effect(tank) {
    //setting tank.old_fire=tank.fire caused an inf_recursion bug, so I just copied the defn

    tank.fire = function () {
      this.fire_helper(this.rotation, this.maze.settings.bullet_speed);
      this.fire_helper(this.rotation - Math.PI / 12, this.maze.settings.bullet_speed);
      this.fire_helper(this.rotation + Math.PI / 12, this.maze.settings.bullet_speed);
    };

    tank.bullet_limit = 3 * this.maze.settings.bullet_limit;
  }

  undo(tank) {
    {
      tank.fire = function () {
        this.fire_helper(this.rotation, this.maze.settings.bullet_speed);
      };
      tank.bullet_limit = this.maze.settings.bullet_limit;
    }
  }
}

export class MoveThroughWallsPowerup extends Powerup {
  constructor(maze, x, y) {
    super(maze, x, y);
    this.name = "ghost";
    this.color = "blue";
    this.img = document.getElementById("ghost");
  }
  // Effect and undo methods remain unchanged.
  effect(tank) {
    tank.tryMovingTo = function (pos) {
      var x = pos[0];
      var y = pos[1];

      if (!this.maze.isOutOfBounds([x, y])) {
        this.x = x;
        this.y = y;
      }
    };
  }

  undo(tank) {
    tank.tryMovingTo = function (pos) {
      var x = pos[0];
      var y = pos[1];

      if (!this.maze.doesRectCollide([x, y, this.width, this.height])) {
        this.x = x;
        this.y = y;
      }
    };
    // After ghost expires, if intersecting an active wall, snap to cell center
    if (tank.maze.doesRectCollide([tank.x, tank.y, tank.width, tank.height])) {
      var square = tank.maze.getSquareAtXY([tank.x, tank.y]);
      if (square) {
        var center = square.getCenter();
        tank.x = center[0];
        tank.y = center[1];
      }
    }
  }
}

export class TeleportPowerup extends Powerup {
  constructor(maze, x, y) {
    super(maze, x, y);
    this.name = "Teleport";
    this.color = "cyan";
    this.img = document.getElementById("teleport");
  }
  // Effect and undo methods remain unchanged.
  effect(tank) {
    this.draw_mirror = function () {
      //Drawing
      ctx.save();
      ctx.translate(
        canvas.width - (this.x + this.width / 2),
        this.maze.height - (this.y + this.height / 2)
      );
      // Keep same rotation as the tank
      ctx.rotate(this.rotation || 0);
      // Set 30% opacity for the clone
      var oldAlpha = ctx.globalAlpha;
      ctx.globalAlpha = 0.3;
      var sprite = document.getElementById('tank');
      if (isValidImage(sprite)) {
        var prev = ctx.imageSmoothingEnabled;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(sprite,-this.width/2,-this.height/2,this.width,this.height);
        ctx.imageSmoothingEnabled = prev;
      } else {
        ctx.fillStyle = this.colour;
        ctx.fillRect(-this.width/2,-this.height/2,this.width,this.height);
      }
      // Restore alpha
      ctx.globalAlpha = oldAlpha;
      ctx.restore();
    }.bind(tank);
    // Tag for robust cleanup
    try { this.draw_mirror.__tp_tankId = tank.id; } catch (_) {}

    tank.maze.extraFunctionsPerCycle.push(this.draw_mirror);
    tank.maze.teleportMirrors[tank.id] = true;

    tank.special = function () {
      if (this.poweruplock == true) {
        return;
      }
      /*TrymovingTo is designed a bit awkwardly for this. If the position is invalid, it will try to move in just the horizontal and just the vertical components.
            This is to let tanks to slide up slowly against a wall theyre driving into at an upwards angle, instead of stopping completely. 
            For teleport, if the position is invalid it tries to only teleport its x-component, which contradicts the marker of where you will be teleported.
            My solution is to move the tank to a potentially invalid position, then call tryMovingTo, which centers it in the square if its currently in an invalid position.
            It looks hacky, but its bug-free and unnoticeable during gameplay.
            */
      // Teleport to the exact mirrored position of the current mirror drawing.
      // Our tank position is top-left; mirror draws at mirrored center.
      // So new top-left = mirrorCenter - (width/2,height/2) = (W - (x+width/2) - width/2, H - (y+height/2) - height/2)
      this.x = canvas.width - this.x - this.width;
      this.y = this.maze.height - this.y - this.height;
      this.tryMovingTo([this.x, this.y]);

      // Authoritative safety: if still overlapping a wall after mirror, snap to cell center
      // In multiplayer, relying solely on tryMovingTo can miss rare overlaps due to
      // rounding/neighbor checks; force a validity pass here on the host.
      try {
        // Host is authoritative for final position correction
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
      } catch (_) {}

      this.poweruplock = true;
    };
  }

  undo(tank) {
    try {
      // Remove the exact function if present
      removeElementFromArray(this.draw_mirror, tank.maze.extraFunctionsPerCycle);
      // Also defensively remove any stale mirror draw functions for this tank
      var arr = tank.maze.extraFunctionsPerCycle;
      if (Array.isArray(arr)) {
        for (var i = arr.length - 1; i >= 0; i--) {
          var f = arr[i];
          if (f && f.__tp_tankId && f.__tp_tankId === tank.id) {
            arr.splice(i, 1);
          }
        }
      }
    } catch(_) {}
    try { delete tank.maze.teleportMirrors[tank.id]; } catch(_){}
    tank.special = function () {};
    tank.poweruplock = false;

    // After teleport effect window ends, ensure tank is not stuck inside a wall
    if (tank.maze.doesRectCollide([tank.x, tank.y, tank.width, tank.height])) {
      var sq = tank.maze.getSquareAtXY([tank.x, tank.y]);
      if (sq) {
        var c = sq.getCenter();
        tank.x = c[0];
        tank.y = c[1];
      }
    }
  }
}

export class CannonballPowerup extends Powerup {
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
    tank.special = function () {
      this.fire();
      var cannonball = this.bullets[this.bullets.length - 1];

      cannonball.radius = 50;

      var speedMultipler = 2;
      cannonball.direction[0] *= speedMultipler;
      cannonball.direction[1] *= speedMultipler;

      cannonball.handleMovement = function () {
        this.x += this.direction[0];
        this.y += this.direction[1];

        if (
          this.x > canvas.width + this.radius ||
          this.x < 0 - this.radius ||
          this.y > (this.tank.maze.height) + this.radius ||
          this.y < 0 - this.radius
        )
          this.tank.removeBullet(this);
      };

      this.special = function () {};
      this.removeAllPowerups();
    };
  }

  undo(tank) {
    tank.special = function () {};
  }
}

export class InvisibilityPowerup extends Powerup {
  constructor(maze, x, y) {
    super(maze, x, y);
    this.name = "Invisibility";
    this.color = "grey";
    this.img = document.getElementById("invisible");
  }
  // Effect and undo methods remain unchanged.
  effect(tank) {
    tank.old_draw = tank.draw;
    tank.draw = function () {
      this.bullets.forEach(function (e) {
        e.draw();
      });
    };
    tank.special = tank.old_draw;
  }

  undo(tank) {
    tank.draw = tank.old_draw;
  }
}

export class ShinraTenseiPowerup extends Powerup {
  constructor(maze, x, y) {
    super(maze, x, y);
    this.name = "Shinra Tensei";
    this.color = "purple";
    this.img = document.getElementById("repel");
  }
  // Effect and undo methods remain unchanged.
  effect(tank) {
    tank.special = function () {
      this.maze.tanks.forEach(
        function (tank) {
          ShinraTenseiPowerup.repelTank(this, tank);
          tank.bullets.forEach(
            function (bullet) {
              ShinraTenseiPowerup.repelBullet(this, bullet);
            }.bind(this)
          );
        }.bind(this)
      );
    };
  }

  undo(tank) {
    tank.special = function () {};
  }

  static repelTank(repeler, repelee) {
    //A tank can't repel itself
    if (repeler == repelee) {
      return;
    }

    var dx = repelee.x - repeler.x;
    var dy = repelee.y - repeler.y;
    var dist = Math.sqrt(dx * dx + dy * dy) || 1;
    // Push away with a small impulse, independent of distance
    var strength = 2; // pixels per frame impulse
    var nx = dx / dist;
    var ny = dy / dist;
    repelee.tryMovingTo([
      repelee.x + nx * strength,
      repelee.y + ny * strength,
    ]);
  }

  static repelBullet(tank, bullet) {
    // Push bullet directly away from the tank, but clamp speed
    var dx = bullet.x - tank.x;
    var dy = bullet.y - tank.y;
    var dist = Math.sqrt(dx * dx + dy * dy) || 1;
    var nx = dx / dist;
    var ny = dy / dist;
    var push = 0.5; // acceleration per frame
    var vx = bullet.direction[0] + nx * push;
    var vy = bullet.direction[1] + ny * push;
    var maxSpeed = (tank && tank.maze && tank.maze.settings && tank.maze.settings.bullet_speed) ? tank.maze.settings.bullet_speed : 3;
    var speed = Math.sqrt(vx * vx + vy * vy);
    if (speed > maxSpeed) {
      var scale = maxSpeed / speed;
      vx *= scale;
      vy *= scale;
    }
    bullet.direction[0] = vx;
    bullet.direction[1] = vy;
  }
}

export class HexPowerup extends Powerup {
  constructor(maze, x, y) {
    super(maze, x, y);
    this.name = "Hex";
    this.color = "purple";
    this.img = document.getElementById("hex");
  }
  // Effect and undo methods remain unchanged.
  effect(tank) {
    tank.maze.tanks.forEach(function (tank) {
      [tank.onLeftPress, tank.onRightPress] = [
        tank.onRightPress,
        tank.onLeftPress,
      ];
      [tank.onUpPress, tank.onDownPress] = [tank.onDownPress, tank.onUpPress];
    });
  }

  undo(tank) {
    this.effect(tank);
  }
}

export function generatePowerup(maze) {
  // Randomly pick from available powerups (0..7)
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

export default Powerup;

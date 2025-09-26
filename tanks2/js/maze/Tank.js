// ctx must be defined before this file is executed.
import Bullet from './Bullet.js';
import { removeElementFromArray } from '../helper_fns.js';
import { ctx } from '../render/context.js';

const DEFAULT_RECHARGE_DURATION = 20;

const TANK_ACTIONS = ['up', 'right', 'down', 'left', 'fire', 'special'];
function createInputState() {
  return { up: false, right: false, down: false, left: false, fire: false, special: false };
}

function forwardVector(angle, magnitude) {
  return {
    x: Math.sin(angle) * magnitude,
    y: -Math.cos(angle) * magnitude,
  };
}

export class Tank {
  /**
   * @param {number} x
   * @param {number} y
   * @param {Maze} maze
   * @param {string[]} controls - ordered as [up, right, down, left, fire, special]
   * @param {string} colour
   * @param {{ disableInput?: boolean }} options
   */
  constructor(x, y, maze, controls, colour = 'black', options) {
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

    // Fire-once-per-press tracking
    this.hasFiredThisPress = false;

    this.special = function () {};

    this.rechargeDuration = (this.maze && this.maze.settings && typeof this.maze.settings.recharge_duration === 'number')
      ? this.maze.settings.recharge_duration
      : DEFAULT_RECHARGE_DURATION;

    this.setControls(controls);
  }

  setControls(controls) {
    this.controls = Array.isArray(controls) ? controls.slice(0, TANK_ACTIONS.length) : [];
    // Input is handled by Maze forwarding events to tank handlers
  }

  setLocalAction(action, isActive) {
    if (!Object.prototype.hasOwnProperty.call(this.localInput, action)) {
      return;
    }
    if (this.localInput[action] === isActive) {
      return;
    }
    this.localInput[action] = isActive;
    if (action === 'special' && !isActive) {
      this.poweruplock = false;
    }
    if (action === 'fire') {
      // Reset per-press flag on key transitions
      if (!isActive) {
        this.hasFiredThisPress = false;
      }
    }
    
    this.syncDerivedInput();
  }

  applyNetworkInput(input) {
    if (!input) { return; }
    TANK_ACTIONS.forEach((action, index) => {
      const key = action === 'fire' ? 'shooting' : action === 'special' ? 'specialKeyPressed' : `${action}Pressed`;
      if (action === 'fire' && typeof input.shooting === 'boolean') {
        this.networkInput.fire = input.shooting;
      } else if (action === 'special' && typeof input.specialKeyPressed === 'boolean') {
        this.networkInput.special = input.specialKeyPressed;
        if (!input.specialKeyPressed) {
          this.poweruplock = false;
        }
      } else if (typeof input[key] === 'boolean') {
        this.networkInput[action] = input[key];
      }
    });
    this.syncDerivedInput();
    this.pendingPowerupUpdates = true;
  }

  syncDerivedInput() {
    this.upPressed = this.isActionActive('up');
    this.rightPressed = this.isActionActive('right');
    this.downPressed = this.isActionActive('down');
    this.leftPressed = this.isActionActive('left');
    this.shooting = this.isActionActive('fire');
    this.specialKeyPressed = this.isActionActive('special');
    if (!this.shooting) {
      this.fireWasActive = false;
      // Important: allow next shot once fire is released (covers network input too)
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
    if (!action) { return; }
    this.setLocalAction(action, isActive);
  }

  main() {
    if (!this.is_dead) {
      if (this.shouldFire()) { this.fire(); }

      if (this.isActionActive('special')) {
        this.special();
      }
    }

    this.bullets.forEach((bullet) => bullet.main());

    if (!this.is_dead) {
      this.handleMovement();
    }
    // Rendering is handled by Maze.drawDynamicObjects to ensure single-pass draw
  }

  draw() {
    this.drawBullets();
    if (this.is_dead) { return; }
    this.drawBody();
  }

  drawBullets() {
    this.bullets.forEach((bullet) => bullet.draw());
  }

  drawBody() {
    // Lazy-resolve sprite if available
    if (!this.img) {
      var el = document.getElementById('tank');
      if (el && el.tagName === 'IMG' && el.complete && el.naturalWidth > 0) {
        this.img = el;
      }
    }

    ctx.save();
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    ctx.rotate(this.rotation);

    if (this.img && this.img.tagName === 'IMG' && this.img.complete && this.img.naturalWidth > 0) {
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
    const active = this.isActionActive('fire');
    if (!active) {
      this.fireWasActive = false;
      return false;
    }
    // Only allow one bullet per key press (until key up occurs)
    if (this.hasFiredThisPress) { return false; }
    if (this.bullets.length >= this.bullet_limit) { return false; }
    if (this.isWithinRechargeWindow()) { return false; }
    this.hasFiredThisPress = true;
    this.fireWasActive = true;
    return true;
  }

  isWithinRechargeWindow() {
    var recharge = (typeof this.rechargeDuration === 'number') ? this.rechargeDuration : DEFAULT_RECHARGE_DURATION;
    if (!recharge || recharge <= 0) { return false; }
    if (!Array.isArray(this.bullets) || this.bullets.length === 0) { return false; }
    var tick = (this.maze && typeof this.maze.tick === 'number') ? this.maze.tick : 0;
    for (var i = 0; i < this.bullets.length; i++) {
      var bullet = this.bullets[i];
      if (!bullet || bullet.time_created == null) { continue; }
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
    // Spawn the bullet just in front of the tank, outside hitbox
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    // Place bullet a fixed distance ahead of tank center along facing
    const bulletRadius = 1;
    const originX = centerX + Math.sin(rotation);
    const originY = centerY - Math.cos(rotation);
    const newBullet = new Bullet(this, [velocity.x, velocity.y], originX, originY, bulletRadius);
    this.bullets.push(newBullet);
  }

  fire_helper(rotation, speed) {
    this.fireHelper(rotation, speed);
  }

  handleMovement() {
    if (this.isActionActive('right')) { this.rotation += this.rotation_speed; }
    if (this.isActionActive('left')) { this.rotation -= this.rotation_speed; }

    if (this.isActionActive('up')) {
      const forward = forwardVector(this.rotation, this.move_speed);
      this.tryMovingTo([this.x + forward.x, this.y]);
      this.tryMovingTo([this.x, this.y + forward.y]);
    }

    if (this.isActionActive('down')) {
      const backward = forwardVector(this.rotation, -this.move_speed);
      this.tryMovingTo([this.x + backward.x, this.y]);
      this.tryMovingTo([this.x, this.y + backward.y]);
    }
  }

  tryMovingTo(pos) {
    // If currently intersecting, snap to center of current square first
    if (this.maze.doesRectCollide([this.x, this.y, this.width, this.height])) {
      const centerNow = this.maze.getSquareAtXY([this.x, this.y]).getCenter();
      this.x = centerNow[0];
      this.y = centerNow[1];
      // After snapping, continue with intended move attempt from safe center
    }

    // Try full move
    if (!this.maze.doesRectCollide([pos[0], pos[1], this.width, this.height])) {
      this.x = pos[0];
      this.y = pos[1];
      return;
    }

    // Try X-only move
    if (!this.maze.doesRectCollide([pos[0], this.y, this.width, this.height])) {
      this.x = pos[0];
      return;
    }

    // Try Y-only move
    if (!this.maze.doesRectCollide([this.x, pos[1], this.width, this.height])) {
      this.y = pos[1];
      return;
    }

    // All movement attempts failed: snap to the center of the current square
    const center = this.maze.getSquareAtXY([this.x, this.y]).getCenter();
    this.x = center[0];
    this.y = center[1];
  }

  keyDownHandler(e) {
    if (this.disableInput) { return; }
    const key = typeof e === 'string' ? e : e && e.key;
    if (!key) { return; }
    this.setLocalActionForKey(key, true);
  }

  keyUpHandler(e) {
    if (this.disableInput) { return; }
    const key = typeof e === 'string' ? e : e && e.key;
    if (!key) { return; }
    this.setLocalActionForKey(key, false);
  }

  loadImage(imgElement) {
    this.img = imgElement;
  }

  originalMovement() {
    const ms = this.move_speed;
    if (this.upPressed) { this.tryMovingTo([this.x, this.y - ms]); }
    if (this.rightPressed) { this.tryMovingTo([this.x + ms, this.y]); }
    if (this.downPressed) { this.tryMovingTo([this.x, this.y + ms]); }
    if (this.leftPressed) { this.tryMovingTo([this.x - ms, this.y]); }
  }

  onBulletHit() {
    this.destroy();
  }

  destroy() {
    // Input listeners are managed at the Maze/Game level
    this.is_dead = true;
    this.maze.tankDestroyed();
  }

  restart() {
    // Input listeners are managed at the Maze/Game level
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
    // Only allow a single active powerup at a time
    this.removeAllPowerups();
    this.powerups.push(powerup);
    powerup.effect(this);
    this.pendingPowerupUpdates = true;
  }

  removePowerup(powerup) {
    const index = this.powerups.indexOf(powerup);
    if (index === -1) { return; }
    // Prevent late teardown firing after manual removal
    try { if (powerup && powerup.timeout) { clearTimeout(powerup.timeout); powerup.timeout = null; } } catch(_){}
    powerup.undo(this);
    if (typeof powerup.notifyDeactivate === 'function') {
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
    removeElementFromArray(bullet, this.bullets);
  }
}

export default Tank;

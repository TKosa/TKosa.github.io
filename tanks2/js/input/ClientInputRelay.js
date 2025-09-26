const ACTION_BINDINGS = [
  { action: 'up', payloadKey: 'upPressed' },
  { action: 'right', payloadKey: 'rightPressed' },
  { action: 'down', payloadKey: 'downPressed' },
  { action: 'left', payloadKey: 'leftPressed' },
  { action: 'fire', payloadKey: 'shooting' },
  { action: 'special', payloadKey: 'specialKeyPressed' },
];

export class ClientInputRelay {
  constructor(peer) {
    this.peerManager = peer;
    this.controlMap = {};
    this.inputState = {};
    this.bound = false;
    this.handlers = null;
  }

  configure(payload) {
    this.unregister();
    this.controlMap = {};
    this.inputState = {};

    const peer = this.peerManager;
    if (!peer || peer.isHost || !peer.id) {
      return false;
    }

    const tanks = payload && Array.isArray(payload.tanks) ? payload.tanks : [];
    const localCfgs = peer && Array.isArray(peer.localTankConfigs) ? peer.localTankConfigs.slice() : [];
    const usedCfgIndexes = new Set();

    let hasControlledTank = false;
    const myId = peer.id;

    for (let i = 0; i < tanks.length; i++) {
      const tank = tanks[i];
      if (!tank || !tank.id) { continue; }

      let tankOwner = tank.ownerPeerId || null;
      if (!tankOwner && myId && tank.id.indexOf(myId + '-') === 0) {
        tankOwner = myId;
      }
      if (tankOwner !== myId) { continue; }

      hasControlledTank = true;
      this.inputState[tank.id] = this.buildInitialInputState();

      let controls = Array.isArray(tank.controls) ? tank.controls.slice() : null;
      if (!controls || controls.length === 0) {
        controls = deriveControlsFromLocalConfigs(localCfgs, usedCfgIndexes, tank, myId);
      }

      controls = Array.isArray(controls) ? controls : [];
      for (let j = 0; j < controls.length && j < ACTION_BINDINGS.length; j++) {
        const key = controls[j];
        if (!key) { continue; }
        this.controlMap[key] = {
          tankId: tank.id,
          action: ACTION_BINDINGS[j].action,
          payloadKey: ACTION_BINDINGS[j].payloadKey,
        };
      }
    }

    if (hasControlledTank) {
      this.register();
    }

    return hasControlledTank;
  }

  register() {
    if (this.bound) { return; }
    this.handlers = {
      keydown: (event) => this.handleKeyDown(event),
      keyup: (event) => this.handleKeyUp(event),
    };
    document.addEventListener('keydown', this.handlers.keydown, true);
    document.addEventListener('keyup', this.handlers.keyup, true);
    this.bound = true;
  }

  unregister() {
    if (!this.bound || !this.handlers) { return; }
    document.removeEventListener('keydown', this.handlers.keydown, true);
    document.removeEventListener('keyup', this.handlers.keyup, true);
    this.handlers = null;
    this.bound = false;
  }

  handleKeyDown(event) {
    const peer = this.peerManager;
    if (!peer || peer.isHost) { return; }
    if (isTypingInEditable()) { return; }

    const mapping = this.controlMap[event.key];
    if (!mapping) { return; }

    const state = this.inputState[mapping.tankId];
    if (!state) { return; }

    const changed = this.setInputStateFlag(state, mapping.payloadKey, true);
    if (changed) {
      this.queueInputSend(mapping.tankId);
    }

    if (event.key.indexOf('Arrow') === 0) {
      event.preventDefault();
    }
  }

  handleKeyUp(event) {
    const peer = this.peerManager;
    if (!peer || peer.isHost) { return; }
    if (isTypingInEditable()) { return; }

    const mapping = this.controlMap[event.key];
    if (!mapping) { return; }

    const state = this.inputState[mapping.tankId];
    if (!state) { return; }

    const changed = this.setInputStateFlag(state, mapping.payloadKey, false);
    if (changed) {
      this.queueInputSend(mapping.tankId);
    }
  }

  buildInitialInputState() {
    return {
      upPressed: false,
      rightPressed: false,
      downPressed: false,
      leftPressed: false,
      shooting: false,
      specialKeyPressed: false,
    };
  }

  setInputStateFlag(state, key, value) {
    if (state[key] === value) {
      return false;
    }
    state[key] = value;
    return true;
  }

  queueInputSend(tankId) {
    const peer = this.peerManager;
    if (!peer || typeof peer.sendInputState !== 'function') {
      return;
    }
    const state = this.inputState[tankId];
    if (!state) {
      return;
    }
    peer.sendInputState({
      tankId: tankId,
      upPressed: !!state.upPressed,
      downPressed: !!state.downPressed,
      leftPressed: !!state.leftPressed,
      rightPressed: !!state.rightPressed,
      shooting: !!state.shooting,
      specialKeyPressed: !!state.specialKeyPressed,
    });
  }
}

function deriveControlsFromLocalConfigs(localCfgs, usedCfgIndexes, tank, myId) {
  if (!Array.isArray(localCfgs) || !tank || !tank.id) {
    return [];
  }

  const suffix = tank.id.substring((myId + '-').length);
  let matchIndex = -1;

  for (let ci = 0; ci < localCfgs.length; ci++) {
    if (usedCfgIndexes.has(ci)) { continue; }
    const cfg = localCfgs[ci];
    if (cfg && cfg.panelId && suffix && cfg.panelId === suffix) {
      matchIndex = ci;
      break;
    }
  }

  if (matchIndex === -1) {
    for (let cj = 0; cj < localCfgs.length; cj++) {
      if (!usedCfgIndexes.has(cj)) {
        matchIndex = cj;
        break;
      }
    }
  }

  if (matchIndex >= 0) {
    usedCfgIndexes.add(matchIndex);
    const cfg = localCfgs[matchIndex];
    if (cfg && Array.isArray(cfg.controls)) {
      return cfg.controls.slice();
    }
  }

  return [];
}

function isTypingInEditable() {
  try {
    const el = document && document.activeElement ? document.activeElement : null;
    if (!el) { return false; }
    const tag = (el.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') { return true; }
    if (el.isContentEditable) { return true; }
  } catch (_) {}
  return false;
}

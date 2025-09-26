// Centralized networking message types (moved from js/net/messages.js)
window.MSG = {
  STATE_INIT: 'state-init',
  STATE_DELTA: 'state-delta',
  INPUT_STATE: 'input-state',
  START_GAME: 'start-game',
  PLAYER_LIST: 'player-list',
  TANK_CONFIG: 'tank-config',
  NICKNAME: 'nickname',
  MESSAGE: 'message',
  NOTIFICATION: 'notification',
  BULLET_ADD: 'bullet-add'
};

// Client-side update kinds used internally by Game.updateStateFromHost
window.HOST_UPDATE = {
  INIT: 'init',
  DELTA: 'delta'
};

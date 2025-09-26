import { eventHub } from '../event_hub.js';
import { peerManager, addChatMessage } from './peer_manager.js';
import { canvas } from '../render/context.js';
// NetworkingScreen as ES module with legacy global bridge
function NetworkingScreen(game) {
    this.game = game;
    // Separate overlays: connect vs chat
    this.connectOverlay = null;
    this.chatOverlay = null; // overlay removed
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

    // Control whether overlays are allowed to appear (disabled during gameplay)
    this.overlayEnabled = true;
    // Track whether user has requested networking UI this session
    this.overlayRequested = false;

    this.ensureDom();

    // Allow typing chat immediately; sending locally doesn't require network
    if (this.sendButton) { this.sendButton.disabled = false; }
    if (this.chatInput) { this.chatInput.disabled = false; }
    // no enter-lobby button in this UI

    this.registerListeners();
}

NetworkingScreen.prototype.ensureDom = function(){
    // (Re)query DOM elements; safe if called multiple times
    this.connectOverlay = document.getElementById('networking-connect-overlay');
    this.chatOverlay = null; // overlay no longer used
    this.statusEls = Array.from(document.querySelectorAll('#network-status, #network-status-connect, #network-status-chat'));
    this.roomInput = document.getElementById('room-name');
    this.nicknameInput = document.getElementById('nickname');
    this.hostButton = document.getElementById('host-room-btn');
    this.joinButton = document.getElementById('join-room-btn');
    this.enterLobbyButton = document.getElementById('enter-lobby-btn');
    this.playerListEl = document.getElementById('player-list');
    this.roomCodeEl = document.getElementById('room-code');
    this.chatInput = document.getElementById('chat-message-input');
    this.sendButton = document.getElementById('chat-send-btn');
    this.chatPanel = document.getElementById('networking-chat-panel');
    this.closeConnectButton = document.getElementById('networking-close-connect-btn');
    this.closeChatButton = document.getElementById('networking-close-chat-btn');
};

NetworkingScreen.prototype.registerListeners = function() {
    var self = this;

    if (this.hostButton) {
      this.hostButton.addEventListener('click', function() {
        peerManager.hostRoom(self.roomInput.value, self.nicknameInput.value);
        // Immediately transition UI intent to chat/lobby
        self.showChatOverlay();
      });
    }

    if (this.joinButton) {
      this.joinButton.addEventListener('click', function() {
        peerManager.joinRoom(self.roomInput.value, self.nicknameInput.value);
        // Immediately transition UI intent to chat/lobby
        self.showChatOverlay();
      });
    }

    // enter-lobby removed; close handled via Close buttons

    if (this.closeConnectButton) {
      this.closeConnectButton.addEventListener('click', function() { self.hideOverlay(); });
    }
    // No close button in lobby/chat

    if (this.sendButton) {
      this.sendButton.addEventListener('click', function() {
        self.handleSendMessage();
      });
    }

    if (this.chatInput) {
      this.chatInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
          event.preventDefault();
          
          self.handleSendMessage();
        }
      });
    }

    eventHub.on('network-status', function(message) {
      for (var i=0;i<self.statusEls.length;i++) {
        self.statusEls[i].textContent = message;
      }
    });

    eventHub.on('network-ready', function(info) {
      if (!info) { return; }
      // Already enabled above for immediate chat; keep enabled here too
      if (self.sendButton) { self.sendButton.disabled = false; }
      if (self.chatInput) { self.chatInput.disabled = false; }
      // As soon as a room is hosted or joined, switch to chat overlay
      if (self.overlayEnabled) {
        self.showChatOverlay();
      }
      // Restore persisted chat width if any
      try {
        var saved = localStorage.getItem('chatPanelWidthPx');
        if (saved && self.chatPanel) {
          var px = Math.max(0, Math.min(window.innerWidth * 0.9, parseInt(saved, 10) || 0));
          if (px > 0) { self.chatPanel.style.width = px + 'px'; self.chatPanel.classList.add('chat-open'); }
        }
      } catch(_){}
      if (self.game && self.game.pregame && typeof self.game.pregame.emitTankConfig === 'function') {
        self.game.pregame.emitTankConfig();
      }
    });

    eventHub.on('network-player-list', function(players) {
      self.renderPlayerList(players || []);
      // Overlay switching is handled on network-ready now.
    });

    // Lightweight live stats in status line
    eventHub.on('network-stats', function(stats){
      if (!stats || !self.statusEls || self.statusEls.length === 0) { return; }
      // Determine which status element we're updating to decide verbosity
      var connectEl = document.getElementById('network-status-connect');
      var chatEl = null; // no chat status in lobby panel
      var statsEl = document.getElementById('network-status');
      var connectLines = [];
      var chatLines = [];
      if (typeof stats.rttMs === 'number') {
        // Connect overlay: show ping only, no throughput metrics
        connectLines.push('Ping: ' + stats.rttMs + ' ms');
        // Chat overlay: full metrics once in-room
        chatLines.push('Ping: ' + stats.rttMs + ' ms');
      }
      chatLines.push('Tx: ' + stats.sentPerSec + ' msg/s');
      chatLines.push('Rx: ' + stats.recvPerSec + ' msg/s');
      chatLines.push('Up: ' + stats.bytesSentPerSec + ' B/s');
      chatLines.push('Down: ' + stats.bytesRecvPerSec + ' B/s');

      // Update individual overlays if present; otherwise fall back to all statusEls
      if (connectEl) {
        var baseC = (connectEl.textContent || '').split('\n')[0] || connectEl.textContent;
        connectEl.textContent = baseC + '\n' + connectLines.join('\n');
      }
      // Only append metrics to chat overlay when it's visible (networking setup panel reused)
      // no metrics appended to chat overlay
      // Always update the net-stats overlay element if present
      if (statsEl) {
        var baseS = (statsEl.textContent || '').split('\n')[0] || statsEl.textContent;
        statsEl.textContent = baseS + '\n' + chatLines.join('\n');
      }
      if (!connectEl && !chatEl && !statsEl) {
        // Legacy fallback: update all statusEls with chat-level detail
        var lines = chatLines;
        for (var i=0;i<self.statusEls.length;i++) {
          var el = self.statusEls[i];
          var base = (el.textContent || '').split('\n')[0] || el.textContent;
          el.textContent = base + '\n' + lines.join('\n');
        }
      }
    });

    // Chat resize handle drag behavior
    var handle = document.getElementById('chat-resize-handle');
    if (handle && this.chatPanel) {
      handle.addEventListener('mousedown', function(e){
        e.preventDefault();
        self._chatDrag.active = true;
        self._chatDrag.startX = e.clientX;
        self._chatDrag.startWidth = self.chatPanel.getBoundingClientRect().width;
        document.body.classList.add('resizing-chat');
      });
      window.addEventListener('mousemove', function(e){
        if (!self._chatDrag.active) { return; }
        // Dragging the left edge: newWidth increases as mouse moves left (since panel is on right)
        var dx = self._chatDrag.startX - e.clientX;
        var newWidth = Math.max(0, Math.min(window.innerWidth * 0.9, self._chatDrag.startWidth + dx));
        self.chatPanel.style.width = newWidth + 'px';
        self.chatPanel.classList.add('chat-open');
      });
      window.addEventListener('mouseup', function(){
        if (!self._chatDrag.active) { return; }
        self._chatDrag.active = false;
        document.body.classList.remove('resizing-chat');
        try {
          var w = self.chatPanel.getBoundingClientRect().width;
          localStorage.setItem('chatPanelWidthPx', Math.round(w));
        } catch(_){}
      });
    }
};

// No-op: layout handled by flex CSS in app-shell
NetworkingScreen.prototype.layoutChatRight = function(){};

NetworkingScreen.prototype.handleSendMessage = function() {
    if (this.chatInput.disabled) {
      return;
    }
    var message = (this.chatInput.value || '').trim();
    if (!message) {
      return;
    }
    var nickname = peerManager.getNickname ? peerManager.getNickname() : 'Me';
    addChatMessage('You: ' + message, 'self-message');
    peerManager.sendChatMessage(message);
    this.chatInput.value = '';
};

NetworkingScreen.prototype.renderPlayerList = function(players) {
    if (!this.playerListEl) {
      return;
    }
    while (this.playerListEl.firstChild) {
      this.playerListEl.removeChild(this.playerListEl.firstChild);
    }

    if (!players || players.length === 0) {
      var emptyItem = document.createElement('li');
      emptyItem.textContent = 'Waiting for players...';
      emptyItem.className = 'player-list-empty';
      this.playerListEl.appendChild(emptyItem);
      return;
    }

    var localTankCount = this.game && this.game.pregame ? this.game.pregame.tank_panels.length : 0;

    for (var i = 0; i < players.length; i++) {
      var item = document.createElement('li');
      var entry = players[i];
      var label = entry.nickname || 'Player';
      if (entry.id && peerManager.id === entry.id) {
        label += ' (This device';
        if (localTankCount) {
          label += ', Tanks: ' + localTankCount;
        }
        label += ')';
      } else {
        label += ' (ID ' + (entry.id ? entry.id.substring(0, 6) : '????') + ')';
      }
      item.textContent = label;
      this.playerListEl.appendChild(item);
    }
};

NetworkingScreen.prototype.showOverlay = function() {
    if (!this.overlayEnabled) { return; }
    // Default behavior: if not ready, show connect; otherwise show chat
    if (peerManager && (peerManager.connections || []).length > 0 || (peerManager && peerManager.readyNotified)) {
      this.showChatOverlay();
    } else {
      this.showConnectOverlay();
    }
};

NetworkingScreen.prototype.showConnectOverlay = function(){
    if (!this.overlayEnabled) { return; }
    this.overlayRequested = true;
    if (!this.connectOverlay) { this.ensureDom(); }
    if (this.chatOverlay) { this.chatOverlay.classList.add('hidden'); this.chatOverlay.style.display = ''; }
    if (this.connectOverlay) {
      this.connectOverlay.classList.remove('hidden');
      this.connectOverlay.style.display = 'flex';
      if (this.roomInput) { try { this.roomInput.focus(); } catch(_){} }
    }
};

NetworkingScreen.prototype.showChatOverlay = function(){
    if (!this.overlayEnabled) { return; }
    this.ensureDom();
    if (this.connectOverlay) { this.connectOverlay.classList.add('hidden'); this.connectOverlay.style.display = ''; }
    if (this.chatPanel) {
      this.chatPanel.classList.remove('hidden');
      this.chatPanel.classList.add('chat-open');
      // Ensure chat controls are enabled immediately when opening the chat UI
      if (this.chatInput) {
        try { this.chatInput.disabled = false; this.chatInput.removeAttribute('disabled'); } catch(_){}
      }
      if (this.sendButton) {
        try { this.sendButton.disabled = false; this.sendButton.removeAttribute('disabled'); } catch(_){}
      }
      if (this.chatInput) { try { this.chatInput.focus(); } catch(_){} }
    }
};

NetworkingScreen.prototype.hideOverlay = function() {
    this.ensureDom();
    this.overlayRequested = false;
    if (this.connectOverlay) {
      this.connectOverlay.classList.add('hidden');
      this.connectOverlay.style.display = '';
    }
    // Do NOT hide the docked chat panel when closing the connect overlay.
    // Only collapse it (optional) but keep it visible as part of main UI.
    if (this.chatPanel) { this.chatPanel.classList.add('chat-open'); this.chatPanel.classList.remove('hidden'); }
};

NetworkingScreen.prototype.enableOverlay = function(){ this.overlayEnabled = true; };
NetworkingScreen.prototype.disableOverlay = function(){ this.overlayEnabled = false; this.hideOverlay(); };

  // No canvas-driven lifecycle here; input handled by DOM elements.

export { NetworkingScreen };

import { eventHub } from '../event_hub.js';
import { netBinary } from './binary_protocol.js';
import { netProtocol } from './protocol_router.js';
import { createPowerupByType } from '../maze/Powerup.js';

export class PeerManager {
  constructor() {
    this.remoteTankConfigs = {};
    this.localTankConfigs = [];
    this.game = null;
    this.reset();
    // instrumentation
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
    // Removed unused guest/host powerup tracking fields during refactor
  }

  reset() {
    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (err) {
        /* logging removed */
      }
    }
    this.peer = null;
    this.connections = [];
    this.nickname = '';
    this.players = new Map();
    this.isHost = false;
    this.id = null;
    this.roomName = '';
    this.readyNotified = false;
    this.lastStartPayload = null;
    this.remoteTankConfigs = {};
    if (this.isHost) {
      this.remoteTankConfigs[this.id || 'host'] = this.localTankConfigs || [];
    }
    this.stopInstrumentation();
  }

  hostRoom(roomName, nickname) {
    if (!window.Peer) {
      eventHub.emit('network-status', 'PeerJS library not available.');
      return;
    }
    roomName = sanitize(roomName);
    nickname = sanitize(nickname) || 'Commander';
    if (!roomName) {
      eventHub.emit('network-status', 'Please provide a room name to host.');
      return;
    }
    this.reset();
    this.isHost = true;
    this.roomName = roomName;
    this.nickname = nickname;
    /* logging removed */
    this.peer = new Peer(roomName);
    this.peer.on('connection', (conn) => {
      /* logging removed */
      this.setupConnection(conn);
    });
    this.peer.on('open', (id) => {
      this.id = id;
      this.players.set(id, this.nickname);
      eventHub.emit('network-status', 'Hosting room "' + roomName + '". ');
      eventHub.emit('network-ready', { role: 'host', roomId: id });
      this.readyNotified = true;
      this.emitPlayerList();
      addChatMessage('You are hosting the room as "' + this.nickname + '".', 'notification-message');
      /* logging removed */
      this.startInstrumentation();
    });
    this.peer.on('error', (err) => {
      /* logging removed */
      eventHub.emit('network-status', 'Error hosting room: ' + (err && err.type ? err.type : 'unknown'));
      if (err && (err.type === 'unavailable-id' || /taken/i.test(err.message || ''))) {
        eventHub.emit('network-status', 'Room name already taken. Ask friends for the room code to join.');
      } else {
        addChatMessage('* Host error: ' + (err && err.type ? err.type : 'unknown'), 'notification-message');
      }
    });
  }

  joinRoom(roomName, nickname) {
    if (!window.Peer) {
      eventHub.emit('network-status', 'PeerJS library not available.');
      return;
    }
    roomName = sanitize(roomName);
    // If no nickname provided, pick a random army-themed callsign
    nickname = sanitize(nickname) || randomCallsign();
    if (!roomName) {
      eventHub.emit('network-status', 'Please enter a room name or ID to join.');
      return;
    }
    this.reset();
    this.isHost = false;
    this.roomName = roomName;
    this.nickname = nickname;
    /* logging removed */
    this.peer = new Peer();
    this.peer.on('open', (id) => {
      this.id = id;
      this.players.set(id, this.nickname);
      eventHub.emit('network-status', 'Attempting to join room "' + roomName + '"...');
      this.emitPlayerList();
      /* logging removed */
      const conn = this.peer.connect(roomName);
      conn.on('error', (err) => {
        /* logging removed */
        eventHub.emit('network-status', 'Connection error: ' + (err && err.type ? err.type : 'unknown'));
      });
      this.setupConnection(conn);
    });
    this.peer.on('error', (err) => {
      /* logging removed */
      eventHub.emit('network-status', 'Error joining room: ' + (err && err.type ? err.type : 'unknown'));
    });
  }
  
  setupConnection(conn) {
    if (!conn || conn._handled) { return; }
    conn._handled = true;
    /* logging removed */
    this.connections.push(conn);
    conn.on('data', (data) => {
      // logging removed
      // stats: incoming
      try {
        var size = 0;
        if (typeof data === 'string') { size = data.length; }
        else if (data && data.byteLength) { size = data.byteLength; }
        this._stats.recvBytes += size;
        this._stats.recvMessages += 1;
      } catch (_) {}
      if (netProtocol && typeof netProtocol.handlePeerMessage === 'function') {
        netProtocol.handlePeerMessage(this, data, conn);
      }
    });
    conn.on('close', () => {
      this.connections = this.connections.filter((c) => c !== conn);
      const removedName = this.players.get(conn.peer);
      this.players.delete(conn.peer);
      if (this.remoteTankConfigs) {
        delete this.remoteTankConfigs[conn.peer];
      }
      this.broadcastPlayerList();
      if (removedName) {
        addChatMessage('* ' + removedName + ' disconnected.', 'notification-message');
        if (this.isHost) {
          this.sendNotification(removedName + ' left the room.');
        }
      }
      /* logging removed */
    });
    conn.on('error', (err) => {
      /* logging removed */
      eventHub.emit('network-status', 'Connection error with ' + conn.peer);
    });
    conn.on('open', () => {
      /* logging removed */
      if (!this.isHost) {
        eventHub.emit('network-status', 'Connected to host "' + conn.peer + '".');
        eventHub.emit('network-ready', { role: 'guest', roomId: this.roomName });
        // Notify guest locally in chat area (mirrors host notification)
        addChatMessage('You joined room "' + this.roomName + '" as "' + this.nickname + '".', 'notification-message');
        this.startInstrumentation();
      }
      // Send nickname (binary with fallback)
      try { conn.send(netBinary.buildNickname(this.id, this.nickname)); } catch (e) { try { conn.send(['N', this.id, netProtocol.encodeFreeText(this.nickname)].join(',')); } catch(_){} }
      if (this.isHost) {
        this.sendPlayerListTo(conn);
        this.broadcastPlayerList();
        if (this.game && this.game.main_object && typeof this.game.main_object.getCachedSnapshot === 'function') {
          // Compact init for late joiners
          if (this.game && this.game.maze && typeof this.game.maze.serializeInitString === 'function') {
            try {
              var istr = this.game.maze.serializeInitString();
              var ib = null;
              try { ib = netBinary.buildInitFromString(istr); } catch(_){ ib = null; }
              if (ib) { conn.send(ib); } else { conn.send(istr); }
            } catch (e) {}
          }
          // Unified snapshot (experimental): send JSON state for immediate parity
          try {
            if (this.game && this.game.maze && typeof this.game.maze.serializeUnifiedSnapshot === 'function') {
              var jsnap = this.game.maze.serializeUnifiedSnapshot();
              conn.send('U,' + jsnap);
            }
          } catch(_){}
        }
      }
    });
  };

  broadcast(message, excludeConn) {
    // Try to convert certain compact strings to binary for efficiency
    let outMsg = message;
    try {
      if (typeof message === 'string' && message.length) {
        const k = message[0];
        if (k === 'I') {
          const binI = netBinary.buildInitFromString(message);
          if (binI) { outMsg = binI; }
        } else if (k === 'D') {
          const binD = netBinary.buildDeltaFromString(message);
          if (binD) { outMsg = binD; }
        } else if (k === 'P') {
          // Convert via current player list for accuracy
          outMsg = netBinary.buildPlayerList(this.getPlayerListPayload());
        } else if (k === 'M') {
          // M,nickname,text
          const parts = message.split(',');
          const nick = netProtocol.decodeFreeText(parts[1]||'');
          const text = netProtocol.decodeFreeText(parts.slice(2).join(','));
          outMsg = netBinary.buildChat(nick, text);
        } else if (k === 'E') {
          const text = netProtocol.decodeFreeText(message.substring(2));
          outMsg = netBinary.buildNotify(text);
        } else if (k === 'X') {
          const binX = netBinary.buildPowerupEventFromString(message);
          if (binX) { outMsg = binX; }
        } else if (k === 'S') {
          const binS = netBinary.buildSpawnFromString(message);
          if (binS) { outMsg = binS; }
        } else if (k === 'N') {
          const parts = message.split(',');
          const pid = parts[1]||'';
          const nick = netProtocol.decodeFreeText(parts[2]||'');
          outMsg = netBinary.buildNickname(pid, nick);
        }
      }
    } catch (_) {}
    this.connections.forEach((conn) => {
      if (conn.open && conn !== excludeConn) {
        try {
          conn.send(outMsg);
          // stats: outgoing
          try {
            var size = 0;
            if (typeof outMsg === 'string') { size = outMsg.length; }
            else if (outMsg && outMsg.byteLength) { size = outMsg.byteLength; }
            this._stats.sentBytes += size;
            this._stats.sentMessages += 1;
          } catch (_) {}
        } catch (err) { /* logging removed */ }
      }
    });
  }

  broadcastPlayerList() {
    // Send binary player list
    try { this.broadcast(netBinary.buildPlayerList(this.getPlayerListPayload())); } catch (e) { try { this.broadcast(netProtocol.buildCompactPlayerList(this.getPlayerListPayload())); } catch(_){} }
    this.emitPlayerList();
  }

  sendPlayerListTo(conn) {
    if (!conn || !conn.open) { return; }
    try { conn.send(netBinary.buildPlayerList(this.getPlayerListPayload())); } catch (e) { try { conn.send(netProtocol.buildCompactPlayerList(this.getPlayerListPayload())); } catch(_){} }
  }

  emitPlayerList() {
    eventHub.emit('network-player-list', this.getPlayerListPayload());
    if (!this.isHost) { this.maybeEmitReady('player-list'); }
  }

  getPlayerListPayload() {
    const list = [];
    this.players.forEach((name, id) => { list.push({ id, nickname: name }); });
    return list;
  }

  sendTankConfig(configs) {
    this.localTankConfigs = configs || [];
    if (!this.peer) { return; }
    const peerId = this.id || 'pending';
    if (this.isHost) { this.remoteTankConfigs[peerId] = this.localTankConfigs; }
    // Compact T message: T,peerId,panelId|colour|c1|c2|c3|c4|c5|c6;...
    try {
      const blocks = (this.localTankConfigs || []).map((cfg) => {
        const pid = netProtocol.encodeFreeText(cfg.panelId || '');
        const col = netProtocol.encodeFreeText(cfg.colour || '');
        const cs = (cfg.controls || []).slice(0, 6).map(netProtocol.encodeFreeText);
        while (cs.length < 6) { cs.push(''); }
        return [pid, col].concat(cs).join('|');
      }).join(';');
      const msg = ['T', peerId, blocks].join(',');
      this.broadcast(msg);
    } catch (e) { /* ignore send error */ }
  }

  sendInputState(state) {
    if (!state || !state.tankId) { return; }
    state.peerId = this.id;
    if (this.isHost) { this.applyInputState(state); return; }
    // Send minimal binary input packet
    try {
      this.broadcast(netBinary.buildInput(state));
    } catch (e) {
      // Fallback to compact string if binary fails
      var flags = function(v){ return v ? 1 : 0; };
      var compact = ['C', state.tankId, flags(state.upPressed), flags(state.rightPressed), flags(state.downPressed), flags(state.leftPressed), flags(state.shooting), flags(state.specialKeyPressed)].join(',');
      this.broadcast(compact);
    }
  }

  updatePlayersFromPayload(players) {
    this.players = new Map();
    if (Array.isArray(players)) {
      for (let i = 0; i < players.length; i++) {
        const entry = players[i];
        if (entry && entry.id) {
          this.players.set(entry.id, entry.nickname || 'Player');
        }
      }
    }
    if (this.id && !this.players.has(this.id)) {
      this.players.set(this.id, this.nickname);
    }
    this.emitPlayerList();
  }

  applyInputState(state) {
    if (!state) { return; }
    if (this.isHost) {
      this.remoteTankConfigs = this.remoteTankConfigs || {};
      if (state.peerId && !this.remoteTankConfigs[state.peerId]) {
        this.remoteTankConfigs[state.peerId] = [];
      }
    }
    if (this.game && this.game.main_object && typeof this.game.main_object.applyInputState === 'function') {
      this.game.main_object.applyInputState(state);
    }
  }

  addPlayer(id, nickname) {
    if (!id) { return; }
    this.players.set(id, nickname || 'Player');
    this.broadcastPlayerList();
  }

  sendChatMessage(message) {
    // Compact M,nickname,text
    const nickSafe = netProtocol.encodeFreeText(this.nickname);
    const textSafe = netProtocol.encodeFreeText(message);
    this.broadcast(['M', nickSafe, textSafe].join(','));
  }

  sendNotification(text) {
    addChatMessage('* ' + text, 'notification-message');
    // Compact E,text
    const textSafe = netProtocol.encodeFreeText(text);
    this.broadcast(['E', textSafe].join(','));
  }

  getNickname() { return this.nickname; }

  maybeEmitReady(reason) {
    if (this.readyNotified) { return; }
    this.readyNotified = true;
    /* logging removed */
    eventHub.emit('network-ready', { role: this.isHost ? 'host' : 'guest', roomId: this.isHost ? this.id : this.roomName });
  }

  // --- instrumentation ---
  startInstrumentation() {
    this.stopInstrumentation();
    // periodic stats
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
      eventHub.emit('network-stats', Object.assign({}, this._stats));
    }, 1000);
    // periodic ping from guests
    if (!this.isHost) {
      this._pingTimer = setInterval(() => {
        const ts = Math.floor(performance.now());
        try { this.broadcast(netBinary.buildPing(ts)); } catch (_) {}
      }, 2000);
    }
  }

  stopInstrumentation() {
    if (this._statsTimer) { clearInterval(this._statsTimer); this._statsTimer = null; }
    if (this._pingTimer) { clearInterval(this._pingTimer); this._pingTimer = null; }
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
}

function sanitize(value) {
  return (value || '').replace(/[^a-zA-Z0-9 _-]/g, '').trim();
}

function encodeFreeText(value) {
  return ('' + (value == null ? '' : value)).replace(/,/g, '·').replace(/[|;]/g, '/');
}

function decodeFreeText(value) {
  return ('' + (value == null ? '' : value)).replace(/·/g, ',');
}

// ---- Minimal binary protocol helpers ----
// Type codes
const BIN_TYPE = {
  INPUT: 0x01,   // guest -> host: input state
  PING:  0x02,   // guest -> host
  PONG:  0x03,   // host  -> guest
  PLAYERS: 0x10, // player list
  NICK:   0x11,  // nickname
  CHAT:   0x12,  // chat message
  NOTIFY: 0x13,  // notification
  PWR:    0x14,  // powerup event
  SPAWN:  0x15,  // spawn item
  INIT: 0x20,    // state init
  DELTA: 0x21    // state delta
};

function utf8Encode(str) {
  // Simple UTF-8 encode for small ASCII-ish strings
  str = '' + (str == null ? '' : str);
  const out = new Uint8Array(str.length * 4);
  let o = 0;
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) { out[o++] = code; }
    else if (code < 0x800) { out[o++] = 0xC0 | (code >> 6); out[o++] = 0x80 | (code & 0x3F); }
    else if (code < 0x10000) { out[o++] = 0xE0 | (code >> 12); out[o++] = 0x80 | ((code >> 6) & 0x3F); out[o++] = 0x80 | (code & 0x3F); }
    else { out[o++] = 0xF0 | (code >> 18); out[o++] = 0x80 | ((code >> 12) & 0x3F); out[o++] = 0x80 | ((code >> 6) & 0x3F); out[o++] = 0x80 | (code & 0x3F); }
  }
  return out.slice(0, o);
}

function utf8Decode(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes || 0);
  let out = '';
  for (let i = 0; i < b.length; i++) {
    const c = b[i];
    if (c < 0x80) { out += String.fromCharCode(c); }
    else if ((c & 0xE0) === 0xC0) { const c2 = b[++i]; out += String.fromCharCode(((c & 0x1F) << 6) | (c2 & 0x3F)); }
    else if ((c & 0xF0) === 0xE0) { const c2 = b[++i], c3 = b[++i]; out += String.fromCharCode(((c & 0x0F) << 12) | ((c2 & 0x3F) << 6) | (c3 & 0x3F)); }
    else { const c2 = b[++i], c3 = b[++i], c4 = b[++i]; let cp = ((c & 0x07) << 18) | ((c2 & 0x3F) << 12) | ((c3 & 0x3F) << 6) | (c4 & 0x3F); cp -= 0x10000; out += String.fromCharCode(0xD800 + (cp >> 10), 0xDC00 + (cp & 0x3FF)); }
  }
  return out;
}

function buildBinaryInput(state) {
  const idBytes = utf8Encode(state.tankId || '');
  const flags = (state.upPressed ? 1 : 0) |
                ((state.rightPressed ? 1 : 0) << 1) |
                ((state.downPressed ? 1 : 0) << 2) |
                ((state.leftPressed ? 1 : 0) << 3) |
                ((state.shooting ? 1 : 0) << 4) |
                ((state.specialKeyPressed ? 1 : 0) << 5);
  const len = Math.min(255, idBytes.length);
  const buf = new Uint8Array(3 + len);
  buf[0] = BIN_TYPE.INPUT;
  buf[1] = len;
  for (let i = 0; i < len; i++) { buf[2 + i] = idBytes[i]; }
  buf[2 + len] = flags & 0x3F;
  return buf.buffer;
}

function buildBinaryPing(ts) {
  const buf = new ArrayBuffer(1 + 4);
  const dv = new DataView(buf);
  dv.setUint8(0, BIN_TYPE.PING);
  // 32-bit ts is enough for RTT calculation
  dv.setUint32(1, (ts >>> 0));
  return buf;
}

function buildBinaryPong(ts) {
  const buf = new ArrayBuffer(1 + 4);
  const dv = new DataView(buf);
  dv.setUint8(0, BIN_TYPE.PONG);
  dv.setUint32(1, (ts >>> 0));
  return buf;
}

function ByteWriter() {
  this._a = [];
}
ByteWriter.prototype.writeU8 = function(v){ this._a.push((v & 0xFF) >>> 0); };
ByteWriter.prototype.writeU16 = function(v){ v >>>= 0; this._a.push((v & 0xFF), ((v >>> 8) & 0xFF)); };
ByteWriter.prototype.writeU32 = function(v){ v >>>= 0; this._a.push((v & 0xFF), ((v>>>8)&0xFF), ((v>>>16)&0xFF), ((v>>>24)&0xFF)); };
ByteWriter.prototype.writeF32 = function(f){ const buf = new ArrayBuffer(4); new DataView(buf).setFloat32(0, +f || 0, true); const b = new Uint8Array(buf); for (let i=0;i<4;i++){ this._a.push(b[i]); } };
ByteWriter.prototype.writeBytes = function(bytes){ const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes||0); for (let i=0;i<b.length;i++){ this._a.push(b[i]); } };
ByteWriter.prototype.writeStr8 = function(str){ const b = utf8Encode(str||''); const len = Math.min(255, b.length); this.writeU8(len); for (let i=0;i<len;i++){ this._a.push(b[i]); } };
ByteWriter.prototype.writeStr16 = function(str){ const b = utf8Encode(str||''); const len = Math.min(65535, b.length); this.writeU16(len); for (let i=0;i<len;i++){ this._a.push(b[i]); } };
ByteWriter.prototype.toBuffer = function(){ const u = new Uint8Array(this._a.length); for (let i=0;i<u.length;i++){ u[i] = this._a[i]; } return u.buffer; };

function buildBinaryPlayerList(players){
  const w = new ByteWriter();
  w.writeU8(BIN_TYPE.PLAYERS);
  const list = Array.isArray(players) ? players : [];
  const n = Math.min(255, list.length);
  w.writeU8(n);
  for (let i = 0; i < n; i++){
    const p = list[i] || {};
    w.writeStr8(p.id || '');
    w.writeStr8(p.nickname || 'Player');
  }
  return w.toBuffer();
}

function parseInitStringParts(str){
  const parts = (str||'').split(',');
  if (parts[0] !== 'I') return null;
  return parts;
}

function buildBinaryInitFromString(str){
  const parts = parseInitStringParts(str);
  if (!parts) return null;
  const toInt = (v)=>{ const n = parseInt(v,10); return isNaN(n)?0:n; };
  const toNum = (v)=>{ const n = parseFloat(v); return isNaN(n)?0:n; };
  const w = new ByteWriter();
  w.writeU8(BIN_TYPE.INIT);
  // 12 numeric + 1 flag (ff)
  const rows=toInt(parts[1]), cols=toInt(parts[2]), wall=toInt(parts[3]);
  const mv=toNum(parts[4]), rv=toNum(parts[5]), bv=toNum(parts[6]);
  const bl=toInt(parts[7]), bo=toInt(parts[8]);
  const pi=toNum(parts[9]), pl=toInt(parts[10]), pd=toNum(parts[11]);
  const ff=(parts[12]==='1')?1:0;
  w.writeU16(rows); w.writeU16(cols); w.writeU16(wall);
  w.writeF32(mv); w.writeF32(rv); w.writeF32(bv);
  w.writeU16(bl); w.writeU16(bo);
  w.writeF32(pi); w.writeU16(pl); w.writeF32(pd);
  w.writeU8(ff);
  // layout (base64 string) - may exceed 255, use 16-bit length
  w.writeStr16(parts[13] || '');
  // powerups
  const pBlock = parts[14] || '';
  const pList = pBlock ? pBlock.split(';').filter(Boolean) : [];
  const pc = Math.min(65535, pList.length);
  w.writeU16(pc);
  for (let i=0;i<pc;i++){
    const f = pList[i].split('|');
    w.writeU16(toInt(f[0]||0)); // x
    w.writeU16(toInt(f[1]||0)); // y
    w.writeU16(toInt(f[2]||0)); // w
    w.writeU16(toInt(f[3]||0)); // h
    w.writeStr8(f[4]||'');      // spriteId
    w.writeStr8(f[5]||'');      // color
  }
  // tanks
  const tBlock = parts[15] || '';
  const tList = tBlock ? tBlock.split(';').filter(Boolean) : [];
  const tc = Math.min(65535, tList.length);
  w.writeU16(tc);
  for (let i=0;i<tc;i++){
    const f = tList[i].split('|');
    w.writeStr8(f[0]||'');               // id
    w.writeU16(toInt(f[1]||0));          // x
    w.writeU16(toInt(f[2]||0));          // y
    w.writeF32(toNum(f[3]||0));          // rotation
    w.writeU16(toInt(f[4]||0));          // width
    w.writeU16(toInt(f[5]||0));          // height
    w.writeStr8(f[6]||'');               // colour
    w.writeU16(toInt(f[7]||0));          // score
  }
  return w.toBuffer();
}

function buildBinaryDeltaFromString(str){
  const parts = (str||'').split(',');
  if (parts[0] !== 'D') return null;
  const toInt = (v)=>{ const n = parseInt(v,10); return isNaN(n)?0:n; };
  const toNum = (v)=>{ const n = parseFloat(v); return isNaN(n)?0:n; };
  const w = new ByteWriter();
  w.writeU8(BIN_TYPE.DELTA);
  const ts = toInt(parts[1]||0);
  w.writeU32(ts);
  // tanks
  const tBlock = parts[2] || '';
  const tList = tBlock ? tBlock.split(';').filter(Boolean) : [];
  const tc = Math.min(65535, tList.length);
  w.writeU16(tc);
  for (let i=0;i<tc;i++){
    const f = tList[i].split('|');
    w.writeStr8(f[0]||'');       // id
    w.writeU16(toInt(f[1]||0));  // x
    w.writeU16(toInt(f[2]||0));  // y
    w.writeF32(toNum(f[3]||0));  // rotation
    w.writeU16(toInt(f[4]||0));  // score
    w.writeU8(toInt(f[5]||1));   // alive
  }
  // bullets
  const bBlock = parts[3] || '';
  const bList = bBlock ? bBlock.split(';').filter(Boolean) : [];
  const bc = Math.min(65535, bList.length);
  w.writeU16(bc);
  for (let i=0;i<bc;i++){
    const f = bList[i].split('|');
    w.writeU16(toInt(f[0]||0));  // x
    w.writeU16(toInt(f[1]||0));  // y
    w.writeF32(toNum(f[2]||0));  // vx
    w.writeF32(toNum(f[3]||0));  // vy
    w.writeStr8(f[4]||'');       // colour
    w.writeU8(toInt(f[5]||1));   // radius
  }
  // powerups
  const pBlock = parts[4] || '';
  const pList = pBlock ? pBlock.split(';').filter(Boolean) : [];
  const pc = Math.min(65535, pList.length);
  w.writeU16(pc);
  for (let i=0;i<pc;i++){
    const f = pList[i].split('|');
    w.writeU16(toInt(f[0]||0)); // x
    w.writeU16(toInt(f[1]||0)); // y
    w.writeU16(toInt(f[2]||0)); // w
    w.writeU16(toInt(f[3]||0)); // h
    w.writeStr8(f[4]||'');      // spriteId
    w.writeStr8(f[5]||'');      // color
  }
  // events
  const eBlock = parts[5] || '';
  const eList = eBlock ? eBlock.split(';').filter(Boolean) : [];
  const ec = Math.min(65535, eList.length);
  w.writeU16(ec);
  for (let i=0;i<ec;i++){
    const f = eList[i].split('|');
    w.writeStr8(f[0]||'');  // powerup
    w.writeStr8(f[1]||'');  // status
    w.writeStr8(f[2]||'');  // target
    w.writeStr8(f[3]||'');  // tankId
  }
  return w.toBuffer();
}

function buildBinaryNickname(peerId, nickname){
  const w = new ByteWriter();
  w.writeU8(BIN_TYPE.NICK);
  w.writeStr8(peerId||'');
  w.writeStr8(nickname||'');
  return w.toBuffer();
}

function buildBinaryChat(nickname, text){
  const w = new ByteWriter();
  w.writeU8(BIN_TYPE.CHAT);
  w.writeStr8(nickname||'');
  w.writeStr16(text||'');
  return w.toBuffer();
}

function buildBinaryNotify(text){
  const w = new ByteWriter();
  w.writeU8(BIN_TYPE.NOTIFY);
  w.writeStr16(text||'');
  return w.toBuffer();
}

function buildBinaryPowerupEventFromString(str){
  // X,powerup,status,target,tankId,powerupId
  const parts = (str||'').split(',');
  if (parts[0] !== 'X') return null;
  const w = new ByteWriter();
  w.writeU8(BIN_TYPE.PWR);
  w.writeStr8(parts[1]||'');
  w.writeStr8(parts[2]||'');
  w.writeStr8(parts[3]||'');
  w.writeStr8(parts[4]||'');
  const id = parseInt(parts[5]||'0',10) || 0;
  w.writeU16(id);
  return w.toBuffer();
}

function buildBinarySpawnFromString(str){
  // S,type|id|x|y|w|h|spriteId|color
  if (typeof str !== 'string' || str[0] !== 'S') return null;
  const block = str.substring(2) || '';
  const f = block.split('|');
  const toInt = (v)=>{ const n=parseInt(v,10); return isNaN(n)?0:n; };
  const w = new ByteWriter();
  w.writeU8(BIN_TYPE.SPAWN);
  w.writeStr8(f[0]||'');            // type
  w.writeU16(toInt(f[1]||0));       // id
  w.writeU16(toInt(f[2]||0));       // x
  w.writeU16(toInt(f[3]||0));       // y
  w.writeU16(toInt(f[4]||0));       // w
  w.writeU16(toInt(f[5]||0));       // h
  w.writeStr8(f[6]||'');            // spriteId
  w.writeStr8(f[7]||'');            // color
  return w.toBuffer();
}

// Hydrate incoming network payload to a compact string message understood by handlers.
// - If Blob: re-dispatch after converting to ArrayBuffer (async) and return null
// - If ArrayBuffer/Uint8Array: parse minimal format and return legacy compact string
// - If string: return as-is
function hydrate(data, manager, conn) {
  try {
    if (typeof data === 'string') { return data; }
    // Handle Blob by converting to ArrayBuffer then reinvoking
    if (typeof Blob !== 'undefined' && data instanceof Blob && data.arrayBuffer) {
      data.arrayBuffer().then((buf) => { try { handlePeerMessage(manager, buf, conn); } catch (_) {} });
      return null;
    }
    // Handle ArrayBuffer or typed array
    let bytes = null;
    if (data && data.byteLength != null && !(data instanceof ArrayBuffer)) { bytes = new Uint8Array(data); }
    else if (data instanceof ArrayBuffer) { bytes = new Uint8Array(data); }
    if (!bytes || bytes.length === 0) { return data; }
    const type = bytes[0];
    switch (type) {
      case BIN_TYPE.INPUT: {
        const len = bytes[1] || 0;
        const idBytes = bytes.slice(2, 2 + len);
        const tankId = utf8Decode(idBytes);
        const flags = bytes[2 + len] || 0;
        const f = function(bit){ return ((flags >> bit) & 1) ? '1' : '0'; };
        return ['C', tankId, f(0), f(1), f(2), f(3), f(4), f(5)].join(',');
      }
      case BIN_TYPE.PING: {
        const dv = new DataView(bytes.buffer, bytes.byteOffset || 0, bytes.byteLength);
        const ts = dv.getUint32(1);
        return 'Q,' + ts;
      }
      case BIN_TYPE.PONG: {
        const dv = new DataView(bytes.buffer, bytes.byteOffset || 0, bytes.byteLength);
        const ts = dv.getUint32(1);
        return 'q,' + ts;
      }
      case BIN_TYPE.INIT: {
        let o = 1;
        const rdU16 = ()=>{ const v = bytes[o] | (bytes[o+1]<<8); o+=2; return v>>>0; };
        const rdU8  = ()=> bytes[o++];
        const rdF32 = ()=>{ const dv = new DataView(bytes.buffer, bytes.byteOffset + o, 4); const f = dv.getFloat32(0, true); o+=4; return f; };
        const rdStr8 = ()=>{ const l = rdU8(); const s = utf8Decode(bytes.slice(o, o+l)); o+=l; return s; };
        const rdStr16 = ()=>{ const l = rdU16(); const s = utf8Decode(bytes.slice(o, o+l)); o+=l; return s; };
        const rows=rdU16(), cols=rdU16(), wall=rdU16();
        const mv=rdF32(), rv=rdF32(), bv=rdF32();
        const bl=rdU16(), bo=rdU16();
        const pi=rdF32(), pl=rdU16(), pd=rdF32();
        const ff=rdU8();
        const layoutStr = rdStr16();
        const pc = rdU16();
        const pParts = [];
        for (let i=0;i<pc;i++){
          const x=rdU16(), y=rdU16(), w=rdU16(), h=rdU16();
          const sid=rdStr8(), col=rdStr8();
          pParts.push([x,y,w,h,sid,col].join('|'));
        }
        const tc = rdU16();
        const tParts = [];
        for (let i=0;i<tc;i++){
          const id=rdStr8(); const x=rdU16(), y=rdU16(); const rot=rdF32(); const w=rdU16(), h=rdU16(); const col=rdStr8(); const score=rdU16();
          tParts.push([id,x,y,rot,w,h,col,score].join('|'));
        }
        return ['I', rows, cols, wall, mv, rv, bv, bl, bo, pi, pl, pd, (ff?1:0), layoutStr, pParts.join(';'), tParts.join(';')].join(',');
      }
      case BIN_TYPE.DELTA: {
        let o = 1;
        const rdU16 = ()=>{ const v = bytes[o] | (bytes[o+1]<<8); o+=2; return v>>>0; };
        const rdU8  = ()=> bytes[o++];
        const rdU32 = ()=>{ const dv = new DataView(bytes.buffer, bytes.byteOffset + o, 4); const v = dv.getUint32(0, true); o+=4; return v>>>0; };
        const rdF32 = ()=>{ const dv = new DataView(bytes.buffer, bytes.byteOffset + o, 4); const f = dv.getFloat32(0, true); o+=4; return f; };
        const rdStr8 = ()=>{ const l = rdU8(); const s = utf8Decode(bytes.slice(o, o+l)); o+=l; return s; };
        /*ts*/ rdU32();
        const tc = rdU16();
        const tParts = [];
        for (let i=0;i<tc;i++){
          const id=rdStr8(); const x=rdU16(), y=rdU16(); const rot=rdF32(); const score=rdU16(); const alive=rdU8();
          tParts.push([id,x,y,rot,score,alive].join('|'));
        }
        const bc = rdU16();
        const bParts = [];
        for (let i=0;i<bc;i++){
          const x=rdU16(), y=rdU16(); const vx=rdF32(), vy=rdF32(); const col=rdStr8(); const rad=rdU8();
          bParts.push([x,y,vx,vy,col,rad].join('|'));
        }
        const pc = rdU16();
        const pParts = [];
        for (let i=0;i<pc;i++){
          const x=rdU16(), y=rdU16(), w=rdU16(), h=rdU16(); const sid=rdStr8(), col=rdStr8();
          pParts.push([x,y,w,h,sid,col].join('|'));
        }
        const ec = rdU16();
        const eParts = [];
        for (let i=0;i<ec;i++){
          const p=rdStr8(), s=rdStr8(), t=rdStr8(), id=rdStr8();
          eParts.push([p,s,t,id].join('|'));
        }
        return ['D', tParts.join(';'), bParts.join(';'), pParts.join(';'), eParts.join(';')].join(',');
      }
      case BIN_TYPE.PLAYERS: {
        // Optional player list hydration for future use
        let o = 1; const n = bytes[o++] || 0; const parts = [];
        for (let i = 0; i < n; i++) {
          const lid = bytes[o++] || 0; const id = utf8Decode(bytes.slice(o, o + lid)); o += lid;
          const lnn = bytes[o++] || 0; const nn = utf8Decode(bytes.slice(o, o + lnn)); o += lnn;
          parts.push(id + '|' + encodeFreeText(nn));
        }
        return 'P,' + parts.join(';');
      }
      case BIN_TYPE.NICK: {
        let o = 1; const rl8 = ()=> bytes[o++]; const rStr8 = ()=>{ const l=rl8(); const s=utf8Decode(bytes.slice(o,o+l)); o+=l; return s; };
        const id = rStr8(); const nn = rStr8();
        return 'N,' + id + ',' + encodeFreeText(nn);
      }
      case BIN_TYPE.CHAT: {
        let o = 1; const rdU8=()=> bytes[o++]; const rdU16=()=>{ const v=bytes[o]|(bytes[o+1]<<8); o+=2; return v>>>0; };
        const rStr8=()=>{ const l=rdU8(); const s=utf8Decode(bytes.slice(o,o+l)); o+=l; return s; };
        const rStr16=()=>{ const l=rdU16(); const s=utf8Decode(bytes.slice(o,o+l)); o+=l; return s; };
        const nick = rStr8(); const text = rStr16();
        return 'M,' + encodeFreeText(nick) + ',' + encodeFreeText(text);
      }
      case BIN_TYPE.NOTIFY: {
        let o=1; const rdU16=()=>{ const v=bytes[o]|(bytes[o+1]<<8); o+=2; return v>>>0; };
        const rStr16=()=>{ const l=rdU16(); const s=utf8Decode(bytes.slice(o,o+l)); o+=l; return s; };
        const text = rStr16();
        return 'E,' + encodeFreeText(text);
      }
      case BIN_TYPE.PWR: {
        let o=1; const rdU8=()=> bytes[o++]; const rdU16=()=>{ const v=bytes[o]|(bytes[o+1]<<8); o+=2; return v>>>0; };
        const rStr8=()=>{ const l=rdU8(); const s=utf8Decode(bytes.slice(o,o+l)); o+=l; return s; };
        const p=rStr8(), s=rStr8(), t=rStr8(), id=rStr8(); const pid=rdU16();
        return ['X', p, s, t, id, pid].join(',');
      }
      case BIN_TYPE.SPAWN: {
        let o=1; const rdU8=()=> bytes[o++]; const rdU16=()=>{ const v=bytes[o]|(bytes[o+1]<<8); o+=2; return v>>>0; };
        const rStr8=()=>{ const l=rdU8(); const s=utf8Decode(bytes.slice(o,o+l)); o+=l; return s; };
        const type=rStr8(); const id=rdU16(); const x=rdU16(); const y=rdU16(); const w=rdU16(); const h=rdU16(); const sid=rStr8(); const col=rStr8();
        const block = [type, id, x, y, w, h, sid, col].join('|');
        return 'S,' + block;
      }
    }
  } catch (_) { /* ignore hydration errors, fallback to original */ }
  return data;
}

function buildCompactPlayerList(players) {
  var blocks = (players || []).map(function(p){
    var id = p && p.id ? p.id : '';
    var name = p && p.nickname ? encodeFreeText(p.nickname) : 'Player';
    return id + '|' + name;
  }).join(';');
  return 'P,' + blocks;
}

  function handlePeerMessage(manager, data, conn) {
    // Hydrate first to normalize payloads (requirement)
    data = hydrate(data, manager, conn);
    if (data == null) { return; }
    // Compact protocol routing
    if (typeof data === 'string' && data.length) {
      var kind = data[0];
      switch (kind) {
        case 'U': {
          // U,{json unified snapshot}
          if (!manager.isHost && manager.game && manager.game.maze && typeof manager.game.maze.applyUnifiedSnapshot === 'function') {
            try { manager.game.maze.applyUnifiedSnapshot(data.substring(2)); } catch (e) {}
          }
          return;
        }
        case 'S': {
          // S,type|id|x|y|w|h|spriteId|color  (id is sequential integer)
          if (manager.isHost) { return; }
          try {
            if (!manager.game || !manager.game.maze) { return; }
            var mz = manager.game.maze;
            var block = data.substring(2) || '';
            if (!block) { return; }
            var f = block.split('|');
            var type = f[0] || '';
            var id = parseInt(f[1] || '0', 10) || 0;
            var x = parseInt(f[2] || '0', 10) || 0;
            var y = parseInt(f[3] || '0', 10) || 0;
            var w = parseInt(f[4] || '20', 10) || 20;
            var h = parseInt(f[5] || '20', 10) || 20;
            var spriteId = f[6] || '';
            var color = f[7] || '';
            // Maintain remote board powerups so spectators render them
            if (!mz.remotePowerups) { mz.remotePowerups = []; }
            mz.remotePowerups.push({ id: id, type: type, name: type, x: x, y: y, width: w, height: h, spriteId: spriteId, color: color });
            mz.remoteState = { tanks: mz.remoteTankMeta, powerups: mz.remotePowerups };
          } catch (e) {}
          return;
        }
        case 'Q': {
          // ping from guest -> host replies
          if (manager.isHost) {
            try {
              var tsStr = data.substring(2);
              var tsNum = parseInt(tsStr, 10) || 0;
              if (conn && conn.send) { conn.send(buildBinaryPong(tsNum)); }
            } catch (e) {}
          }
          return;
        }
        case 'q': {
          // pong from host -> guest measures RTT (uint32 wrap-safe)
          if (!manager.isHost) {
            try {
              var ts = (parseInt(data.substring(2), 10) >>> 0);
              var now = Math.floor(performance.now());
              var now32 = (now >>> 0);
              var diff = (now32 - ts) >>> 0;
              if (diff <= 30000) { manager._stats.rttMs = diff; }
            } catch (e) {}
          }
          return;
        }
        case 'I':
          if (!manager.isHost && manager.game && typeof manager.game.startFromHostCompact === 'function') {
            manager.game.startFromHostCompact(data);
          }
          return;
        case 'D':
          if (!manager.isHost && manager.game && typeof manager.game.updateStateFromHostCompact === 'function') {
            manager.game.updateStateFromHostCompact(data);
          }
          return;
        case 'C':
          // C,tankId,u,r,d,l,f,s
          if (manager.isHost) {
            try {
              var parts = data.split(',');
              var payload = {
                tankId: parts[1],
                upPressed: parts[2] === '1',
                rightPressed: parts[3] === '1',
                downPressed: parts[4] === '1',
                leftPressed: parts[5] === '1',
                shooting: parts[6] === '1',
                specialKeyPressed: parts[7] === '1',
                peerId: conn && conn.peer
              };
              manager.applyInputState(payload);
            } catch (e) { /* ignore parse errors */ }
          }
          return;
        case 'P': {
          // P,id|nickname;id2|nickname2
          try {
            var block = data.substring(2) || '';
            var players = [];
            if (block) {
              block.split(';').forEach(function(tok){
                if (!tok) { return; }
                var f = tok.split('|');
                var id = f[0];
                var nn = decodeFreeText(f[1] || 'Player');
                if (id) { players.push({ id: id, nickname: nn }); }
              });
            }
            manager.updatePlayersFromPayload(players);
            manager.maybeEmitReady('player-list-compact');
          } catch (e) {}
          return;
        }
        case 'N': {
          // N,peerId,nickname
          try {
            var partsN = data.split(',');
            var pid = partsN[1] || (conn && conn.peer);
            var nick = decodeFreeText(partsN[2] || 'Player');
            if (pid) {
              manager.players.set(pid, nick);
              manager.emitPlayerList();
              if (manager.isHost) {
                manager.broadcast(data, conn);
                manager.broadcastPlayerList();
              }
            }
            if (!manager.isHost) { manager.maybeEmitReady('nickname-compact'); }
          } catch (e) {}
          return;
        }
        case 'M': {
          // M,nickname,text
          try {
            var partsM = data.split(',');
            var nickM = decodeFreeText(partsM[1] || 'Player');
            var textM = decodeFreeText(partsM.slice(2).join(','));
            addChatMessage(nickM + ': ' + textM, 'other-message');
            if (manager.isHost) { manager.broadcast(data, conn); }
          } catch (e) {}
          return;
        }
        case 'E': {
          // E,text
          try {
            var textE = decodeFreeText(data.substring(2));
            addChatMessage('* ' + textE, 'notification-message');
            if (manager.isHost) { manager.broadcast(data, conn); }
          } catch (e) {}
          return;
        }
        case 'V': {
          // V,{json unified delta}
          if (!manager.isHost && manager.game && manager.game.maze && typeof manager.game.maze.applyUnifiedDelta === 'function') {
            try { manager.game.maze.applyUnifiedDelta(data.substring(2)); } catch (e) {}
          }
          return;
        }
        case 'X': {
          // X,powerup,status,target,tankId,powerupId
          try {
            var partsX = data.split(',');
            var pType = partsX[1] || '';
            var pStatus = partsX[2] || '';
            var pTarget = partsX[3] || '';
            var pTankId = partsX[4] || '';
            var pId = parseInt(partsX[5] || '0', 10) || 0;
            var payload = { type: 'powerup', powerup: pType, status: pStatus, target: pTarget, tankId: pTankId, powerupId: pId };
            // If host, apply to authoritative game state and rebroadcast to others
            if (manager.isHost && manager.game && manager.game.maze) {
              var mzHost = manager.game.maze;
              // Try board instance pickup first by id; fallback to synthesize by type
              var hostHandled = false;
              if (pId && Array.isArray(mzHost.powerups)) {
                for (var hi = 0; hi < mzHost.powerups.length; hi++){
                  var hp = mzHost.powerups[hi];
                  if (hp && hp.id === pId && typeof hp.pickup === 'function') { hostHandled = hp.pickup(pTankId) || hostHandled; break; }
                }
              }
              try {
                const hinst = createPowerupByType(pType, mzHost);
                if (hinst && typeof hinst.pickup === 'function') { try { hinst.pickup(pTankId); } catch(_){} }
              } catch (_) {}
              // Rebroadcast to all other guests except sender
              manager.broadcast(data, conn);
              return;
            }
            // Apply on local game if guest via Maze unified handler
            if (!manager.isHost && manager.game && manager.game.maze) {
              var mz = manager.game.maze;
              // Guests: route through Maze unified handler to update unified state/icons and flags
              if (typeof mz.applyPowerupEvent === 'function') { mz.applyPowerupEvent(payload); }
              // If a local tank triggered it (guest picking up), ensure board instance is consumed
              // so the icon renders immediately and the powerup disappears. Prefer exact id.
              try {
                if (payload && payload.status === 'activate' && payload.powerupId && Array.isArray(mz.powerups)) {
                  for (var gi = 0; gi < mz.powerups.length; gi++) {
                    var gp = mz.powerups[gi];
                    if (gp && gp.id === payload.powerupId && typeof gp.pickup === 'function') {
                      gp.pickup(payload.tankId || '');
                      break;
                    }
                  }
                }
              } catch(_){}
              // Ensure unified state has icon for immediate scoreboard before next delta arrives
              if (payload && payload.tankId && payload.status === 'activate' && typeof mz.resolvePowerupSpriteId === 'function') {
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
                if (typeof mz.recomputeGlobalPowerups === 'function') { mz.recomputeGlobalPowerups(); }
              }
            }
          } catch (e) {}
          return;
        }
        case 'T': {
          // T,peerId,panelId|colour|c1|c2|c3|c4|c5|c6;...
          try {
            var partsT = data.split(',');
            var fromId = partsT[1] || (conn && conn.peer);
            var blockT = partsT[2] || '';
            var list = [];
            if (blockT) {
              blockT.split(';').forEach(function(tok){
                if (!tok) { return; }
                var f = tok.split('|');
                var cfg = {
                  panelId: decodeFreeText(f[0] || ''),
                  colour: decodeFreeText(f[1] || ''),
                  controls: []
                };
                for (var i=2;i<8;i++){ cfg.controls.push(decodeFreeText(f[i] || '')); }
                list.push(cfg);
              });
            }
            if (fromId) {
              manager.remoteTankConfigs[fromId] = list;
              if (fromId === manager.id) {
                manager.localTankConfigs = list;
              }
            }
            // Host rebroadcasts to keep all guests in sync with each other's configs
            if (manager.isHost) { manager.broadcast(data, conn); }
          } catch (e) {}
          return;
        }
      }
    }
    // Ignore non-compact legacy messages
    return;
  }

  export function addChatMessage(message, messageType) {
    var chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) { return; }
    var messageElement = document.createElement('div');
    messageElement.textContent = message;
    messageElement.className = 'chat-message ' + (messageType || 'notification-message');
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // Export a shared singleton instance for modules
  export const peerManager = new PeerManager();

// No window.* bridges; all consumers should import from this module
  
function randomCallsign(){
  // Army-themed random callsigns used when guest doesn't provide nickname
  const CALLSIGNS = [
  'Scout','Ranger','Vanguard','Maverick','Falcon','Viper','Nomad','Ghost','Reaper','Sentinel',
  'Hunter','Bravo','Delta','Echo','Foxtrot','Saber','Specter','Havoc','Phoenix','Spartan',
  'Titan','Bulldog','Badger','Wolverine','Gunner','Hammer','Raptor','Hawk','Comet','Meteor',
  'Blaze','Gladius','Aegis','Paladin','Corsair','Dragoon','Lancer','Outrider','Pathfinder','Overwatch',
  'Warhorse','Longbow','Blackjack','Wildcat','Cougar','Kodiak','Patriot','Valkyrie','Legion','Arcadian',
  'Buckeye','Guardian','Centurion','Warlock','Sentury','Bastion','Onyx','Cinder','Inferno','Grizzly',
  'Ajax','Atlas','Bishop','Crosshair','Diesel','Fury','Goliath','Hurricane','Iceman','Jaguar',
  'Knight','Lynx','Maelstrom','Nomad-2','Oracle','Phantom','Quake','Ravager','Saber-2','Talon',
  'Umbra','Vector','Warden','Xiphos','Yankee','Zephyr','Ironclad','Foxhound','Thunder','Lightning'
  ];
  const i = Math.floor(Math.random() * CALLSIGNS.length);
  return CALLSIGNS[i];
}  

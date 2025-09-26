// Protocol router — parses hydrated strings and applies to game/peer state
import { createPowerupByType } from '../maze/Powerup.js';
import { addChatMessage } from './peer_manager.js';
import { netBinary } from './binary_protocol.js';
const P = {};
export const netProtocol = P;

  P.encodeFreeText = function(value){ return ('' + (value == null ? '' : value)).replace(/,/g, '·').replace(/[|;]/g, '/'); };
  P.decodeFreeText = function(value){ return ('' + (value == null ? '' : value)).replace(/·/g, ','); };

  P.buildCompactPlayerList = function(players){
    var blocks = (players || []).map(function(p){ var id = p && p.id ? p.id : ''; var name = p && p.nickname ? P.encodeFreeText(p.nickname) : 'Player'; return id + '|' + name; }).join(';');
    return 'P,' + blocks;
  };

  P.handlePeerMessage = function(manager, data, conn){
    // Always hydrate first
    data = netBinary && netBinary.hydrate ? netBinary.hydrate(data, manager, conn) : data;
    if (data == null) { return; }
    if (typeof data !== 'string' || !data.length) { return; }
    var kind = data[0];
    switch (kind) {
      case 'U': {
        if (!manager.isHost && manager.game && manager.game.maze && typeof manager.game.maze.applyUnifiedSnapshot === 'function') {
          try { manager.game.maze.applyUnifiedSnapshot(data.substring(2)); } catch (e) {}
        }
        return;
      }
      case 'S': {
        if (manager.isHost) { return; }
        try {
          if (!manager.game || !manager.game.maze) { return; }
          var mz = manager.game.maze; var block = data.substring(2) || ''; if (!block) { return; }
          var f = block.split('|'); var type = f[0]||''; var id = parseInt(f[1]||'0',10)||0; var x = parseInt(f[2]||'0',10)||0; var y = parseInt(f[3]||'0',10)||0; var w = parseInt(f[4]||'20',10)||20; var h = parseInt(f[5]||'20',10)||20; var spriteId = f[6]||''; var color = f[7]||'';
          if (!mz.remotePowerups) { mz.remotePowerups = []; }
          mz.remotePowerups.push({ id:id, type:type, name:type, x:x, y:y, width:w, height:h, spriteId:spriteId, color:color });
          mz.remoteState = { tanks: mz.remoteTankMeta, powerups: mz.remotePowerups };
        } catch(e){}
        return;
      }
      case 'Q': {
        if (manager.isHost) {
          try { var tsNum = parseInt(data.substring(2), 10) || 0; if (conn && conn.send) { conn.send(netBinary.buildPong(tsNum)); } } catch(e){}
        }
        return;
      }
      case 'q': {
        if (!manager.isHost) {
          try {
            var ts = parseInt(data.substring(2), 10) >>> 0;
            var now = Math.floor(performance.now());
            var now32 = (now >>> 0);
            var diff = (now32 - ts) >>> 0; // wrap-safe
            if (diff <= 30000) { manager._stats.rttMs = diff; }
          } catch(e){}
        }
        return;
      }
      case 'I': { if (!manager.isHost && manager.game && typeof manager.game.startFromHostCompact === 'function') { manager.game.startFromHostCompact(data); } return; }
      case 'D': { if (!manager.isHost && manager.game && typeof manager.game.updateStateFromHostCompact === 'function') { manager.game.updateStateFromHostCompact(data); } return; }
      case 'C': {
        if (manager.isHost) {
          try {
            var parts = data.split(',');
            var payload = {
              tankId: parts[1],
              upPressed: parts[2] === '1', rightPressed: parts[3] === '1', downPressed: parts[4] === '1', leftPressed: parts[5] === '1',
              shooting: parts[6] === '1', specialKeyPressed: parts[7] === '1', peerId: conn && conn.peer
            };
            manager.applyInputState(payload);
          } catch(e){}
        }
        return;
      }
      case 'P': {
        try {
          var block = data.substring(2) || ''; var players = [];
          if (block) { block.split(';').forEach(function(tok){ if (!tok) { return; } var f = tok.split('|'); var id = f[0]; var nn = P.decodeFreeText(f[1] || 'Player'); if (id) { players.push({ id: id, nickname: nn }); } }); }
          manager.updatePlayersFromPayload(players); manager.maybeEmitReady('player-list-compact');
        } catch(e){}
        return;
      }
      case 'N': {
        try {
          var partsN = data.split(','); var pid = partsN[1] || (conn && conn.peer); var nick = P.decodeFreeText(partsN[2] || 'Player');
          if (pid) { manager.players.set(pid, nick); manager.emitPlayerList(); if (manager.isHost) { manager.broadcast(data, conn); manager.broadcastPlayerList(); } }
          if (!manager.isHost) { manager.maybeEmitReady('nickname-compact'); }
        } catch(e){}
        return;
      }
      case 'M': {
        try { var partsM = data.split(','); var nickM = P.decodeFreeText(partsM[1]||'Player'); var textM = P.decodeFreeText(partsM.slice(2).join(',')); addChatMessage(nickM + ': ' + textM, 'other-message'); if (manager.isHost) { manager.broadcast(data, conn); } } catch(e){}
        return;
      }
      case 'E': {
        try { var textE = P.decodeFreeText(data.substring(2)); addChatMessage('* ' + textE, 'notification-message'); if (manager.isHost) { manager.broadcast(data, conn); } } catch(e){}
        return;
      }
      case 'V': {
        if (!manager.isHost && manager.game && manager.game.maze && typeof manager.game.maze.applyUnifiedDelta === 'function') { try { manager.game.maze.applyUnifiedDelta(data.substring(2)); } catch(e){} }
        return;
      }
      case 'X': {
        try {
          var partsX = data.split(','); var pType = partsX[1]||''; var pStatus = partsX[2]||''; var pTarget = partsX[3]||''; var pTankId = partsX[4]||''; var pId = parseInt(partsX[5]||'0',10)||0;
          var payload = { type:'powerup', powerup:pType, status:pStatus, target:pTarget, tankId:pTankId, powerupId:pId };
          if (manager.isHost && manager.game && manager.game.maze) {
            var mzHost = manager.game.maze; var hostHandled=false;
            if (pId && Array.isArray(mzHost.powerups)) { for (var hi=0;hi<mzHost.powerups.length;hi++){ var hp=mzHost.powerups[hi]; if (hp && hp.id===pId && typeof hp.pickup==='function'){ hostHandled = hp.pickup(pTankId)||hostHandled; break; } } }
            if (!hostHandled) { try { var hinst = createPowerupByType(pType, mzHost); if (hinst && typeof hinst.pickup === 'function') { try { hinst.pickup(pTankId); } catch(_){} } } catch(_){} }
            manager.broadcast(data, conn); return;
          }
          if (!manager.isHost && manager.game && manager.game.maze) {
            var mz = manager.game.maze; if (typeof mz.applyPowerupEvent === 'function') { mz.applyPowerupEvent(payload); }
            try { if (payload && payload.status==='activate' && payload.powerupId && Array.isArray(mz.powerups)) { for (var gi=0;gi<mz.powerups.length;gi++){ var gp=mz.powerups[gi]; if (gp && gp.id===payload.powerupId && typeof gp.pickup==='function'){ gp.pickup(payload.tankId||''); break; } } } } catch(_){ }
            if (payload && payload.tankId && payload.status==='activate' && typeof mz.resolvePowerupSpriteId === 'function') {
              mz.state = mz.state || { tanks:{}, powerups:{}, meta:{ nextPowerupId:0 } };
              var st = mz.state.tanks[payload.tankId] || (mz.state.tanks[payload.tankId] = { id: payload.tankId, powerups: [] });
              var iconId = mz.resolvePowerupSpriteId(payload.powerup);
              st.powerups = iconId ? [{ type: payload.powerup, spriteId: iconId }] : [{ type: payload.powerup }];
              if (mz.remoteTankMap) { var rt = mz.remoteTankMap[payload.tankId] || (mz.remoteTankMap[payload.tankId] = { id: payload.tankId }); rt.powerups = (st.powerups||[]).slice(); mz.remoteTankMeta = mz.collectRemoteTankMeta(); mz.remoteState = { tanks: mz.remoteTankMeta, powerups: mz.remotePowerups }; }
              if (typeof mz.recomputeGlobalPowerups === 'function') { mz.recomputeGlobalPowerups(); }
            }
          }
        } catch(e){}
        return;
      }
      case 'T': {
        try {
          var partsT = data.split(','); var fromId = partsT[1] || (conn && conn.peer); var blockT = partsT[2] || ''; var list = [];
          if (blockT) { blockT.split(';').forEach(function(tok){ if (!tok) { return; } var f = tok.split('|'); var cfg = { panelId: P.decodeFreeText(f[0]||''), colour: P.decodeFreeText(f[1]||''), controls: [] }; for (var i=2;i<8;i++){ cfg.controls.push(P.decodeFreeText(f[i]||'')); } list.push(cfg); }); }
          if (fromId) { manager.remoteTankConfigs[fromId] = list; if (fromId === manager.id) { manager.localTankConfigs = list; } }
          if (manager.isHost) { manager.broadcast(data, conn); }
        } catch(e){}
        return;
      }
    }
  };
// End of module

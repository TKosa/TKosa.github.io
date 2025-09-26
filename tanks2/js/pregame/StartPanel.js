import Panel from './Panel.js';
import Button from './Button.js';
import TankPanel from './TankPanel.js';
import Tank from '../maze/Tank.js';
import { peerManager, addChatMessage } from '../networking/peer_manager.js';
import { canvas, setHudScoreboardVisible, layoutHudOverCanvas } from '../render/context.js';
import { setPregameOverlayVisible } from '../render/pregame_dom.js';
import { PREGAME_BORDER_WIDTH } from './constants.js';

export class StartPanel extends Panel {
  constructor(colour,pregame){
    super(colour);
    this.pregame=pregame;
    this.west_border=PREGAME_BORDER_WIDTH;
    this.east_border=PREGAME_BORDER_WIDTH;

    var start_button = new Button(this,0,0,"Start");
    start_button.onclick = this.start.bind(this.pregame);
    start_button.center_horizontally();
    start_button.y = canvas.height * 9/20;
    this.addButton(start_button);

    var add_button = new Button(this,0,0,"Add Tank");
    add_button.onclick = function(){
      var pregame=this.panel.pregame;
      var current_template = pregame.tank_panels.length;
      pregame.addTankPanel(new TankPanel(pregame,pregame.colour_templates[current_template],pregame.controls_templates[current_template]));
    };
    add_button.y=canvas.height * 11/20;
    add_button.center_horizontally();
    this.addButton(add_button);

    var settings_button = new Button(this,0,0,"Settings");
    settings_button.onclick = function(){ this.pregame.showSettingsPanel(); }.bind(this);
    settings_button.y=canvas.height * 13/20;
    settings_button.center_horizontally();
    this.addButton(settings_button);

    var networking_button = new Button(this,0,0,"Networking");
    networking_button.onclick = function(){
      if (this.pregame.game && this.pregame.game.networking) {
        // Explicitly open the connect overlay from pregame
        this.pregame.game.networking.showConnectOverlay();
        if (peerManager && typeof peerManager.emitPlayerList === 'function') {
          peerManager.emitPlayerList();
        }
      }
    }.bind(this);
    networking_button.y=canvas.height * 15/20;
    networking_button.center_horizontally();
    this.addButton(networking_button);
  }

  start(){
    if (this.pregame && this.pregame.game && this.pregame.game.networking) {
      // Disable networking overlays during gameplay
      try { this.pregame.game.networking.disableOverlay(); } catch(_){}
    }
    if (peerManager && peerManager.connections && peerManager.connections.length > 0 && !peerManager.isHost) {
      addChatMessage('* Only the host can start the match.', 'notification-message');
      return;
    }
    var maze = this.game.maze;
    this.game.main_object = maze;
    if (typeof maze.beginGameplay === 'function') { maze.beginGameplay(); }
    try { setHudScoreboardVisible(true); layoutHudOverCanvas(); } catch(_){}
    try { setPregameOverlayVisible(false); } catch(_){}
    // Background canvas visibility is managed by CSS; no JS toggle needed.
    maze.hostOwned = true;
    var tankPayloads = [];
    var ownerId = (peerManager && peerManager.id) ? peerManager.id : 'local';
    for(var i=0;i<this.tank_panels.length;i++){
      var panel = this.tank_panels[i];
      var cb = panel.buttons;
      var controls = [cb[1].value, cb[2].value, cb[3].value, cb[4].value, cb[5].value, cb[6].value];
      var rnd_pos = maze.getRandomSquare().getCenter();
      var tank = new Tank (0,0,maze,controls,panel.colour);
      tank.id = ownerId + '-' + (panel.panelId || ('tank-' + i));
      tank.ownerPeerId = ownerId;
      var tankSprite = document.getElementById('tank');
      if (tankSprite && tankSprite.tagName === 'IMG' && tankSprite.complete && tankSprite.naturalWidth > 0) {
        tank.loadImage(tankSprite);
      }
      maze.registerTank && maze.registerTank(tank);
      maze.placeObject(tank);
      tankPayloads.push({
        id: tank.id, colour: tank.colour, controls: controls, ownerPeerId: ownerId, score: tank.score,
        x: tank.x, y: tank.y, rotation: tank.rotation, width: tank.width, height: tank.height
      });
    }
    if (peerManager && peerManager.isHost) {
      var remoteConfigs = peerManager.remoteTankConfigs || {};
      Object.keys(remoteConfigs).forEach(function(peerId){
        if (!remoteConfigs[peerId] || remoteConfigs[peerId].length === 0) { return; }
        if (peerId === ownerId) { return; }
        remoteConfigs[peerId].forEach(function(cfg, idx){
          var controls = cfg.controls && cfg.controls.length ? cfg.controls : ["w","d","s","a","f","g"];
          var tank = new Tank(0,0,maze,controls,cfg.colour || '#cccccc', { disableInput: true });
          tank.id = peerId + '-' + (cfg.panelId || ('tank-' + idx));
          tank.ownerPeerId = peerId;
          tank.score = cfg.score || 0;
          var remoteSprite = document.getElementById('tank');
          if (remoteSprite) { tank.loadImage(remoteSprite); }
          maze.registerTank && maze.registerTank(tank);
          maze.placeObject(tank);
          tankPayloads.push({
            id: tank.id, colour: tank.colour, controls: controls, ownerPeerId: peerId, score: tank.score,
            x: tank.x, y: tank.y, rotation: tank.rotation, width: tank.width, height: tank.height
          });
        });
      });
    }
    if (peerManager && peerManager.isHost && peerManager.connections && peerManager.connections.length > 0) {
      // Compact init broadcast only
      if (typeof maze.serializeInitString === 'function') {
        try { peerManager.broadcast(maze.serializeInitString()); } catch (e) {}
      }
      peerManager.maybeEmitReady && peerManager.maybeEmitReady('host-start');
    }
  }
}

export default StartPanel;

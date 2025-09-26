import { peerManager } from '../networking/peer_manager.js';
import { doRectsOverlap } from '../helper_fns.js';
import { PREGAME_BORDER_WIDTH } from './constants.js';
import UiNode from './UiNode.js';
import TankPanel from './TankPanel.js';
import StartPanel from './StartPanel.js';
import SettingsPanel from './SettingsPanel.js';
import SetControlsButton from './SetControlsButton.js';
import { canvas } from '../render/context.js';
import { setPregameOverlayVisible, renderPregameMainPanels, renderPregameSettingsPanel } from '../render/pregame_dom.js';

export class Pregame {
  constructor(game, height) {
    this.game = game;
    this.height = canvas.height;
    this.width = canvas.width;
    this.root = new UiNode({
      x: 0,
      y: 0,
      width: this.width,
      height: this.height,
    });
    this.focus = null;
    this.start_panel = new StartPanel("red", this);
    this.tank_panels = [];
    this.settings = new SettingsPanel(this);
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
      "#D90368",
    ];
    this.controls_templates = [
      ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft", "1", "2"],
      ["w", "d", "s", "a", "f", "g"],
      ["y", "j", "h", "g", "k", "l"],
    ];
    this.showMainPanels();
    this.updatePanelHorizontals();
    this.ensureDefaultTank();
    try { setPregameOverlayVisible(true); renderPregameMainPanels(this); } catch(_){}
  }
  main() {
    // DOM-driven; no per-frame layout required
  }
  draw() {
    // No-op: panels are rendered as HTML overlay
  }
  syncRootWithPanels(panels) {
    this.current_panels = panels;
    this.root.setChildren(panels);
  }
  showMainPanels() {
    this.focus = null;
    this.syncRootWithPanels([this.start_panel].concat(this.tank_panels));
    try { setPregameOverlayVisible(true); renderPregameMainPanels(this); } catch(_){}
  }
  showSettingsPanel() {
    this.focus = null;
    this.syncRootWithPanels([this.settings]);
    try { setPregameOverlayVisible(true); renderPregameSettingsPanel(this); } catch(_){}
  }
  addTankPanel(tank_panel) {
    this.tank_panels.push(tank_panel);
    this.showMainPanels();
    this.updatePanelHorizontals();
    this.emitTankConfig();
    try { renderPregameMainPanels(this); } catch(_){}
  }
  removeTankPanel(tank_panel) {
    this.tank_panels.splice(this.tank_panels.indexOf(tank_panel), 1);
    this.showMainPanels();
    this.updatePanelHorizontals();
    this.emitTankConfig();
    try { renderPregameMainPanels(this); } catch(_){}
  }
  updatePanelHorizontals() {
    (this.tank_panels || []).forEach(function (tank_panel) {
      if (!tank_panel || !Array.isArray(tank_panel.buttons)) {
        return;
      }
      tank_panel.buttons.forEach(function (b) {
        if (b && typeof b.update === 'function') {
          b.update();
        }
      });
      tank_panel.east_border = PREGAME_BORDER_WIDTH / 2;
    });
    if (this.tank_panels.length > 0) {
      this.tank_panels[this.tank_panels.length - 1].east_border =
        PREGAME_BORDER_WIDTH;
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
        var brect = button.get_as_Rect
          ? button.get_as_Rect()
          : [button.x, button.y, button.width, button.height];
        var hit =
          typeof doRectsOverlap === "function"
            ? doRectsOverlap(rect, brect)
            : x >= button.x &&
              y >= button.y &&
              x <= button.x + button.width &&
              y <= button.y + button.height;
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
    return this.tank_panels.map(function (panel, index) {
      var controls = panel.buttons
        .filter(function (btn) {
          return btn instanceof SetControlsButton;
        })
        .map(function (btn) {
          return btn.value || "";
        });
      return {
        panelId: panel.panelId || "panel-" + index,
        colour: panel.colour,
        controls: controls,
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
        "2",
      ];
      this.addTankPanel(new TankPanel(this, colour, controls));
    }
  }
}

export default Pregame;

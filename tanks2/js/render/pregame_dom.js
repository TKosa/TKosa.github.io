import TankPanel from '../pregame/TankPanel.js';

let overlayEl = null;
let innerEl = null;
let hasBoundKeyListener = false;
let keyCaptureButton = null;
let keyCaptureNode = null;

function ensureEls() {
  if (!overlayEl) overlayEl = document.getElementById('pregame-overlay');
  if (!innerEl) innerEl = document.getElementById('pregame-inner');
}

export function setPregameOverlayVisible(visible) {
  ensureEls();
  if (!overlayEl) return;
  overlayEl.classList.toggle('hidden', !visible);
}

function resetInner() {
  ensureEls();
  if (!innerEl) return;
  innerEl.replaceChildren();
}

function getControlLabel(button) {
  if (!button) return '';
  return `${button.text || ''}${button.value || ''}`;
}

function setActiveControl(button, node) {
  if (keyCaptureNode && keyCaptureNode !== node) {
    keyCaptureNode.classList.remove('pg-control--active');
  }
  keyCaptureButton = button || null;
  keyCaptureNode = node || null;
  if (keyCaptureNode) {
    keyCaptureNode.classList.add('pg-control--active');
  }
}

function syncActiveControl(button, node) {
  if (!keyCaptureButton || keyCaptureButton !== button) {
    return;
  }
  if (keyCaptureNode && keyCaptureNode !== node) {
    keyCaptureNode.classList.remove('pg-control--active');
  }
  keyCaptureNode = node;
  keyCaptureNode.classList.add('pg-control--active');
}

function clearActiveControl() {
  setActiveControl(null, null);
}

function bindKeyCaptureOnce(pregame) {
  if (hasBoundKeyListener) return;
  document.addEventListener(
    'keydown',
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
        if (pregame && typeof pregame.emitTankConfig === 'function') {
          pregame.emitTankConfig();
        }
      } catch (_) {}
      clearActiveControl();
    },
    true
  );
  hasBoundKeyListener = true;
}

function resolvePaletteToken(pregame, colour) {
  if (!colour) return 'default';
  const templates = (pregame && pregame.colour_templates) || [];
  const idx = templates.findIndex((value) =>
    typeof value === 'string' && value.toLowerCase() === colour.toLowerCase()
  );
  if (idx === -1) {
    return 'default';
  }
  return String(idx);
}

function renderStartPanel(pregame, root) {
  const card = document.createElement('section');
  card.className = 'pg-card pg-card--start';

  const title = document.createElement('h2');
  title.className = 'pg-card__title';
  title.textContent = 'Pregame';
  card.appendChild(title);

  const description = document.createElement('p');
  description.className = 'pg-card__description';
  description.textContent = 'Configure tanks, adjust settings, and start the match when you\'re ready.';
  card.appendChild(description);

  const actions = document.createElement('div');
  actions.className = 'pg-action-list';
  card.appendChild(actions);

  const sp = pregame.start_panel;

  function addAction(label, handler, extraClass = '') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = extraClass ? `pg-btn ${extraClass}` : 'pg-btn';
    btn.textContent = label;
    btn.addEventListener('click', handler);
    actions.appendChild(btn);
    return btn;
  }

  addAction('Start', () => {
    if (sp && typeof sp.start === 'function') {
      sp.start.call(pregame);
    }
  }, 'pg-btn--primary');

  addAction('Add Tank', () => {
    const i = pregame.tank_panels.length;
    const templates = pregame.colour_templates || [];
    const controlsTemplates = pregame.controls_templates || [];
    const colour = templates[i % templates.length] || templates[0] || '#63C132';
    const controls = controlsTemplates[i % controlsTemplates.length] || controlsTemplates[0] || [
      'ArrowUp',
      'ArrowRight',
      'ArrowDown',
      'ArrowLeft',
      '1',
      '2',
    ];
    pregame.addTankPanel(new TankPanel(pregame, colour, controls));
  });

  addAction('Settings', () => {
    pregame.showSettingsPanel();
  });

  addAction('Networking', () => {
    const networking = pregame && pregame.game && pregame.game.networking;
    if (networking && typeof networking.showConnectOverlay === 'function') {
      networking.showConnectOverlay();
    }
  });

  root.appendChild(card);
}

function renderTankPanels(pregame, root) {
  const stack = document.createElement('section');
  stack.className = 'pg-tank-stack';

  const header = document.createElement('div');
  header.className = 'pg-stack-header';
  header.textContent = 'Tanks';
  stack.appendChild(header);

  const tankGrid = document.createElement('div');
  tankGrid.className = 'pg-tank-grid';
  stack.appendChild(tankGrid);

  const panels = pregame.tank_panels || [];
  if (!panels.length) {
    const empty = document.createElement('p');
    empty.className = 'pg-empty-state';
    empty.textContent = 'Click “Add Tank” to configure local players.';
    tankGrid.appendChild(empty);
    root.appendChild(stack);
    return;
  }

  const controlNames = ['Up', 'Right', 'Down', 'Left', 'Attack', 'Special'];

  panels.forEach((tp, index) => {
    const tankCard = document.createElement('article');
    tankCard.className = 'pg-card pg-tank';
    const paletteToken = resolvePaletteToken(pregame, tp.colour);
    tankCard.dataset.palette = paletteToken;

    const title = document.createElement('header');
    title.className = 'pg-tank__title';
    const swatch = document.createElement('span');
    swatch.className = 'pg-tank__swatch';
    title.appendChild(swatch);
    const titleText = document.createElement('span');
    titleText.textContent = `Tank ${index + 1}`;
    title.appendChild(titleText);
    tankCard.appendChild(title);

    const controlList = document.createElement('div');
    controlList.className = 'pg-control-list';
    tankCard.appendChild(controlList);

    for (let ci = 0; ci < controlNames.length; ci++) {
      const btnObj = tp.buttons[1 + ci];
      const control = document.createElement('button');
      control.type = 'button';
      control.className = 'pg-control';
      control.dataset.role = controlNames[ci].toLowerCase();
      control.textContent = getControlLabel(btnObj);
      control.title = 'Click, then press a key';
      control.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        if (btnObj && typeof btnObj.onclick === 'function') {
          btnObj.onclick();
        } else if (pregame) {
          pregame.focus = btnObj;
        }
        setActiveControl(btnObj, control);
      });
      controlList.appendChild(control);
      syncActiveControl(btnObj, control);
    }

    const footer = document.createElement('div');
    footer.className = 'pg-tank__footer';
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'pg-btn pg-btn--danger';
    delBtn.textContent = 'Delete Tank';
    delBtn.addEventListener('click', (ev) => {
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

export function renderPregameMainPanels(pregame) {
  ensureEls();
  if (!overlayEl || !innerEl) return;
  bindKeyCaptureOnce(pregame);
  resetInner();

  const layout = document.createElement('div');
  layout.className = 'pg-main-layout';

  renderStartPanel(pregame, layout);
  renderTankPanels(pregame, layout);

  innerEl.appendChild(layout);
}

export function renderPregameSettingsPanel(pregame) {
  ensureEls();
  if (!overlayEl || !innerEl) return;
  clearActiveControl();
  resetInner();

  const panel = pregame.settings;
  const layout = document.createElement('div');
  layout.className = 'pg-settings-layout';

  const card = document.createElement('section');
  card.className = 'pg-card pg-card--settings';

  const title = document.createElement('h2');
  title.className = 'pg-card__title';
  title.textContent = 'Settings';
  card.appendChild(title);

  const list = document.createElement('div');
  list.className = 'pg-setting-list';
  card.appendChild(list);

  const buttons = panel.buttons || [];
  buttons.forEach((btn) => {
    if (!btn || btn === panel.back) {
      return;
    }
    const row = document.createElement('label');
    row.className = 'pg-setting';

    const span = document.createElement('span');
    span.className = 'pg-setting__label';
    span.textContent = btn.text || '';
    row.appendChild(span);

    if ((btn.text || '').toLowerCase().includes('friendly fire')) {
      row.classList.add('pg-setting--toggle');
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = (btn.value || '').toString().toLowerCase() === 'true';
      input.addEventListener('change', () => {
        btn.value = input.checked ? 'true' : 'false';
      });
      row.appendChild(input);
    } else {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = (btn.value || '').toString();
      input.addEventListener('input', () => {
        btn.value = input.value;
      });
      row.appendChild(input);
    }

    list.appendChild(row);
  });

  const footer = document.createElement('div');
  footer.className = 'pg-settings__footer';
  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'pg-btn pg-btn--primary';
  backBtn.textContent = panel.back && panel.back.text ? panel.back.text : 'Back';
  backBtn.addEventListener('click', () => {
    const ok = panel.save();
    if (ok === false) {
      backBtn.textContent = panel.back && panel.back.text ? panel.back.text : 'Back';
      return;
    }
    pregame.showMainPanels();
  });
  footer.appendChild(backBtn);
  card.appendChild(footer);

  layout.appendChild(card);
  innerEl.appendChild(layout);
}

let rootEl = null;
let innerEl = null;
let playersEl = null;
let networkImg = null;
let testBtn = null;
let lastSignature = '';
let lastTankSpriteSrc = '';
let lastNetworkIconSrc = '';

function ensureStructure() {
  if (!rootEl) {
    rootEl = document.getElementById('hud-scoreboard');
  }
  if (!rootEl) {
    return null;
  }
  if (!innerEl) {
    innerEl = rootEl.querySelector('.sb-inner');
    if (!innerEl) {
      innerEl = document.createElement('div');
      innerEl.className = 'sb-inner';
      rootEl.appendChild(innerEl);
    }
  }
  if (!playersEl) {
    playersEl = innerEl.querySelector('.sb-players');
    if (!playersEl) {
      playersEl = document.createElement('div');
      playersEl.className = 'sb-players';
      innerEl.insertBefore(playersEl, innerEl.firstChild || null);
    }
  }
  if (!testBtn) {
    testBtn = innerEl.querySelector('.sb-test');
  }
  if (!networkImg) {
    const networkBtn = innerEl.querySelector('.sb-network');
    networkImg = networkBtn ? networkBtn.querySelector('img') : null;
  }
  return {
    root: rootEl,
    inner: innerEl,
    players: playersEl,
    testBtn,
    networkImg,
  };
}

function resolveImageSrc(idOrSelector) {
  if (!idOrSelector) return '';
  const el = document.getElementById(idOrSelector);
  if (!el || !('src' in el)) {
    return '';
  }
  return el.src || '';
}

function createPlayerNode(tankId) {
  const wrapper = document.createElement('div');
  wrapper.className = 'sb-player';
  if (tankId) {
    wrapper.dataset.tankId = tankId;
  }

  const icon = document.createElement('img');
  icon.className = 'sb-icon';
  icon.alt = '';
  icon.hidden = true;
  wrapper.appendChild(icon);

  const row = document.createElement('div');
  row.className = 'sb-row';

  const tankImg = document.createElement('img');
  tankImg.className = 'sb-tank';
  tankImg.alt = '';
  row.appendChild(tankImg);

  const scoreSpan = document.createElement('span');
  scoreSpan.className = 'sb-score';
  scoreSpan.textContent = '0';
  row.appendChild(scoreSpan);

  wrapper.appendChild(row);

  wrapper._iconEl = icon;
  wrapper._tankEl = tankImg;
  wrapper._scoreEl = scoreSpan;

  return wrapper;
}

export function renderHudScoreboard({
  players = [],
  tankSpriteId = 'tank',
  networkIconId = 'network-icon',
} = {}) {
  const nodes = ensureStructure();
  if (!nodes) {
    return;
  }

  const tankSpriteSrc = resolveImageSrc(tankSpriteId);
  const networkIconSrc = resolveImageSrc(networkIconId) || 'res/ui/network.png';

  const signature = JSON.stringify({
    players: players.map((p) => ({
      id: p && p.id ? p.id : null,
      score: p && typeof p.score !== 'undefined' ? p.score : 0,
      powerup: p && p.powerupIconId ? p.powerupIconId : null,
    })),
    tankSpriteSrc,
    networkIconSrc,
  });

  if (
    signature === lastSignature &&
    tankSpriteSrc === lastTankSpriteSrc &&
    networkIconSrc === lastNetworkIconSrc
  ) {
    return;
  }

  lastSignature = signature;
  lastTankSpriteSrc = tankSpriteSrc;
  lastNetworkIconSrc = networkIconSrc;

  const container = nodes.players;
  const existing = new Map();
  Array.from(container.children).forEach((child) => {
    if (child.dataset && child.dataset.tankId) {
      existing.set(child.dataset.tankId, child);
    }
  });

  const fragment = document.createDocumentFragment();
  for (let i = 0; i < players.length; i += 1) {
    const player = players[i] || {};
    const tankId = player.id || `tank-${i + 1}`;
    let node = existing.get(tankId);
    if (node) {
      existing.delete(tankId);
    } else {
      node = createPlayerNode(tankId);
    }
    if (!node._iconEl) {
      node._iconEl = node.querySelector('.sb-icon');
    }
    if (!node._tankEl) {
      node._tankEl = node.querySelector('.sb-tank');
    }
    if (!node._scoreEl) {
      node._scoreEl = node.querySelector('.sb-score');
    }
    node.dataset.tankId = tankId;

    // Update icon
    const iconId = player.powerupIconId || null;
    if (iconId) {
      const iconSrc = resolveImageSrc(iconId);
      if (iconSrc) {
        node._iconEl.src = iconSrc;
        node._iconEl.hidden = false;
      } else {
        node._iconEl.hidden = true;
      }
    } else {
      node._iconEl.hidden = true;
    }

    // Update tank sprite
    if (tankSpriteSrc) {
      node._tankEl.src = tankSpriteSrc;
    }

    // Update score text
    const scoreVal = typeof player.score === 'number' ? player.score : parseInt(player.score, 10) || 0;
    const scoreText = String(scoreVal);
    if (node._scoreEl.textContent !== scoreText) {
      node._scoreEl.textContent = scoreText;
    }

    fragment.appendChild(node);
  }

  if (existing.size > 0) {
    existing.forEach((node) => {
      if (node && node.parentNode === container) {
        node.parentNode.removeChild(node);
      }
    });
  }

  container.replaceChildren(fragment);

  if (nodes.networkImg) {
    nodes.networkImg.src = networkIconSrc;
  }
}

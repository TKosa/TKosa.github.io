export const canvas = document.getElementById('myCanvas');
export const ctx = canvas.getContext('2d');

// Disable image smoothing to reduce anti-aliasing artifacts on pixel edges
ctx.imageSmoothingEnabled = false;
ctx.mozImageSmoothingEnabled = false;
ctx.webkitImageSmoothingEnabled = false;
ctx.msImageSmoothingEnabled = false;

// Maintain a fixed logical game resolution and aspect ratio with letterboxing.
// - The canvas's internal size (width/height) stays at the logical resolution.
// - CSS size scales to fit the window while preserving aspect; extra space is left blank.
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720; // 16:9 default
canvas.width = GAME_WIDTH;
canvas.height = GAME_HEIGHT;

export function setHudScoreboardVisible(visible) {
  const hudScoreboard = document.getElementById('hud-scoreboard');
  if (!hudScoreboard) return;
  hudScoreboard.classList.toggle('hidden', !visible);
}

export function layoutHudOverCanvas() {
  const hudScoreboard = document.getElementById('hud-scoreboard');
  if (!hudScoreboard) return;
  const rect = canvas.getBoundingClientRect();
  const panelHeight = Math.round(rect.height * 0.20); // match Maze scoreboardHeight ratio
  hudScoreboard.style.left = Math.round(rect.left) + 'px';
  hudScoreboard.style.top = Math.round(rect.top) + 'px';
  hudScoreboard.style.width = Math.round(rect.width) + 'px';
  hudScoreboard.style.height = panelHeight + 'px';
}

// Keep HUD aligned with the canvas; canvas sizing handled by CSS.
window.addEventListener('resize', () => {
  try { layoutHudOverCanvas(); } catch (_) {}
});

// Back-compat: no-op canvas resizer kept for older code paths.
// Canvas CSS sizing is handled by css/app.css now.
export function resizeCanvasToWindow() {
  try { layoutHudOverCanvas(); } catch (_) {}
}

// Ensure HUD scoreboard interactive controls work even if contents are re-rendered
let _hudHandlersBound = false;
export function ensureHudScoreboardHandlers() {
  if (_hudHandlersBound) return;
  // Network stats toggle via network icon
  document.addEventListener('click', function(ev) {
    const net = ev.target && ev.target.closest ? ev.target.closest('.sb-network') : null;
    if (!net) return;
    ev.stopPropagation();
    ev.preventDefault();
    const overlay = document.getElementById('net-stats-overlay');
    if (overlay) {
      overlay.classList.toggle('hidden');
    }
  }, true);
  document.addEventListener('click', function(ev) {
    const btn = ev.target && ev.target.closest ? ev.target.closest('.sb-test') : null;
    if (!btn) return;
    ev.stopPropagation();
    ev.preventDefault();
    try {
      if (window.__mazeRef && typeof window.__mazeRef.testFlattenAndRegen === 'function') {
        window.__mazeRef.testFlattenAndRegen();
      }
    } catch (_) {}
  }, true);
  _hudHandlersBound = true;
}

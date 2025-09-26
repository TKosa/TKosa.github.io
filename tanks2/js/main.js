// App entrypoint (ES module)
import { Game } from './Game.js';
import { peerManager } from './networking/peer_manager.js';
import { canvas, ctx, GAME_WIDTH, GAME_HEIGHT } from './render/context.js';

const game = new Game();
peerManager.game = game;

function draw(){
  // Clear only when not rendering the Maze (Maze handles its own clears)
  if (game.main_object !== game.maze) {
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  game.main();
  requestAnimationFrame(draw);
}

function setup(){
  // Map pointer to logical canvas coordinates accounting for letterboxing.
  canvas.addEventListener('click', function(event) {
    const rect = canvas.getBoundingClientRect();
    const sx = GAME_WIDTH / rect.width;
    const sy = GAME_HEIGHT / rect.height;
    const x = (event.clientX - rect.left) * sx;
    const y = (event.clientY - rect.top) * sy;
    game.onclick(x,y);
  }, false);

  addEventListener('keydown', function(event) {
    game.keyDownHandler(event.key);
  }, false);

  addEventListener('keyup', function(event) {
    if (typeof game.keyUpHandler === 'function') {
      game.keyUpHandler(event.key);
    }
  }, false);

  draw();
}

setup();

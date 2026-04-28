import { Barricade } from "./Barricade.js";
import { createAiBot } from "./AI/index.js";
import { peerManager } from "./PeerManager.js";
import { eventHub } from "./EventHub.js";

const MODE_PLAYERS = {
  "1v1": ["red", "blue"],
  "4p": ["red", "blue", "green", "yellow"],
};

export class Game {
  constructor() {
    this.game = new Barricade();
    this.boardElement = document.getElementById("barricadeboard");
    this.rightLabelsElement = document.getElementById("right-labels");
    this.bottomLabelsElement = document.getElementById("bottom-labels");
    this.wallsElement = document.getElementById("walls");
    this.statusElement = document.getElementById("status");
    this.modeSelect = document.getElementById("game-mode");
    this.pendingRedirectChoices = null;
    this.hoverWall = null;
    this.hoverSquare = null;
    this.hoverDelayMs = 25;
    this.hoverWallTimer = null;
    this.hoverSquareTimer = null;

    this.timerElements = {
      red: document.getElementById("red-timer"),
      blue: document.getElementById("blue-timer"),
      green: document.getElementById("green-timer"),
      yellow: document.getElementById("yellow-timer"),
    };
    this.startTimeInput = document.getElementById("start-time");
    this.incrementInput = document.getElementById("increment");
    this.aiLevelSelect = document.getElementById("ai-level");
    this.startButton = document.getElementById("start-button");
    this.restartButton = document.getElementById("restart-button");
    this.reflectButton = document.getElementById("reflect-button");
    this.backButton = document.getElementById("back-button");
    this.forwardButton = document.getElementById("forward-button");
    this.movesListElement = document.getElementById("moves-list");

    this.increment = 0;
    this.timeMs = { red: 0, blue: 0, green: 0, yellow: 0 };
    this.activeTimer = null;

    this.isNetworkedGame = false;
    this.networkListenersAdded = false;
    this.localPlayerColor = null;
    this.isHost = false;
    this.playerOrder = ["red", "blue"];
    this.colorAssignments = {};
    this.stateVersion = 0;
    this.isReflected = false;
    this.aiBot = createAiBot("ai2");
    this.aiThinking = false;
    this.hardPlusWeights = { dist: 129, walls: 7, mobility: 7 };
    this.hardPlusValueModel = null;
    this.hardPlusPolicyModel = null;

    this.startButton.addEventListener("click", () => this.startGame(true));
    this.restartButton.addEventListener("click", () => this.restartBoard());
    this.reflectButton.addEventListener("click", () => this.toggleReflection());
    this.backButton.addEventListener("click", () => this.goBackOneMove());
    this.forwardButton.addEventListener("click", () => this.goForwardOneMove());
    this.modeSelect.addEventListener("change", () => this.onModeChanged());
    this.aiLevelSelect.addEventListener("change", () => this.onAiLevelChanged());
    document.addEventListener("keydown", (event) => this.onKeyDown(event));

    eventHub.on("start-game", (data) => {
      this.modeSelect.value = data.mode || "1v1";
      this.startTimeInput.value = data.startTime;
      this.incrementInput.value = data.increment;
      this.colorAssignments = data.colorAssignments || {};
      if (data.colorAssignments && peerManager.clientId in data.colorAssignments) {
        this.localPlayerColor = data.colorAssignments[peerManager.clientId];
      } else {
        this.localPlayerColor = data.assignedColor || "blue";
      }
      this.playerOrder = data.playerOrder || MODE_PLAYERS[this.modeSelect.value];
      this.initiateTimers(data.startTime, data.increment);
      this.startGame(false);
    });

    eventHub.on("reset-by-host", () => this.reset());
    eventHub.on("participants-updated", ({ count, isHost }) => {
      const networked = (count || 0) > 1;
      this.modeSelect.disabled = networked && !isHost;
      this.aiLevelSelect.disabled = networked;
    });
    eventHub.on("barricade-action", (data) => {
      if (!data || !data.action) {
        return;
      }
      this.handleRemoteAction(data.action);
    });
    eventHub.on("room-state-loaded", (state) => {
      this.applyNetworkState(state);
    });
    eventHub.on("state-sync", (data) => {
      if (data && data.state) {
        this.applyNetworkState(data.state);
      }
    });
    eventHub.on("state-request", () => {
      if (!peerManager.isConnected()) {
        return;
      }
      peerManager.broadcast({
        type: "state-sync",
        state: this.getSerializableState(),
      });
    });
    eventHub.on("relay-connected", () => {
      setTimeout(() => {
        peerManager.broadcast({ type: "state-request" });
      }, 300);
    });
    this.initializeBoard();
    this.updateBoard();
    this.updateStatus();
    this.renderMoves();
    this.loadHardPlusWeights();
    this.loadHardPlusValueModel();
    this.loadHardPlusPolicyModel();
  }

  initializeBoard() {
    this.updateBoardGeometry();
    this.boardElement.innerHTML = "";
    this.boardElement.onmouseleave = () => {
      clearTimeout(this.hoverSquareTimer);
      clearTimeout(this.hoverWallTimer);
      this.hoverSquare = null;
      this.hoverWall = null;
      this.updateBoard();
    };

    const extent = this.game.size * 2 - 1;
    for (let r = 0; r < extent; r++) {
      for (let c = 0; c < extent; c++) {
        const node = document.createElement("div");
        node.dataset.r = r;
        node.dataset.c = c;

        if (r % 2 === 0 && c % 2 === 0) {
          node.className = "square";
          node.addEventListener("click", () => this.onSquareClick(r / 2, c / 2));
          node.addEventListener("mouseenter", () => this.onSquareHover(r / 2, c / 2));
          node.addEventListener("mouseleave", () => this.clearSquareHover());
        } else if (r % 2 === 1 && c % 2 === 0) {
          node.className = "edge h-edge";
          node.addEventListener("click", () => this.onEdgeClick("h", (r - 1) / 2, c / 2));
          node.addEventListener("mouseenter", () => this.onEdgeHover("h", (r - 1) / 2, c / 2));
          node.addEventListener("mouseleave", () => this.clearEdgeHover());
        } else if (r % 2 === 0 && c % 2 === 1) {
          node.className = "edge v-edge";
          node.addEventListener("click", () => this.onEdgeClick("v", r / 2, (c - 1) / 2));
          node.addEventListener("mouseenter", () => this.onEdgeHover("v", r / 2, (c - 1) / 2));
          node.addEventListener("mouseleave", () => this.clearEdgeHover());
        } else {
          node.className = "junction";
        }
        this.boardElement.appendChild(node);
      }
    }
  }

  updateBoardGeometry() {
    const size = this.game.size;
    const square = 54;
    const road = 10;
    const tileRowWidth = size * square + (size - 1) * road;
    this.boardElement.style.gridTemplateColumns = `repeat(${size - 1}, ${square}px ${road}px) ${square}px`;
    this.boardElement.style.gridTemplateRows = `repeat(${size - 1}, ${square}px ${road}px) ${square}px`;
    this.wallsElement.style.width = `${tileRowWidth}px`;

    this.rightLabelsElement.innerHTML = "";
    this.rightLabelsElement.style.gridTemplateRows = `repeat(${size - 1}, ${square}px ${road}px) ${square}px`;
    for (let n = size; n >= 1; n--) {
      const span = document.createElement("span");
      span.textContent = n.toString();
      if (n > 1) {
        span.style.gridRow = "span 2";
      }
      this.rightLabelsElement.appendChild(span);
    }

    this.bottomLabelsElement.innerHTML = "";
    this.bottomLabelsElement.style.gridTemplateColumns = `repeat(${size - 1}, ${square}px ${road}px) ${square}px`;
    for (let i = 0; i < size; i++) {
      const span = document.createElement("span");
      span.textContent = String.fromCharCode("a".charCodeAt(0) + i);
      if (i < size - 1) {
        span.style.gridColumn = "span 2";
      }
      this.bottomLabelsElement.appendChild(span);
    }
  }

  canLocalPlayerAct() {
    if (!this.isNetworkedGame) {
      if (this.isAiEnabled() && this.game.future.length > 0) {
        return true;
      }
      return !this.isAiTurn();
    }
    return this.localPlayerColor === this.game.getCurrentPlayer();
  }

  onAiLevelChanged() {
    this.aiBot = createAiBot(this.aiLevelSelect.value, {
      hardPlusWeights: this.hardPlusWeights,
      hardPlusValueModel: this.hardPlusValueModel,
      hardPlusPolicyModel: this.hardPlusPolicyModel,
      defaultWeights: { dist: 120, walls: 10, mobility: 6 },
    });
    this.maybeRunAiTurn();
  }

  async loadHardPlusWeights() {
    try {
      const response = await fetch("./bot-weights.json", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      if (data && data.bestWeights) {
        this.hardPlusWeights = {
          dist: Number(data.bestWeights.dist) || this.hardPlusWeights.dist,
          walls: Number(data.bestWeights.walls) || this.hardPlusWeights.walls,
          mobility: Number(data.bestWeights.mobility) || this.hardPlusWeights.mobility,
        };
        if (this.aiLevelSelect.value === "ai4") {
          this.aiBot.setWeights(this.hardPlusWeights);
        }
      }
    } catch (error) {
      // Keep default fallback weights for hardplus.
    }
  }

  async loadHardPlusValueModel() {
    try {
      const response = await fetch("./value-net.json", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      if (data && data.w1 && data.b1 && data.w2 && data.b2) {
        this.hardPlusValueModel = data;
        if (this.aiLevelSelect.value === "ai4") {
          this.aiBot.setValueModel(this.hardPlusValueModel);
        }
      }
    } catch (error) {
      // keep null model fallback
    }
  }

  async loadHardPlusPolicyModel() {
    try {
      const response = await fetch("./policy-net.json", { cache: "no-store" });
      if (!response.ok) {
        return;
      }
      const data = await response.json();
      if (data && data.w1 && data.b1 && data.w2 && data.b2) {
        this.hardPlusPolicyModel = data;
        if (this.aiLevelSelect.value === "ai4") {
          this.aiBot.setPolicyModel(this.hardPlusPolicyModel);
        }
      }
    } catch (error) {
      // keep null policy model fallback
    }
  }

  isAiEnabled() {
    return !this.isNetworkedGame && this.game.mode === "1v1" && this.aiLevelSelect.value !== "off";
  }

  isAiTurn() {
    return this.isAiEnabled() && this.game.status === "In progress" && this.game.getCurrentPlayer() === "blue";
  }

  onSquareClick(row, col) {
    if (this.game.status !== "In progress" || !this.canLocalPlayerAct()) {
      return;
    }
    const player = this.game.getCurrentPlayer();
    const current = this.game.positions[player];
    const occupant = this.game.getOccupant(row, col);
    const clickedOpponent = occupant && occupant !== player;
    const isAdjacentToCurrent = Math.abs(current.row - row) + Math.abs(current.col - col) === 1;

    if (this.pendingRedirectChoices) {
      const allowed = this.pendingRedirectChoices.some((m) => m.row === row && m.col === col);
      if (!allowed) {
        this.pendingRedirectChoices = null;
        this.updateBoard();
        return;
      }
      this.makeLocalAction({ type: "move", to: { row, col } });
      this.afterAction();
      return;
    }

    if (clickedOpponent && isAdjacentToCurrent && !this.game.isBlocked(current.row, current.col, row, col)) {
      const choices = this.game.getRedirectMoves(current, this.game.positions[occupant]);
      if (choices.length === 1) {
        this.makeLocalAction({ type: "move", to: choices[0] });
        this.afterAction();
      } else {
        this.pendingRedirectChoices = choices;
        this.updateBoard();
      }
      return;
    }

    this.makeLocalAction({ type: "move", to: { row, col } });
    this.afterAction();
  }

  onEdgeClick(orientation, row, col) {
    if (this.game.status !== "In progress" || !this.canLocalPlayerAct()) {
      return;
    }
    this.makeLocalAction({ type: "wall", orientation, row, col });
    this.afterAction();
  }

  onSquareHover(row, col) {
    if (this.game.status !== "In progress" || !this.canLocalPlayerAct()) {
      clearTimeout(this.hoverSquareTimer);
      this.hoverSquare = null;
      this.updateBoard();
      return;
    }
    clearTimeout(this.hoverSquareTimer);
    this.hoverSquareTimer = setTimeout(() => {
      this.hoverSquare = { row, col };
      this.updateBoard();
    }, this.hoverDelayMs);
  }

  clearSquareHover() {
    clearTimeout(this.hoverSquareTimer);
    if (!this.hoverSquare) {
      return;
    }
    this.hoverSquare = null;
    this.updateBoard();
  }

  onEdgeHover(orientation, row, col) {
    if (this.game.status !== "In progress" || !this.canLocalPlayerAct()) {
      clearTimeout(this.hoverWallTimer);
      this.hoverWall = null;
      this.updateBoard();
      return;
    }
    clearTimeout(this.hoverWallTimer);
    this.hoverWallTimer = setTimeout(() => {
      this.hoverWall = { orientation, row, col };
      this.updateBoard();
    }, this.hoverDelayMs);
  }

  clearEdgeHover() {
    clearTimeout(this.hoverWallTimer);
    if (!this.hoverWall) {
      return;
    }
    this.hoverWall = null;
    this.updateBoard();
  }

  makeLocalAction(action) {
    const wasViewingPast = this.game.future.length > 0;
    const canBranchFromPast = !this.isNetworkedGame && this.isAiEnabled() && wasViewingPast;
    if (wasViewingPast && !canBranchFromPast) {
      this.fastForwardToCurrent(false);
    }
    const ok = this.game.executeActionAndUpdateState(action);
    if (ok) {
      eventHub.emit("my-action", action);
      this.pendingRedirectChoices = null;
    }
  }

  handleRemoteAction(action) {
    const wasViewingPast = this.game.future.length > 0;
    if (wasViewingPast) {
      this.fastForwardToCurrent(false);
    }
    const ok = this.game.executeActionAndUpdateState(action);
    if (!ok) {
      return;
    }
    this.pendingRedirectChoices = null;
    this.afterAction();
  }

  afterAction() {
    this.updateStatus();
    this.updateTimers();
    this.updateBoard();
    this.renderMoves();
    this.stateVersion += 1;
    this.persistRoomState();
    this.maybeRunAiTurn();
  }

  formatPlayerName(player) {
    return player.charAt(0).toUpperCase() + player.slice(1);
  }

  updateStatus() {
    if (this.game.status !== "In progress") {
      this.statusElement.textContent = this.game.status;
      return;
    }
    if (this.isAiTurn()) {
      this.statusElement.textContent = "AI thinking...";
      return;
    }
    const player = this.game.getCurrentPlayer();
    this.statusElement.textContent = `${this.formatPlayerName(player)}'s turn`;
  }

  updateBoard() {
    this.boardElement.parentElement.classList.toggle("reflected", this.isReflected);
    const nodes = this.boardElement.querySelectorAll("div");
    nodes.forEach((node) => {
      node.classList.remove(
        "occupied-red",
        "occupied-blue",
        "occupied-green",
        "occupied-yellow",
        "win-tile",
        "legal-target",
        "legal-target-hover",
        "wall-placed",
        "wall-red",
        "wall-blue",
        "wall-green",
        "wall-yellow"
      );
      node.classList.remove("wall-ghost");
      if (node.classList.contains("square")) {
        node.textContent = "";
      }
    });

    this.game.players.forEach((player) => {
      const pos = this.game.positions[player];
      this.getSquareNode(pos.row, pos.col).classList.add(`occupied-${player}`);
    });

    const goalTiles = this.getHighlightedGoalTiles();
    goalTiles.forEach((tile) => {
      this.getSquareNode(tile.row, tile.col).classList.add("win-tile");
    });

    this.game.placedWalls.forEach((wallKey) => {
      const [orientation, anchor] = wallKey.split(":");
      const [row, col] = anchor.split(",").map(Number);
      const owner = this.getWallOwner(orientation, row, col);
      const ownerClass = `wall-${owner}`;
      this.getWallNodes(orientation, row, col).forEach((node) => {
        if (node) {
          node.classList.add("wall-placed", ownerClass);
        }
      });
    });

    if (this.hoverWall) {
      const player = this.game.getCurrentPlayer();
      const canPlace = this.game.canPlaceWall(player, this.hoverWall.orientation, this.hoverWall.row, this.hoverWall.col);
      if (canPlace) {
        const ownerClass = `wall-${player}`;
        this.getWallNodes(this.hoverWall.orientation, this.hoverWall.row, this.hoverWall.col).forEach((node) => {
          if (node && !node.classList.contains("wall-placed")) {
            node.classList.add("wall-ghost", ownerClass);
          }
        });
      }
    }

    if (this.game.status === "In progress" && this.canLocalPlayerAct()) {
      const legalMoves = this.pendingRedirectChoices || this.game.getLegalPawnMoves(this.game.getCurrentPlayer());
      legalMoves.forEach((m) => {
        this.getSquareNode(m.row, m.col).classList.add("legal-target");
      });
      if (this.hoverSquare && this.isHoveredSquareLegal()) {
        this.getSquareNode(this.hoverSquare.row, this.hoverSquare.col).classList.add("legal-target-hover");
      }
    }

    this.updateWallCounts();
    this.updateTimerVisibility();
  }

  toggleReflection() {
    this.isReflected = !this.isReflected;
    this.updateBoard();
  }

  getHighlightedGoalTiles() {
    if (this.isNetworkedGame) {
      if (!this.localPlayerColor) {
        return [];
      }
      return this.getTilesForGoal(this.localPlayerColor);
    }
    const currentPlayer = this.game.getCurrentPlayer();
    return this.getTilesForGoal(currentPlayer);
  }

  getTilesForGoal(player) {
    const goal = this.game.goals[player];
    if (!goal) {
      return [];
    }
    if (this.game.mode === "1v1") {
      return Array.from({ length: this.game.size }, (_, col) => ({ row: goal.row, col }));
    }
    return [{ row: goal.row, col: goal.col }];
  }

  updateWallCounts() {
    const players = MODE_PLAYERS[this.game.mode];
    Object.keys(this.timeMs).forEach((player) => {
      const el = document.getElementById(`${player}-walls`);
      const wrap = document.getElementById(`${player}-walls-wrap`);
      const sep = document.getElementById(`${player}-walls-sep`);
      const show = players.includes(player);
      if (wrap) {
        wrap.style.display = show ? "inline" : "none";
      }
      if (sep) {
        sep.style.display = show ? "inline" : "none";
      }
      if (el) {
        const count = this.game.remainingWalls[player];
        el.textContent = typeof count === "number" ? count.toString() : "";
      }
    });
  }

  updateTimerVisibility() {
    const activePlayers = MODE_PLAYERS[this.game.mode];
    Object.entries(this.timerElements).forEach(([player, el]) => {
      if (!el) {
        return;
      }
      el.style.display = activePlayers.includes(player) ? "block" : "none";
    });
  }

  isHoveredSquareLegal() {
    if (!this.hoverSquare) {
      return false;
    }
    const { row, col } = this.hoverSquare;
    if (this.game.isOccupied(row, col)) {
      return false;
    }
    const legalMoves = this.pendingRedirectChoices || this.game.getLegalPawnMoves(this.game.getCurrentPlayer());
    return legalMoves.some((m) => m.row === row && m.col === col);
  }

  getSquareNode(row, col) {
    return this.boardElement.querySelector(`.square[data-r="${row * 2}"][data-c="${col * 2}"]`);
  }

  getEdgeNode(orientation, row, col) {
    if (orientation === "h") {
      return this.boardElement.querySelector(`.h-edge[data-r="${row * 2 + 1}"][data-c="${col * 2}"]`);
    }
    return this.boardElement.querySelector(`.v-edge[data-r="${row * 2}"][data-c="${col * 2 + 1}"]`);
  }

  getJunctionNode(row, col) {
    return this.boardElement.querySelector(`.junction[data-r="${row * 2 + 1}"][data-c="${col * 2 + 1}"]`);
  }

  getWallNodes(orientation, row, col) {
    if (orientation === "h") {
      return [this.getEdgeNode("h", row, col), this.getJunctionNode(row, col), this.getEdgeNode("h", row, col + 1)];
    }
    return [this.getEdgeNode("v", row, col), this.getJunctionNode(row, col), this.getEdgeNode("v", row + 1, col)];
  }

  getWallOwner(orientation, row, col) {
    if (orientation === "h") {
      const key = this.game.edgeKey(row, col, row + 1, col);
      return this.game.edgeOwners.get(key);
    }
    const key = this.game.edgeKey(row, col, row, col + 1);
    return this.game.edgeOwners.get(key);
  }

  reset() {
    this.game.reset(this.modeSelect.value);
    this.initializeBoard();
    this.isNetworkedGame = peerManager.getParticipantCount() > 1;
    this.aiLevelSelect.disabled = this.isNetworkedGame;
    if (!this.isNetworkedGame) {
      this.localPlayerColor = null;
      this.isHost = false;
    }
    clearTimeout(this.hoverSquareTimer);
    clearTimeout(this.hoverWallTimer);
    this.pendingRedirectChoices = null;
    this.hoverWall = null;
    this.hoverSquare = null;
    this.updateBoard();
    this.updateStatus();
    this.renderMoves();
    if (this.activeTimer) {
      this.initiateTimers(this.startTimeInput.value, this.incrementInput.value);
    }
    clearInterval(this.activeTimer);
    this.activeTimer = null;
    this.stateVersion += 1;
    this.persistRoomState();
    this.maybeRunAiTurn();
  }

  onModeChanged() {
    const networkPlayers = peerManager.getParticipantCount();
    const networked = networkPlayers > 1;
    this.aiLevelSelect.disabled = networked;
    if (networked && !peerManager.isHost) {
      this.modeSelect.value = this.game.mode;
      this.statusElement.textContent = "Only host can change game mode in networked game";
      return;
    }
    clearTimeout(this.hoverSquareTimer);
    clearTimeout(this.hoverWallTimer);
    clearInterval(this.activeTimer);
    this.activeTimer = null;
    this.pendingRedirectChoices = null;
    this.hoverWall = null;
    this.hoverSquare = null;
    this.game.reset(this.modeSelect.value);
    this.playerOrder = MODE_PLAYERS[this.modeSelect.value];
    this.initializeBoard();
    this.updateBoard();
    this.updateStatus();
    this.renderMoves();
    this.stateVersion += 1;
    this.persistRoomState();
    this.maybeRunAiTurn();
  }

  restartBoard() {
    const networkPlayers = peerManager.getParticipantCount();
    const networked = networkPlayers > 1;
    if (networked && !peerManager.isHost) {
      this.statusElement.textContent = "Only host can restart in networked game";
      return;
    }

    const originalMode = this.modeSelect.value;
    const targetMode = "1v1";
    this.modeSelect.value = "4p";
    this.game.reset("4p");
    this.modeSelect.value = targetMode;
    this.game.reset(targetMode);
    this.playerOrder = MODE_PLAYERS[targetMode];
    this.modeSelect.value = targetMode;
    clearTimeout(this.hoverSquareTimer);
    clearTimeout(this.hoverWallTimer);
    clearInterval(this.activeTimer);
    this.activeTimer = null;
    this.pendingRedirectChoices = null;
    this.hoverWall = null;
    this.hoverSquare = null;
    this.initializeBoard();
    this.updateBoard();
    this.updateStatus();
    this.renderMoves();
    this.stateVersion += 1;
    this.persistRoomState();
    this.maybeRunAiTurn();

    if (networked && originalMode !== targetMode) {
      peerManager.broadcast({ type: "state-sync", state: this.getSerializableState() });
    }
  }

  getExpectedPlayerCount() {
    return this.modeSelect.value === "4p" ? 4 : 2;
  }

  startGame(isHostStartTrigger) {
    const networkPlayers = peerManager.getParticipantCount();
    this.isNetworkedGame = networkPlayers > 1;
    this.isHost = this.isNetworkedGame ? peerManager.isHost : false;
    this.modeSelect.disabled = this.isNetworkedGame && !this.isHost;
    this.aiLevelSelect.disabled = this.isNetworkedGame;

    if (this.isNetworkedGame && isHostStartTrigger && !this.isHost) {
      this.statusElement.textContent = "Only host can start networked game";
      return;
    }

    const expectedPlayers = this.getExpectedPlayerCount();
    if (this.isNetworkedGame && isHostStartTrigger && networkPlayers !== expectedPlayers) {
      this.statusElement.textContent = `Need exactly ${expectedPlayers} players in room to start ${this.modeSelect.value}`;
      return;
    }

    this.game.reset(this.modeSelect.value);
    this.game.startGame();
    this.initializeBoard();
    this.playerOrder = MODE_PLAYERS[this.modeSelect.value];

    if (!this.isNetworkedGame) {
      this.localPlayerColor = null;
    } else if (isHostStartTrigger && this.isHost) {
      this.localPlayerColor = "red";
      const participantIds = peerManager.getParticipantIds();
      const colorAssignments = {};
      participantIds.forEach((id, index) => {
        colorAssignments[id] = this.playerOrder[index] || "blue";
      });
      this.colorAssignments = colorAssignments;
      this.localPlayerColor = colorAssignments[peerManager.clientId] || this.localPlayerColor;
      peerManager.broadcast({
        type: "start-game",
        mode: this.modeSelect.value,
        startTime: this.startTimeInput.value,
        increment: this.incrementInput.value,
        playerOrder: this.playerOrder,
        colorAssignments,
      });
    }

    clearTimeout(this.hoverSquareTimer);
    clearTimeout(this.hoverWallTimer);
    this.pendingRedirectChoices = null;
    this.hoverWall = null;
    this.hoverSquare = null;
    this.updateBoard();
    this.updateStatus();
    this.renderMoves();
    this.startTimers();
    this.stateVersion += 1;
    this.persistRoomState();
    this.maybeRunAiTurn();

    if (this.isNetworkedGame && !this.networkListenersAdded) {
      this.broadcastAction = (action) => {
        peerManager.broadcast({ type: "barricade-action", action });
      };
      eventHub.on("my-action", this.broadcastAction);
      this.networkListenersAdded = true;
    }
  }

  getSerializableState() {
    return {
      game: this.game.snapshot(),
      history: this.game.history,
      future: this.game.future,
      mode: this.modeSelect.value,
      playerOrder: this.playerOrder,
      colorAssignments: this.colorAssignments,
      startTimeInput: this.startTimeInput.value,
      incrementInput: this.incrementInput.value,
      increment: this.increment,
      timeMs: this.timeMs,
      isNetworkedGame: this.isNetworkedGame,
      stateVersion: this.stateVersion,
    };
  }

  applyNetworkState(state) {
    if (!state || !state.game) {
      return;
    }
    if (
      typeof state.stateVersion === "number" &&
      state.stateVersion < this.stateVersion
    ) {
      return;
    }

    this.modeSelect.value = state.mode || this.modeSelect.value;
    this.game.reset(this.modeSelect.value);
    this.game.restore(state.game);
    this.game.history = JSON.parse(JSON.stringify(state.history || []));
    this.game.future = JSON.parse(JSON.stringify(state.future || []));
    this.playerOrder = state.playerOrder || MODE_PLAYERS[this.modeSelect.value];
    this.colorAssignments = state.colorAssignments || {};
    this.localPlayerColor = this.colorAssignments[peerManager.clientId] || this.localPlayerColor;
    this.startTimeInput.value = state.startTimeInput || "";
    this.incrementInput.value = state.incrementInput || "";
    this.increment = state.increment || 0;
    this.timeMs = {
      red: state.timeMs?.red || 0,
      blue: state.timeMs?.blue || 0,
      green: state.timeMs?.green || 0,
      yellow: state.timeMs?.yellow || 0,
    };
    this.isNetworkedGame = Boolean(state.isNetworkedGame);
    this.isHost = this.isNetworkedGame ? peerManager.isHost : false;
    this.aiLevelSelect.disabled = this.isNetworkedGame;
    this.stateVersion = state.stateVersion || 0;
    this.timerElements.red.textContent = this.formatTime(this.timeMs.red);
    this.timerElements.blue.textContent = this.formatTime(this.timeMs.blue);
    this.timerElements.green.textContent = this.formatTime(this.timeMs.green);
    this.timerElements.yellow.textContent = this.formatTime(this.timeMs.yellow);
    this.initializeBoard();
    this.updateBoard();
    this.updateStatus();
    this.renderMoves();
    this.maybeRunAiTurn();
  }

  persistRoomState() {
    if (!peerManager.isConnected()) {
      return;
    }
    peerManager.saveRoomState(this.getSerializableState());
  }

  startTimers() {
    if (this.startTimeInput.value === "") {
      return;
    }
    this.initiateTimers(this.startTimeInput.value, this.incrementInput.value);
    if (this.activeTimer) {
      clearInterval(this.activeTimer);
    }
    const intervalMs = 100;
    this.activeTimer = setInterval(() => {
      if (this.game.status !== "In progress") {
        return;
      }
      const current = this.game.getCurrentPlayer();
      this.timeMs[current] -= intervalMs;
      this.timerElements[current].textContent = this.formatTime(this.timeMs[current]);
      if (this.timeMs[current] <= 0) {
        this.endGameOnTime(current);
      }
    }, intervalMs);
  }

  updateTimers() {
    if (!this.activeTimer || this.game.status !== "In progress") {
      return;
    }
    const current = this.game.getCurrentPlayer();
    const previousIndex = (this.game.moveIndex - 1 + this.game.players.length) % this.game.players.length;
    const previousPlayer = this.game.players[previousIndex];
    this.timeMs[previousPlayer] += this.increment;
    this.timerElements[previousPlayer].textContent = this.formatTime(this.timeMs[previousPlayer]);
    this.timerElements[current].textContent = this.formatTime(this.timeMs[current]);
  }

  initiateTimers(startTime, increment) {
    const startTimeMs = parseInt(startTime, 10) * 60 * 1000 || 0;
    this.increment = parseInt(increment, 10) * 1000 || 0;
    Object.keys(this.timeMs).forEach((player) => {
      this.timeMs[player] = startTimeMs;
      this.timerElements[player].textContent = this.formatTime(startTimeMs);
    });
  }

  formatTime(milliseconds) {
    const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }

  endGameOnTime(playerFlagged) {
    clearInterval(this.activeTimer);
    this.activeTimer = null;
    const winner = this.game.players.find((p) => p !== playerFlagged) || this.game.players[0];
    this.game.status = `Game over - ${this.formatPlayerName(winner)} wins on time`;
    this.updateStatus();
  }

  goBackOneMove() {
    this.game.goBackOneMove();
    clearTimeout(this.hoverSquareTimer);
    clearTimeout(this.hoverWallTimer);
    this.pendingRedirectChoices = null;
    this.hoverWall = null;
    this.hoverSquare = null;
    this.updateBoard();
    this.updateStatus();
    this.renderMoves();
  }

  goForwardOneMove() {
    this.game.goForwardOneMove();
    clearTimeout(this.hoverSquareTimer);
    clearTimeout(this.hoverWallTimer);
    this.pendingRedirectChoices = null;
    this.hoverWall = null;
    this.hoverSquare = null;
    this.updateBoard();
    this.updateStatus();
    this.renderMoves();
  }

  fastForwardToCurrent(refresh = true) {
    while (this.game.future.length > 0) {
      this.game.goForwardOneMove();
    }
    if (refresh) {
      this.updateBoard();
      this.updateStatus();
      this.renderMoves();
    }
  }

  onKeyDown(event) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      this.goBackOneMove();
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      this.goForwardOneMove();
    }
  }

  maybeRunAiTurn() {
    if (!this.isAiTurn() || this.aiThinking) {
      return;
    }
    this.aiThinking = true;
    this.updateStatus();
    setTimeout(() => {
      const action = this.aiBot.chooseAction(this.game, "blue");
      this.aiThinking = false;
      if (!action || !this.isAiTurn()) {
        this.updateStatus();
        return;
      }
      this.makeLocalAction(action);
      this.afterAction();
    }, 40);
  }

  formatMove(action) {
    if (!action) {
      return "";
    }
    if (action.type === "move" && action.to) {
      const file = String.fromCharCode("a".charCodeAt(0) + action.to.col);
      const rank = (this.game.size - action.to.row).toString();
      return `${file}${rank}`;
    }
    if (action.type === "wall") {
      const anchorRow = action.row + 1;
      const anchorCol = action.col;
      const file = String.fromCharCode("a".charCodeAt(0) + anchorCol);
      const rank = (this.game.size - anchorRow).toString();
      const orientation = action.orientation === "h" ? "h" : "v";
      return `${file}${rank}${orientation}`;
    }
    return action.type || "";
  }

  renderMoves() {
    if (!this.movesListElement) {
      return;
    }
    const actions = this.game.moveLog || [];
    const currentPly = actions.length - this.game.future.length;
    const rows = Math.ceil(actions.length / 2);
    this.movesListElement.innerHTML = "";

    for (let row = 0; row < rows; row++) {
      const rowElement = document.createElement("div");
      rowElement.className = "move-row";
      for (let col = 0; col < 2; col++) {
        const ply = row * 2 + col;
        const cell = document.createElement("div");
        cell.className = "move-cell";
        if (ply < actions.length) {
          const movePlayer = this.game.players[ply % this.game.players.length];
          cell.classList.add(`move-cell-${movePlayer}`);
          cell.textContent = this.formatMove(actions[ply]);
          if (ply === currentPly - 1) {
            cell.classList.add("active");
          }
        }
        rowElement.appendChild(cell);
      }
      this.movesListElement.appendChild(rowElement);
    }

    const activeCell = this.movesListElement.querySelector(".move-cell.active");
    if (activeCell) {
      activeCell.scrollIntoView({ block: "nearest" });
    } else {
      this.movesListElement.scrollTop = this.movesListElement.scrollHeight;
    }
  }
}

export const game = new Game();
window.game = game;

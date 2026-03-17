// Everything, including UI, Game Logic, Networking
// Includes buttons + fields for time control and start/end game 

import { Chess } from "./Chess.js?v=20260316e";
import { peerManager } from './PeerManager.js';
import { eventHub } from './EventHub.js';


export class Game {
  constructor() {
    this.chessGame = new Chess();
    this.boardElement = document.getElementById("chessboard");
    this.statusElement = document.getElementById("status");
    this.selected = null;
    this.lastMove = null;
    this.stateVersion = 0;
    this.playerSlots = { white: null, black: null };
    this.lastAnnouncedGameStatus = "";
    this.promotionPending = false;
    this.pendingPromotion = null;
    this.initializeBoard();
    this.renderBoard();
    this.updateStatus();

		// Coming from button in testUI
		eventHub.on("resetButtonClicked", () => {
			this.reset();
			peerManager.broadcast({
				type: "reset-by-host",
			});
		});

		// Coming from peerManager
		eventHub.on("reset-by-host", () => {
			this.reset();
		});

    this.startTimeInput = document.getElementById("start-time");
    this.incrementInput = document.getElementById("increment");
    this.startButton = document.getElementById("start-button");
    this.whiteTimer = document.getElementById("white-timer");
    this.blackTimer = document.getElementById("black-timer");
    this.whiteTime = 0;
    this.blackTime = 0;
    this.increment = 0;
    this.activeTimer = null;
    this.whiteTimeMs = 0;
    this.blackTimeMs = 0;

    this.isNetworkedGame = false;
    this.networkListenersAdded = false; // Track if listeners have been added
    this.startButton.addEventListener("click", () => this.startGame(true));
    eventHub.on("start-game", (data) => {
      this.startTimeInput.value = data.startTime;
      this.incrementInput.value = data.increment;
      this.initiateTimers(data.startTime, data.increment);
      this.playerSlots = {
        white: data.hostId || null,
        black: peerManager.clientId,
      };
      this.startGame(false);
    });
    eventHub.on("chess-move", (data) => {
      if (!this.acceptRemoteMove(data)) {
        return;
      }
      this.handleRemoteMove(data.move);
      this.afterMove();
    });
    eventHub.on("room-state-loaded", (state) => {
      this.applyNetworkState(state);
    });

    this.backButton = document.getElementById("back-button");
    this.forwardButton = document.getElementById("forward-button");

    this.backButton.addEventListener("click", () => this.goBackOneMove());
    this.forwardButton.addEventListener("click", () => this.goForwardOneMove());
  }

  initializeBoard() {
    this.boardElement.innerHTML = "";
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const cell = document.createElement("div");
        cell.classList.add("cell");
        cell.classList.add((row + col) % 2 === 0 ? "white" : "black");
        cell.dataset.row = row;
        cell.dataset.col = col;

        cell.addEventListener("click", () => this.onCellClick(row, col));
        this.boardElement.appendChild(cell);
      }
    }
  }

  renderBoard() {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const cell = this.boardElement.querySelector(
          `.cell[data-row="${row}"][data-col="${col}"]`
        );
        const piece = this.chessGame.board[row][col];
        cell.textContent = piece;
      }
    }
  }

  reset() {
    this.chessGame.reset();
    this.renderBoard();
    this.selected = null;
    this.updateStatus();
    // Reset timers if they exist
    if (this.activeTimer) {
      this.initiateTimers(this.startTimeInput.value, this.incrementInput.value);
		}
		clearInterval(this.activeTimer);
		this.activeTimer = null;
    this.persistRoomState();
  }

  onCellClick(row, col) {
    if (this.promotionPending) {
      return; // Don't allow moves while promotion is pending
    }
    
    if (this.chessGame.status !== 'In progress') {
      return;
    }
    
    if (!this.selected) {
      const piece = this.chessGame.board[row][col];
      if (!piece) {
        return;
      }
      const pieceBelongsToCurrentPlayer = this.chessGame.isPlayerPiece(
        piece,
        this.chessGame.getCurrentPlayer()
      );
      if (pieceBelongsToCurrentPlayer) {
        this.selected = [row, col];
			}
			this.updateBoard();
    } else {
      const [sRow, sCol] = this.selected;
      const [dRow, dCol] = [row, col];
      const isMoveValid = this.chessGame.isValidMove(sRow, sCol, dRow, dCol);
      if (isMoveValid) {
        if (this.isPawnPromotion(sRow, sCol, dRow, dCol)) {
          this.showPromotionPopup(sRow, sCol, dRow, dCol);
        } else {
          this.makeLocalMove(sRow, sCol, dRow, dCol);
          this.afterMove();
        }
      }
      
      this.selected = null;
      if (!isMoveValid) {
        this.updateBoard(); // Update board to remove highlight of selected piece
      }
    }
  }

  isPawnPromotion(sRow, sCol, dRow, dCol) {
    const piece = this.chessGame.board[sRow][sCol];
    return (piece === "♙" && dRow === 0) || (piece === "♟" && dRow === 7);
  }

  showPromotionPopup(sRow, sCol, dRow, dCol) {
    this.promotionPending = true;
    this.pendingPromotion = { sRow: sRow, sCol: sCol, dRow: dRow, dCol: dCol };

    const popup = document.createElement("div");
    popup.id = "promotion-popup";
    popup.style.position = "fixed";
    popup.style.top = "50%";
    popup.style.left = "50%";
    popup.style.transform = "translate(-50%, -50%)";
    popup.style.backgroundColor = "white";
    popup.style.padding = "20px";
    popup.style.border = "2px solid black";
    popup.style.zIndex = "1000";

    const pieces =
      this.chessGame.getCurrentPlayer() === "black"
        ? ["♛", "♜", "♝", "♞"]
        : ["♕", "♖", "♗", "♘"];
    pieces.forEach((piece) => {
      const button = document.createElement("button");
      button.textContent = piece;
      button.style.fontSize = "24px";
      button.style.margin = "5px";
      button.addEventListener("click", () => this.promotePawn(sRow, sCol, dRow, dCol, piece));
      popup.appendChild(button);
    });

    document.body.appendChild(popup);
  }

  promotePawn(sRow, sCol, dRow, dCol, newPiece) {
    this.makeLocalMove(sRow, sCol, dRow, dCol, newPiece);
    this.chessGame.board[dRow][dCol] = newPiece; //Turn pawn into new piece
    this.promotionPending = false;
    this.pendingPromotion = null;
    document.body.removeChild(document.getElementById("promotion-popup"));
    this.afterMove();
  }

  // Execute move. Update status. Send move over network if networked game. Update timers.
  makeLocalMove(sRow, sCol, dRow, dCol, newPiece = "") {
    const expectedColor = this.chessGame.getCurrentPlayer();
    const expectedSender = this.playerSlots[expectedColor];
    if (expectedSender && expectedSender !== peerManager.clientId) {
      return;
    }
    if (!this.playerSlots[expectedColor]) {
      this.playerSlots[expectedColor] = peerManager.clientId;
    }
    this.chessGame.executeMoveAndUpdateState(sRow, sCol, dRow, dCol, newPiece);
    this.lastMove = { from: { row: sRow, col: sCol }, to: { row: dRow, col: dCol } };
    eventHub.emit("my-move", { sRow, sCol, dRow, dCol, newPiece });
  }

  afterMove() {
    this.chessGame.updateGameStatusFromPosition();
    this.updateStatus();
    this.playGameOverSoundIfNeeded();
    this.playCheckSoundIfNeeded();
		this.updateTimers();
		this.selected = null;
    this.updateBoard();
    this.playMovePing();
    this.stateVersion += 1;
    this.persistRoomState();
  }

	// Add increment
  updateTimers() {
    const currentColor = this.chessGame.getCurrentPlayer();
    if (this.activeTimer) {
      if (currentColor === "white") {
        this.blackTimeMs += this.increment;
        this.blackTimer.textContent = this.formatTime(this.blackTimeMs);
      } else {
        this.whiteTimeMs += this.increment;
        this.whiteTimer.textContent = this.formatTime(this.whiteTimeMs);
      }
    }
  }

	updateStatus() {
		// If game is not started, say so 
		if (this.chessGame.status !== 'In progress') {
			this.statusElement.textContent = this.chessGame.status;
			return;
		}

    const checkedColor = this.getCheckedColor();
    if (checkedColor) {
      this.statusElement.textContent = `The ${checkedColor} king is in check.`;
      return;
    }
		
    const currentPlayer =
      this.chessGame.getCurrentPlayer().charAt(0).toUpperCase() +
      this.chessGame.getCurrentPlayer().slice(1);
    this.statusElement.textContent = `${currentPlayer}'s turn`;
  }

  updateBoard() {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const cell = this.boardElement.querySelector(
          `.cell[data-row="${row}"][data-col="${col}"]`
        );
        cell.textContent = this.chessGame.board[row][col];
        cell.classList.remove("selected");
        cell.classList.remove("last-move-from");
        cell.classList.remove("last-move-to");
      }
    }

    if (this.selected) {
      const [row, col] = this.selected;
      const selectedCell = this.boardElement.querySelector(
        `.cell[data-row="${row}"][data-col="${col}"]`
      );
    
			selectedCell.classList.add("selected");
    }

    if (this.lastMove) {
      const fromCell = this.boardElement.querySelector(
        `.cell[data-row="${this.lastMove.from.row}"][data-col="${this.lastMove.from.col}"]`
      );
      const toCell = this.boardElement.querySelector(
        `.cell[data-row="${this.lastMove.to.row}"][data-col="${this.lastMove.to.col}"]`
      );
      if (fromCell) {
        fromCell.classList.add("last-move-from");
      }
      if (toCell) {
        toCell.classList.add("last-move-to");
      }
    }
	}
	

	handleRemoteMove(move) {
		this.chessGame.bringMoveIndexToFront(); // In case player moved back while waiting for move
    const { sRow, sCol, dRow, dCol, newPiece } = move;
    this.chessGame.executeMoveAndUpdateState(sRow, sCol, dRow, dCol, newPiece);
    this.lastMove = { from: { row: sRow, col: sCol }, to: { row: dRow, col: dCol } };
  }

  startGame(isHost) {
		this.chessGame.reset();
		this.chessGame.startGame();
    if (isHost) {
      this.playerSlots = { white: null, black: null };
      this.playerSlots.white = peerManager.clientId;
    } else if (!this.playerSlots) {
      this.playerSlots = { white: null, black: null };
    }
    this.renderBoard();
    this.startTimers();
    this.updateStatus(); // Update status after starting the game
    
    if (peerManager.isConnected()) {
      this.isNetworkedGame = true;
      if (isHost) {
        peerManager.broadcast({
          type: "start-game",
          startTime: this.startTimeInput.value,
          increment: this.incrementInput.value,
          hostId: peerManager.clientId,
        });
      }

      // If it's the networked game, listen for local event from makeLocalMove and broadcast it over the network
      this.broadcastMove = (move) => {
        peerManager.broadcast({
          type: "chess-move",
          move,
        });
      };
      if (!this.networkListenersAdded) {
        eventHub.on("my-move", this.broadcastMove);
      }

      this.networkListenersAdded = true; // Mark listeners as added
    }
    this.persistRoomState();
  }

  formatTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const ms = milliseconds % 1000;
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  }

  startTimers() {
    if (this.startTimeInput.value == "") {
      return;
    }

    this.initiateTimers(this.startTimeInput.value, this.incrementInput.value);

    if (this.activeTimer) {
      clearInterval(this.activeTimer);
    }

    const intervalMs = 100; // 100ms interval
    this.activeTimer = setInterval(() => {
      const currentPlayer = this.chessGame.getCurrentPlayer();
      if (currentPlayer === "white") {
        this.whiteTimeMs -= intervalMs;
        this.whiteTimer.textContent = this.formatTime(this.whiteTimeMs);
      } else {
        this.blackTimeMs -= intervalMs;
        this.blackTimer.textContent = this.formatTime(this.blackTimeMs);
      }

      if (
        (currentPlayer === "white" && this.whiteTimeMs <= 0) ||
        (currentPlayer === "black" && this.blackTimeMs <= 0)
      ) {
        this.endGame();
      }
    }, intervalMs);
  }

  // Load time from input fields
  initiateTimers(startTime, increment) {
    const startTimeMs = parseInt(startTime, 10) * 60 * 1000 || 0; // Ensure it's 0 if invalid
    this.whiteTimeMs = this.blackTimeMs = startTimeMs;
    this.increment = parseInt(increment, 10) * 1000 || 0; // Ensure it's 0 if invalid
    this.whiteTimer.textContent = this.formatTime(this.whiteTimeMs);
    this.blackTimer.textContent = this.formatTime(this.blackTimeMs);
  }

  endGame() {
    clearInterval(this.activeTimer);
    this.activeTimer = null;
    const winner =
      this.chessGame.getCurrentPlayer() === "white" ? "Black" : "White";
    alert(`Game Over! ${winner} wins on time!`);
  }

  goBackOneMove() {
    this.chessGame.goBackOneMove();
    this.renderBoard();
    this.updateStatus();
  }

  goForwardOneMove() {
    this.chessGame.goForwardOneMove();
    this.renderBoard();
    this.updateStatus();
  }

  getSerializableState() {
    return {
      board: this.chessGame.board,
      history: this.chessGame.history,
      moveIndex: this.chessGame.moveIndex,
      status: this.chessGame.status,
      whiteTimeMs: this.whiteTimeMs,
      blackTimeMs: this.blackTimeMs,
      increment: this.increment,
      startTimeInput: this.startTimeInput.value,
      incrementInput: this.incrementInput.value,
      lastMove: this.lastMove,
      stateVersion: this.stateVersion,
      playerSlots: this.playerSlots,
    };
  }

  applyNetworkState(state) {
    if (!state || !state.board || !state.history) {
      return;
    }
    if (
      typeof state.stateVersion === "number" &&
      state.stateVersion < this.stateVersion
    ) {
      return;
    }
    this.chessGame.board = state.board;
    this.chessGame.history = state.history;
    this.chessGame.moveIndex = state.moveIndex || 0;
    this.chessGame.status = state.status || "Not started";
    this.lastMove = state.lastMove || null;
    this.stateVersion = state.stateVersion || 0;
    this.playerSlots = state.playerSlots || { white: null, black: null };
    this.whiteTimeMs = state.whiteTimeMs || 0;
    this.blackTimeMs = state.blackTimeMs || 0;
    this.increment = state.increment || 0;
    this.startTimeInput.value = state.startTimeInput || "";
    this.incrementInput.value = state.incrementInput || "";
    this.whiteTimer.textContent = this.formatTime(this.whiteTimeMs);
    this.blackTimer.textContent = this.formatTime(this.blackTimeMs);
    this.renderBoard();
    this.updateStatus();
    this.playGameOverSoundIfNeeded();
  }

  persistRoomState() {
    if (!peerManager.isConnected()) {
      return;
    }
    peerManager.saveRoomState(this.getSerializableState());
  }

  acceptRemoteMove(data) {
    if (!data || !data.move) {
      return false;
    }
    const { sRow, sCol, dRow, dCol } = data.move;
    const expectedColor = this.chessGame.getCurrentPlayer();
    const sender = data._senderPeer || null;
    const expectedSender = this.playerSlots[expectedColor];
    if (expectedSender && sender && expectedSender !== sender) {
      return false;
    }
    if (!expectedSender && sender) {
      this.playerSlots[expectedColor] = sender;
    }
    return this.chessGame.isValidMove(sRow, sCol, dRow, dCol);
  }

  playMovePing() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return;
    }
    if (!this.audioCtx) {
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }

    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    osc.connect(gain);
    gain.connect(this.audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  playCheckSoundIfNeeded() {
    if (this.chessGame.status !== "In progress") {
      return;
    }
    const checkedColor = this.getCheckedColor();
    if (!checkedColor) {
      return;
    }
    const localColor = this.getLocalPlayerColor();
    if (!localColor || localColor !== checkedColor) {
      return;
    }
    this.playToneSequence([880, 880], 0.1, 0.075);
  }

  getCheckedColor() {
    const currentPlayer = this.chessGame.getCurrentPlayer();
    if (this.chessGame.isKingInCheck(currentPlayer)) {
      return currentPlayer;
    }
    return null;
  }

  playGameOverSoundIfNeeded() {
    const status = this.chessGame.status || "";
    if (!status.startsWith("Game over")) {
      this.lastAnnouncedGameStatus = "";
      return;
    }
    if (status === this.lastAnnouncedGameStatus) {
      return;
    }
    this.lastAnnouncedGameStatus = status;

    const localColor = this.getLocalPlayerColor();
    if (status.includes("Stalemate")) {
      this.playToneSequence([440, 392], 0.12);
      return;
    }

    const whiteWon = status.includes("White wins");
    const blackWon = status.includes("Black wins");
    const localWon =
      (whiteWon && localColor === "white") || (blackWon && localColor === "black");
    const localLost =
      (whiteWon && localColor === "black") || (blackWon && localColor === "white");

    if (localWon) {
      this.playToneSequence([523, 659, 784], 0.14);
      return;
    }
    if (localLost) {
      this.playToneSequence([220, 185, 165], 0.16);
      return;
    }

    this.playToneSequence([392, 330], 0.12);
  }

  getLocalPlayerColor() {
    if (this.playerSlots.white === peerManager.clientId) {
      return "white";
    }
    if (this.playerSlots.black === peerManager.clientId) {
      return "black";
    }
    return null;
  }

  playToneSequence(frequencies, stepDuration = 0.12, peakGain = 0.05) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return;
    }
    if (!this.audioCtx) {
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === "suspended") {
      this.audioCtx.resume();
    }

    const start = this.audioCtx.currentTime;
    frequencies.forEach((freq, i) => {
      const t0 = start + i * stepDuration;
      const t1 = t0 + stepDuration * 0.9;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(peakGain, t0 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t1);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start(t0);
      osc.stop(t1);
    });
  }
}

// Create and export a single instance of the game
export const game = new Game();
window.game = game;


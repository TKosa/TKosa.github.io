// Everything, including UI, Game Logic, Networking
// Includes buttons + fields for time control and start/end game 

import { Chess } from "./Chess.js";
import { peerManager } from './PeerManager.js';
import { eventHub } from './EventHub.js';


export class Game {
  constructor() {
    this.chessGame = new Chess();
    this.boardElement = document.getElementById("chessboard");
    this.statusElement = document.getElementById("status");
    this.selected = null;
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
      this.startGame(false);
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
    this.chessGame.executeMoveAndUpdateState(sRow, sCol, dRow, dCol, newPiece);
    eventHub.emit("my-move", { sRow, sCol, dRow, dCol, newPiece });
  }

  afterMove() {
    this.updateStatus();
		this.updateTimers();
		this.selected = null;
    this.updateBoard();
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
      }
    }

    if (this.selected) {
      const [row, col] = this.selected;
      const selectedCell = this.boardElement.querySelector(
        `.cell[data-row="${row}"][data-col="${col}"]`
      );
    
			selectedCell.classList.add("selected");
    }
	}
	

	handleRemoteMove(move) {
		this.chessGame.bringMoveIndexToFront(); // In case player moved back while waiting for move
    const { sRow, sCol, dRow, dCol, newPiece } = move;
    this.chessGame.executeMoveAndUpdateState(sRow, sCol, dRow, dCol, newPiece);
  }

  startGame(isHost) {
		this.chessGame.reset();
		this.chessGame.startGame();
    this.renderBoard();
    this.startTimers();
    this.updateStatus(); // Update status after starting the game
    
    if (peerManager.connections.length > 0) {
      this.isNetworkedGame = true;
      
      // Add listeners only if they haven't been added before
      peerManager.connections.forEach((conn) => {
        if (isHost) {
          // Send start event to other players
          conn.send({
            type: "start-game",
            startTime: this.startTimeInput.value,
            increment: this.incrementInput.value,
          });
        }
        if (!this.networkListenersAdded) {
          // Listen for moves from other players
          conn.on("data", (data) => {
            if (data.type === "chess-move") {
              this.handleRemoteMove(data.move);
              this.afterMove();
            }
          });
        }
      });

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
}

// Create and export a single instance of the game
export const game = new Game();
window.game = game;


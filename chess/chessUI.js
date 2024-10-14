import { Chess } from "./chess.js";
import { peerManager } from './PeerManager.js';
import { eventHub } from './EventHub.js';


export class ChessUI {
	constructor() {
		this.chessGame = new Chess();
		this.boardElement = document.getElementById("chessboard");
		this.statusElement = document.getElementById("status");
		this.selected = null;
		this.allMoves = [];
		this.promotionPending = false;
		this.pendingPromotion = null;
		this.initializeBoard();
		this.renderBoard();
		this.updateStatus();
		this.setupNetworking();
		
		eventHub.on('move-executed', (move) => {
			this.handleRemoteMove(move);
		});

		this.startTimeInput = document.getElementById('start-time');
		this.incrementInput = document.getElementById('increment');
		this.startButton = document.getElementById('start-button');
		this.whiteTimer = document.getElementById('white-timer');
		this.blackTimer = document.getElementById('black-timer');
		this.whiteTime = 0;
		this.blackTime = 0;
		this.increment = 0;
		this.activeTimer = null;
		
		this.startButton.addEventListener('click', () => this.startGame());
		eventHub.on('start-game', () => this.startGame());
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
        const cell = this.boardElement.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
        cell.textContent = this.chessGame.state[row][col];
      }
    }
  }

	reset() {
		this.chessGame.reset();
		this.selected = null;
		this.updateStatus();
		this.renderBoard();
	}

	onCellClick(row, col) {
		if (this.promotionPending) {
			return; // Don't allow moves while promotion is pending
		}

		const piece = this.chessGame.state[row][col];

		if (this.selected) {
			const [sRow, sCol] = this.selected;
			this.makeLocalMove(sRow, sCol, row, col);
		} else {
			if (piece && this.chessGame.isPlayerPiece(piece, this.chessGame.currentPlayer)) {
				this.selected = [row, col];
			}
		}

		this.updateBoard();
	}

	isPawnPromotion(row, col) {
		const piece = this.chessGame.state[row][col];
		return (piece === '♙' && row === 0) || (piece === '♟' && row === 7);
	}

	showPromotionPopup(row, col) {
		this.promotionPending = true;
		this.pendingPromotion = { row, col };

		const popup = document.createElement('div');
		popup.id = 'promotion-popup';
		popup.style.position = 'fixed';
		popup.style.top = '50%';
		popup.style.left = '50%';
		popup.style.transform = 'translate(-50%, -50%)';
		popup.style.backgroundColor = 'white';
		popup.style.padding = '20px';
		popup.style.border = '2px solid black';
		popup.style.zIndex = '1000';

		const pieces = this.chessGame.currentPlayer === 'black' ? ['♕', '♖', '♗', '♘'] : ['♛', '♜', '♝', '♞']; //Turn has passed since by the time we run this promotion logic, the current player has already changed
		pieces.forEach(piece => {
			const button = document.createElement('button');
			button.textContent = piece;
			button.style.fontSize = '24px';
			button.style.margin = '5px';
			button.addEventListener('click', () => this.promotePawn(row, col, piece));
			popup.appendChild(button);
		});

		document.body.appendChild(popup);
	}

	promotePawn(row, col, newPiece) {
		this.chessGame.state[row][col] = newPiece;
		this.promotionPending = false;
		this.pendingPromotion = null;
		document.body.removeChild(document.getElementById('promotion-popup'));
		this.updateStatus();
		this.updateBoard();
	}

	updateStatus() {
		const currentPlayer = this.chessGame.currentPlayer.charAt(0).toUpperCase() + 
							  this.chessGame.currentPlayer.slice(1);
		this.statusElement.textContent = `${currentPlayer}'s turn`;
	}

	updateBoard() {
		for (let row = 0; row < 8; row++) {
			for (let col = 0; col < 8; col++) {
				const cell = this.boardElement.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
				cell.textContent = this.chessGame.state[row][col];
				cell.classList.remove("selected");
			}
		}

		if (this.selected) {
			const [row, col] = this.selected;
			const selectedCell = this.boardElement.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
			if (selectedCell) {
				selectedCell.classList.add("selected");
				console.log(`Selected piece at Row: ${row}, Col: ${col}`);
			}
		}
	}

	setupNetworking() {
		eventHub.on('data', (data, peerId) => {
			if (data.type === 'chess-move') {
				this.handleRemoteMove(data.move);
			}
		});

		// Example: Sending a move
		// You can call this.sendMove(move) whenever a local move is made
	}

	makeLocalMove(sRow, sCol, dRow, dCol) {
		const moveWasExecuted = this.chessGame.executeMoveIfValid(sRow, sCol, dRow, dCol);
		if (moveWasExecuted) {
			this.updateStatus();
			this.selected = null;
			this.allMoves.push([sRow, sCol, dRow, dCol]);

			// Switch timers
			const currentColor = this.chessGame.currentPlayer === 'white' ? 'black' : 'white';
			if (this.activeTimer) {
				clearInterval(this.activeTimer);
				if (currentColor === 'white') {
					this.blackTime += this.increment;
				} else {
					this.whiteTime += this.increment;
				}
				this.updateTimerDisplay(currentColor === 'white' ? 'black' : 'white');
			}
			this.startTimer(currentColor);

			// Check for pawn promotion
			if (this.isPawnPromotion(dRow, dCol)) {
				this.showPromotionPopup(dRow, dCol);
			}
		}
	}

	handleRemoteMove(move) {
		const { sRow, sCol, dRow, dCol } = move;
		const moveWasExecuted = this.chessGame.executeMoveIfValid(sRow, sCol, dRow, dCol);
		if (moveWasExecuted) {
			this.updateStatus();
			this.allMoves.push([sRow, sCol, dRow, dCol]);
			this.updateBoard();

			// Switch timers
			const currentColor = this.chessGame.currentPlayer;
			if (this.activeTimer) {
				clearInterval(this.activeTimer);
				if (currentColor === 'white') {
					this.blackTime += this.increment;
				} else {
					this.whiteTime += this.increment;
				}
				this.updateTimerDisplay(currentColor === 'white' ? 'black' : 'white');
			}
			this.startTimer(currentColor);

			// Check for pawn promotion
			if (this.isPawnPromotion(dRow, dCol)) {
				// Handle remote pawn promotion
				// You might want to wait for a promotion choice from the remote player
			}
		}
	}

	startGame() {
		const startTime = parseInt(this.startTimeInput.value, 10) || 10; // Default to 10 minutes if invalid input
		const increment = parseInt(this.incrementInput.value, 10) || 0; // Default to 0 seconds if invalid input
		
		// Convert minutes to milliseconds for the timer
		const startTimeMs = startTime * 60 * 1000;
		const incrementMs = increment * 1000;
		
		if (peerManager.connections.length > 0) {
			// Start networked game
			this.startGameWithTime(startTimeMs, incrementMs);
		} else {
			// Start local game
			this.startGameLocally(startTimeMs, incrementMs);
		}
	}

	startGameWithTime(startTimeMs, incrementMs) {
		this.whiteTime = startTimeMs;
		this.blackTime = startTimeMs;
		this.increment = incrementMs;
		this.updateTimerDisplay('white');
		this.updateTimerDisplay('black');
		// Additional networked game setup...
	}

	startGameLocally(startTimeMs, incrementMs) {
		this.whiteTime = startTimeMs;
		this.blackTime = startTimeMs;
		this.increment = incrementMs;
		this.updateTimerDisplay('white');
		this.updateTimerDisplay('black');
		this.startTimer('white');
	}

	updateTimerDisplay(color) {
		const timer = color === 'white' ? this.whiteTimer : this.blackTimer;
		const time = color === 'white' ? this.whiteTime : this.blackTime;
		timer.textContent = this.formatTime(time);
	}

	formatTime(ms) {
		const minutes = Math.floor(ms / 60000);
		const seconds = Math.floor((ms % 60000) / 1000);
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}

	startTimer(color) {
		if (this.activeTimer) {
			clearInterval(this.activeTimer);
		}
		this.activeTimer = setInterval(() => {
			if (color === 'white') {
				this.whiteTime -= 1000;
			} else {
				this.blackTime -= 1000;
			}
			this.updateTimerDisplay(color);
			if ((color === 'white' && this.whiteTime <= 0) || (color === 'black' && this.blackTime <= 0)) {
				this.endGame(color === 'white' ? 'black' : 'white');
			}
		}, 1000);
	}

	endGame(winner) {
		// clearInterval(this.activeTimer);
		// this.activeTimer = null;
		// alert(`Game Over! ${winner.charAt(0).toUpperCase() + winner.slice(1)} wins on time!`);
		// Additional end game logic...
	}
}

// Create and export a single instance of the game
export const chessUI = new ChessUI();
window.chessBoard = chessUI;

// Export the reset function
export function reset() {
	chessGame.reset();
}

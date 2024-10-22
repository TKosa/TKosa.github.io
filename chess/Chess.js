export class Chess {
  constructor() {
    this.reset();
  }

  reset() {
    this.board = [
      ["♜", "♞", "♝", "♛", "♚", "♝", "♞", "♜"],
      ["♟", "♟", "♟", "♟", "♟", "♟", "♟", "♟"],
      ["", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", ""],
      ["♙", "♙", "♙", "♙", "♙", "♙", "♙", "♙"],
      ["♖", "♘", "♗", "♕", "♔", "♗", "♘", "♖"],
    ];
    this.history = [];
    this.moveIndex = 0;
    this.status = 'Not started'; // Initialize status
  }

  // New method to start the game
  startGame() {
    this.status = 'In progress';
  }

  // New method to end the game
  endGame(winner) {
    this.status = `Game over - ${winner}`;
  }

  // Getter to infer the current player based on moveIndex
  getCurrentPlayer() {
    return this.moveIndex % 2 === 0 ? "white" : "black";
  }

  // Execute a move and return the results for the history. This only modifies the board.
  executeMove(sRow, sCol, dRow, dCol, newPiece) {
    
    const piece = this.board[sRow][sCol];
    let capturedPiece = this.board[dRow][dCol];

    // Handle en passant
    const isMoveEnPassant = this.isEnPassant(sRow, sCol, dRow, dCol);
    if (isMoveEnPassant) {
      this.board[sRow][sCol] = "";
      this.board[dRow][dCol] = piece;
      capturedPiece = this.board[sRow][dCol];
      this.board[sRow][dCol] = "";
    }

    // Handle castling 
    const isMoveCastling = (piece === "♔" || piece === "♚") && Math.abs(dCol - sCol) === 2;
    if (isMoveCastling) {
      const rookCol = dCol > sCol ? 7 : 0;
      const rookPiece = this.getCurrentPlayer() === "white" ? "♖" : "♜";
      // Move king over two squares
      this.board[sRow][sCol] = "";
      this.board[dRow][dCol] = piece;
      // Move rook to new position
      this.board[sRow][rookCol] = "";
      this.board[sRow][(sCol + dCol) / 2] = rookPiece;
    }
    else {
      this.board[sRow][sCol] = "";
      this.board[dRow][dCol] = piece;
      if (newPiece) {
        this.board[dRow][dCol] = newPiece; // Promote pawn to new piece
      }
    }

    const moveResults = {sRow, sCol, dRow, dCol, piece, capturedPiece, isMoveEnPassant, isMoveCastling};
   

    return moveResults;
  }

  // To be called when player makes a valid move.
  executeMoveAndUpdateState(sRow, sCol, dRow, dCol, newPiece) {
    const moveResults = this.executeMove(sRow, sCol, dRow, dCol, newPiece);
    this.updateHistory(moveResults);
    this.nextTurn();  
  }

  updateHistory({ sRow, sCol, dRow, dCol, piece, capturedPiece, isMoveEnPassant, isMoveCastling }) {
    const move = {
      from: { row: sRow, col: sCol },
      to: { row: dRow, col: dCol },
      piece,
      capturedPiece,
      isMoveEnPassant,
      isMoveCastling,
    };
    
    if (this.moveIndex < this.history.length) {
      // If we're here we went back some moves and made a new one. Clear the history after the move index.
      this.history.splice(this.moveIndex);
    }

    this.history.push(move);
  }
  
  isValidMove(sRow, sCol, dRow, dCol) {
    const targetPiece = this.board[dRow][dCol];

    const targetIsEmptyOrOpponentPiece = targetPiece === "" || !this.isPlayerPiece(targetPiece, this.getCurrentPlayer());
    if (!targetIsEmptyOrOpponentPiece) {
      return false;
    }
    
    if (!this.moveFollowsPieceRules(sRow, sCol, dRow, dCol)) {
      return false;
    }

    if (this.doesMoveEndInCheck(sRow, sCol, dRow, dCol)) {
      return false;
    }

    return true;
  }

  doesMoveEndInCheck(sRow, sCol, dRow, dCol) {
    // Simulate the move
    const currentPlayer = this.getCurrentPlayer(); // Must go first since executeMove changes the current player
    this.executeMoveAndUpdateState(sRow, sCol, dRow, dCol);
    const isInCheck = this.isKingInCheck(currentPlayer);
    
    this.goBackOneMove();
    this.history.pop();
    
    return isInCheck;
  }

  isKingInCheck(player) {
    const kingSymbol = player === 'white' ? '♔' : '♚';
    // Find the king's position
    let kingPos;
    let row = 0;
    while (row < 8 && kingPos === undefined) {
      let col = 0;
      while (col < 8 && kingPos === undefined) {
        if (this.board[row][col] === kingSymbol) {
          kingPos = { row, col };
        }
        col++;
      }
      row++;  
    }
    // Check if any opponent's piece can attack the king
    const opponentPlayer = player === 'white' ? 'black' : 'white';
    const isInCheck = this.isSquareUnderAttack(kingPos.row, kingPos.col, opponentPlayer);
    return isInCheck;
  }  

  isEnPassant(sRow, sCol, dRow, dCol) {
    if (this.moveIndex === 0) { return false; }

    const piece = this.board[sRow][sCol];
    const lastMove = this.history[this.moveIndex - 1];
    
    const lastMoveIsPawnMoveTwoSquares = lastMove &&
      Math.abs(lastMove.from.row - lastMove.to.row) === 2 &&
      ["♟", "♙"].includes(lastMove.piece);
    
    const theyEndUpBesideUs = lastMove.to.row === sRow && Math.abs(lastMove.to.col - sCol) === 1; 

    const weMovePawnBehindThem = ["♟", "♙"].includes(piece) && dRow === (lastMove.to.row + lastMove.from.row) / 2;

    const isEnPassant = lastMoveIsPawnMoveTwoSquares && theyEndUpBesideUs && weMovePawnBehindThem;

    return isEnPassant;
  }

  moveFollowsPieceRules(sRow, sCol, dRow, dCol) {
    const piece = this.board[sRow][sCol];
    const targetPiece = this.board[dRow][dCol];
    const currentPlayer = ["♚", "♛", "♜", "♝", "♞", "♟"].includes(piece) ? "black" : "white";
    const rowDiff = Math.abs(dRow - sRow);
    const colDiff = Math.abs(dCol - sCol);

    switch (piece) {
      case "♟":
      case "♙":
        // Pawn logic        
        const isMovingInCorrectDirection = currentPlayer === "white" ? dRow < sRow : dRow > sRow;
        if (!isMovingInCorrectDirection) { return false; }
        // Forward moves 
        if (sCol === dCol && !targetPiece) {
          // Move one square forward
          if (rowDiff === 1) return true;
          // Move two squares forward
          if (
            rowDiff === 2 &&
            (sRow === 6 && currentPlayer === "white" || sRow === 1 && currentPlayer === "black")
          )
            return true;
        }
        // Capture
        if (targetPiece && colDiff === 1 && rowDiff === 1 && !this.isPlayerPiece(targetPiece, currentPlayer)) {
          return true;
        }
        // En passant
        if (colDiff === 1 && targetPiece === "") {
          const isEnPassant = this.isEnPassant(sRow, sCol, dRow, dCol);
          return isEnPassant;
        }
        break;
      case "♜":
      case "♖":
        // Rook logic
        if ((sRow === dRow || sCol === dCol) && this.isPathClear(sRow, sCol, dRow, dCol)) {
          return true;
        }
        break;
      case "♞":
      case "♘":
        // Knight logic
        if ((rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2)) {return true;}
        break;
      case "♝":
      case "♗":
        // Bishop logic
        if (rowDiff === colDiff && this.isPathClear(sRow, sCol, dRow, dCol)) {return true;}
        break;
      case "♛":
      case "♕":
        // Queen logic
        if ((sRow === dRow || sCol === dCol || rowDiff === colDiff) &&
            this.isPathClear(sRow, sCol, dRow, dCol)) {return true;}
        break;
      case "♚":
      case "♔":
        // King logic 
        if (rowDiff <= 1 && colDiff <= 1) {
          return true;
        }

        // Castling
        if (colDiff === 2) {
          // Can't castle through check
          const otherPlayer = currentPlayer === "white" ? "black" : "white";
          if (this.isSquareUnderAttack(sRow, sCol, otherPlayer)) { return false; }
          
          const kingPiece = currentPlayer === 'white' ? '♔' : '♚';
          const rookPiece = currentPlayer === 'white' ? '♖' : '♜';
          const isKingside = dCol > sCol;
          const rookCol = isKingside ? 7 : 0;
          const rookRow = sRow;
          
          // Check if the king or the rook has moved before
          for (let move of this.history) {
            if (move.piece === kingPiece ||
                (move.piece === rookPiece &&
                 move.from.row === rookRow && move.from.col === rookCol)) {
              return false;
            }
          }
          
          // Check if the path between the king and rook is clear
          const direction = isKingside ? 1 : -1;
          const opponentPlayer = currentPlayer === 'white' ? 'black' : 'white';
          for (let col = sCol + direction; col !== rookCol; col += direction) {
            if (this.board[sRow][col] !== '' || this.isSquareUnderAttack(sRow, col, opponentPlayer)) {
              return false;
            }
          }
          
          return true;
        }
    }
    return false;
  }


  isPathClear(sRow, sCol, dRow, dCol) {
    const rowStep = sRow === dRow ? 0 : dRow > sRow ? 1 : -1;
    const colStep = sCol === dCol ? 0 : dCol > sCol ? 1 : -1;

    let row = sRow + rowStep;
    let col = sCol + colStep;

    while (row !== dRow || col !== dCol) {
      if (this.board[row][col] !== "") {
        return false;
      }
      row += rowStep;
      col += colStep;
    }

    return true;
  }

  isSquareUnderAttack(row, col, attackingPlayer) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (piece && this.isPlayerPiece(piece, attackingPlayer)) {
          if (this.canPieceAttackSquare(r, c, row, col)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  canPieceAttackSquare(sRow, sCol, dRow, dCol) {
    const piece = this.board[sRow][sCol];
    const rowDiff = Math.abs(dRow - sRow);
    const colDiff = Math.abs(dCol - sCol);

    switch (piece) {
      case "♟":
      case "♙":
        // Pawn attack logic
        return colDiff === 1 && (
          (piece === "♙" && sRow - dRow === 1) || // White pawn
          (piece === "♟" && dRow - sRow === 1)    // Black pawn
        );
      case "♜":
      case "♖":
        // Rook attack logic
        return (sRow === dRow || sCol === dCol) && this.isPathClear(sRow, sCol, dRow, dCol);
      case "♞":
      case "♘":
        // Knight attack logic
        return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);
      case "♝":
      case "♗":
        // Bishop attack logic
        return rowDiff === colDiff && this.isPathClear(sRow, sCol, dRow, dCol);
      case "♛":
      case "♕":
        // Queen attack logic
        return (sRow === dRow || sCol === dCol || rowDiff === colDiff) && this.isPathClear(sRow, sCol, dRow, dCol);
      case "♚":
      case "♔":
        // King attack logic (without castling)
        return rowDiff <= 1 && colDiff <= 1;
      default:
        return false;
    }
  }

  isPlayerPiece(piece, player) {
    const whitePieces = ["♔", "♕", "♖", "♗", "♘", "♙"];
    const blackPieces = ["♚", "♛", "♜", "♝", "♞", "♟"];
    return (
      (player === "white" && whitePieces.includes(piece)) ||
      (player === "black" && blackPieces.includes(piece))
    );
  }

  nextTurn() {
    this.moveIndex++;
  }

  printPartialHistory() {
    // for each move in history, print the move
    for (let move of this.history) {
      // print source and destination as array [row, col] 
      console.log(`[${move.from.row},${move.from.col},${move.to.row},${move.to.col}]`);
    }
  }

  goBackOneMove() {
    if (this.moveIndex === 0) {
      console.warn("No moves to undo.");
      return;
    }

    this.moveIndex--;
    const currentPlayer = this.getCurrentPlayer(); // Infer the current player from moveIndex after decrement
    const lastMove = this.history[this.moveIndex];
    if (!lastMove) {
      debugger;
    }

    const { from, to, piece, capturedPiece, isMoveEnPassant, isMoveCastling } =
      lastMove;

    if (isMoveEnPassant) {
      this.board[to.row][to.col] = "";
      // Calculate the row where the captured pawn was
      const captureRow = currentPlayer === "white" ? to.row + 1 : to.row - 1;
      this.board[captureRow][to.col] = capturedPiece;
      this.board[from.row][from.col] = piece;
    } else if (isMoveCastling) {
      // Move king back to original position
      this.board[from.row][to.col] = "";
      this.board[from.row][from.col] = piece;

      // Move rook back to original position
      const isKingside = to.col > from.col;
      const rookFromCol = isKingside ? 7 : 0;
      const rookToCol = isKingside ? 5 : 3; // Standard castling positions
      const rookPiece = currentPlayer === "white" ? "♖" : "♜";
      this.board[from.row][rookToCol] = "";
      this.board[from.row][rookFromCol] = rookPiece;
    } else {
      this.board[to.row][to.col] = capturedPiece;
      this.board[from.row][from.col] = piece;
    }
  }

  goForwardOneMove() {
    // Do nothing if there is no next move
    if (this.moveIndex >= this.history.length) {
      return;
    }

    const nextMove = this.history[this.moveIndex];
    this.executeMove(nextMove.from.row, nextMove.from.col, nextMove.to.row, nextMove.to.col);
    this.moveIndex++;
  }

  bringMoveIndexToFront() {
    while (this.moveIndex < this.history.length) {
      this.goForwardOneMove();
    }
  }
}

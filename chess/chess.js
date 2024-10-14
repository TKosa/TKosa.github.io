// A game of chess 
export class Chess {
  constructor() {
    this.reset();
  }

  reset() {
    this.state = [
      ["♜", "♞", "♝", "♛", "♚", "♝", "♞", "♜"],
      ["♟", "♟", "♟", "♟", "♟", "♟", "♟", "♟"],
      ["", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", ""],
      ["", "", "", "", "", "", "", ""],
      ["♙", "♙", "♙", "♙", "♙", "♙", "♙", "♙"],
      ["♖", "♘", "♗", "♕", "♔", "♗", "♘", "♖"],
    ];
    this.history = {
      white: {
        kingHasMoved: false,
        leftRookHasMoved: false,
        rightRookHasMoved: false,
      },
      black: {
        kingHasMoved: false,
        leftRookHasMoved: false,
        rightRookHasMoved: false,
      },
      lastMove: null,
    };
    this.currentPlayer = "white";
  }

  execute(sRow, sCol, dRow, dCol) {
    const piece = this.state[sRow][sCol];
    this.state[dRow][dCol] = piece;
    this.state[sRow][sCol] = "";
  }

  executeMoveIfValid(sRow, sCol, dRow, dCol) {
    if (this.isValidMove(sRow, sCol, dRow, dCol)) {
      if (this.isValidCommonMove(sRow, sCol, dRow, dCol)) {
        this.executeCommonMove(sRow, sCol, dRow, dCol);
      } else {
        this.executeSpecialMove(sRow, sCol, dRow, dCol);
      }
      return true; // Move was executed
    }
    return false; // Move was not executed
  }

  isKingInCheck(sRow, sCol, dRow, dCol, player) {
    // Find the king's position
    let kingRow, kingCol;
    const kingSymbol = player === 'white' ? '♔' : '♚';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (this.state[row][col] === kingSymbol) {
          kingRow = row;
          kingCol = col;
          break;
        }
      }
      if (kingRow !== undefined) break;
    }
    
    // Check if any opponent's piece can attack the king
    const opponentPlayer = player === 'white' ? 'black' : 'white';
    return this.isSquareUnderAttack(kingRow, kingCol, opponentPlayer);
  }

  isValidMove(sRow, sCol, dRow, dCol) {
    const testBoard = new Chess();
    testBoard.state = JSON.parse(JSON.stringify(this.state));
    testBoard.currentPlayer = JSON.parse(JSON.stringify(this.currentPlayer));
    testBoard.executeCommonMove(sRow, sCol, dRow, dCol);
    if (testBoard.isKingInCheck(sRow, sCol, dRow, dCol, this.currentPlayer)) {
      return false;
    }
    
    if (this.isValidSpecialMove(sRow, sCol, dRow, dCol)) {
      return true; // If it's a valid special move
    } else if (this.isValidCommonMove(sRow, sCol, dRow, dCol)) {
      return true; // If it's a valid common move
    }
    return false; // If neither move is valid
  }

  executeCommonMove(sRow, sCol, dRow, dCol) {
    this.execute(sRow, sCol, dRow, dCol);

    this.history.lastMove = [sRow, sCol, dRow, dCol];
    this.nextTurn();

    // If move was king move, update the history
    if (this.state[dRow][dCol] === "♚" || this.state[dRow][dCol] === "♔") {
      this.history[this.currentPlayer].kingHasMoved = true;
    }
  }

  isValidCommonMove(sRow, sCol, dRow, dCol) {
    const piece = this.state[sRow][sCol];
    const targetPiece = this.state[dRow][dCol];

    const whitePieces = ['♔', '♕', '♖', '♗', '♘', '♙'];
    if (targetPiece) {
      const attackingPieceOwner = whitePieces.includes(piece) ? 'white' : 'black';
      const defendingPieceOwner = whitePieces.includes(targetPiece) ? 'white' : 'black';
      if (attackingPieceOwner === defendingPieceOwner) {
        return false;
      }
    }

    const rowDiff = Math.abs(dRow - sRow);
    const colDiff = Math.abs(dCol - sCol);

    switch (piece) {
      case "♟":
      case "♙":
        // Pawn logic
        const direction = this.currentPlayer === "white" ? -1 : 1;
        if (sCol === dCol && !targetPiece) {
          if (rowDiff === 1 && dRow - sRow === direction) return true;
          if (
            rowDiff === 2 &&
            dRow - sRow === 2 * direction &&
            (sRow === 1 || sRow === 6)
          )
            return true;
        } else if (colDiff === 1 && dRow - sRow === direction && targetPiece) {
          return true;
        }
        return false;
      case "♜":
      case "♖":
        // Rook logic
        if ((sRow === dRow || sCol === dCol) && this.isPathClear(sRow, sCol, dRow, dCol)) {
          // Update history about rook moving
          if (sCol === 0) {
            this.history[this.currentPlayer].leftRookHasMoved = true;
          } else if (sCol === 7) {
            this.history[this.currentPlayer].rightRookHasMoved = true;
          }
          return true;
        }
        return false;
      case "♞":
      case "♘":
        // Knight logic
        return (
          (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2)
        );
      case "♝":
      case "♗":
        // Bishop logic
        return rowDiff === colDiff && this.isPathClear(sRow, sCol, dRow, dCol);
      case "♛":
      case "♕":
        // Queen logic
        return (
          (sRow === dRow || sCol === dCol || rowDiff === colDiff) &&
          this.isPathClear(sRow, sCol, dRow, dCol)
        );
      case "♚":
      case "♔":
        // King logic (without castling)
        return rowDiff <= 1 && colDiff <= 1;
    }
    return false;
  }

  isValidSpecialMove(sRow, sCol, dRow, dCol) {
    const piece = this.state[sRow][sCol];

    // Castling logic
    if (piece === "♔" || piece === "♚") {
      // Check if the move is a valid castling move
      if (dRow === sRow && (dCol === sCol + 2 || dCol === sCol - 2)) {
        const isKingside = dCol > sCol;
        const rookCol = isKingside ? 7 : 0;
        
        // Check if the king or the corresponding rook has moved
        if (this.history[this.currentPlayer].kingHasMoved ||
            (isKingside && this.history[this.currentPlayer].rightRookHasMoved) ||
            (!isKingside && this.history[this.currentPlayer].leftRookHasMoved)) {
          return false;
        }
        
        // Check if the path is clear
        if (!this.isPathClear(sRow, sCol, sRow, dCol)) {
          return false;
        }
        
        // Check if the king is in check or passes through check
        const opponentPlayer = this.currentPlayer === 'white' ? 'black' : 'white';
        for (let col = Math.min(sCol, dCol); col <= Math.max(sCol, dCol); col++) {
          if (this.isSquareUnderAttack(sRow, col, opponentPlayer)) {
            return false;
          }
        }
        
        return true;
      }
    }

    // En passant logic
    if (piece === "♙" && this.currentPlayer === "white") {
      if (Math.abs(sCol - dCol) === 1 && dRow === sRow - 1) {
        const lastMove = this.history.lastMove;
        if (
          lastMove &&
          this.state[dRow + 1][dCol] === "♟" &&
          lastMove[0] === 1 &&
          lastMove[2] === 3 &&
          lastMove[3] === dCol
        ) {
          return true;
        }
      }
      return false;
    } else if (piece === "♟" && this.currentPlayer === "black") {
      if (Math.abs(sCol - dCol) === 1 && dRow === sRow + 1) {
        const lastMove = this.history.lastMove;
        if (
          lastMove &&
          this.state[dRow - 1][dCol] === "♙" &&
          lastMove[0] === 6 &&
          lastMove[2] === 4 &&
          lastMove[3] === dCol
        ) {
          return true;
        }
      }
      return false;
    }

    return false;
  }

  executeSpecialMove(sRow, sCol, dRow, dCol) {
    const piece = this.state[sRow][sCol];
    const opponent = this.currentPlayer === "white" ? "black" : "white";

    // Castling
    if (piece === "♔" || piece === "♚") {
      const isKingside = dCol > sCol;
      const rookCol = isKingside ? 7 : 0;
      const newRookCol = isKingside ? dCol - 1 : dCol + 1;

      this.execute(sRow, sCol, dRow, dCol);
      this.execute(dRow, rookCol, dRow, newRookCol);

      this.history[this.currentPlayer].kingHasMoved = true;
      if (isKingside) {
        this.history[this.currentPlayer].rightRookHasMoved = true;
      } else {
        this.history[this.currentPlayer].leftRookHasMoved = true;
      }

      this.history.lastMove = [sRow, sCol, dRow, dCol];
      this.nextTurn();
      return;
    }

    // En passant
    if (
      (piece === "♙" && this.currentPlayer === "white") ||
      (piece === "♟" && this.currentPlayer === "black")
    ) {
      const direction = this.currentPlayer === "white" ? -1 : 1;
      if (Math.abs(sCol - dCol) === 1 && dRow === sRow + direction) {
        this.state[sRow][dCol] = "";
      }
    }

    this.execute(sRow, sCol, dRow, dCol);

    this.history.lastMove = [sRow, sCol, dRow, dCol];
    this.nextTurn();
  }

  isPathClear(sRow, sCol, dRow, dCol) {
    const rowStep = sRow === dRow ? 0 : dRow > sRow ? 1 : -1;
    const colStep = sCol === dCol ? 0 : dCol > sCol ? 1 : -1;

    let row = sRow + rowStep;
    let col = sCol + colStep;

    while (row !== dRow || col !== dCol) {
      if (this.state[row][col] !== "") {
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
        const piece = this.state[r][c];
        if (piece && this.isPlayerPiece(piece, attackingPlayer)) {
          if (this.isValidCommonMove(r, c, row, col)) {
            return true;
          }
        }
      }
    }
    return false;
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
    this.currentPlayer = this.currentPlayer === "white" ? "black" : "white";
  }
}


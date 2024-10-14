const TestStatus = {
  NOT_RUN: "not run",
  RUNNING: "running",
  PASSED: "passed",
  FAILED: "failed",
};

export class Test {
  constructor(title, description, moves) {
    this.title = title;
    this.moves = moves;
    this.description = description;
    this.status = TestStatus.NOT_RUN;
  }

  async run(slow) {
    const testSlowly = slow;
    for (let [sRow, sCol, dRow, dCol, expectedSuccess] of this.moves) {
      if (expectedSuccess === undefined) {
        expectedSuccess = true;
      }
      const sourceCell = document.querySelector(
        `.cell[data-row="${sRow}"][data-col="${sCol}"]`
      );
      const sourcePiece = sourceCell.textContent;

      sourceCell.click();

      const destCell = document.querySelector(
        `.cell[data-row="${dRow}"][data-col="${dCol}"]`
      );
      destCell.click();

      await new Promise((resolve) => setTimeout(resolve, testSlowly ? 1000 : 100));

      const moveSucceeded = destCell.textContent === sourcePiece;

      if (moveSucceeded !== expectedSuccess) {
        console.error(
          `Move from (${sRow}, ${sCol}) to (${dRow}, ${dCol}) ${moveSucceeded ? 'succeeded' : 'failed'}, but expected ${expectedSuccess ? 'success' : 'failure'}.`
        );
        this.status = TestStatus.FAILED;
        return;
      }
    }
    this.status = TestStatus.PASSED;
  }
}

export const tests = [
  new Test("All Pieces Move", "Every type of piece moves at least twice", [
    [7, 1, 5, 2, true], // White knight to c3
    [0, 1, 2, 2, true], // Black knight to c6
    [6, 3, 5, 3], // White pawn to d3
    [1, 3, 2, 3], // Black pawn to d6
    [7, 2, 6, 3], // White bishop to b2
    [0, 2, 1, 3], // Black bishop to b6
    [7, 3, 5, 5], // White queen to d3
    [0, 3, 2, 5], // Black queen to d6
    [7, 4, 7, 3], // White king to e2
    [0, 4, 0, 3], // Black king to e7
    [7, 0, 7, 2], // White rook to c1
    [0, 0, 0, 2], // Black rook to c8
    [6, 4, 4, 4], // White pawn to e4
    [1, 4, 3, 4], // Black pawn to e5
    [7, 5, 4, 2], // White bishop to c4
    [0, 5, 3, 2], // Black bishop to c5
    [5, 2, 3, 3], // White knight to d5
    [2, 2, 4, 3], // Black knight to d5
    [5, 5, 3, 3], // White queen captures knight
    [2, 5, 4, 3], // Black queen captures queen
    [4, 2, 3, 2], // White bishop captures queen
    [3, 2, 4, 3], // Black bishop captures bishop
    [7, 2, 5, 2], // White rook to c3
    [0, 2, 2, 2], // Black rook to c6
    [6, 0, 5, 0], // White pawn to a3
    [1, 7, 2, 7], // Black pawn to h6
  ]),
  new Test(
    "Test Castling",
    "Can't castle into check. Can't castle out of check. Can't castle through check. Can't castle if king or rook has moved.",
    [
      [6, 4, 4, 4],
      [1, 4, 3, 4],
      [6, 3, 4, 3],
      [1, 3, 3, 3],
      [7, 5, 4, 2],
      [1, 5, 3, 5],
      [4, 2, 3, 3],
      [0, 6, 2, 5],
      [7, 3, 5, 3],
      [0, 5, 3, 2],
      [4, 3, 3, 4],
      [0, 3, 3, 3],
      [5, 3, 3, 1],
      [0, 4, 0, 6, false], // Can't castle out of check
      [1, 2, 2, 2],
      [3, 1, 3, 2],
      [0, 4, 0, 6, false], // Can't castle through check
      [3, 3, 2, 3],
      [3, 2, 3, 3],
      [0, 4, 0, 6, false], // Can't castle if rook has moved
      [0, 7, 0, 6],
      [6, 0, 5, 0],
      [0, 6, 0, 7],
      [3, 3, 3, 2],
      [0, 4, 0, 6, false], // Can't castle into check
      [1, 1, 2, 1],
      [7, 6, 5, 5],
      [1, 0, 2, 0],
      [7, 4, 7, 6, true],
      // Below this is setup for testing if the king has moved
      [2, 0, 3, 0],
      [7, 5, 7, 3],
      [3, 0, 4, 0],
      [7, 3, 3, 3],
      [2, 1, 3, 1],
      [7, 2, 5, 4],
      [2, 3, 3, 2],
      [7, 1, 5, 2],
      [3, 2, 4, 2],
      [3, 3, 5, 3],
      [4, 2, 3, 2],
      [7, 6, 7, 5],
      [3, 2, 4, 2],
      [7, 5, 7, 4],
      [4, 2, 3, 2],
      [7, 4, 7, 2, false], // cant castle if king has moved
    ]
  ),
  new Test("En passant", "Can capture en passant", [
    [6, 4, 4, 4],
      [1, 0, 2, 0],
      [4, 4, 3, 4],
      [1, 3, 3, 3],
      [3, 4, 2, 3],
      [1, 2, 3, 2],
      [2, 3, 1, 3],
  ]),
];

export const games = [
  new Test("Game of the Century", "", [
    [7, 6, 5, 5, true],
    [0, 6, 2, 5, true],
    [6, 2, 4, 2],
    [1, 6, 2, 6],
    [7, 1, 5, 2],
    [0, 5, 1, 6],
    [6, 3, 4, 3],
    [0, 4, 0, 6],
    [7, 2, 4, 5],
    [1, 3, 3, 3],
    [7, 3, 5, 1],
    [3, 3, 4, 2],
    [5, 1, 4, 2],
    [1, 2, 2, 2],
    [6, 4, 4, 4],
    [0, 1, 1, 3],
    [7, 0, 7, 3],
    [1, 3, 2, 1],
    [4, 2, 3, 2],
    [0, 2, 4, 6],
    [4, 5, 3, 6],
    [2, 1, 4, 0],
    [3, 2, 5, 0],
    [4, 0, 5, 2],
    [6, 1, 5, 2],
    [2, 5, 4, 4],
    [3, 6, 1, 4],
    [0, 3, 2, 1],
    [7, 5, 4, 2],
    [4, 4, 5, 2],
    [1, 4, 3, 2],
    [0, 5, 0, 4],
    [7, 4, 7, 5],
    [4, 6, 2, 4],
    [3, 2, 2, 1],
    [2, 4, 4, 2],
    [7, 5, 7, 6],
    [5, 2, 6, 4],
    [7, 6, 7, 5],
    [6, 4, 4, 3],
    [7, 5, 7, 6],
    [4, 3, 6, 4],
    [7, 6, 7, 5],
    [6, 4, 5, 2],
    [7, 5, 7, 6],
    [1, 0, 2, 1],
    [5, 0, 4, 1],
    [0, 0, 4, 0],
    [4, 1, 2, 1],
    [5, 2, 7, 3],
    [6, 7, 5, 7],
    [4, 0, 6, 0],
    [7, 6, 6, 7],
    [7, 3, 6, 5],
    [7, 7, 7, 4],
    [0, 4, 7, 4],
    [2, 1, 0, 3],
    [1, 6, 0, 5],
    [5, 5, 7, 4],
    [4, 2, 3, 3],
    [7, 4, 5, 5],
    [6, 5, 4, 4],
    [0, 3, 0, 1],
    [1, 1, 3, 1],
    [5, 7, 4, 7],
    [1, 7, 3, 7],
    [5, 5, 3, 4],
    [0, 6, 1, 6],
    [6, 7, 7, 6],
    [0, 5, 3, 2],
    [7, 6, 7, 5],
    [4, 4, 5, 6],
    [7, 5, 7, 4],
    [3, 2, 4, 1],
    [7, 4, 7, 3],
    [3, 3, 5, 1],
    [7, 3, 7, 2],
    [5, 6, 6, 4],
    [7, 2, 7, 1],
    [6, 4, 5, 2],
    [7, 1, 7, 2],
    [6, 0, 6, 2],
  ]),

  new Test("King's Gambit", "", [
    [6, 4, 4, 4],
    [1, 4, 3, 4],
    [6, 5, 4, 5],
    [3, 4, 4, 5],
    [7, 6, 5, 5],
    [0, 5, 1, 4],
    [7, 5, 4, 2],
    [1, 4, 4, 7],
    [6, 6, 5, 6],
    [4, 5, 5, 6],
    [7, 4, 7, 6],
    [5, 6, 6, 7],
    [7, 6, 7, 7],
    [4, 7, 1, 4],
    [4, 2, 1, 5],
    [0, 4, 1, 5],
    [5, 5, 3, 4],
    [1, 5, 0, 4],
    [7, 3, 3, 7],
    [1, 6, 2, 6],
    [3, 4, 2, 6],
    [1, 7, 2, 6],
    [3, 7, 2, 6]
  ])
];

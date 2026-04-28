export class Barricade {
  constructor() {
    this.debugPathValidation = true;
    this.reset();
  }

  reset(mode = "1v1") {
    this.size = mode === "4p" ? 7 : 9;
    this.mode = mode;
    this.status = "Not started";
    this.moveIndex = 0;
    this.history = [];
    this.future = [];
    this.blockedEdges = new Set();
    this.edgeOwners = new Map();
    this.placedWalls = new Set();
    this.players = this.getPlayersForMode(mode);
    this.remainingWalls = {};
    this.positions = {};
    this.goals = {};

    const wallsPerPlayer = mode === "4p" ? 5 : 10;
    this.players.forEach((player) => {
      this.remainingWalls[player] = wallsPerPlayer;
    });

    if (mode === "4p") {
      const last = this.size - 1;
      this.positions = {
        red: { row: 0, col: 0 },
        blue: { row: 0, col: last },
        green: { row: last, col: last },
        yellow: { row: last, col: 0 },
      };
      this.goals = {
        red: { row: last, col: last },
        blue: { row: last, col: 0 },
        green: { row: 0, col: 0 },
        yellow: { row: 0, col: last },
      };
    } else {
      this.positions = {
        red: { row: 8, col: 4 },
        blue: { row: 0, col: 4 },
      };
      this.goals = {
        red: { row: 0, col: 4 },
        blue: { row: 8, col: 4 },
      };
    }
  }

  startGame() {
    this.status = "In progress";
  }

  getCurrentPlayer() {
    return this.players[this.moveIndex % this.players.length];
  }

  getPlayersForMode(mode) {
    return mode === "4p" ? ["red", "blue", "green", "yellow"] : ["red", "blue"];
  }

  inBounds(row, col) {
    return row >= 0 && row < this.size && col >= 0 && col < this.size;
  }

  edgeKey(r1, c1, r2, c2) {
    const a = `${r1},${c1}`;
    const b = `${r2},${c2}`;
    return a < b ? `${a}|${b}` : `${b}|${a}`;
  }

  isBlocked(r1, c1, r2, c2) {
    return this.blockedEdges.has(this.edgeKey(r1, c1, r2, c2));
  }

  setBlocked(r1, c1, r2, c2, blocked, owner = null) {
    const key = this.edgeKey(r1, c1, r2, c2);
    if (blocked) {
      this.blockedEdges.add(key);
      if (owner) {
        this.edgeOwners.set(key, owner);
      }
    } else {
      this.blockedEdges.delete(key);
      this.edgeOwners.delete(key);
    }
  }

  getAdjacentSquares(row, col) {
    return [
      { row: row - 1, col },
      { row: row + 1, col },
      { row, col: col - 1 },
      { row, col: col + 1 },
    ].filter((p) => this.inBounds(p.row, p.col));
  }

  isOccupied(row, col) {
    return Object.values(this.positions).some((p) => p.row === row && p.col === col);
  }

  getOccupant(row, col) {
    for (const player of this.players) {
      const pos = this.positions[player];
      if (pos.row === row && pos.col === col) {
        return player;
      }
    }
    return null;
  }

  getRedirectMoves(from, occupiedBy) {
    return this.getAdjacentSquares(occupiedBy.row, occupiedBy.col).filter((target) => {
      if (target.row === from.row && target.col === from.col) {
        return false;
      }
      if (this.isOccupied(target.row, target.col)) {
        return false;
      }
      return !this.isBlocked(occupiedBy.row, occupiedBy.col, target.row, target.col);
    });
  }

  getLegalPawnMoves(player) {
    const me = this.positions[player];
    const legal = [];

    for (const next of this.getAdjacentSquares(me.row, me.col)) {
      if (this.isBlocked(me.row, me.col, next.row, next.col)) {
        continue;
      }
      const occupant = this.getOccupant(next.row, next.col);
      if (occupant && occupant !== player) {
        const redirects = this.getRedirectMoves(me, this.positions[occupant]);
        legal.push(...redirects);
      } else {
        legal.push(next);
      }
    }

    const unique = new Map();
    for (const m of legal) {
      unique.set(`${m.row},${m.col}`, m);
    }
    return [...unique.values()];
  }

  canPlayerReachGoal(player) {
    const start = this.positions[player];
    const goal = this.goals[player];
    const queue = [start];
    const seen = new Set([`${start.row},${start.col}`]);
    let expandedNodes = 0;

    while (queue.length > 0) {
      const current = queue.shift();
      expandedNodes += 1;
      if (this.isAtGoal(player, current)) {
        return { hasPath: true, expandedNodes };
      }
      for (const next of this.getAdjacentSquares(current.row, current.col)) {
        const key = `${next.row},${next.col}`;
        if (seen.has(key)) {
          continue;
        }
        if (this.isBlocked(current.row, current.col, next.row, next.col)) {
          continue;
        }
        seen.add(key);
        queue.push(next);
      }
    }
    return { hasPath: false, expandedNodes };
  }

  canPlayerReachGoalDFS(player) {
    const start = this.positions[player];
    const stack = [start];
    const seen = new Set([`${start.row},${start.col}`]);
    let expandedNodes = 0;

    while (stack.length > 0) {
      const current = stack.pop();
      expandedNodes += 1;
      if (this.isAtGoal(player, current)) {
        return { hasPath: true, expandedNodes };
      }

      const adjacent = this.getAdjacentSquares(current.row, current.col);
      for (let i = adjacent.length - 1; i >= 0; i--) {
        const next = adjacent[i];
        const key = `${next.row},${next.col}`;
        if (seen.has(key)) {
          continue;
        }
        if (this.isBlocked(current.row, current.col, next.row, next.col)) {
          continue;
        }
        seen.add(key);
        stack.push(next);
      }
    }

    return { hasPath: false, expandedNodes };
  }

  canPlayerReachGoalBidirectionalBFS(player) {
    const start = this.positions[player];
    const forwardQueue = [start];
    const forwardSeen = new Set([`${start.row},${start.col}`]);
    let expandedNodes = 0;

    const goals = this.getGoalSquares(player);
    const backwardQueue = [...goals];
    const backwardSeen = new Set(goals.map((g) => `${g.row},${g.col}`));

    if (forwardQueue.some((n) => backwardSeen.has(`${n.row},${n.col}`))) {
      return { hasPath: true, expandedNodes };
    }

    while (forwardQueue.length > 0 && backwardQueue.length > 0) {
      const expandForward = forwardQueue.length <= backwardQueue.length;
      const queue = expandForward ? forwardQueue : backwardQueue;
      const current = queue.shift();
      expandedNodes += 1;
      const currentKey = `${current.row},${current.col}`;

      if (expandForward) {
        if (backwardSeen.has(currentKey)) {
          return { hasPath: true, expandedNodes };
        }
      } else if (forwardSeen.has(currentKey)) {
        return { hasPath: true, expandedNodes };
      }

      for (const next of this.getAdjacentSquares(current.row, current.col)) {
        if (this.isBlocked(current.row, current.col, next.row, next.col)) {
          continue;
        }
        const key = `${next.row},${next.col}`;
        const mySeen = expandForward ? forwardSeen : backwardSeen;
        const otherSeen = expandForward ? backwardSeen : forwardSeen;
        if (mySeen.has(key)) {
          continue;
        }
        mySeen.add(key);
        queue.push(next);
        if (otherSeen.has(key)) {
          return { hasPath: true, expandedNodes };
        }
      }
    }

    return { hasPath: false, expandedNodes };
  }

  isAtGoal(player, pos) {
    if (this.mode === "4p") {
      const goal = this.goals[player];
      return pos.row === goal.row && pos.col === goal.col;
    }
    if (player === "red") {
      return pos.row === 0;
    }
    return pos.row === this.size - 1;
  }

  getGoalSquares(player) {
    if (this.mode === "4p") {
      return [{ ...this.goals[player] }];
    }
    const targetRow = player === "red" ? 0 : this.size - 1;
    return Array.from({ length: this.size }, (_, col) => ({ row: targetRow, col }));
  }

  getWallSegments(orientation, row, col) {
    if (orientation === "h") {
      return [
        [{ row, col }, { row: row + 1, col }],
        [{ row, col: col + 1 }, { row: row + 1, col: col + 1 }],
      ];
    }
    return [
      [{ row, col }, { row, col: col + 1 }],
      [{ row: row + 1, col }, { row: row + 1, col: col + 1 }],
    ];
  }

  canPlaceWall(player, orientation, row, col) {
    if (this.remainingWalls[player] <= 0) {
      return false;
    }

    const wallKey = `${orientation}:${row},${col}`;
    if (this.placedWalls.has(wallKey)) {
      return false;
    }

    const crossWallKey = `${orientation === "h" ? "v" : "h"}:${row},${col}`;
    if (this.placedWalls.has(crossWallKey)) {
      return false;
    }

    if ((orientation !== "h" && orientation !== "v") || row < 0 || row >= this.size - 1 || col < 0 || col >= this.size - 1) {
      return false;
    }
    const segments = this.getWallSegments(orientation, row, col);

    for (const [from, to] of segments) {
      if (this.isBlocked(from.row, from.col, to.row, to.col)) {
        return false;
      }
    }

    for (const [from, to] of segments) {
      this.setBlocked(from.row, from.col, to.row, to.col, true);
    }

    const validation = [];
    let allHavePath = true;
    let totalExpanded = 0;
    for (const p of this.players) {
      const result = this.canPlayerReachGoalDFS(p);
      validation.push({ player: p, ...result });
      totalExpanded += result.expandedNodes;
      if (!result.hasPath) {
        allHavePath = false;
      }
    }

    for (const [from, to] of segments) {
      this.setBlocked(from.row, from.col, to.row, to.col, false);
    }

    if (this.debugPathValidation) {
      const workSummary = validation
        .map((r) => `${r.player}: path=${r.hasPath ? "yes" : "no"}, expanded=${r.expandedNodes}`)
        .join(" | ");
      console.log(
        `[PathValidation] wall ${orientation}@(${row},${col}) by ${player} => ${allHavePath ? "valid" : "invalid"}; totalExpanded=${totalExpanded}; ${workSummary}`
      );
    }

    return allHavePath;
  }

  executeAction(action) {
    const player = this.getCurrentPlayer();
    if (action.type === "move") {
      const legal = this.getLegalPawnMoves(player);
      const ok = legal.some((m) => m.row === action.to.row && m.col === action.to.col);
      if (!ok) {
        return false;
      }
      this.positions[player] = { row: action.to.row, col: action.to.col };
      return true;
    }

    if (action.type === "wall") {
      if (!this.canPlaceWall(player, action.orientation, action.row, action.col)) {
        return false;
      }
      const segments = this.getWallSegments(action.orientation, action.row, action.col);
      for (const [from, to] of segments) {
        this.setBlocked(from.row, from.col, to.row, to.col, true, player);
      }
      this.placedWalls.add(`${action.orientation}:${action.row},${action.col}`);
      this.remainingWalls[player] -= 1;
      return true;
    }
    return false;
  }

  executeActionAndUpdateState(action) {
    const snapshot = this.snapshot();
    const ok = this.executeAction(action);
    if (!ok) {
      return false;
    }
    this.history.push(snapshot);
    this.future = [];
    this.updateStatusAfterAction();
    if (this.status === "In progress") {
      this.moveIndex += 1;
    }
    return true;
  }

  updateStatusAfterAction() {
    for (const player of this.players) {
      const pos = this.positions[player];
      if (this.isAtGoal(player, pos)) {
        this.status = `Game over - ${player.charAt(0).toUpperCase()}${player.slice(1)} wins`;
        return;
      }
    }
    this.status = "In progress";
  }

  snapshot() {
    return {
      status: this.status,
      moveIndex: this.moveIndex,
      mode: this.mode,
      players: [...this.players],
      positions: JSON.parse(JSON.stringify(this.positions)),
      goals: JSON.parse(JSON.stringify(this.goals)),
      remainingWalls: JSON.parse(JSON.stringify(this.remainingWalls)),
      blockedEdges: [...this.blockedEdges],
      edgeOwners: [...this.edgeOwners.entries()],
      placedWalls: [...this.placedWalls],
    };
  }

  restore(snapshot) {
    this.status = snapshot.status;
    this.moveIndex = snapshot.moveIndex;
    this.mode = snapshot.mode || this.mode;
    this.players = snapshot.players || this.getPlayersForMode(this.mode);
    this.positions = JSON.parse(JSON.stringify(snapshot.positions));
    this.goals = JSON.parse(JSON.stringify(snapshot.goals || this.goals));
    this.remainingWalls = JSON.parse(JSON.stringify(snapshot.remainingWalls));
    this.blockedEdges = new Set(snapshot.blockedEdges);
    this.edgeOwners = new Map(snapshot.edgeOwners || []);
    this.placedWalls = new Set(snapshot.placedWalls || []);
  }

  goBackOneMove() {
    if (this.history.length === 0) {
      return;
    }
    const current = this.snapshot();
    const prev = this.history.pop();
    this.future.push(current);
    this.restore(prev);
  }

  goForwardOneMove() {
    if (this.future.length === 0) {
      return;
    }
    const current = this.snapshot();
    const next = this.future.pop();
    this.history.push(current);
    this.restore(next);
  }
}

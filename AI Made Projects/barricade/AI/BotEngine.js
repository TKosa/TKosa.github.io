import { Barricade } from "../Barricade.js";

export class BarricadeBot {
  static memoryRecommendationCache = new Map();

  constructor(level = "custom", options = {}) {
    this.weights = {
      dist: 120,
      walls: 10,
      mobility: 6,
      ...(options.weights || {}),
    };
    this.level = level;
    this.config = {
      maxDepth: 2,
      timeBudgetMs: 260,
      wallSampleLimit: 16,
      ...(options.config || {}),
    };
    this.valueModel = null;
    this.policyModel = null;
    this.tt = new Map();
    this.ttMaxEntries = options.ttMaxEntries || 200000;
    this.killers = [];
    this.aspirationWindow = options.aspirationWindow || 140;
  }

  setLevel(level, config) {
    this.level = level || this.level;
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  setWeights(weights = {}) {
    this.weights = {
      ...this.weights,
      ...weights,
    };
  }

  getWeights() {
    return { ...this.weights };
  }

  setValueModel(model) {
    this.valueModel = model || null;
  }

  setPolicyModel(model) {
    this.policyModel = model || null;
  }

  chooseAction(game, player) {
    const root = this.cloneGame(game);
    const legal = this.generateActions(root, player);
    if (legal.length === 0) {
      return null;
    }
    const cacheKey = this.getRecommendationCacheKey(root, player);
    const cachedAction = this.getCachedRecommendation(cacheKey);
    if (cachedAction && legal.some((a) => this.sameAction(a, cachedAction))) {
      return cachedAction;
    }

    const deadline = Date.now() + this.config.timeBudgetMs;
    let bestAction = legal[0];
    this.tt.clear();
    this.killers = [];

    let lastScore = 0;
    for (let depth = 1; depth <= this.config.maxDepth; depth++) {
      if (Date.now() >= deadline) {
        break;
      }
      let result;
      if (depth >= 3) {
        const window = this.aspirationWindow;
        let alpha = lastScore - window;
        let beta = lastScore + window;
        result = this.search(root, depth, alpha, beta, player, deadline, 0);
        if (result.score <= alpha || result.score >= beta) {
          result = this.search(root, depth, -Infinity, Infinity, player, deadline, 0);
        }
      } else {
        result = this.search(root, depth, -Infinity, Infinity, player, deadline, 0);
      }
      if (result.action) {
        bestAction = result.action;
      }
      lastScore = result.score;
    }
    this.setCachedRecommendation(cacheKey, bestAction);
    return bestAction;
  }

  search(state, depth, alpha, beta, perspectivePlayer, deadline, plyFromRoot) {
    if (Date.now() >= deadline || depth === 0 || state.status !== "In progress") {
      return { score: this.evaluate(state, perspectivePlayer), action: null };
    }

    const alphaOrig = alpha;
    const betaOrig = beta;
    const ttKey = this.getStateKey(state);
    const ttEntry = this.tt.get(ttKey);
    if (ttEntry && ttEntry.depth >= depth) {
      if (ttEntry.bound === "EXACT") {
        return { score: ttEntry.score, action: ttEntry.bestAction };
      }
      if (ttEntry.bound === "LOWER") {
        alpha = Math.max(alpha, ttEntry.score);
      } else if (ttEntry.bound === "UPPER") {
        beta = Math.min(beta, ttEntry.score);
      }
      if (alpha >= beta) {
        return { score: ttEntry.score, action: ttEntry.bestAction };
      }
    }

    const current = state.getCurrentPlayer();
    const actions = this.orderActions(
      state,
      current,
      this.generateActions(state, current),
      ttEntry?.bestAction,
      plyFromRoot
    );
    if (actions.length === 0) {
      return { score: this.evaluate(state, perspectivePlayer), action: null };
    }

    const maximizing = current === perspectivePlayer;
    let bestAction = null;
    let bestScore = maximizing ? -Infinity : Infinity;

    let searched = 0;
    for (const action of actions) {
      if (Date.now() >= deadline) {
        break;
      }
      const snapshot = this.applyActionInPlace(state, action);
      if (!snapshot) {
        continue;
      }
      let score;
      if (searched === 0) {
        score = this.search(state, depth - 1, alpha, beta, perspectivePlayer, deadline, plyFromRoot + 1).score;
      } else if (maximizing) {
        score = this.search(
          state,
          depth - 1,
          alpha,
          alpha + 1,
          perspectivePlayer,
          deadline,
          plyFromRoot + 1
        ).score;
        if (score > alpha && score < beta) {
          score = this.search(state, depth - 1, alpha, beta, perspectivePlayer, deadline, plyFromRoot + 1).score;
        }
      } else {
        score = this.search(
          state,
          depth - 1,
          beta - 1,
          beta,
          perspectivePlayer,
          deadline,
          plyFromRoot + 1
        ).score;
        if (score < beta && score > alpha) {
          score = this.search(state, depth - 1, alpha, beta, perspectivePlayer, deadline, plyFromRoot + 1).score;
        }
      }
      this.undoActionInPlace(state, snapshot);
      searched += 1;

      if (maximizing) {
        if (score > bestScore) {
          bestScore = score;
          bestAction = action;
        }
        alpha = Math.max(alpha, bestScore);
      } else {
        if (score < bestScore) {
          bestScore = score;
          bestAction = action;
        }
        beta = Math.min(beta, bestScore);
      }

      if (beta <= alpha) {
        this.addKiller(plyFromRoot, action);
        break;
      }
    }

    let bound = "EXACT";
    if (bestScore <= alphaOrig) {
      bound = "UPPER";
    } else if (bestScore >= betaOrig) {
      bound = "LOWER";
    }
    this.putTt(ttKey, { depth, score: bestScore, bound, bestAction });

    return { score: bestScore, action: bestAction };
  }

  generateActions(state, player) {
    const actions = state.getLegalPawnMoves(player).map((to) => ({ type: "move", to }));
    if (state.remainingWalls[player] > 0) {
      actions.push(...this.generateCandidateWalls(state, player));
    }
    return actions;
  }

  generateCandidateWalls(state, player) {
    const candidates = [];
    const opponent = state.players.find((p) => p !== player) || state.players[0];
    const myPath = state.getShortestPath(player);
    const oppPath = state.getShortestPath(opponent);
    const visited = new Set();
    const baseOppDist = state.getShortestDistance(opponent);
    const baseMyDist = state.getShortestDistance(player);

    const collectNearPath = (path) => {
      for (const tile of path) {
        for (let dr = -1; dr <= 0; dr++) {
          for (let dc = -1; dc <= 0; dc++) {
            const row = tile.row + dr;
            const col = tile.col + dc;
            if (row < 0 || row >= state.size - 1 || col < 0 || col >= state.size - 1) {
              continue;
            }
            for (const orientation of ["h", "v"]) {
              const key = `${orientation}:${row},${col}`;
              if (visited.has(key)) {
                continue;
              }
              visited.add(key);
              if (state.canPlaceWall(player, orientation, row, col)) {
                const action = { type: "wall", orientation, row, col };
                const snapshot = this.applyActionInPlace(state, action);
                if (!snapshot) {
                  continue;
                }
                const oppAfter = state.getShortestDistance(opponent);
                const myAfter = state.getShortestDistance(player);
                this.undoActionInPlace(state, snapshot);
                const deltaOpp = oppAfter - baseOppDist;
                const deltaMine = myAfter - baseMyDist;
                const score = deltaOpp * 3 - deltaMine;
                candidates.push({ ...action, _score: score });
              }
            }
          }
        }
      }
    };

    collectNearPath(oppPath);
    collectNearPath(myPath);
    candidates.sort((a, b) => (b._score || 0) - (a._score || 0));
    return candidates.slice(0, this.config.wallSampleLimit).map(({ _score, ...action }) => action);
  }

  evaluate(state, player) {
    const opponent = state.players.find((p) => p !== player) || state.players[0];
    if (state.status.startsWith("Game over")) {
      const winner = state.status.includes("Red wins")
        ? "red"
        : state.status.includes("Blue wins")
          ? "blue"
          : state.status.includes("Green wins")
            ? "green"
            : state.status.includes("Yellow wins")
              ? "yellow"
              : null;
      if (winner === player) {
        return 1_000_000;
      }
      if (winner === opponent) {
        return -1_000_000;
      }
    }

    if (this.policyModel) {
      const myBest = this.bestActionPolicyScore(state, player);
      const oppBest = this.bestActionPolicyScore(state, opponent);
      return (myBest - oppBest) * 500;
    }
    const features = this.extractFeatures(state, player);
    if (this.valueModel) {
      return this.forwardValue(features) * 1000;
    }
    const [myDist, oppDist, myWalls, oppWalls, myMobility, oppMobility] = features;

    return (
      (oppDist - myDist) * this.weights.dist +
      (myWalls - oppWalls) * this.weights.walls +
      (myMobility - oppMobility) * this.weights.mobility
    );
  }

  orderActions(state, player, actions, ttBestAction, plyFromRoot = 0) {
    const killers = this.killers[plyFromRoot] || [];
    const scored = actions.map((action) => {
      let s = 0;
      if (ttBestAction && this.sameAction(action, ttBestAction)) {
        s += 100000;
      }
      if (killers.length > 0) {
        if (killers[0] && this.sameAction(action, killers[0])) s += 12000;
        else if (killers[1] && this.sameAction(action, killers[1])) s += 9000;
      }
      if (action.type === "move") {
        const opponent = state.players.find((p) => p !== player) || state.players[0];
        const before = state.getShortestDistance(player) - state.getShortestDistance(opponent);
        const snapshot = this.applyActionInPlace(state, action);
        if (snapshot) {
          const after = state.getShortestDistance(player) - state.getShortestDistance(opponent);
          s += (before - after) * 200;
          this.undoActionInPlace(state, snapshot);
        }
      } else if (action.type === "wall") {
        s += 40;
      }
      if (this.policyModel) {
        s += this.forwardPolicy(this.extractActionFeatures(state, player, action)) * 25;
      }
      return { action, s };
    });
    scored.sort((a, b) => b.s - a.s);
    return scored.map((x) => x.action);
  }

  addKiller(plyFromRoot, action) {
    if (!action) return;
    const list = this.killers[plyFromRoot] || [];
    if (list.some((k) => this.sameAction(k, action))) {
      return;
    }
    this.killers[plyFromRoot] = [action, ...list].slice(0, 2);
  }

  getStateKey(state) {
    const toMove = state.getCurrentPlayer();
    const pos = state.players.map((p) => `${p}:${state.positions[p].row},${state.positions[p].col}`).join("|");
    const wallsLeft = state.players.map((p) => `${p}:${state.remainingWalls[p]}`).join("|");
    const placedWalls = [...state.placedWalls].sort().join(";");
    return `${state.mode}|${toMove}|${pos}|${wallsLeft}|${placedWalls}`;
  }

  putTt(key, entry) {
    if (this.tt.size >= this.ttMaxEntries) {
      const firstKey = this.tt.keys().next().value;
      if (firstKey !== undefined) {
        this.tt.delete(firstKey);
      }
    }
    this.tt.set(key, entry);
  }

  applyActionInPlace(state, action) {
    const snapshot = state.snapshot();
    const ok = state.executeAction(action);
    if (!ok) {
      return null;
    }
    state.updateStatusAfterAction();
    if (state.status === "In progress") {
      state.moveIndex += 1;
    }
    return snapshot;
  }

  undoActionInPlace(state, snapshot) {
    state.restore(snapshot);
  }

  sameAction(a, b) {
    if (!a || !b || a.type !== b.type) {
      return false;
    }
    if (a.type === "move") {
      return a.to.row === b.to.row && a.to.col === b.to.col;
    }
    return a.orientation === b.orientation && a.row === b.row && a.col === b.col;
  }

  bestActionPolicyScore(state, player) {
    const actions = this.generateActions(state, player);
    if (actions.length === 0) {
      return -1;
    }
    let best = -Infinity;
    for (const action of actions) {
      const x = this.extractActionFeatures(state, player, action);
      const score = this.forwardPolicy(x);
      if (score > best) {
        best = score;
      }
    }
    return best;
  }

  extractFeatures(state, player) {
    const opponent = state.players.find((p) => p !== player) || state.players[0];
    return [
      state.getShortestDistance(player),
      state.getShortestDistance(opponent),
      state.remainingWalls[player] || 0,
      state.remainingWalls[opponent] || 0,
      state.getLegalPawnMoves(player).length,
      state.getLegalPawnMoves(opponent).length,
    ];
  }

  forwardValue(features) {
    const model = this.valueModel;
    if (!model || !model.w1 || !model.b1 || !model.w2 || !model.b2) {
      return 0;
    }
    const hidden = new Array(model.b1.length).fill(0);
    for (let h = 0; h < hidden.length; h++) {
      let z = model.b1[h];
      for (let i = 0; i < features.length; i++) {
        z += features[i] * model.w1[i][h];
      }
      hidden[h] = z > 0 ? z : 0;
    }
    let out = model.b2[0];
    for (let h = 0; h < hidden.length; h++) {
      out += hidden[h] * model.w2[h][0];
    }
    return Math.tanh(out);
  }

  extractActionFeatures(state, player, action) {
    const base = this.extractFeatures(state, player).map((v, i) => {
      if (i < 2) return v / 20;
      if (i < 4) return v / 10;
      return v / 12;
    });
    const isMove = action.type === "move" ? 1 : 0;
    const isWall = action.type === "wall" ? 1 : 0;
    const row = (action.to?.row ?? action.row ?? 0) / Math.max(1, state.size - 1);
    const col = (action.to?.col ?? action.col ?? 0) / Math.max(1, state.size - 1);
    const orientH = action.orientation === "h" ? 1 : 0;
    const orientV = action.orientation === "v" ? 1 : 0;
    return [...base, isMove, isWall, row, col, orientH, orientV];
  }

  forwardPolicy(features) {
    const model = this.policyModel;
    if (!model || !model.w1 || !model.b1 || !model.w2 || !model.b2) {
      return 0;
    }
    const hidden = new Array(model.b1.length).fill(0);
    for (let h = 0; h < hidden.length; h++) {
      let z = model.b1[h];
      for (let i = 0; i < features.length; i++) {
        z += features[i] * model.w1[i][h];
      }
      hidden[h] = z > 0 ? z : 0;
    }
    let out = model.b2[0];
    for (let h = 0; h < hidden.length; h++) {
      out += hidden[h] * model.w2[h][0];
    }
    return out;
  }

  cloneGame(game) {
    const clone = new Barricade();
    clone.reset(game.mode);
    clone.restore(game.snapshot());
    clone.history = JSON.parse(JSON.stringify(game.history || []));
    clone.future = JSON.parse(JSON.stringify(game.future || []));
    return clone;
  }

  getRecommendationCacheKey(state, player) {
    return `${this.level}|${player}|${this.getStateKey(state)}`;
  }

  getLocalStorage() {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
    return null;
  }

  getCachedRecommendation(key) {
    const storage = this.getLocalStorage();
    if (storage) {
      try {
        const raw = storage.getItem(`barricade:rec:${key}`);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || !parsed.type) return null;
        return parsed;
      } catch {
        return null;
      }
    }
    return BarricadeBot.memoryRecommendationCache.get(key) || null;
  }

  setCachedRecommendation(key, action) {
    if (!action) return;
    const storage = this.getLocalStorage();
    if (storage) {
      try {
        storage.setItem(`barricade:rec:${key}`, JSON.stringify(action));
        return;
      } catch {
        // localStorage unavailable/full; fall through to memory cache
      }
    }
    BarricadeBot.memoryRecommendationCache.set(key, action);
  }
}

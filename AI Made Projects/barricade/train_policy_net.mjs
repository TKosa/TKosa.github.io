import fs from "node:fs";
import path from "node:path";
import { Barricade } from "./Barricade.js";
import { BarricadeBot } from "./BarricadeBot.js";

const minutes = Number(process.argv[2] || 10);
const deadline = Date.now() + minutes * 60 * 1000;
const outPath = path.resolve("./AI Made Projects/barricade/policy-net.json");

const INPUT = 12;
const HIDDEN = 40;
const LR = 0.0007;
const L2 = 0.00002;
const NEGATIVES = 4;

const model = {
  w1: Array.from({ length: INPUT }, () => Array.from({ length: HIDDEN }, () => (Math.random() * 2 - 1) * 0.05)),
  b1: Array.from({ length: HIDDEN }, () => 0),
  w2: Array.from({ length: HIDDEN }, () => [(Math.random() * 2 - 1) * 0.05]),
  b2: [0],
};

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}

function extractFeatures(state, player, action) {
  const opponent = state.players.find((p) => p !== player) || state.players[0];
  const myDist = state.getShortestDistance(player) / 20;
  const oppDist = state.getShortestDistance(opponent) / 20;
  const myWalls = (state.remainingWalls[player] || 0) / 10;
  const oppWalls = (state.remainingWalls[opponent] || 0) / 10;
  const myMob = state.getLegalPawnMoves(player).length / 12;
  const oppMob = state.getLegalPawnMoves(opponent).length / 12;
  const isMove = action.type === "move" ? 1 : 0;
  const isWall = action.type === "wall" ? 1 : 0;
  const row = (action.to?.row ?? action.row ?? 0) / Math.max(1, state.size - 1);
  const col = (action.to?.col ?? action.col ?? 0) / Math.max(1, state.size - 1);
  const orientH = action.orientation === "h" ? 1 : 0;
  const orientV = action.orientation === "v" ? 1 : 0;
  return [myDist, oppDist, myWalls, oppWalls, myMob, oppMob, isMove, isWall, row, col, orientH, orientV];
}

function forward(x) {
  const h = new Array(HIDDEN).fill(0);
  const a = new Array(HIDDEN).fill(0);
  for (let j = 0; j < HIDDEN; j++) {
    let z = model.b1[j];
    for (let i = 0; i < INPUT; i++) z += x[i] * model.w1[i][j];
    h[j] = z;
    a[j] = z > 0 ? z : 0;
  }
  let z2 = model.b2[0];
  for (let j = 0; j < HIDDEN; j++) z2 += a[j] * model.w2[j][0];
  return { h, a, z2 };
}

function trainOne(x, y) {
  const { h, a, z2 } = forward(x);
  const p = sigmoid(z2);
  const dLdz2 = (p - y);
  for (let j = 0; j < HIDDEN; j++) {
    const grad = dLdz2 * a[j] + L2 * model.w2[j][0];
    model.w2[j][0] -= LR * grad;
  }
  model.b2[0] -= LR * dLdz2;
  for (let j = 0; j < HIDDEN; j++) {
    const dRelu = h[j] > 0 ? 1 : 0;
    const dLdh = dLdz2 * model.w2[j][0] * dRelu;
    for (let i = 0; i < INPUT; i++) {
      const grad = dLdh * x[i] + L2 * model.w1[i][j];
      model.w1[i][j] -= LR * grad;
    }
    model.b1[j] -= LR * dLdh;
  }
  return -(y * Math.log(Math.max(1e-8, p)) + (1 - y) * Math.log(Math.max(1e-8, 1 - p)));
}

function generateActions(state, player) {
  const actions = state.getLegalPawnMoves(player).map((to) => ({ type: "move", to }));
  if ((state.remainingWalls[player] || 0) > 0) {
    const lim = state.size - 1;
    for (let r = 0; r < lim; r++) {
      for (let c = 0; c < lim; c++) {
        for (const o of ["h", "v"]) {
          if (state.canPlaceWall(player, o, r, c)) {
            actions.push({ type: "wall", orientation: o, row: r, col: c });
          }
        }
      }
    }
  }
  return actions;
}

function sameAction(a, b) {
  if (!a || !b || a.type !== b.type) return false;
  if (a.type === "move") return a.to.row === b.to.row && a.to.col === b.to.col;
  return a.orientation === b.orientation && a.row === b.row && a.col === b.col;
}

function sampleNegatives(actions, positive) {
  const others = actions.filter((a) => !sameAction(a, positive));
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  return others.slice(0, NEGATIVES);
}

let stop = false;
process.on("SIGINT", () => {
  stop = true;
});

let games = 0;
let samples = 0;
let loss = 0;
const hard = new BarricadeBot("hard");
let nextLog = Date.now() + 30000;

while (!stop && Date.now() < deadline) {
  const game = new Barricade();
  game.reset("1v1");
  game.startGame();
  let plies = 0;
  while (game.status === "In progress" && plies < 180) {
    const player = game.getCurrentPlayer();
    const actions = generateActions(game, player);
    if (actions.length === 0) break;
    const chosen = hard.chooseAction(game, player);
    if (!chosen) break;
    const posX = extractFeatures(game, player, chosen);
    loss += trainOne(posX, 1);
    samples += 1;
    for (const neg of sampleNegatives(actions, chosen)) {
      const negX = extractFeatures(game, player, neg);
      loss += trainOne(negX, 0);
      samples += 1;
    }
    if (!game.executeActionAndUpdateState(chosen)) break;
    plies += 1;
  }
  games += 1;
  if (Date.now() >= nextLog) {
    console.log(`games=${games} samples=${samples} avgLoss=${(loss / Math.max(1, samples)).toFixed(5)}`);
    nextLog = Date.now() + 30000;
  }
}

const payload = {
  trainedAt: new Date().toISOString(),
  minutes,
  architecture: { input: INPUT, hidden: HIDDEN, output: 1, objective: "hard-move-imitation-bce" },
  training: { games, samples, avgLoss: loss / Math.max(1, samples) },
  ...model,
};
fs.writeFileSync(outPath, JSON.stringify(payload), "utf8");
console.log(`Saved policy net: ${outPath}`);


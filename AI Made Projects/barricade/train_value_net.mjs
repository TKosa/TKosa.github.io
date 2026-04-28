import fs from "node:fs";
import path from "node:path";
import { Barricade } from "./Barricade.js";
import { BarricadeBot } from "./BarricadeBot.js";

const minutes = Number(process.argv[2] || 10);
const outPath = path.resolve("./AI Made Projects/barricade/value-net.json");
const deadline = Date.now() + minutes * 60 * 1000;

const INPUT = 6;
const HIDDEN = 32;
const LR = 0.0008;
const L2 = 0.00002;

function randn(scale = 0.05) {
  return (Math.random() * 2 - 1) * scale;
}

const model = {
  w1: Array.from({ length: INPUT }, () => Array.from({ length: HIDDEN }, () => randn())),
  b1: Array.from({ length: HIDDEN }, () => 0),
  w2: Array.from({ length: HIDDEN }, () => [randn()]),
  b2: [0],
};

function featuresFor(state, player) {
  const opponent = state.players.find((p) => p !== player) || state.players[0];
  return [
    state.getShortestDistance(player) / 20,
    state.getShortestDistance(opponent) / 20,
    (state.remainingWalls[player] || 0) / 10,
    (state.remainingWalls[opponent] || 0) / 10,
    state.getLegalPawnMoves(player).length / 12,
    state.getLegalPawnMoves(opponent).length / 12,
  ];
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
  const y = Math.tanh(z2);
  return { h, a, z2, y };
}

function backward(x, target) {
  const { h, a, z2, y } = forward(x);
  const lossGradY = 2 * (y - target);
  const dyDz2 = 1 - Math.tanh(z2) ** 2;
  const dLdz2 = lossGradY * dyDz2;

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
  return (y - target) ** 2;
}

function winnerFromStatus(status) {
  if (status.includes("Red wins")) return "red";
  if (status.includes("Blue wins")) return "blue";
  return null;
}

function playSelfGame(maxPlies = 180) {
  const game = new Barricade();
  game.reset("1v1");
  game.startGame();
  const red = new BarricadeBot("hard");
  const blue = new BarricadeBot("hard");
  const samples = [];

  let plies = 0;
  while (game.status === "In progress" && plies < maxPlies) {
    const p = game.getCurrentPlayer();
    samples.push({ x: featuresFor(game, p), player: p });
    const bot = p === "red" ? red : blue;
    const action = bot.chooseAction(game, p);
    if (!action || !game.executeActionAndUpdateState(action)) break;
    plies += 1;
  }
  const winner = winnerFromStatus(game.status);
  return { winner, samples };
}

let games = 0;
let steps = 0;
let lossAcc = 0;
let nextLog = Date.now() + 30000;

while (Date.now() < deadline) {
  const { winner, samples } = playSelfGame();
  games += 1;
  for (const s of samples) {
    const target = winner === null ? 0 : winner === s.player ? 1 : -1;
    lossAcc += backward(s.x, target);
    steps += 1;
  }
  if (Date.now() >= nextLog) {
    console.log(`games=${games} steps=${steps} avgLoss=${(lossAcc / Math.max(1, steps)).toFixed(5)}`);
    nextLog = Date.now() + 30000;
  }
}

const payload = {
  trainedAt: new Date().toISOString(),
  minutes,
  architecture: { input: INPUT, hidden: HIDDEN, output: 1, activation: "relu+tanh" },
  training: { games, steps, avgLoss: lossAcc / Math.max(1, steps) },
  ...model,
};
fs.writeFileSync(outPath, JSON.stringify(payload), "utf8");
console.log(`Saved value net: ${outPath}`);


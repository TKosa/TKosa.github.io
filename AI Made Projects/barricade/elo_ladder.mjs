import fs from "node:fs";
import path from "node:path";
import { Barricade } from "./Barricade.js";
import { createAiBot } from "./AI/index.js";

const GAMES = Number(process.argv[2] || 120);
const MODE = process.argv[3] || "all";
const K = 32;
const levels = ["ai1", "ai2", "ai3", "ai4", "ai5", "ai6"];
const activeLevels = MODE === "vs-medium"
  ? ["ai2", "ai5"]
  : MODE === "vs-hard"
    ? ["ai3", "ai6"]
    : MODE === "vs-ai5"
      ? ["ai5", "ai6"]
    : levels;
const ratings = Object.fromEntries(activeLevels.map((l) => [l, 1000]));
const SPEED_PROFILE = {
  ai1: { maxDepth: 1, timeBudgetMs: 35, wallSampleLimit: 8 },
  ai2: { maxDepth: 2, timeBudgetMs: 55, wallSampleLimit: 10 },
  ai3: { maxDepth: 2, timeBudgetMs: 80, wallSampleLimit: 14 },
  ai4: { maxDepth: 99, timeBudgetMs: 1500, wallSampleLimit: 24 },
  ai5: { maxDepth: 99, timeBudgetMs: 1500, wallSampleLimit: 24 },
  ai6: { maxDepth: 99, timeBudgetMs: 1500, wallSampleLimit: 28 },
};

const weightsPath = path.resolve("./AI Made Projects/barricade/bot-weights.json");
let hardPlusWeights = { dist: 129, walls: 7, mobility: 7 };
let hardPlusPolicyModel = null;
if (fs.existsSync(weightsPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(weightsPath, "utf8"));
    if (data?.bestWeights) {
      hardPlusWeights = {
        dist: Number(data.bestWeights.dist) || hardPlusWeights.dist,
        walls: Number(data.bestWeights.walls) || hardPlusWeights.walls,
        mobility: Number(data.bestWeights.mobility) || hardPlusWeights.mobility,
      };
    }
  } catch {
    // Use fallback
  }
}
const policyPath = path.resolve("./AI Made Projects/barricade/policy-net.json");
if (fs.existsSync(policyPath)) {
  try {
    const data = JSON.parse(fs.readFileSync(policyPath, "utf8"));
    if (data?.w1 && data?.b1 && data?.w2 && data?.b2) {
      hardPlusPolicyModel = data;
    }
  } catch {
    // no policy model
  }
}

function makeBot(level) {
  const bot = createAiBot(level, {
    hardPlusWeights,
    hardPlusPolicyModel: null,
    hardPlusValueModel: null,
    defaultWeights: { dist: 120, walls: 10, mobility: 6 },
  });
  bot.config = { ...bot.config, ...SPEED_PROFILE[level] };
  bot.setPolicyModel(null);
  return bot;
}

function pickTwoDistinct() {
  if (MODE === "vs-medium") {
    return ["ai2", "ai5"];
  }
  if (MODE === "vs-hard") {
    return ["ai3", "ai6"];
  }
  if (MODE === "vs-ai5") {
    return ["ai5", "ai6"];
  }
  const a = activeLevels[Math.floor(Math.random() * activeLevels.length)];
  let b = a;
  while (b === a) {
    b = activeLevels[Math.floor(Math.random() * activeLevels.length)];
  }
  return [a, b];
}

function expectedScore(ra, rb) {
  return 1 / (1 + 10 ** ((rb - ra) / 400));
}

function winnerFromStatus(status) {
  if (status.includes("Red wins")) return "red";
  if (status.includes("Blue wins")) return "blue";
  return null;
}

function playGame(redBot, blueBot, maxPlies = 220) {
  const game = new Barricade();
  game.reset("1v1");
  game.startGame();

  let plies = 0;
  while (game.status === "In progress" && plies < maxPlies) {
    const current = game.getCurrentPlayer();
    const bot = current === "red" ? redBot : blueBot;
    const action = bot.chooseAction(game, current);
    if (!action) {
      break;
    }
    if (!game.executeActionAndUpdateState(action)) {
      break;
    }
    plies += 1;
  }

  const winner = winnerFromStatus(game.status);
  if (winner) {
    return winner;
  }
  const redDist = game.getShortestDistance("red");
  const blueDist = game.getShortestDistance("blue");
  if (redDist < blueDist) return "red";
  if (blueDist < redDist) return "blue";
  return "draw";
}

for (let i = 1; i <= GAMES; i++) {
  const [a, b] = pickTwoDistinct();
  const aOnRed = Math.random() < 0.5;
  const redName = aOnRed ? a : b;
  const blueName = aOnRed ? b : a;
  const redBot = makeBot(redName);
  const blueBot = makeBot(blueName);

  const result = playGame(redBot, blueBot);
  const aScore = result === "draw" ? 0.5 : (result === (aOnRed ? "red" : "blue") ? 1 : 0);
  const bScore = 1 - aScore;
  const ea = expectedScore(ratings[a], ratings[b]);
  const eb = expectedScore(ratings[b], ratings[a]);
  ratings[a] += K * (aScore - ea);
  ratings[b] += K * (bScore - eb);

  console.log(
    `Game ${i}/${GAMES}: ${redName}(red) vs ${blueName}(blue) => ${result} | ${a}=${ratings[a].toFixed(1)} ${b}=${ratings[b].toFixed(1)}`
  );

  const partialTable = Object.entries(ratings)
    .map(([name, elo]) => ({ name, elo: Number(elo.toFixed(1)) }))
    .sort((x, y) => y.elo - x.elo);
  const partialOut = {
    generatedAt: new Date().toISOString(),
    gamesRequested: GAMES,
    gamesCompleted: i,
    kFactor: K,
    speedProfile: SPEED_PROFILE,
    hardPlusWeights,
    ratings: partialTable,
  };
  const outPath = path.resolve("./AI Made Projects/barricade/elo_results.json");
  fs.writeFileSync(outPath, JSON.stringify(partialOut, null, 2), "utf8");
}

const finalTable = Object.entries(ratings)
  .map(([name, elo]) => ({ name, elo: Number(elo.toFixed(1)) }))
  .sort((x, y) => y.elo - x.elo);

const output = {
  generatedAt: new Date().toISOString(),
  games: GAMES,
  kFactor: K,
  speedProfile: SPEED_PROFILE,
  hardPlusWeights,
  ratings: finalTable,
};

const outPath = path.resolve("./AI Made Projects/barricade/elo_results.json");
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");
console.log("\nFinal ratings:");
for (const row of finalTable) {
  console.log(`${row.name}: ${row.elo}`);
}
console.log(`Saved: ${outPath}`);

import fs from "node:fs";
import path from "node:path";
import { Barricade } from "./Barricade.js";
import { BarricadeBot } from "./BarricadeBot.js";

const args = process.argv.slice(2);
const getArg = (name, fallback) => {
  const idx = args.indexOf(name);
  if (idx === -1 || idx + 1 >= args.length) {
    return fallback;
  }
  return args[idx + 1];
};

const minutes = Number(getArg("--minutes", "1"));
const checkpointEverySec = Number(getArg("--checkpoint-every", "15"));
const outPath = getArg("--out", path.resolve("./AI Made Projects/barricade/bot-weights.json"));

const seedWeights = { dist: 120, walls: 10, mobility: 6 };
const BOUNDS = {
  dist: [50, 220],
  walls: [0, 35],
  mobility: [0, 22],
};
const GAMES_PER_CANDIDATE = Number(getArg("--games-per-candidate", "24"));
let bestWeights = { ...seedWeights };
let bestScore = 0;
let evalCount = 0;
let gamesPlayed = 0;

let stopRequested = false;
process.on("SIGINT", () => {
  stopRequested = true;
  console.log("\nStop requested. Saving checkpoint...");
});

const deadline = Date.now() + Math.max(1, minutes) * 60 * 1000;
let nextCheckpointAt = Date.now() + checkpointEverySec * 1000;

function jitter(value, scale) {
  const delta = (Math.random() * 2 - 1) * scale;
  return value + delta;
}

function mutateWeights(w) {
  const clamp = (name, v) => Math.max(BOUNDS[name][0], Math.min(BOUNDS[name][1], Math.round(v)));
  return {
    dist: clamp("dist", jitter(w.dist, 16)),
    walls: clamp("walls", jitter(w.walls, 3)),
    mobility: clamp("mobility", jitter(w.mobility, 2)),
  };
}

function winnerFromStatus(status) {
  if (status.includes("Red wins")) return "red";
  if (status.includes("Blue wins")) return "blue";
  return null;
}

function playGame(redWeights, blueWeights, maxPlies = 180) {
  const game = new Barricade();
  game.reset("1v1");
  game.startGame();
  const redBot = new BarricadeBot("medium", { weights: redWeights });
  const blueBot = new BarricadeBot("medium", { weights: blueWeights });

  let plies = 0;
  while (game.status === "In progress" && plies < maxPlies) {
    const current = game.getCurrentPlayer();
    const bot = current === "red" ? redBot : blueBot;
    const action = bot.chooseAction(game, current);
    if (!action) {
      break;
    }
    const ok = game.executeActionAndUpdateState(action);
    if (!ok) {
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

function evaluateAgainstChampion(candidateWeights, championWeights) {
  let points = 0;
  for (let i = 0; i < GAMES_PER_CANDIDATE; i++) {
    const candidateOnRed = i % 2 === 0;
    const result = candidateOnRed
      ? playGame(candidateWeights, championWeights)
      : playGame(championWeights, candidateWeights);
    gamesPlayed += 1;
    if (result === "draw") {
      points += 0.5;
      continue;
    }
    if (candidateOnRed) {
      if (result === "red") points += 1;
    } else if (result === "blue") {
      points += 1;
    }
  }
  return points / GAMES_PER_CANDIDATE;
}

function saveCheckpoint(final = false) {
  const payload = {
    trainedAt: new Date().toISOString(),
    final,
    minutesRequested: minutes,
    evalCount,
    gamesPlayed,
    bestScore,
    bestWeights,
    seedWeights,
    bounds: BOUNDS,
    gamesPerCandidate: GAMES_PER_CANDIDATE,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`${final ? "Final" : "Checkpoint"} saved -> ${outPath}`);
}

console.log(`Training start: ${minutes} minute(s), output: ${outPath}`);

while (!stopRequested && Date.now() < deadline) {
  const candidate = mutateWeights(bestWeights);
  const score = evaluateAgainstChampion(candidate, bestWeights);
  evalCount += 1;
  if (score > bestScore) {
    bestScore = score;
    bestWeights = candidate;
    console.log(`Improved: winRate=${bestScore.toFixed(3)}, weights=${JSON.stringify(bestWeights)}`);
  }

  if (Date.now() >= nextCheckpointAt) {
    saveCheckpoint(false);
    nextCheckpointAt = Date.now() + checkpointEverySec * 1000;
  }
}

saveCheckpoint(true);
console.log(`Done. evals=${evalCount}, games=${gamesPlayed}, best=${JSON.stringify(bestWeights)}, winRate=${bestScore.toFixed(3)}`);

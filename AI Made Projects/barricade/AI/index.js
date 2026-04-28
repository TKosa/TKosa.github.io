import { BarricadeBot } from "./BotEngine.js";
import * as ai1 from "./ai1.js";
import * as ai2 from "./ai2.js";
import * as ai3 from "./ai3.js";
import * as ai4 from "./ai4.js";
import * as ai5 from "./ai5.js";
import * as ai6 from "./ai6.js";

export const AI_REGISTRY = {
  [ai1.AI_LEVEL]: ai1,
  [ai2.AI_LEVEL]: ai2,
  [ai3.AI_LEVEL]: ai3,
  [ai4.AI_LEVEL]: ai4,
  [ai5.AI_LEVEL]: ai5,
  [ai6.AI_LEVEL]: ai6,
};

export function createAiBot(level, options = {}) {
  const spec = AI_REGISTRY[level] || ai2;
  const bot = new BarricadeBot(spec.AI_LEVEL, {
    config: spec.AI_CONFIG,
    ...(spec.AI_TWEAKS || {}),
  });

  if (spec.AI_LEVEL === "ai4") {
    bot.setWeights(options.hardPlusWeights || { dist: 129, walls: 7, mobility: 7 });
    bot.setValueModel(options.hardPlusValueModel || null);
    bot.setPolicyModel(options.hardPlusPolicyModel || null);
  } else {
    bot.setWeights(options.defaultWeights || { dist: 120, walls: 10, mobility: 6 });
    bot.setValueModel(null);
    bot.setPolicyModel(null);
  }

  return bot;
}

# AI6 Tuning Log

## 2026-04-28 Baseline Reset
- `ai6` set to match `ai5` (`maxDepth 99`, `1500ms`, `wallSampleLimit 24`, no extra tweaks).
- Match: `node "AI Made Projects/barricade/elo_ladder.mjs" 30 vs-ai5`
- Result: `ai6 1019.6`, `ai5 980.4` (ai6 `+39.2`)

## 2026-04-28 Round 1 (TT size only)
- Change: `AI_TWEAKS = { ttMaxEntries: 300000 }`
- Match: `node "AI Made Projects/barricade/elo_ladder.mjs" 30 vs-ai5`
- Result: `ai6 998.7`, `ai5 1001.3` (ai6 `-2.6`)
- Verdict: reject

## 2026-04-28 Round 2 (Aspiration window only)
- Change: `AI_TWEAKS = { aspirationWindow: 160 }`
- Match: `node "AI Made Projects/barricade/elo_ladder.mjs" 30 vs-ai5`
- Result: `ai6 1029.4`, `ai5 970.6` (ai6 `+58.8`)
- Verdict: keep (current)


# Hard+ Experiments

## 2026-04-28 Round 1 (baseline)
- Benchmark: `node "AI Made Projects/barricade/elo_ladder.mjs" 20 vs-hard`
- Result: `hardplus 1074.0`, `hard 926.0` (delta `+148.0`)
- Notes: current engine used TT + move ordering + 1500ms search budget.

## 2026-04-28 Round 2 (PVS + aspiration windows)
- Change:
  - Added aspiration windows in iterative deepening from depth 3+ (re-search on fail-high/low).
  - Added principal variation search (null-window probes for non-first moves with re-search on window hit).
- Benchmark: `node "AI Made Projects/barricade/elo_ladder.mjs" 20 vs-hard`
- Result: `hardplus 1165.4`, `hard 834.6` (delta `+330.8`)
- Outcome: strong positive; keep this change.

## 2026-04-28 Round 3 (fork to hard++)
- Change:
  - Added `hardplusplus` as experimental branch.
  - Kept `hardplus` intact.
  - UI now includes `Opponent: AI Hard++`.
  - Elo harness `vs-hard` now compares `hard` vs `hardplusplus`.
- Benchmark: `node "AI Made Projects/barricade/elo_ladder.mjs" 20 vs-hard`
- Result: `hardplusplus 1165.4`, `hard 834.6` (delta `+330.8`)
- Outcome: fork baseline established.

## 2026-04-28 Round 4 (killer move ordering)
- Change:
  - Added per-ply killer moves in search, with ordering bonuses and updates on beta cutoffs.
- Benchmark: `node "AI Made Projects/barricade/elo_ladder.mjs" 20 vs-hard`
- Result: `hardplusplus 1165.4`, `hard 834.6` (delta `+330.8`)
- Outcome: neutral in this sample; keep for now, but mark as unproven benefit.


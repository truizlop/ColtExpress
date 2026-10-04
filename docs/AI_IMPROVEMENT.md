# Second-generation AI research

The user reported on 2026-10-04 that the released AI was easy to beat. This work treats that report as evidence that the original scripted-opponent benchmark was insufficient. No human-strength claim is made.

## Audit findings

- The original aggregate was helped considerably by the two-player team variant. New development comparisons emphasize 3–6 players and report the team variant separately.
- Original population training used roughly 65% current learners, with only a small fraction of past-model opponents. A past model could change on every decision. The new stable league selects an opponent and temperature for the whole game and retains permanent anchors plus a longer checkpoint history.
- The original feature representation omitted explicit destinations for some interactions and truncated the queue at 32 cards. Feature v2 canonicalizes seats, represents up to 64 queue entries, adds forecast board positions, explicit punch/marshal destinations, public inventory information and remaining-hand follow-up values.
- The original network compressed state to 64 units and joint action interactions to 32. The v2 model uses two 128-unit state layers, a 64-unit action encoder, 128/64-unit joint layers, and value/action-value heads.
- Original terminal-reward PPO used discount 0.995 and trace 0.95. The control tests longer credit assignment (discount 1, trace 0.98). V2 adds Monte Carlo value supervision, an auxiliary action-value head, per-table-size advantage normalization, KL monitoring/stopping and a small terminal score-share component.
- Original Legend considered only three policy-ranked actions. The new planner samples every candidate (up to 16) before pruning, uses paired hidden worlds, and keeps coherent opponent styles within a rollout. Search options are compared before selecting a release.

## Experiments underway

1. **Longer-training control:** 262,144 additional games, existing width-64 model, stable league, longer credit assignment, 16 checkpoint opponents and permanent prior-model anchors.
2. **Larger initialization:** 5,120 games distilling the previous model into feature v2; this is initialization, not evidence of strength improvement.
3. **Main v2 PPO:** scheduled 393,216 games, width 128, stable learned-opponent league including a separate short-combination planning opponent.
4. **Planning comparisons:** old Legend, wider old search, and paired-world planning with different sample/opponent/value settings, using a fixed development suite.
5. **Hardware comparison:** a four-iteration MPS run was slower than CPU for this simulator-driven workload. CPU remains the selected training device. A dtype failure found in the first GPU smoke run was repaired and parity then passed.

The first 120-game mixed-league development check gave the released policy 24.17% winning share and released Legend 35.00%, versus a 23.75% equal-strength reference. These small development runs guide experiments; they are not final holdouts or human results.

## Process improvements

`training/arena.ts` records setup seeds, seats, opponent lineups, player-count results, scores, wasted programmed actions, draws and latency. It supports direct matches against the previous release policy and its actual Legend search. Evaluation policies stay fixed within each game.

`training/train_v2.py` records losses, entropy, approximate KL, clipping fraction, gradient norms, value explained variance and learner outcomes. Checkpoints retain optimizer state, training counters and random states. Each new run preserves its trainer source and bundled simulator with SHA-256 provenance; the frozen simulator is used throughout that run and on restore.

`experiments/v2/plan.json` separates development, selection and final-holdout seed ranges. The previous release is frozen in `experiments/v2/models/express64-release.json`. Source and numeric export parity, information-boundary regressions, complete-game tests and browser latency are release gates. Final model and difficulty changes will be selected from measured results, not training loss alone.

## Research references and scope

[PPO](https://arxiv.org/abs/1707.06347) supplies the clipped on-policy objective. [AlphaStar's league research](https://deepmind.google/blog/alphastar-grandmaster-level-in-starcraft-ii-using-multi-agent-reinforcement-learning/) motivates maintaining diverse opponents rather than relying on self-play alone. [Recent work on advantage variance](https://arxiv.org/abs/2605.19235) motivates a separate optional action-value-trace experiment. This implementation uses observation-only critics and does **not** claim to reproduce centralized VRPO, solve an equilibrium or establish human superiority.

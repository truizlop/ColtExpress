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

## Reproducibility gates completed

The CPU restoration test compares a three-iteration uninterrupted run with one iteration followed by checkpoint restoration. Final weights are identical (maximum difference zero), as are game and decision counts. `experiments/v2/resume-parity.json` records the result. The larger initialization passes 200 PyTorch/JavaScript comparisons, including 100 legal observations from all player counts and multiple game phases; maximum error is below 0.000006.

An exact seed audit includes all configured future training iterations and completed search-data games. The selection and final holdout seed ranges were moved above the planned main run before either was used. These planned-seed counts describe leakage checks, not completed training work.

Sparse feature multiplication and a shared state projection accelerate inference without changing the order of nonzero additions. Across 202 real game positions, optimized outputs are exactly identical to the original arithmetic. Median encoded-inference speedups on this host are 2.16× for v2 and 2.66× for v1. A separate PyTorch comparison passes 200 probes with maximum absolute error below 0.000008. This is inference timing, not an end-to-end search speedup.

Long tournaments save atomic progress snapshots and reject resumption if source, model hashes or configuration differ. A 20-game interrupted/resumed tournament produces identical game records and summary statistics to an uninterrupted run. The new rotating lineup balances opponent types across seats and table sizes; the initial development suite retains its original fixed lineup for fair checkpoint comparisons.

## Early development results

All entries below use the same 120-game 3–6-player mixed league. Winning shares include fractional credit for ties. They are provisional, without independent confirmation.

| Candidate | Winning share | Mean decision latency |
| --- | ---: | ---: |
| Released policy | 24.17% | 0.12 ms |
| Released Legend (8 worlds, top 3) | 35.00% | 40 ms |
| Wider legacy search (12 worlds, top 7) | 37.50% | 93 ms |
| New planner (12 worlds, mixed opponents) | 46.25% | 69 ms |
| New planner (24 worlds, 20% material heuristic) | 44.17% | See raw result |
| Larger initialization | 27.50% | 0.55 ms |
| Main v2 PPO, iteration 128 | 30.83% | 0.59 ms |
| Action-value trace, iteration 128 | 26.67% | 0.57 ms |
| Longer-training control, iteration 512 | 29.17% | 0.14 ms |

The paired 95% bootstrap interval for the 12-world planner's 11.25-percentage-point development advantage over old Legend is approximately −0.8 to +23.3 points. It remains provisional. Independent selection and holdout results must establish the release claim.

The planner changes decisions in roughly 28% of collected training positions. A separate search-distillation experiment will test whether its stronger choices can improve the fast network. The action-value-trace experiment stops at iteration 128 for evaluation; it is not assumed better than ordinary GAE.

## Research references and scope

[PPO](https://arxiv.org/abs/1707.06347) supplies the clipped on-policy objective. [AlphaStar's league research](https://deepmind.google/blog/alphastar-grandmaster-level-in-starcraft-ii-using-multi-agent-reinforcement-learning/) motivates maintaining diverse opponents rather than relying on self-play alone. [Recent work on advantage variance](https://arxiv.org/abs/2605.19235) motivates a separate optional action-value-trace experiment. This implementation uses observation-only critics and does **not** claim to reproduce centralized VRPO, solve an equilibrium or establish human superiority.

## Subsequent experiments

The v2 iteration-128 model with 12-world planning achieved 49.17% on the initial development league; using the compact release model for rollouts achieved 45.00% at lower latency. The iteration-256 fast policy regressed to 25.00%, so the newest checkpoint is not automatically selected.

The first search-distillation dataset contains 10,000 positions from 196 games. Both soft targets and a hard-choice/value-preservation variant failed to improve the parent on the development league. Those branches are rejected at this stage. This small pilot also sampled expert rules only for one table size; it is not a balanced expert-training dataset.

A separate planning-league branch starts from v2 iteration 128 with a lower learning rate, lower entropy coefficient, fewer current learners and a small fraction of genuine four-world planning opponents. The smoke run completed eight legal games containing planning opponents and passed export parity. The branch is evaluated every 64 iterations.

At iteration 256 the main run was continued with the optimized simulator, retaining optimizer and random state. Before this change, 256 full league games and 19,544 learner decisions were compared between the frozen and optimized bridges; observations, opponent decisions and terminal results matched exactly. The continuation records both simulator hashes and its parent checkpoint. Its cumulative counters include the first 256 iterations and must not be double-counted.

Independent selection uses 240 standard and 120 expert games against the actual previous Legend. The final, untouched protocol reserves 480 standard, 240 expert and 120 team games, reported separately. Main table sizes receive balanced seat counts. Confidence intervals and complete per-game records accompany release evaluation.

# AI improvement experiments

The second training campaign began after a human found the released opponent easy to beat. Its purpose is stronger play against a wider opposition, with independent selection and final testing. Additional training is measured as computation, not evidence of human strength.

## What changed

The v2 network receives 1,280 observation features and 192 features per legal action. It encodes destinations, targets, follow-up hand value, the full supported queue, schedule and public forecasts. The state branch is 128→128, the action branch 64, and the joint branch 128→64, with separate policy, value and action-value outputs. No real hidden hands, hidden purse values or future random seed enter the network.

The new planner samples paired hidden worlds for every candidate (up to 16), initially tests each four times, then allocates the remaining worlds to four finalists. Policy and action-value rankings shortlist larger action sets. Within each world, an opponent keeps one style: neural policy, tactical or aggressive. Rollouts stop at the observer's first decision in the next round; the learned value estimates the continuation. Full-game rollouts, more worlds, compact-model rollouts and heuristic blending were separately measured. This is root sampled-world planning, not a full IS-MCTS tree or AlphaZero.

Training uses a stable per-game opponent league with immutable historical anchors and a bounded checkpoint pool. The v2 PPO objective uses gamma 1, GAE lambda 0.98, clipping 0.2, gradient clipping 0.5, three epochs and 512-example minibatches. Advantages are normalized separately by player count. Rewards combine 90% winning credit with 10% softmax of final scores (temperature $500). KL monitoring can stop an update early. A separate experiment recalibrates only the value head at near-greedy behavior temperature; its policy and shared encoder are frozen.

## Reproduce training

Use the installation instructions in [TRAINING.md](TRAINING.md). The exact configurations and completed iteration counts are archived in `experiments/v2/training/`; their configured maximum schedules can exceed the deliberate stopping point. Keep the original `iterations` value to preserve its learning-rate schedule and use `--stop-after` to reproduce a shorter run.

```sh
pnpm ai:build

# Initialize the richer representation using the frozen previous policy.
.venv/bin/python training/train_v2.py --mode distill --width 128 \
  --iterations 80 --batch 64 --threads 2 --seed 704791 --lr .0003 --lr-final .00015 \
  --teacher experiments/v2/models/express64-release.json \
  --save-every 20 --output training/runs/v2-distill

# Larger-policy PPO. A checkpoint is produced every 16,384 games.
.venv/bin/python training/train_v2.py --mode ppo --width 128 \
  --iterations 3072 --stop-after 512 --batch 128 --threads 2 --seed 904791 \
  --lr .00015 --lr-final .000025 --entropy .025 --gae-lambda .98 \
  --score-mix .1 --strategist-fraction .15 --save-every 128 \
  --anchor experiments/v2/models/express64-release.json experiments/models/express32.json \
  --resume training/runs/v2-distill/distill-00080.pt --output training/runs/v2-main

# Calibrate the value head while preserving the earlier policy exactly.
.venv/bin/python training/train_v2.py --mode ppo --width 128 \
  --iterations 512 --stop-after 128 --batch 128 --threads 1 --seed 1665791 \
  --lr .0004 --lr-final .00005 --value-only --behavior-temperature .08 \
  --entropy 0 --gae-lambda 1 --score-mix .1 --save-every 64 \
  --strategist-fraction .15 \
  --anchor experiments/v2/models/express64-release.json experiments/models/express32.json \
  --resume training/runs/v2-main/ppo-00128.pt --output training/runs/v2-value-calibration
```

The main run was continued at iteration 256 using an optimized inference bridge. A 256-game, 19,544-decision trajectory comparison proved identical actions, observations and rewards before this upgrade. The continuation's cumulative counts include those first 256 iterations; they must not be added twice.

`--resume` alone starts a new fine-tuning run. For v2, adding `--restore` restores optimizer state, random generators, league pool, counters and history and validates the configuration. Each run freezes its bundled simulator and records source hashes and runtime provenance. The trainer source is preserved for audit; exact continuation still requires a compatible trainer implementation. CPU interrupted/uninterrupted verification produced identical weights. The legacy v1 control retains weights-only resume semantics.

```sh
.venv/bin/python training/verify_resume.py
.venv/bin/python training/verify_arena_resume.py
.venv/bin/python training/test_targets.py
.venv/bin/python training/seed_audit.py
.venv/bin/python training/verify_export.py CHECKPOINT.pt public/models/champion.json \
  --out experiments/v2/export-parity.json
```

Export verification compares 100 synthetic probes and 100 real legal observations across 2–6 players, including policy, value and action-value outputs. Inference optimizations are checked against the previous arithmetic, not merely against legal move production.

## Evaluate and select

[plan.json](../experiments/v2/plan.json) reserved development, selection and final seed families before selection began. The audit enumerates configured training seeds and search-data seeds for collisions. Its planned seed count is not the number of completed training games.

Development compares checkpoints on a fixed mixed league and investigates planner budgets, learning objectives, temperatures, weight averaging and search distillation. These results are selected on and have substantial uncertainty. They are unsuitable as the final strength claim.

Independent selection fills every other seat with the exact previously released Legend policy: the frozen Express64 network with eight worlds and three candidates. It uses 240 standard and 120 expert games. The final protocol uses new seeds for 480 standard 3–6-player games, 240 expert games and 120 two-player team games. The selected weights and settings are frozen before those final games, and are not tuned to their outcomes.

```sh
node --import tsx training/arena.ts CONFIG.json
# Same games and seats, partitioned by player count for parallel execution.
.venv/bin/python training/arena_sharded.py CONFIG.json --output-dir SHARD_DIRECTORY --jobs 4
.venv/bin/python training/analyze_v2.py REPORT.json --output ANALYSIS.json
# Paired comparisons require matching seed, seat, opponents and rule variant.
.venv/bin/python training/analyze_v2.py CANDIDATE.json --reference REFERENCE.json --output DELTA.json
```

Arena results retain each game seed, table size, seat, scores, fractional winning credit and action diagnostics. Interrupted jobs resume only with identical source/model hashes and configuration. Parallel sharding was verified against 30 sequential games across every supported player count. Confidence intervals use 20,000 bootstrap resamples within player-count strata. The two-player variant is reported separately because its high win rate inflated the earlier aggregate against a tactical baseline.

## Limits

Hidden-world sampling remains approximate and does not infer opponents' private intentions from a learned recurrent belief. Value estimates can fail against unfamiliar human strategies. The search budget is deliberately bounded for a browser worker. Engine tournaments depend on rules correctness and a finite opponent population. No human trial, exploitability bound or claim of beating every human is supplied by this campaign.

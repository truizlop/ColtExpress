# Training and evaluation

The game uses PyTorch for local training, a shared TypeScript rules engine for simulation, and exported JSON weights for JavaScript inference in a Web Worker. It runs entirely on static GitHub Pages: no model service or API key is needed.

## Install

Use Node 22+ and pnpm 11.19. The recorded experiments used Python 3.12, CPU PyTorch and an Apple M1 Max with 64 GB RAM. Runtime versions and source hashes are recorded with each new run.

```sh
pnpm install --frozen-lockfile
pnpm ai:build
python3 -m venv .venv
.venv/bin/python -m pip install -r training/requirements.txt
# Plotting and Python formatting tools:
.venv/bin/python -m pip install -r training/requirements-dev.txt
```

The committed browser model is sufficient to play. Python is only needed for training, verification and statistical analysis. Large checkpoints and raw run directories stay in ignored `training/runs/`; selected weights, experiment configurations, completed metrics and per-game evidence are retained in `experiments/`.

## Current model and experiments

[TRAINING_V2.md](TRAINING_V2.md) documents the richer policy/value network, stable opponent league, broader sampled-world planner, value calibration, exact continuation checks, seed isolation and independent selection protocol. The [model card](../MODEL_CARD.md) describes the shipped model and measured limits.

```sh
pnpm test
pnpm build
.venv/bin/python training/test_targets.py
.venv/bin/python training/verify_resume.py
.venv/bin/python training/verify_arena_resume.py
.venv/bin/python training/seed_audit.py
# Requires the selected local PyTorch checkpoint:
.venv/bin/python training/verify_export.py CHECKPOINT.pt public/models/champion.json \
  --out experiments/v2/export-parity.json
# Run after other CPU-heavy jobs finish:
node --import tsx training/benchmark_difficulty.ts
```

The frozen release tournament is reproduced with `training/benchmark_v2.py`; it verifies model and source hashes before running. Checkpoint development curves are generated with `training/plot_v2.py`. `training/archive_v2.py` preserves completed evidence and counts continuation games only once. Arena configurations can be replayed with `training/arena.ts`, or partitioned by player count using `training/arena_sharded.py`; the latter preserves every original seed and seat.

## Architecture rationale

Colt Express has hidden hands and purse values, random draws, a programmed action queue and several competing players. Direct full-state AlphaZero search would reveal information that a player cannot see. This implementation borrows policy/value learning while enforcing an observation boundary and sampling possible hidden worlds. Population PPO is practical for local experiments and static browser deployment; it is not claimed to be the optimal architecture.

The policy is feedforward with explicit tactical features, not tabula-rasa learning. The planner is root information-set Monte Carlo planning, not full IS-MCTS. Belief-aware recurrent policies and stronger independent opponent populations remain potential research directions. No engine tournament establishes superiority to every human.

Background: [AlphaZero](https://arxiv.org/abs/1712.01815), [PPO](https://arxiv.org/abs/1707.06347), [Information Set Monte Carlo Tree Search](https://eprints.whiterose.ac.uk/id/eprint/75048/).

## Historical release

The original six-run Express64 campaign and 199,680 training games are documented in [TRAINING_V1.md](TRAINING_V1.md), with results under the original `experiments/` paths. Those counts and results are distinct from the second campaign. Historical difficulty settings must not be silently replaced when reproducing its benchmarks.

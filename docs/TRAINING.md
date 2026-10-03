# Training and evaluation

## Architecture choice

Colt Express has hidden hands and purse values, a shared programmed action queue, random setup and draws, and up to six competing players. A conventional AlphaZero state search would expose information the player cannot see. Its policy/value-learning idea remains useful, but a practical implementation needs an observation boundary and sampling of unknown information.

This project uses a small policy/value network, imitation initialization, population PPO self-play, and optional information-set Monte Carlo planning. It uses the **same TypeScript rules engine** in the browser and Node training process. Python/PyTorch batches policy decisions; exported JSON weights run inside a browser Web Worker. There is no paid inference API or backend. This was chosen for fast local experimentation and entirely static GitHub Pages deployment.

The network has a 576-feature observation branch (32 or 64 tanh units), a 64-feature legal-action branch (24 tanh units), a joint 32-unit layer and scalar action score. A separate state-value head predicts discounted winning share. Illegal actions never enter the choice set. Features include visible positions, loot counts, own hand, powers, events, the first 32 queue entries, and approximate tactical forecasts. This is a feedforward network with hand-designed features, not tabula-rasa AlphaZero. It does not learn a complete hidden-state belief or recurrent memory.

Legend samples eight possible hidden worlds, compares up to three policy-ranked actions, rolls each forward using the policy until the next round's first decision for that player, and evaluates the resulting observation with the learned value head. Terminal worlds use the exact result with a small score-based tie-break. All rollouts use the acting player's observation. Uniform hidden-card/loot beliefs are approximate. This is root information-set Monte Carlo search, **not** a full IS-MCTS tree or an equilibrium solver. Longer tactical rollouts were measured and rejected because they were slower and did not improve aggregate strength.

Background: [AlphaZero](https://arxiv.org/abs/1712.01815), [PPO](https://arxiv.org/abs/1707.06347), and [Information Set Monte Carlo Tree Search](https://eprints.whiterose.ac.uk/id/eprint/75048/). A recurrent policy with a learned belief model and stronger opponent league is a sensible next research step; these experiments do not establish an optimal architecture or human-level performance.

## Install

Node 22 or newer, pnpm 11.19, Python 3.12. The measured runs used an Apple M1 Max, 64 GB RAM, CPU PyTorch with two threads per process. MPS is supported but was not used for the reported results.

```sh
pnpm install --frozen-lockfile
pnpm ai:build
python3 -m venv .venv
.venv/bin/python -m pip install -r training/requirements.txt
```

The Node bridge is bundled through esbuild's JavaScript API. Model weights are enough to play; Python is only required to train or reproduce the tournament. All runs write to ignored `training/runs/` directories. `config.json`, metrics, JSON weights and PyTorch checkpoints are saved by new runs. Checkpoints contain network weights; resuming starts a new optimizer and counters, so it is a new fine-tuning run rather than an exact interrupted-run continuation.

## Experiment recipe

Imitation visits complete games using a stochastic tactical teacher, with a higher exploration temperature every fourth iteration. PPO trains on terminal winning share (ties split), GAE with gamma 0.995 and lambda 0.95, clipping 0.2, entropy regularization, three epochs per batch, 512-example minibatches and gradient norm clipping at 0.5. Opponents mix current learners, tactical/greedy/aggressive policies and previous checkpoints. Player counts are sampled from 2–6; 15% of eligible games use expert decks.

The following recipe exposes all relevant choices and recreates the experiment families. The original pre-config-logging runs retain seed, width, games, metrics and exported weights in the local run directory; their summary and curves are committed in `experiments/`. Floating-point libraries and hardware can change exact trajectories.

```sh
# Two imitation initializations, 3,840 games each.
.venv/bin/python training/train.py --mode imitation --width 32 --iterations 80 --batch 48 --threads 2 --seed 1701 --save-every 20 --output training/runs/imitation-w32
.venv/bin/python training/train.py --mode imitation --width 64 --iterations 80 --batch 48 --threads 2 --seed 1701 --save-every 20 --output training/runs/imitation-w64

# Two independent 32,000-game population PPO runs.
.venv/bin/python training/train.py --mode ppo --width 32 --iterations 500 --batch 64 --threads 2 --seed 4711 --lr .0001 --save-every 50 --resume training/runs/imitation-w32/imitation-0080.pt --output training/runs/ppo-conservative
.venv/bin/python training/train.py --mode ppo --width 32 --iterations 500 --batch 64 --threads 2 --seed 8917 --lr .0003 --save-every 50 --resume training/runs/imitation-w32/imitation-0080.pt --output training/runs/ppo-exploratory

# Two longer runs, 64,000 games each, seeded with previous opponents.
.venv/bin/python training/train.py --mode ppo --width 64 --iterations 1000 --batch 64 --threads 2 --seed 24719 --lr .0003 --lr-final .00005 --save-every 100 --resume training/runs/imitation-w64/imitation-0080.pt --pool training/runs/ppo-exploratory/ppo-0300.json training/runs/ppo-conservative/ppo-0200.json --output training/runs/ppo-w64
.venv/bin/python training/train.py --mode ppo --width 32 --iterations 1000 --batch 64 --threads 2 --seed 34719 --lr .00008 --lr-final .00002 --entropy .03 --save-every 100 --resume training/runs/ppo-exploratory/ppo-0300.pt --pool training/runs/ppo-exploratory/ppo-0300.json training/runs/ppo-conservative/ppo-0200.json --output training/runs/ppo-refined
```

## Evaluate

For report plots and code formatting, install `training/requirements-dev.txt`. After the tournament, run `.venv/bin/python training/analyze.py` to rebuild the summary and figure.

The evaluator cycles player counts and seats, randomizes characters through seeded setup, and gives every AI only legal observations. Winning share is 1 for a sole win and 1/k for a k-way tie. The equal-strength reference averages 1/player-count; it is 29% for an equally weighted 2–6-player mix. Reported Wilson intervals are approximate because ties are fractional. Release analysis additionally bootstraps within player-count strata.

```sh
# Policy-only validation, deliberately separate from holdout seeds.
pnpm ai:evaluate --candidate training/runs/ppo-w64/ppo-0900.json --opponent tactical --games 600 --seed 401200001 --out training/runs/validation.json

# Exact browser difficulty implementation.
pnpm ai:evaluate --candidate public/models/champion.json --opponent tactical --difficulty legend --games 300 --seed 1700000001 --out training/runs/check.json

# Expert decks, excluding the two-player variant.
pnpm ai:evaluate --candidate public/models/champion.json --opponent tactical --difficulty legend --players 3,4,5,6 --expert true --games 480 --seed 1830000001 --out training/runs/expert.json

# Reproduce the frozen release tournament; requires only Python stdlib and Node.
python3 training/benchmark.py --workers 4

# Verify the selected checkpoint against browser inference on 100 numeric probes.
.venv/bin/python training/verify_export.py training/runs/ppo-w64/ppo-0900.pt public/models/champion.json
```

`experiments/protocol.json` records the frozen model SHA-256 and every holdout job. The benchmark refuses a different model. These seeds are beyond every training and selection seed; the network and Legend search were not tuned against these results. The initial temperature-only Bandit setting proved as strong as Outlaw, so Bandit was calibrated to add 15% mistakes and evaluated on three fresh seed blocks. The original calibration records are retained. Results include all game seeds and scores. Different opponent behavior can change action paths, so pairing identical setup seeds does not imply identical later random events.

Greenhorn combines temperature 1.5 with 30% random legal choices. Bandit uses temperature 0.5 with 15% random legal choices. Outlaw uses temperature 0.08. Legend uses the neural planning procedure above. The same functions are used in benchmarks and the app. Difficulty never grants access to opponents' hidden hands or future cards.

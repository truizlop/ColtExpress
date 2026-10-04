"""Check optimized and frozen simulators follow identical training trajectories."""

import json
from pathlib import Path

import numpy as np
from train import Bridge

old = Bridge("node", "training/runs/v2-main/bridge-source.mjs")
new = Bridge("node", "training/bridge.mjs")
rng = np.random.default_rng(87231)
steps = rows = games = 0
try:
    pool = {
        "cmd": "pool",
        "paths": [
            "experiments/v2/models/express64-release.json",
            "training/runs/v2-main/ppo-00128.json",
            "experiments/models/express32.json",
        ],
    }
    assert old.send(pool) == new.send(pool)
    for seed in [683101, 173473, 933170, 519923]:
        command = {
            "cmd": "start",
            "batch": 64,
            "seed": seed,
            "mode": "ppo",
            "league": "stable",
            "learnerFraction": 0.5,
            "strategistFraction": 0.15,
            "featureVersion": 2,
        }
        a, b = old.send(command), new.send(command)
        while True:
            assert a == b, f"Simulator divergence at seed {seed}, step {steps}"
            steps += 1
            games += len(a["completed"])
            rows += len(a["rows"])
            if not a["rows"]:
                break
            command = {
                "cmd": "step",
                "choices": [
                    [r["env"], int(rng.integers(len(r["actions"])))] for r in a["rows"]
                ],
            }
            a, b = old.send(command), new.send(command)
finally:
    old.close()
    new.close()
report = {
    "identical_trajectories": True,
    "games": games,
    "learner_decisions": rows,
    "bridge_steps": steps,
    "scope": "Frozen main-run simulator versus optimized inference, with a mixed past-model league and identical externally supplied learner choices",
}
Path("experiments/v2/bridge-upgrade-parity.json").write_text(
    json.dumps(report, indent=2)
)
print(json.dumps(report, indent=2))

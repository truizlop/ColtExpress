"""Verify a checkpoint against browser weights on random and real legal observations."""

import argparse
import json
from pathlib import Path

import numpy as np
import torch
from train import Bridge, Policy
from train_v2 import PolicyV2

parser = argparse.ArgumentParser()
parser.add_argument("checkpoint")
parser.add_argument("model")
parser.add_argument("--node", default="node")
parser.add_argument("--out", default="experiments/export-parity.json")
args = parser.parse_args()
torch.set_num_threads(2)
model = json.loads(Path(args.model).read_text())
saved = torch.load(args.checkpoint, map_location="cpu", weights_only=True)
net = (PolicyV2 if model["featureVersion"] == 2 else Policy)(saved["width"])
net.load_state_dict(saved["state_dict"])
net.eval()
bridge = Bridge(args.node)
rng = np.random.default_rng(20261003)
error = 0.0
phases = set()
try:
    probes = [
        {
            "state": rng.uniform(-1, 1, model["stateDim"]).astype(np.float32).tolist(),
            "actions": rng.uniform(-1, 1, (13, model["actionDim"]))
            .astype(np.float32)
            .tolist(),
        }
        for _ in range(100)
    ]
    natural = bridge.send(
        {
            "cmd": "probes",
            "seed": 88127,
            "featureVersion": model["featureVersion"],
            "perPlayerCount": 20,
        }
    )["observations"]
    probes += natural
    for probe in probes:
        if "phase" in probe:
            phases.add(probe["phase"])
        state = np.asarray(probe["state"], dtype=np.float32)
        actions = np.asarray(probe["actions"], dtype=np.float32)
        observed = bridge.send(
            {
                "cmd": "parity",
                "path": str(Path(args.model).resolve()),
                "state": state.tolist(),
                "actions": actions.tolist(),
            }
        )
        with torch.no_grad():
            output = net(
                torch.from_numpy(state[None]),
                torch.from_numpy(actions[None]),
                torch.ones((1, len(actions)), dtype=torch.bool),
            )
        error = max(
            error,
            float(np.max(np.abs(output[0].numpy()[0] - observed["logits"]))),
            abs(float(output[1]) - observed["value"]),
        )
        if len(output) > 2:
            error = max(
                error, float(np.max(np.abs(output[2].numpy()[0] - observed["qs"])))
            )
finally:
    bridge.close()
report = {
    "checkpoint": args.checkpoint,
    "model": args.model,
    "probes": len(probes),
    "random_probes": 100,
    "legal_game_probes": len(natural),
    "phases": sorted(phases),
    "player_counts": [2, 3, 4, 5, 6],
    "maximum_absolute_error": error,
    "tolerance": 1e-4,
    "passed": error < 1e-4,
}
Path(args.out).parent.mkdir(parents=True, exist_ok=True)
Path(args.out).write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
if not report["passed"]:
    raise RuntimeError("Export parity failed")

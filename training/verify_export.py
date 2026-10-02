"""Verify a selected PyTorch checkpoint against the exact browser JSON weights."""

import argparse
import json
from pathlib import Path

import numpy as np
import torch
from train import ACTION_DIM, STATE_DIM, Bridge, Policy

parser = argparse.ArgumentParser()
parser.add_argument("checkpoint")
parser.add_argument("model")
parser.add_argument("--node", default="node")
parser.add_argument("--out", default="experiments/export-parity.json")
args = parser.parse_args()
torch.set_num_threads(2)
saved = torch.load(args.checkpoint, map_location="cpu", weights_only=True)
net = Policy(saved["width"])
net.load_state_dict(saved["state_dict"])
net.eval()
bridge = Bridge(args.node)
rng = np.random.default_rng(20261003)
error = 0.0
try:
    for _ in range(100):
        state = rng.uniform(-1, 1, STATE_DIM).astype(np.float32)
        actions = rng.uniform(-1, 1, (13, ACTION_DIM)).astype(np.float32)
        observed = bridge.send(
            {
                "cmd": "parity",
                "path": str(Path(args.model).resolve()),
                "state": state.tolist(),
                "actions": actions.tolist(),
            }
        )
        with torch.no_grad():
            logits, value = net(
                torch.from_numpy(state[None]),
                torch.from_numpy(actions[None]),
                torch.ones((1, 13), dtype=torch.bool),
            )
        error = max(
            error,
            float(np.max(np.abs(logits.numpy()[0] - observed["logits"]))),
            abs(float(value) - observed["value"]),
        )
finally:
    bridge.close()
report = {
    "checkpoint": args.checkpoint,
    "model": args.model,
    "probes": 100,
    "maximum_absolute_error": error,
    "tolerance": 1e-4,
    "passed": error < 1e-4,
}
Path(args.out).write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
if not report["passed"]:
    raise RuntimeError("Export parity failed.")

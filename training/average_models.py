"""Evaluate parameter averages along one training trajectory; never average unrelated initializations."""

import argparse
import hashlib
from pathlib import Path

import torch
from train import Policy
from train_v2 import PolicyV2

p = argparse.ArgumentParser()
p.add_argument("checkpoints", nargs="+")
p.add_argument("--output", required=True)
a = p.parse_args()
torch.set_num_threads(2)
parents = [
    torch.load(path, map_location="cpu", weights_only=True) for path in a.checkpoints
]
seeds = {x["config"]["seed"] for x in parents}
if len(seeds) != 1:
    raise ValueError("Checkpoint averaging requires a shared training seed/trajectory")
state = parents[0]["state_dict"]
if any(
    x["state_dict"].keys() != state.keys() or x["width"] != parents[0]["width"]
    for x in parents
):
    raise ValueError("Incompatible checkpoint architectures")
net = (PolicyV2 if "state2.weight" in state else Policy)(parents[0]["width"])
net.load_state_dict(
    {
        name: torch.stack([x["state_dict"][name] for x in parents]).mean(0)
        for name in state
    }
)
steps = max(x["steps"] for x in parents)
metadata = {
    "algorithm": "same-trajectory-checkpoint-average",
    "scoreMix": parents[0]["config"].get("score_mix", 0.1),
    "parents": [
        {"path": path, "sha256": hashlib.sha256(Path(path).read_bytes()).hexdigest()}
        for path in a.checkpoints
    ],
    "human_evaluation": False,
}
output = Path(a.output)
output.parent.mkdir(parents=True, exist_ok=True)
net.export(output.with_suffix(".json"), steps, output.name, metadata)
torch.save(
    {
        "state_dict": net.state_dict(),
        "width": parents[0]["width"],
        "steps": steps,
        "metadata": metadata,
    },
    output.with_suffix(".pt"),
)
print(output.with_suffix(".json"))

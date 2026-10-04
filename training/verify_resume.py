"""Integration gate: interrupted CPU league training must match uninterrupted weights."""

import json
import subprocess
import sys
from pathlib import Path

import torch

root = Path(__file__).resolve().parents[1]
out = root / "training/runs/v2-resume-check"
out.mkdir(exist_ok=True)
common = [
    sys.executable,
    str(root / "training/train_v2.py"),
    "--mode",
    "ppo",
    "--iterations",
    "3",
    "--batch",
    "4",
    "--players",
    "3",
    "--width",
    "128",
    "--threads",
    "1",
    "--seed",
    "887331",
    "--lr",
    ".0001",
    "--lr-final",
    ".0001",
    "--save-every",
    "1",
    "--anchor",
    "experiments/v2/models/express64-release.json",
]
initial = "training/runs/v2-distill/distill-00080.pt"
commands = [
    common + ["--resume", initial, "--output", str(out / "whole")],
    common + ["--resume", initial, "--stop-after", "1", "--output", str(out / "split")],
    common
    + [
        "--resume",
        str(out / "split/ppo-00001.pt"),
        "--restore",
        "--output",
        str(out / "split"),
    ],
]
for i, command in enumerate(commands):
    with (out / f"part-{i}.log").open("w") as log:
        subprocess.run(
            command, cwd=root, stdout=log, stderr=subprocess.STDOUT, check=True
        )
a = torch.load(out / "whole/ppo-00003.pt", weights_only=True, map_location="cpu")
b = torch.load(out / "split/ppo-00003.pt", weights_only=True, map_location="cpu")
error = max(
    float((a["state_dict"][k] - b["state_dict"][k]).abs().max())
    for k in a["state_dict"]
)
report = {
    "maximum_weight_difference": error,
    "exact_match": error == 0,
    "decisions_match": a["steps"] == b["steps"],
    "games_match": a["games"] == b["games"],
    "iterations": 3,
    "batch": 4,
    "device": "cpu",
}
(out / "result.json").write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
if not all(report[k] for k in ["exact_match", "decisions_match", "games_match"]):
    raise RuntimeError("Resume equivalence failed")

"""Evaluate immutable checkpoints on the development suite as training produces them."""

import argparse
import json
import subprocess
import time
from pathlib import Path

root = Path(__file__).resolve().parents[1]
p = argparse.ArgumentParser()
p.add_argument("--hours", type=float, default=12)
p.add_argument("--node", default="node")
p.add_argument(
    "--runs", nargs="+", default=["v2-control", "v2-main", "v2-qtrace", "v2-main-fast"]
)
p.add_argument("--planner-worlds", type=int, default=0)
p.add_argument("--rollout-model")
args = p.parse_args()
base = json.loads(
    (root / "training/runs/v2-arena/release-policy-config.json").read_text()
)
out = root / "training/runs/v2-checkpoints"
out.mkdir(exist_ok=True)
start = time.time()
while time.time() - start < args.hours * 3600:
    found = False
    for run in args.runs:
        for model in sorted((root / "training/runs" / run).glob("ppo-*.json")):
            step = int(model.stem.split("-")[1])
            if run == "v2-control" and step % 256:
                continue
            name = f"{run}-{model.stem}" + (
                f"-plan{args.planner_worlds}" if args.planner_worlds else ""
            )
            result = out / f"{name}.json"
            if result.exists():
                continue
            config = {
                **base,
                "name": name,
                "candidate": {"name": name, "model": str(model.relative_to(root))},
                "output": str(result),
            }
            if args.planner_worlds:
                config["candidate"]["planner"] = {
                    "worlds": args.planner_worlds,
                    "warmup": min(4, args.planner_worlds),
                    "finalists": 4,
                    "opponents": "mixed",
                }
                if args.rollout_model:
                    config["candidate"]["rolloutModel"] = args.rollout_model
            cfg = out / f"{name}-config.json"
            cfg.write_text(json.dumps(config, indent=2))
            with (out / f"{name}.log").open("w") as log:
                subprocess.run(
                    [args.node, "--import", "tsx", "training/arena.ts", str(cfg)],
                    cwd=root,
                    stdout=log,
                    stderr=subprocess.STDOUT,
                    check=True,
                )
            report = json.loads(result.read_text())
            print(
                json.dumps(
                    {
                        "name": name,
                        **report["overall"],
                        "latency_ms": report["latency"]["mean"],
                    }
                ),
                flush=True,
            )
            found = True
    if not found:
        time.sleep(10)

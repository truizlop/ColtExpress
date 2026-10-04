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
args = p.parse_args()
base = json.loads(
    (root / "training/runs/v2-arena/release-policy-config.json").read_text()
)
out = root / "training/runs/v2-checkpoints"
out.mkdir(exist_ok=True)
start = time.time()
while time.time() - start < args.hours * 3600:
    found = False
    for run in ["v2-control", "v2-main", "v2-qtrace"]:
        for model in sorted((root / "training/runs" / run).glob("ppo-*.json")):
            step = int(model.stem.split("-")[1])
            if run == "v2-control" and step % 256:
                continue
            name = f"{run}-{model.stem}"
            result = out / f"{name}.json"
            if result.exists():
                continue
            config = {
                **base,
                "name": name,
                "candidate": {"name": name, "model": str(model.relative_to(root))},
                "output": str(result),
            }
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

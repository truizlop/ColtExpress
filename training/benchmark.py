"""Replay the frozen release tournament; each job uses the same browser policy code."""

import argparse
import concurrent.futures
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run(job, model, node):
    destination = ROOT / "experiments/results" / (job["name"] + ".json")
    args = [
        node,
        "--import",
        "tsx",
        "training/evaluate.ts",
        "--candidate",
        model,
        "--opponent",
        job["opponent"],
        "--difficulty",
        job["difficulty"],
        "--games",
        str(job["games"]),
        "--seed",
        str(job["seed"]),
        "--out",
        str(destination),
    ]
    if "bandit_mistakes" in job:
        args += ["--bandit-mistakes", str(job["bandit_mistakes"])]
    if "players" in job:
        args += ["--players", job["players"]]
    if job.get("expert"):
        args += ["--expert", "true"]
    with (ROOT / "training/runs" / (job["name"] + ".log")).open("w") as log:
        subprocess.run(args, cwd=ROOT, stdout=log, stderr=log, check=True)
    result = json.loads(destination.read_text())
    print(job["name"], result["overall"], flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--workers", type=int, default=4)
    parser.add_argument("--node", default="node")
    args = parser.parse_args()
    protocol = json.loads((ROOT / "experiments/protocol.json").read_text())
    model = protocol["model"]
    actual = hashlib.sha256((ROOT / model).read_bytes()).hexdigest()
    if actual != protocol["sha256"]:
        raise RuntimeError("Model differs from the frozen holdout protocol.")
    (ROOT / "training/runs").mkdir(parents=True, exist_ok=True)
    (ROOT / "experiments/results").mkdir(parents=True, exist_ok=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(run, job, model, args.node) for job in protocol["jobs"]]
        for future in concurrent.futures.as_completed(futures):
            future.result()

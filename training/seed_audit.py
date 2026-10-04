"""Check exact game-seed disjointness, including all planned training iterations."""

import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
training = set()
runs = []
for cfg in (root / "training/runs").glob("*/config.json"):
    c = json.loads(cfg.read_text())
    if not all(k in c for k in ["seed", "iterations", "batch"]):
        continue
    runs.append(str(cfg.parent.relative_to(root)))
    training.update(
        (c["seed"] + i * 1000003 + j * 7919) & 0xFFFFFFFF
        for i in range(c["iterations"])
        for j in range(c["batch"])
    )
datasets = []
for manifest in (root / "training/runs").glob("*/manifest.json"):
    c = json.loads(manifest.read_text())
    if "targetPositions" not in c or "seed" not in c:
        continue
    progress = manifest.parent / "complete.json"
    if not progress.exists():
        progress = manifest.parent / "progress.json"
    completed = json.loads(progress.read_text())["games"] if progress.exists() else 0
    games = completed + int(not (manifest.parent / "complete.json").exists())
    training.update((c["seed"] + i * 31337) & 0xFFFFFFFF for i in range(games))
    datasets.append({"path": str(manifest.parent.relative_to(root)), "games": games})
# The earliest experiments predated config snapshots.
for c in json.loads((root / "experiments/training-summary.json").read_text()):
    batch = c["games"] // c["iterations"]
    training.update(
        (c["seed"] + i * 1000003 + j * 7919) & 0xFFFFFFFF
        for i in range(c["iterations"])
        for j in range(batch)
    )
plan = json.loads((root / "experiments/v2/plan.json").read_text())
checks = {}
for phase in ["development", "selection", "final_holdout"]:
    seeds = {
        (base + i * 31337) & 0xFFFFFFFF
        for base in plan[f"{phase}_seeds"]
        for i in range(2000)
    }
    overlap = sorted(training & seeds)
    checks[phase] = {
        "reserved_evaluation_seeds": len(seeds),
        "training_collisions": overlap,
    }
report = {
    "unique_planned_training_seeds": len(training),
    "training_runs": runs,
    "search_datasets": datasets,
    "checks": checks,
    "passed": all(not c["training_collisions"] for c in checks.values()),
}
(root / "experiments/v2/seed-audit.json").write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
if not report["passed"]:
    raise RuntimeError("Training/evaluation seed collision")

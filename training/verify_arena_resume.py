"""Verify interrupted and uninterrupted arenas produce identical game records."""

import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
out = root / "training/runs/v2-arena-resume"
out.mkdir(parents=True, exist_ok=True)
base = {
    "candidate": {
        "name": "released",
        "model": "experiments/v2/models/express64-release.json",
    },
    "opponents": [
        {"name": "tactical", "baseline": "tactical"},
        {"name": "aggressive", "baseline": "aggressive"},
    ],
    "players": [2, 3, 4, 5, 6],
    "games": 20,
    "seed": 93214,
    "lineup": "rotating",
}
for name in ["full", "resumed"]:
    config = out / f"{name}-config.json"
    config.write_text(
        json.dumps(
            {**base, "name": name, "output": str(out / f"{name}.json")}, indent=2
        )
    )
    command = ["node", "--import", "tsx", "training/arena.ts", str(config)]
    with (out / f"{name}.log").open("w") as log:
        if name == "resumed":
            subprocess.run(
                command + ["--stop-after", "7"],
                cwd=root,
                stdout=log,
                stderr=log,
                check=True,
            )
            partial = json.loads((out / f"{name}.json.partial.json").read_text())
            assert len(partial["records"]) == 7
        subprocess.run(command, cwd=root, stdout=log, stderr=log, check=True)
full, resumed = [
    json.loads((out / f"{name}.json").read_text()) for name in ["full", "resumed"]
]
report = {
    "games": 20,
    "stop_after": 7,
    "identical_records": full["records"] == resumed["records"],
    "identical_overall": full["overall"] == resumed["overall"],
    "latency_excluded": True,
}
(out / "result.json").write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
assert report["identical_records"] and report["identical_overall"]

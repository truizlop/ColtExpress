"""Preserve completed AI-improvement evidence without copying checkpoints or partial jobs."""

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "experiments/v2"
RUNS = ROOT / "training/runs"


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2) + "\n")


def main():
    runs = []
    # main-fast includes the original main trajectory; count it only once.
    for name in [
        "v2-distill",
        "v2-main-fast",
        "v2-control",
        "v2-qtrace",
        "v2-planning-league",
        "v2-value-calibration",
    ]:
        folder = RUNS / name
        metrics = json.loads((folder / "metrics.json").read_text())
        config = json.loads((folder / "config.json").read_text())
        last = metrics[-1]
        games = last.get("cumulative_games", last["iteration"] * config["batch"])
        record = {
            "run": name,
            "config": config,
            "completed_iteration": last["iteration"],
            "games": games,
            "learner_decisions": last["decisions"],
            "latest_checkpoint_sha256": hashlib.sha256(
                (folder / "latest.json").read_bytes()
            ).hexdigest(),
        }
        runs.append(record)
        save(OUT / "training" / f"{name}.json", {**record, "metrics": metrics})
    save(
        OUT / "training-summary.json",
        {
            "scope": "Six main improvement runs; continuation counted once. Excludes original release runs, evaluation games, tiny verification runs, and reused-data distillation epochs.",
            "games": sum(r["games"] for r in runs),
            "learner_decisions": sum(r["learner_decisions"] for r in runs),
            "runs": runs,
        },
    )
    for source, target in [
        ("v2-arena", "development"),
        ("v2-checkpoints", "development"),
        ("v2-selection", "selection"),
    ]:
        for path in sorted((RUNS / source).glob("*.json")):
            if path.name.endswith(".partial.json") or path.name.endswith(
                "-config.json"
            ):
                continue
            report = json.loads(path.read_text())
            if (
                "records" not in report
                or len(report["records"]) != report["config"]["games"]
            ):
                continue
            # Per-game outcomes and timing summaries suffice; retain raw timing locally.
            report.pop("latencySamples", None)
            save(OUT / target / path.name, report)
    print(json.dumps({"games": sum(r["games"] for r in runs), "runs": len(runs)}))


if __name__ == "__main__":
    main()

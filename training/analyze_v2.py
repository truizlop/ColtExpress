"""Stratified confidence intervals and paired comparisons for fixed opponent arenas."""

import argparse
import json
from pathlib import Path

import numpy as np


def bootstrap(records, field, rng, repetitions=20000):
    """Keep each player-count stratum's original size in every resample."""
    samples = np.zeros(repetitions)
    for n in sorted({r["players"] for r in records}):
        values = np.array([r[field] for r in records if r["players"] == n], dtype=float)
        samples += values[rng.integers(0, len(values), (repetitions, len(values)))].sum(
            1
        )
    samples /= len(records)
    return {
        "mean": float(np.mean([r[field] for r in records])),
        "ci95": np.quantile(samples, [0.025, 0.975]).tolist(),
        "games": len(records),
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("results", nargs="+")
    p.add_argument("--reference")
    p.add_argument("--output", required=True)
    args = p.parse_args()
    rng = np.random.default_rng(629173)
    reference = json.loads(Path(args.reference).read_text()) if args.reference else None
    reports = []
    for path in args.results:
        report = json.loads(Path(path).read_text())
        records = report["records"]
        result = {
            "path": path,
            "name": report["config"]["name"],
            "overall": {
                field: bootstrap(records, field, rng)
                for field in ["win", "score", "wasted"]
            },
            "byPlayers": {
                n: bootstrap([r for r in records if r["players"] == n], "win", rng)
                for n in sorted({r["players"] for r in records})
            },
            "latency": report["latency"],
        }
        if (
            reference
            and reference["config"]["opponents"] == report["config"]["opponents"]
            and reference["config"].get("expert", False)
            == report["config"].get("expert", False)
        ):
            previous = {
                (r["seed"], r["players"], r["seat"]): r for r in reference["records"]
            }
            paired = []
            for r in records:
                old = previous.get((r["seed"], r["players"], r["seat"]))
                if old and old["opponents"] == r["opponents"]:
                    paired.append(
                        {"players": r["players"], "delta": r["win"] - old["win"]}
                    )
            if paired:
                result["pairedWinningShareDifference"] = {
                    "reference": args.reference,
                    **bootstrap(paired, "delta", rng),
                }
        reports.append(result)
    output = {
        "method": "20,000 percentile bootstrap resamples, stratified by player count; paired differences only for matching seed/seat/opponent/variant",
        "scope": "Intervals describe this fixed opponent suite; they do not measure human strength or account for development model selection.",
        "reports": reports,
    }
    Path(args.output).write_text(json.dumps(output, indent=2))
    print(json.dumps(output, indent=2))


if __name__ == "__main__":
    main()

"""Partition tournaments into contiguous game ranges while preserving global seeds/seats."""

import argparse
import concurrent.futures
import json
import subprocess
import time
from pathlib import Path


def sequential_sum(values):
    # Match JavaScript's left-to-right addition, rather than Python 3.12 compensated sum.
    total = 0.0
    for value in values:
        total += value
    return total


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("config")
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--jobs", type=int, default=8)
    parser.add_argument("--chunks", type=int, default=16)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    if "gameOffset" not in (root / "training/arena.ts").read_text():
        raise RuntimeError(
            "Arena must support global game offsets before range partitioning."
        )
    master = json.loads(Path(args.config).read_text())
    if master.get("gameOffset", 0) or args.jobs < 1 or args.chunks < 1:
        raise ValueError(
            "Expected a complete tournament and positive worker/chunk counts."
        )
    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)
    chunks = min(args.chunks, master["games"])
    configs = []
    for chunk in range(chunks):
        first = master["games"] * chunk // chunks
        end = master["games"] * (chunk + 1) // chunks
        name = f"{first:04}-{end - 1:04}"
        config = {
            **master,
            "name": master["name"] + "-" + name,
            "gameOffset": first,
            "games": end - first,
            "output": str(out / f"{name}.json"),
        }
        path = out / f"{name}-config.json"
        if path.exists() and json.loads(path.read_text()) != config:
            raise ValueError(f"Existing range configuration differs: {path}")
        path.write_text(json.dumps(config, indent=2))
        configs.append((config, path))

    def run(item):
        config, path = item
        result = Path(config["output"])
        if not result.exists():
            with result.with_suffix(".log").open("w") as log:
                subprocess.run(
                    ["node", "--import", "tsx", "training/arena.ts", str(path)],
                    cwd=root,
                    stdout=log,
                    stderr=log,
                    check=True,
                )
        report = json.loads(result.read_text())
        if report["config"] != config or len(report["records"]) != config["games"]:
            raise ValueError("Incomplete or mismatched range")
        print(json.dumps({"range": config["name"], **report["overall"]}), flush=True)
        return report

    start = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as pool:
        reports = list(pool.map(run, configs))
    provenance = reports[0]["provenance"]
    records, timing = [], []
    counts = master["players"]
    for report in reports:
        if report["provenance"] != provenance:
            raise ValueError("Ranges differ in source, runtime or model hashes")
        for row in report["records"]:
            game = row["game"]
            if (
                row["seed"]
                != (master["seed"] + game * master.get("seedStride", 31337))
                & 0xFFFFFFFF
                or row["players"] != counts[game % len(counts)]
                or row["seat"] != (game // len(counts)) % row["players"]
            ):
                raise ValueError(
                    "Partition changed a prescribed seed, table size or seat"
                )
            records.append(row)
        timing.extend(report["latencySamples"])
    records.sort(key=lambda row: row["game"])
    if [r["game"] for r in records] != list(range(master["games"])):
        raise ValueError("Missing or duplicate games")
    timing.sort()

    def summary(rows):
        def mean(key):
            return sequential_sum(r[key] for r in rows) / len(rows)

        return {
            "games": len(rows),
            "winRate": mean("win"),
            "chance": sequential_sum(1 / r["players"] for r in rows) / len(rows),
            "score": mean("score"),
            "wastedPerGame": mean("wasted"),
            "programmedPerGame": mean("programmed"),
            "drawsPerGame": mean("draws"),
        }

    combined = {
        "config": master,
        "provenance": provenance,
        "seconds": time.time() - start,
        "ranges": [r["config"]["output"] for r in reports],
        "overall": summary(records),
        "byPlayers": {
            n: summary([r for r in records if r["players"] == n]) for n in counts
        },
        "latency": {
            "decisions": len(timing),
            "mean": sequential_sum(timing) / len(timing),
            "p50": timing[int(len(timing) * 0.5)],
            "p95": timing[int(len(timing) * 0.95)],
            "max": max(timing),
        },
        "records": records,
        "latencySamples": timing,
    }
    Path(master["output"]).write_text(json.dumps(combined, indent=2))
    print(json.dumps({"name": master["name"], **combined["overall"]}), flush=True)


if __name__ == "__main__":
    main()

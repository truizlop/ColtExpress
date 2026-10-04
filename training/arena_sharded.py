"""Parallelize a fixed tournament by table size without changing seeds or seats."""

import argparse
import concurrent.futures
import json
import subprocess
import time
from pathlib import Path


def main():
    p = argparse.ArgumentParser()
    p.add_argument("config")
    p.add_argument("--output-dir", required=True)
    p.add_argument("--jobs", type=int, default=4)
    args = p.parse_args()
    root = Path(__file__).resolve().parents[1]
    master = json.loads(Path(args.config).read_text())
    counts = master["players"]
    if len(set(counts)) != len(counts) or master["games"] < len(counts):
        raise ValueError("Invalid table-size partition")
    if len(master["opponents"]) > 1 and master.get("lineup") != "rotating":
        raise ValueError("Multi-opponent sharding requires the rotating lineup")
    out = Path(args.output_dir)
    out.mkdir(parents=True, exist_ok=True)
    configs = []
    stride = master.get("seedStride", 31337)
    for offset, n in enumerate(counts):
        config = {
            **master,
            "name": f"{master['name']}-{n}p",
            "players": [n],
            "seed": (master["seed"] + offset * stride) & 0xFFFFFFFF,
            "seedStride": stride * len(counts),
            "games": (master["games"] - 1 - offset) // len(counts) + 1,
            "output": str(out / f"{n}p.json"),
        }
        path = out / f"{n}p-config.json"
        if path.exists() and json.loads(path.read_text()) != config:
            raise ValueError(f"Existing shard configuration differs: {path}")
        path.write_text(json.dumps(config, indent=2))
        configs.append((offset, config, path))

    def run(item):
        offset, config, path = item
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
            raise ValueError("Incomplete or mismatched shard")
        print(json.dumps({"shard": config["name"], **report["overall"]}), flush=True)
        return offset, report

    start = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as pool:
        reports = sorted(pool.map(run, configs))
    provenance = reports[0][1]["provenance"]
    records, timing = [], []
    for offset, report in reports:
        if report["provenance"] != provenance:
            raise ValueError("Shards differ in source, runtime or model hashes")
        for row in report["records"]:
            game = row["game"] * len(counts) + offset
            if (
                row["seed"] != (master["seed"] + game * stride) & 0xFFFFFFFF
                or row["seat"] != (game // len(counts)) % row["players"]
            ):
                raise ValueError("Shard changed the prescribed seed or seat")
            records.append({**row, "game": game})
        timing.extend(report["latencySamples"])
    records.sort(key=lambda r: r["game"])
    timing.sort()
    if [r["game"] for r in records] != list(range(master["games"])):
        raise ValueError("Missing or duplicate tournament games")

    def summarize(rows):
        mean = lambda key: sum(r[key] for r in rows) / len(rows)
        return {
            "games": len(rows),
            "winRate": mean("win"),
            "chance": sum(1 / r["players"] for r in rows) / len(rows),
            "score": mean("score"),
            "wastedPerGame": mean("wasted"),
            "programmedPerGame": mean("programmed"),
            "drawsPerGame": mean("draws"),
        }

    combined = {
        "config": master,
        "provenance": provenance,
        "seconds": time.time() - start,
        "shards": [report["config"]["output"] for _, report in reports],
        "overall": summarize(records),
        "byPlayers": {
            n: summarize([r for r in records if r["players"] == n]) for n in counts
        },
        "latency": {
            "decisions": len(timing),
            "mean": sum(timing) / len(timing),
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

"""Run the frozen release suites with exact model/source checks and bounded parallelism."""

import argparse
import hashlib
import json
import subprocess
import sys
from pathlib import Path


def source_hash(root):
    files = ["training/arena.ts"] + [
        str(path.relative_to(root))
        for directory in ["src/game", "src/ai"]
        for path in sorted((root / directory).glob("*.ts"))
    ]
    digest = hashlib.sha256()
    for name in files:
        digest.update(name.encode())
        digest.update((root / name).read_bytes())
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--protocol", default="experiments/v2/protocol.json")
    parser.add_argument("--output-dir", default="training/runs/v2-reproduction/results")
    parser.add_argument("--work-dir", default="training/runs/v2-reproduction/ranges")
    parser.add_argument("--jobs", type=int, default=8)
    parser.add_argument("--chunks", type=int, default=16)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    protocol = json.loads(Path(args.protocol).read_text())
    if source_hash(root) != protocol["sourceSha256"]:
        raise RuntimeError(
            "Rules/AI/evaluator differ from the frozen release. Use its recorded Git revision."
        )
    for name, expected in protocol.get("tooling", {}).items():
        if hashlib.sha256((root / name).read_bytes()).hexdigest() != expected:
            raise RuntimeError(
                f"Evaluation tooling differs from the frozen release: {name}"
            )
    for name, expected in protocol["models"].items():
        if hashlib.sha256((root / name).read_bytes()).hexdigest() != expected:
            raise RuntimeError(f"Model differs from the frozen release: {name}")
    out, work = Path(args.output_dir), Path(args.work_dir)
    out.mkdir(parents=True, exist_ok=True)
    work.mkdir(parents=True, exist_ok=True)
    for original in protocol["jobs"]:
        config = {**original, "output": str(out / f"{original['name']}.json")}
        path = work / f"{config['name']}-config.json"
        if path.exists() and json.loads(path.read_text()) != config:
            raise ValueError(f"Existing tournament configuration differs: {path}")
        path.write_text(json.dumps(config, indent=2))
        subprocess.run(
            [
                sys.executable,
                "training/arena_parallel.py",
                str(path),
                "--output-dir",
                str(work / config["name"]),
                "--jobs",
                str(args.jobs),
                "--chunks",
                str(args.chunks),
            ],
            cwd=root,
            check=True,
        )
        report = json.loads(Path(config["output"]).read_text())
        if report["provenance"]["sourceSha256"] != protocol["sourceSha256"]:
            raise ValueError("Cached tournament uses a different source revision")
        if report["provenance"]["models"] != protocol["models"]:
            raise ValueError("Cached tournament uses different model files")
        print(json.dumps({"verified": config["name"], **report["overall"]}), flush=True)


if __name__ == "__main__":
    main()

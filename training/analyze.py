"""Aggregate retained game-level benchmark evidence; do not fit or select a model."""

import json
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "experiments"
rng = np.random.default_rng(20261003)


def load_records(pattern):
    files = sorted((DEST / "results").glob(pattern))
    return [row for f in files for row in json.loads(f.read_text())["records"]]


def summarize(rows):
    if not rows:
        raise RuntimeError("Missing benchmark results")
    groups = [
        np.array([r["win"] for r in rows if r["players"] == n])
        for n in sorted({r["players"] for r in rows})
    ]
    boot = np.zeros(10000)
    for group in groups:
        boot += (
            group[rng.integers(0, len(group), (10000, len(group)))].mean(axis=1)
            * len(group)
            / len(rows)
        )
    return {
        "games": len(rows),
        "win_rate": float(np.mean([r["win"] for r in rows])),
        "stratified_bootstrap_95": np.quantile(boot, [0.025, 0.975]).tolist(),
        "chance": float(np.mean([1 / r["players"] for r in rows])),
        "average_score": float(np.mean([r["score"] for r in rows])),
    }


def main():
    groups = {
        "Greenhorn": load_records("tactical-greenhorn-*.json"),
        "Bandit": load_records("tactical-bandit-final-*.json"),
        "Outlaw": load_records("tactical-outlaw-*.json"),
        "Legend": load_records("tactical-legend-*.json"),
    }
    for name, rows in groups.items():
        if len(rows) != 900:
            raise RuntimeError(f"{name}: expected 900 completed games, got {len(rows)}")
    summary = {
        "difficulties": {name: summarize(rows) for name, rows in groups.items()},
        "legend_by_players": {
            n: summarize([r for r in groups["Legend"] if r["players"] == n])
            for n in range(2, 7)
        },
        "other_opponents": {},
    }
    for name, expected in [
        ("aggressive", 300),
        ("greedy", 300),
        ("previous-model", 300),
    ]:
        rows = load_records(f"opponent-{name}.json")
        if len(rows) != expected:
            raise RuntimeError(f"Missing {name} games")
        summary["other_opponents"][name] = summarize(rows)
    expert = load_records("expert-legend.json")
    if len(expert) != 480:
        raise RuntimeError("Missing expert games")
    summary["expert"] = summarize(expert)
    summary["expert_by_players"] = {
        n: summarize([r for r in expert if r["players"] == n]) for n in range(3, 7)
    }
    outlaw = {r["seed"]: r for r in groups["Outlaw"]}
    paired = [
        {**r, "win": r["win"] - outlaw[r["seed"]]["win"]} for r in groups["Legend"]
    ]
    delta = summarize(paired)
    summary["paired_legend_minus_outlaw"] = {
        "games": len(paired),
        "mean_win_share_difference": delta["win_rate"],
        "stratified_bootstrap_95": delta["stratified_bootstrap_95"],
    }
    (DEST / "summary.json").write_text(json.dumps(summary, indent=2))
    print(json.dumps(summary, indent=2))
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.ticker import PercentFormatter

    plt.rcParams.update(
        {
            "font.family": "DejaVu Sans",
            "font.size": 10,
            "axes.spines.top": False,
            "axes.spines.right": False,
            "svg.fonttype": "none",
        }
    )
    fig, axes = plt.subplots(1, 2, figsize=(10.8, 4.3), layout="constrained")
    colors = ["#b5a080", "#9c7654", "#536f66", "#8c392c"]
    for i, (name, result) in enumerate(summary["difficulties"].items()):
        lo, hi = result["stratified_bootstrap_95"]
        v = result["win_rate"]
        axes[0].bar(i, v, color=colors[i], width=0.58)
        axes[0].errorbar(
            i, v, yerr=[[v - lo], [hi - v]], color="#28251f", capsize=4, fmt="none"
        )
        axes[0].text(i, v + 0.045, f"{v:.1%}", ha="center", fontweight="bold")
    axes[0].set_xticks(range(4), list(groups))
    axes[0].set_ylim(0, 0.68)
    axes[0].yaxis.set_major_formatter(PercentFormatter(1))
    axes[0].axhline(
        0.29,
        color="#887a65",
        linestyle="--",
        linewidth=1,
        label="Equal-strength reference (29%)",
    )
    axes[0].set_title(
        "Difficulty: 900 games per level", loc="left", weight="bold", pad=14
    )
    axes[0].legend(frameon=False, fontsize=8, loc="upper left")
    axes[0].set_ylabel("Winning share vs tactical opponents")
    ns = np.array(list(range(2, 7)))
    rates = np.array([summary["legend_by_players"][int(n)]["win_rate"] for n in ns])
    cis = np.array(
        [summary["legend_by_players"][int(n)]["stratified_bootstrap_95"] for n in ns]
    )
    axes[1].errorbar(
        ns,
        rates,
        yerr=[rates - cis[:, 0], cis[:, 1] - rates],
        color="#8c392c",
        capsize=4,
        fmt="o-",
        linewidth=2,
        label="Legend",
    )
    axes[1].plot(ns, 1 / ns, "--", color="#887a65", label="Equal-strength reference")
    axes[1].set_xticks(ns)
    axes[1].set_ylim(0, 1)
    axes[1].yaxis.set_major_formatter(PercentFormatter(1))
    axes[1].set_xlabel("Players")
    axes[1].set_title(
        "Legend: 180 games per player count", loc="left", weight="bold", pad=14
    )
    axes[1].legend(frameon=False, fontsize=8)
    fig.suptitle(
        "Colt Express · held-out engine tournaments",
        fontsize=15,
        fontweight="bold",
        x=0.025,
        ha="left",
    )
    fig.savefig(DEST / "holdout.png", dpi=180)
    fig.savefig(DEST / "holdout.svg")
    plt.close(fig)


if __name__ == "__main__":
    main()
